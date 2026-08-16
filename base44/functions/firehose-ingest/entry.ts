// firehose-ingest — polls the AT Protocol PDS/AppView for SwapPulse custom-
// lexicon records and ingests remote creates/updates/deletes into the local DB
// (scheduled polling within serverless constraints; a true persistent
// WebSocket firehose would need external hosting).
//
// For each SwapPulse collection, lists records from the shared PDS repo AND
// from remote DIDs discovered via Follow records. New/updated records are
// upserted into the local DB by at_uri. Records that exist locally but are gone
// from the PDS (per repo) are deleted — true bidirectional delete sync.
//
// Runs as a service-role function (invoked by the Firehose Ingestion workflow).
// Writes ingested records with created_by_id = null (remote-originated).
//
// Output: { ingested, updated, deleted, errors, collections }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession } from '../../shared/pdsSession.ts';
import { COLLECTIONS, FIELD_MAPPERS } from '../../shared/firehoseMappers.ts';

const APPVIEW = 'https://public.api.bsky.app';

// Resolve a remote actor's profile (displayName, handle, avatar) from the
// AppView once per repo DID, so inbound posts carry author metadata for
// rendering. Cached for the duration of the ingest run.
const profileCache = new Map<string, any>();
async function getProfile(repoDid: string): Promise<any> {
  if (profileCache.has(repoDid)) return profileCache.get(repoDid);
  let profile: any = null;
  try {
    const url = new URL(`${APPVIEW}/xrpc/app.bsky.actor.getProfile`);
    url.searchParams.set('actor', repoDid);
    const res = await fetch(url);
    if (res.ok) profile = await res.json();
  } catch (e) {
    console.error(`firehose-ingest: getProfile failed for ${repoDid}`, e?.message || e);
  }
  profileCache.set(repoDid, profile);
  return profile;
}

// For an inbound interaction (like/repost/reply) on a local post, increment
// the post's counter and notify the author via notify-interaction with a
// 'remote' origin so the notification carries a "via Bluesky" badge. Only
// called for newly-ingested records from remote repos.
async function maybeNotifyInteraction(base44, collection, val, repoDid, commentUri = '', commentCid = '') {
  try {
    const profile = await getProfile(repoDid);
    const actorName = profile?.displayName || '';
    const actorHandle = profile?.handle || '';
    const actorAvatar = profile?.avatar || '';
    const svc = base44.asServiceRole;

    if (collection === 'app.bsky.feed.like' || collection === 'app.bsky.feed.repost') {
      const subjectUri = val?.subject?.uri;
      if (!subjectUri) return;
      const posts = await svc.entities.Post.filter({ at_uri: subjectUri }, '-created_date', 1).catch(() => []);
      const post = posts?.[0];
      if (!post) return;
      // Idempotent: only increment if no prior Like/Repost entity exists for
      // this actor + subject (the notification-inbox path may have already
      // incremented it). The record itself is deduped by at_uri before this
      // point, but the counter increment is a separate concern.
      const entityName = collection === 'app.bsky.feed.like' ? 'Like' : 'Repost';
      const prior = await svc.entities[entityName].filter(
        { did: repoDid, post_uri: subjectUri }, '-created_date', 1,
      ).catch(() => []);
      if (!prior || prior.length === 0) {
        const field = collection === 'app.bsky.feed.like' ? 'likes' : 'reposts';
        await svc.entities.Post.update(post.id, { [field]: (post[field] || 0) + 1 }).catch(() => {});
      }
      if (post.did && post.did !== repoDid) {
        await base44.functions.invoke('notify-interaction', {
          recipientDid: post.did,
          actionType: collection === 'app.bsky.feed.like' ? 'like' : 'repost',
          actorDid: repoDid, actorName, actorHandle, actorAvatar,
          post: { id: post.id, at_uri: post.at_uri, cid: post.cid, content: post.content },
          postUri: subjectUri,
          origin: 'remote',
        }).catch(() => {});
      }
    } else if (collection === 'app.bsky.feed.post') {
      const parentUri = val?.reply?.parent?.uri;
      if (!parentUri) return;
      const posts = await svc.entities.Post.filter({ at_uri: parentUri }, '-created_date', 1).catch(() => []);
      const parent = posts?.[0];
      if (!parent) return;
      await svc.entities.Post.update(parent.id, { replies: (parent.replies || 0) + 1 }).catch(() => {});
      if (parent.did && parent.did !== repoDid) {
        await base44.functions.invoke('notify-interaction', {
          recipientDid: parent.did,
          actionType: 'comment',
          actorDid: repoDid, actorName, actorHandle, actorAvatar,
          post: { id: parent.id, at_uri: parent.at_uri, cid: parent.cid, content: parent.content },
          postUri: parentUri,
          origin: 'remote',
          commentText: (val?.text || '').slice(0, 200),
          commentUri,
          commentCid,
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.error('firehose-ingest: maybeNotifyInteraction error', e?.message || e);
  }
}

// Post-centric inbound reply sync. The repo-scan loop above only ingests
// records authored by repos the bridge account follows — so a reply from a
// non-followed Bluesky user on a local post is never ingested and the author
// never gets notified. This pass queries the AppView directly for replies on
// each recent local post (getPostThread), upserts any reply posts not yet in
// the local DB, and fires the same notify-interaction path. Idempotent: a
// reply already present locally (from a prior run or the repo-scan) is skipped.
async function syncInboundReplies(base44: any, svc: any): Promise<number> {
  let synced = 0;
  try {
    const posts = await svc.entities.Post.list('-created_date', 25).catch(() => []);
    const localPosts = (posts || []).filter((p: any) => p.at_uri);
    const postMapper = FIELD_MAPPERS['app.bsky.feed.post'];
    if (!postMapper) return 0;
    for (const post of localPosts) {
      try {
        const url = new URL(`${APPVIEW}/xrpc/app.bsky.feed.getPostThread`);
        url.searchParams.set('uri', post.at_uri);
        url.searchParams.set('depth', '1');
        url.searchParams.set('parentHeight', '0');
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const thread = data?.thread;
        if (!thread || thread.$type !== 'app.bsky.feed.defs#threadViewPost') continue;
        const replies = thread.replies || [];
        for (const replyNode of replies) {
          try {
            if (replyNode?.$type !== 'app.bsky.feed.defs#threadViewPost') continue;
            const rp = replyNode.post;
            if (!rp?.uri) continue;
            const existing = await svc.entities.Post.filter({ at_uri: rp.uri }, '-created_date', 1).catch(() => []);
            if (existing && existing.length > 0) continue;
            const author = rp.author || {};
            const mapped = postMapper(rp.record || {}, rp.uri, author.did || '', author);
            await svc.entities.Post.create(mapped).catch(() => {});
            synced++;
            await maybeNotifyInteraction(base44, 'app.bsky.feed.post', rp.record || {}, author.did || '', rp.uri, rp.cid || '');
          } catch (e) {
            console.error('firehose-ingest: reply sync error', e?.message || e);
          }
        }
      } catch (e) {
        console.error('firehose-ingest: getPostThread error for', post.at_uri, e?.message || e);
      }
    }
  } catch (e) {
    console.error('firehose-ingest: syncInboundReplies error', e?.message || e);
  }
  return synced;
}

// AppView search phase: poll public.api.bsky.app for posts matching
// SwapPulse-relevant signals (PokemonTCG keyword) so content from non-followed
// Bluesky accounts is ingested into the local feed. Rate-limited to 1 search
// query per run (limit=50). Dedup by at_uri before upserting. Author metadata
// comes directly from the searchPosts response (author.displayName/handle/avatar).
async function searchAppViewPosts(base44: any, svc: any, pdsUrl: string, accessJwt: string, promoUris: Set<string>): Promise<{ found: number; ingested: number }> {
  let found = 0, ingested = 0;
  try {
    const postMapper = FIELD_MAPPERS['app.bsky.feed.post'];
    if (!postMapper) return { found, ingested };

    // searchPosts requires authentication — route through the PDS (which
    // proxies to the AppView) using the bridge account's access JWT.
    const url = new URL(`${pdsUrl}/xrpc/app.bsky.feed.searchPosts`);
    url.searchParams.set('q', 'PokemonTCG');
    url.searchParams.set('limit', '50');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessJwt}` } });
    if (!res.ok) {
      console.error(`firehose-ingest: searchPosts failed (${res.status})`);
      return { found, ingested };
    }
    const data = await res.json();
    const posts = data?.posts || [];
    found = posts.length;
    console.log(`firehose-ingest: AppView search found ${found} posts for query "PokemonTCG"`);

    for (const post of posts) {
      try {
        if (!post?.uri) continue;
        // Skip promotional posts — they must not appear in the local feed.
        if (promoUris.has(post.uri)) continue;
        // Dedup: skip if already exists locally by at_uri
        const existing = await svc.entities.Post.filter({ at_uri: post.uri }, '-created_date', 1).catch(() => []);
        if (existing && existing.length > 0) continue;

        const author = post.author || {};
        const record = post.record || {};
        if (record.reply) continue; // skip replies — only ingest top-level posts

        // searchPosts already includes author displayName/handle/avatar, so
        // pass it directly as the profile argument to mapPostFields.
        const mapped = postMapper(record, post.uri, author.did || '', author);
        await svc.entities.Post.create(mapped).catch(() => {});
        ingested++;
      } catch (e) {
        console.error('firehose-ingest: searchPosts record error', e?.message || e);
      }
    }
    console.log(`firehose-ingest: AppView search ingested ${ingested}/${found} posts`);
  } catch (e) {
    console.error('firehose-ingest: searchAppViewPosts error', e?.message || e);
  }
  return { found, ingested };
}

async function listRecords(baseUrl: string, repoDid: string, collection: string, accessJwt?: string) {
  const all: any[] = [];
  let cursor: string | null = null;
  do {
    const url = new URL(`${baseUrl}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set('repo', repoDid);
    url.searchParams.set('collection', collection);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { headers: accessJwt ? { Authorization: `Bearer ${accessJwt}` } : {} });
    if (!res.ok) return all;
    const data = await res.json();
    all.push(...(data.records || []));
    cursor = data.cursor || null;
  } while (cursor);
  return all;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const { pdsUrl, session } = await getPdsSession();
    const localDid = session.did;
    const accessJwt = session.accessJwt;

    // Load promo post URIs so externally-published promotional posts are never
    // ingested into the local feed (they exist on the PDS only).
    const promoPosts = await svc.entities.PromoPost.list('-created_date', 500).catch(() => []);
    const promoUris = new Set((promoPosts || []).map((p: any) => p.at_uri).filter(Boolean));

    // Discover remote DIDs to ingest from (via Follow records)
    const follows = await svc.entities.Follow.list('-created_date', 200).catch(() => []);
    const remoteDids = new Set<string>();
    for (const f of follows) {
      if (f.subject_did && f.subject_did !== localDid) remoteDids.add(f.subject_did);
    }

    const reposToScan = [localDid, ...remoteDids];

    let ingested = 0, updated = 0, deleted = 0, errors = 0;
    const collectionStats: Record<string, number> = {};

    for (const [collection, entityName] of Object.entries(COLLECTIONS)) {
      const mapper = FIELD_MAPPERS[collection];
      if (!mapper) continue;
      collectionStats[collection] = 0;

      for (const repoDid of reposToScan) {
        try {
          const isLocal = repoDid === localDid;
          const listUrl = isLocal ? pdsUrl : APPVIEW;
          const records = await listRecords(listUrl, repoDid, collection, isLocal ? accessJwt : undefined);
          const pdsUriSet = new Set(records.map((r: any) => r.uri));

          // Resolve the remote actor's profile once per repo for post records
          // so inbound posts carry author_name/handle/avatar for rendering.
          const profile = !isLocal && collection === 'app.bsky.feed.post'
            ? await getProfile(repoDid) : undefined;

          for (const rec of records) {
            try {
              const atUri = rec.uri || '';
              const val = rec.value || {};
              if (!atUri) continue;

              // Skip promotional posts — they're published to the PDS only and
              // must not appear in the local SwapPulse feed.
              if (promoUris.has(atUri)) continue;

              // Skip records already local (authored by the local PDS account)
              if (isLocal) {
                const existing = await svc.entities[entityName].filter({ at_uri: atUri }, '-created_date', 1).catch(() => []);
                if (existing && existing.length > 0) continue;
              }

              const mapped = mapper(val, atUri, repoDid, profile);
              const existing = await svc.entities[entityName].filter({ at_uri: atUri }, '-created_date', 1).catch(() => []);
              let isNew = false;
              if (existing && existing.length > 0) {
                await svc.entities[entityName].update(existing[0].id, mapped).catch(() => {});
                updated++;
              } else {
                await svc.entities[entityName].create(mapped).catch(() => {});
                ingested++;
                isNew = true;
              }
              collectionStats[collection]++;
              if (isNew && !isLocal) {
                await maybeNotifyInteraction(base44, collection, val, repoDid, atUri, rec.cid || '');
              }
            } catch (e) {
              errors++;
              console.error(`firehose-ingest: record error for ${collection}`, e?.message || e);
            }
          }

          // Delete detection: local bridged records authored by this repo whose
          // at_uri is gone from the PDS are tombstoned locally.
          try {
            const localByDid = await svc.entities[entityName]
              .filter({ did: repoDid, bridged: true }, '-created_date', 200).catch(() => []);
            for (const local of localByDid || []) {
              if (!local.at_uri) continue;
              if (!pdsUriSet.has(local.at_uri)) {
                // Decrement the parent post's counter when a remote like/repost
                // is tombstoned, so counts stay accurate over time. Idempotent:
                // the record is deleted here, so a redelivered delete won't
                // re-match. Guards against double-decrement below 0.
                if (entityName === 'Like' || entityName === 'Repost') {
                  const subjectUri = local.post_uri;
                  if (subjectUri) {
                    const posts = await svc.entities.Post.filter({ at_uri: subjectUri }, '-created_date', 1).catch(() => []);
                    const post = posts?.[0];
                    if (post) {
                      const field = entityName === 'Like' ? 'likes' : 'reposts';
                      const current = post[field] || 0;
                      if (current > 0) {
                        await svc.entities.Post.update(post.id, { [field]: current - 1 }).catch(() => {});
                      }
                    }
                  }
                }
                // Decrement the parent post's replies counter when a remote
                // reply is tombstoned, so counts stay accurate over time.
                if (entityName === 'Post' && local.parent_uri) {
                  const parents = await svc.entities.Post.filter({ at_uri: local.parent_uri }, '-created_date', 1).catch(() => []);
                  const parent = parents?.[0];
                  if (parent) {
                    const current = parent.replies || 0;
                    if (current > 0) {
                      await svc.entities.Post.update(parent.id, { replies: current - 1 }).catch(() => {});
                    }
                  }
                }
                await svc.entities[entityName].delete(local.id).catch(() => {});
                deleted++;
              }
            }
          } catch (e) {
            console.error(`firehose-ingest: delete-detect error for ${collection} ${repoDid}`, e?.message || e);
          }
        } catch (e) {
          errors++;
          console.error(`firehose-ingest: repo scan error for ${collection} ${repoDid}`, e?.message || e);
        }
      }
    }

    // Catch replies from Bluesky users the bridge account doesn't follow —
    // the repo-scan above can't see them, so query the AppView per local post.
    const replies_synced = await syncInboundReplies(base44, svc);

    // Broad ingestion: search the public AppView for PokemonTCG posts from
    // non-followed Bluesky accounts so the home feed has content even when
    // the follow graph is sparse.
    const searchResult = await searchAppViewPosts(base44, svc, pdsUrl, accessJwt, promoUris);

    return Response.json({
      ingested, updated, deleted, errors,
      collections: collectionStats,
      repos_scanned: reposToScan.length,
      replies_synced,
      search_found: searchResult.found,
      search_ingested: searchResult.ingested,
    });
  } catch (error) {
    console.error('firehose-ingest error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}