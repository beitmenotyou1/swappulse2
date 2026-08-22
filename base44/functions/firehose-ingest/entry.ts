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
// Uses a persisted high-water cursor (IngestCursor entity) per repo+collection
// so already-processed records are skipped on subsequent runs, and backs off
// on 429/5xx from the AppView/PDS instead of failing the whole ingest.
//
// Also runs three AppView-direct passes to catch interactions from non-followed
// Bluesky users: syncInboundReplies (getPostThread), syncInboundInteractions
// (getLikes + getRepostedBy), and syncInboundDms (conversation resolution).
//
// Runs as a service-role function (invoked by the Firehose Ingestion workflow).
// Writes ingested records with created_by_id = null (remote-originated).
//
// Output: { ingested, updated, deleted, errors, collections, repos_scanned,
//   replies_synced, likes_synced, reposts_synced, dms_synced,
//   search_found, search_ingested, records_scanned, records_skipped, rate_limited }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession } from '../../shared/pdsSession.ts';
import { COLLECTIONS, FIELD_MAPPERS } from '../../shared/firehoseMappers.ts';
import { blobRefCid, pullProfileFromPds, constructBskyCdnUrl } from '../../shared/profileSync.ts';
import { getUserIdentity } from '../../shared/userIdentity.ts';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';
import { upsertEntity } from '../../shared/entityDedup.ts';

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
    if (res.status === 429 || res.status >= 500) return null;
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
//
// `excludeEntityId` is the id of the entity just created by the caller (repo-
// scan or syncInboundInteractions). It's excluded from the prior-entity dedup
// check so the self-match doesn't wrongly suppress the counter increment —
// the original bug where the prior check found the entity we just created and
// skipped the increment entirely.
async function maybeNotifyInteraction(base44: any, collection: string, val: any, repoDid: string, commentUri = '', commentCid = '', excludeEntityId = '') {
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
      // this actor + subject, EXCLUDING the entity we just created (which would
      // self-match and wrongly suppress the increment).
      const entityName = collection === 'app.bsky.feed.like' ? 'Like' : 'Repost';
      const prior = await svc.entities[entityName].filter(
        { did: repoDid, post_uri: subjectUri }, '-created_date', 1,
      ).catch(() => []);
      const hasPrior = prior && prior.length > 0 && prior[0].id !== excludeEntityId;
      if (!hasPrior) {
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
    } else if (collection === 'site.standard.graph.recommend') {
      // Remote recommend: find the local entity whose standard_doc_uri matches
      // the recommend's document field, increment its recommend_count, and
      // notify the author.
      const documentUri = val?.document;
      if (!documentUri) return;
      const entityTypes = [
        { name: 'Journal', type: 'journal' },
        { name: 'CardReview', type: 'card_review' },
        { name: 'Binder', type: 'binder' },
      ];
      for (const { name: entityName, type } of entityTypes) {
        const matches = await svc.entities[entityName].filter({ standard_doc_uri: documentUri }, '-created_date', 1).catch(() => []);
        const target = matches?.[0];
        if (target) {
          await svc.entities[entityName].update(target.id, {
            recommend_count: (target.recommend_count || 0) + 1,
          }).catch(() => {});
          if (target.did && target.did !== repoDid) {
            await base44.functions.invoke('notify-interaction', {
              recipientDid: target.did,
              actionType: 'reaction',
              actorDid: repoDid, actorName, actorHandle, actorAvatar,
              target_type: type === 'card_review' ? 'card' : 'post',
              target_label: `${type.replace('_', ' ')} recommended`,
              origin: 'remote',
            }).catch(() => {});
          }
          break;
        }
      }
    }
  } catch (e) {
    console.error('firehose-ingest: maybeNotifyInteraction error', e?.message || e);
  }
}

// Post-centric inbound reply sync. Queries the AppView getPostThread for each
// recent local post, upserts reply posts not yet in the local DB, and fires
// notify-interaction. Idempotent: a reply already present locally is skipped.
// Scans depth 3 and 50 recent posts so nested replies are captured.
async function syncInboundReplies(base44: any, svc: any): Promise<number> {
  let synced = 0;
  try {
    const posts = await svc.entities.Post.list('-created_date', 50).catch(() => []);
    const localPosts = (posts || []).filter((p: any) => p.at_uri);
    const postMapper = FIELD_MAPPERS['app.bsky.feed.post'];
    if (!postMapper) return 0;
    for (const post of localPosts) {
      try {
        const url = new URL(`${APPVIEW}/xrpc/app.bsky.feed.getPostThread`);
        url.searchParams.set('uri', post.at_uri);
        url.searchParams.set('depth', '3');
        url.searchParams.set('parentHeight', '0');
        const res = await fetch(url);
        if (res.status === 429 || res.status >= 500) continue;
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
            const author = rp.author || {};
            const mapped = postMapper(rp.record || {}, rp.uri, author.did || '', author);
            const { created, id: createdId } = await upsertEntity(svc, 'Post', mapped, rp.uri);
            if (created) {
              synced++;
              // Resolve the local parent's id from parent_uri so the reply
              // nests under its immediate parent in the reply tree.
              const parentUri = rp.record?.reply?.parent?.uri || '';
              if (parentUri) {
                const parents = await svc.entities.Post.filter({ at_uri: parentUri }, '-created_date', 1).catch(() => []);
                if (parents?.[0]?.id) {
                  await svc.entities.Post.update(createdId, { reply_to: parents[0].id }).catch(() => {});
                }
              }
              await maybeNotifyInteraction(base44, 'app.bsky.feed.post', rp.record || {}, author.did || '', rp.uri, rp.cid || '', createdId || '');
            }
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

// Inbound likes + reposts sync. The repo-scan only ingests interactions from
// repos the bridge account follows — so a like/repost from a non-followed
// Bluesky user on a local post is never captured. This pass queries the AppView
// getLikes and getRepostedBy endpoints for recent local bridged posts, upserts
// Like entities not yet local (getLikes returns record URIs), and for reposts
// (getRepostedBy returns actors only, no record URI) increments the counter
// and notifies without creating an entity. Idempotent via at_uri dedup.
async function syncInboundInteractions(base44: any, svc: any): Promise<{ likes_synced: number; reposts_synced: number }> {
  let likes_synced = 0, reposts_synced = 0;
  try {
    const posts = await svc.entities.Post.list('-created_date', 25).catch(() => []);
    const localPosts = (posts || []).filter((p: any) => p.at_uri && p.bridged);

    for (const post of localPosts) {
      // --- Likes ---
      try {
        const url = new URL(`${APPVIEW}/xrpc/app.bsky.feed.getLikes`);
        url.searchParams.set('uri', post.at_uri);
        url.searchParams.set('limit', '50');
        const res = await fetch(url);
        if (res.status === 429 || res.status >= 500) continue;
        if (res.ok) {
          const data = await res.json();
          for (const like of (data.likes || [])) {
            const likeUri = like.uri;
            if (!likeUri) continue;
            const existing = await svc.entities.Like.filter({ at_uri: likeUri }, '-created_date', 1).catch(() => []);
            if (existing && existing.length > 0) continue;
            const actor = like.actor || {};
            const mapped = {
              post_id: post.id,
              post_uri: post.at_uri,
              post_cid: post.cid || '',
              did: actor.did || '',
              at_uri: likeUri,
              cid: like.cid || '',
              record_type: 'app.bsky.feed.like',
              bridged: true,
            };
            const created = await svc.entities.Like.create(mapped).catch(() => null);
            if (created) likes_synced++;
            await maybeNotifyInteraction(base44, 'app.bsky.feed.like', { subject: { uri: post.at_uri } }, actor.did || '', '', '', created?.id || '');
          }
        }
      } catch (e) {
        console.error('firehose-ingest: getLikes error for', post.at_uri, e?.message || e);
      }

      // --- Reposts ---
      try {
        const url = new URL(`${APPVIEW}/xrpc/app.bsky.feed.getRepostedBy`);
        url.searchParams.set('uri', post.at_uri);
        url.searchParams.set('limit', '50');
        const res = await fetch(url);
        if (res.status === 429 || res.status >= 500) continue;
        if (res.ok) {
          const data = await res.json();
          for (const actor of (data.repostedBy || [])) {
            if (!actor?.did) continue;
            // getRepostedBy returns actors, not repost record URIs — check by
            // actor + post_uri and only increment/notify if not already local.
            const existing = await svc.entities.Repost.filter({ did: actor.did, post_uri: post.at_uri }, '-created_date', 1).catch(() => []);
            if (existing && existing.length > 0) continue;
            reposts_synced++;
            await maybeNotifyInteraction(base44, 'app.bsky.feed.repost', { subject: { uri: post.at_uri } }, actor.did, '', '', '');
          }
        }
      } catch (e) {
        console.error('firehose-ingest: getRepostedBy error for', post.at_uri, e?.message || e);
      }
    }
  } catch (e) {
    console.error('firehose-ingest: syncInboundInteractions error', e?.message || e);
  }
  return { likes_synced, reposts_synced };
}

// Inbound DM conversation resolution. When a remote SwapPulse instance sends a
// direct message, firehose-ingest creates a DirectMessage entity with
// conversation_id = '' (the mapper can't know the local conversation id). This
// pass resolves each unlinked DM to its local Conversation by matching
// conversation_ref → Conversation.at_uri, or by matching the participant pair
// (dm.did + dm.recipient_did). It sets conversation_id, marks the DM unread,
// updates the Conversation's last-message metadata, and notifies the recipient.
async function syncInboundDms(base44: any, svc: any): Promise<number> {
  let synced = 0;
  try {
    const allDms = await svc.entities.DirectMessage.list('-created_date', 100).catch(() => []);
    const unlinked = (allDms || []).filter((d: any) => !d.conversation_id && d.conversation_ref);

    for (const dm of unlinked) {
      try {
        let conversation: any = null;

        // 1. Match by conversation_ref → Conversation.at_uri
        if (dm.conversation_ref) {
          const byRef = await svc.entities.Conversation.filter(
            { at_uri: dm.conversation_ref }, '-created_date', 1,
          ).catch(() => []);
          conversation = byRef?.[0] || null;
        }

        // 2. Match by participant pair (dm.did + dm.recipient_did, both directions)
        if (!conversation && dm.did && dm.recipient_did) {
          const asCreator = await svc.entities.Conversation.filter(
            { did: dm.did, recipient_did: dm.recipient_did }, '-created_date', 1,
          ).catch(() => []);
          conversation = asCreator?.[0] || null;
          if (!conversation) {
            const asRecipient = await svc.entities.Conversation.filter(
              { did: dm.recipient_did, recipient_did: dm.did }, '-created_date', 1,
            ).catch(() => []);
            conversation = asRecipient?.[0] || null;
          }
        }

        if (!conversation) continue;

        // Link the DM to the conversation and mark unread
        await svc.entities.DirectMessage.update(dm.id, {
          conversation_id: conversation.id,
          read: false,
        }).catch(() => {});

        // Update conversation metadata (masked preview for encrypted bodies)
        const isEncrypted = !dm.body || dm.body.startsWith('\u{1F512}') || dm.body.length > 200;
        const preview = isEncrypted ? '\u{1F512} Encrypted message' : (dm.body || '').slice(0, 200);
        await svc.entities.Conversation.update(conversation.id, {
          last_message_at: dm.created_date || new Date().toISOString(),
          last_message_preview: preview,
          last_message_did: dm.did,
        }).catch(() => {});

        // Notify the recipient (never leak plaintext)
        if (dm.recipient_did && dm.recipient_did !== dm.did) {
          await base44.functions.invoke('notify-interaction', {
            recipientDid: dm.recipient_did,
            actionType: 'message',
            actorDid: dm.did,
            actorName: dm.author_name || '',
            actorHandle: dm.author_handle || '',
            actorAvatar: dm.author_avatar || '',
            post: { id: conversation.id, at_uri: conversation.at_uri, cid: conversation.cid, content: preview },
            postUri: conversation.at_uri,
            origin: 'remote',
            commentText: preview,
          }).catch(() => {});
        }
        synced++;
      } catch (e) {
        console.error('firehose-ingest: DM resolution error', e?.message || e);
      }
    }
  } catch (e) {
    console.error('firehose-ingest: syncInboundDms error', e?.message || e);
  }
  return synced;
}

// Inbound profile sync (two-way identity). For each migrated user, reads their
// app.bsky.actor.profile record directly from the PDS via getRecord (the
// authoritative source with zero indexing lag) and merges changed fields
// (displayName, description, avatar, banner→header) into the local User
// record. Blob refs are converted to displayable cdn.bsky.app URLs. Gated by
// profile_synced_at vs updated_date (last-write-wins) so a remote edit never
// clobbers a newer local edit. The 10-minute AppView grace period is no
// longer needed since the PDS read is authoritative — the echo loop is
// structurally impossible because inbound and outbound compare against the
// same PDS record.
async function syncInboundProfiles(base44: any, svc: any): Promise<number> {
  let synced = 0;
  try {
    const usersWithDid = await svc.entities.User
      .filter({ migrated_from_bluesky: true }, '-created_date', 100).catch(() => []);
    for (const user of usersWithDid || []) {
      try {
        if (!user.did) continue;

        // Resolve per-user PDS identity + session for a direct PDS read.
        const identity = await getUserIdentity(svc, user);
        if (!identity) continue;
        let session: any;
        try {
          session = (await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword)).session;
        } catch (e) {
          console.error('firehose-ingest: PDS session failed for profile sync', user.did, e?.message || e);
          continue;
        }

        // Read the profile record directly from the PDS (authoritative, zero lag).
        const { ok, profile } = await pullProfileFromPds(identity.pdsUrl, session.accessJwt, identity.did);
        if (!ok || !profile) continue;

        // Conflict guard: if the local profile was edited after the last
        // outbound sync, local is authoritative — skip the remote merge.
        // If the outbound sync has failed 3+ times consecutively, bypass
        // the guard so remote wins (prevents a dead outbound sync from
        // permanently blocking inbound). The 10-minute AppView grace period
        // is removed — the PDS read is lag-free.
        // Last-write-wins conflict guard. Falls back to migrated_at when
        // profile_synced_at is empty (first sync or after a reset) so a local
        // edit made after migration is never overwritten by a stale remote
        // PDS description. After 3 consecutive outbound failures, bypass the
        // guard so remote edits can still merge (prevents a dead outbound
        // sync from permanently blocking inbound).
        const lastSync = user.profile_synced_at || user.migrated_at || '';
        const localUpdated = user.updated_date || '';
        const failCount = user.profile_sync_fail_count || 0;
        if (lastSync && localUpdated > lastSync && failCount < 3) continue;

        const updates: any = {};
        // Text fields: merge from remote if different.
        if (profile.displayName && profile.displayName !== user.display_name) {
          updates.display_name = profile.displayName;
        }
        if ((profile.description || '') !== (user.description || '')) {
          updates.description = profile.description || '';
        }
        // Avatar: compare the PDS record's blob cid against the stored blob
        // ref cid. If they match, it's our own outbound push (echo) — skip.
        // If they differ, the user changed their avatar on Bluesky — merge
        // the new cdn.bsky.app URL and clear the stored ref.
        if (profile.avatar) {
          const remoteCid = blobRefCid(profile.avatar);
          const storedCid = blobRefCid(user.avatar_pds_ref);
          if (remoteCid && (!storedCid || remoteCid !== storedCid)) {
            const url = constructBskyCdnUrl('avatar', identity.did, profile.avatar);
            if (url && url !== user.avatar) {
              updates.avatar = url;
              updates.avatar_pds_ref = '';
              updates.avatar_source_url = '';
            }
          }
        } else if (user.avatar) {
          // Avatar was removed on Bluesky.
          updates.avatar = '';
          updates.avatar_pds_ref = '';
          updates.avatar_source_url = '';
        }
        // Banner: same logic as avatar.
        if (profile.banner) {
          const remoteCid = blobRefCid(profile.banner);
          const storedCid = blobRefCid(user.header_pds_ref);
          if (remoteCid && (!storedCid || remoteCid !== storedCid)) {
            const url = constructBskyCdnUrl('banner', identity.did, profile.banner);
            if (url && url !== user.header) {
              updates.header = url;
              updates.header_pds_ref = '';
              updates.header_source_url = '';
            }
          }
        } else if (user.header) {
          updates.header = '';
          updates.header_pds_ref = '';
          updates.header_source_url = '';
        }
        if (Object.keys(updates).length === 0) continue;
        updates.profile_synced_at = new Date().toISOString();
        await svc.entities.User.update(user.id, updates).catch((e: any) => {
          console.error('firehose-ingest: user profile update failed', user.did, e?.message || e);
        });
        synced++;
      } catch (e) {
        console.error('firehose-ingest: profile sync record error', e?.message || e);
      }
    }
  } catch (e) {
    console.error('firehose-ingest: syncInboundProfiles error', e?.message || e);
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

    const url = new URL(`${pdsUrl}/xrpc/app.bsky.feed.searchPosts`);
    url.searchParams.set('q', 'PokemonTCG');
    url.searchParams.set('limit', '50');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessJwt}` } });
    if (res.status === 429 || res.status >= 500) {
      console.error(`firehose-ingest: searchPosts rate-limited (${res.status})`);
      return { found, ingested };
    }
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
        if (promoUris.has(post.uri)) continue;
        const author = post.author || {};
        const record = post.record || {};
        if (record.reply) continue;

        const mapped = postMapper(record, post.uri, author.did || '', author);
        const { created } = await upsertEntity(svc, 'Post', mapped, post.uri);
        if (created) ingested++;
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

// List all records for a repo+collection with pagination. Returns null on
// 429/5xx so the caller can skip that repo+collection without failing the run.
async function listRecords(baseUrl: string, repoDid: string, collection: string, accessJwt?: string): Promise<any[] | null> {
  const all: any[] = [];
  let cursor: string | null = null;
  do {
    const url = new URL(`${baseUrl}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set('repo', repoDid);
    url.searchParams.set('collection', collection);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { headers: accessJwt ? { Authorization: `Bearer ${accessJwt}` } : {} });
    if (res.status === 429 || res.status >= 500) {
      console.error(`firehose-ingest: listRecords rate-limited/error (${res.status}) for ${repoDid} ${collection}`);
      return null;
    }
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
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
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

    // Migrated users have their own did:plc + PdsCredential. Their repos are
    // the source of truth for their posts/likes/reposts after migration, so
    // they must be scanned for two-way sync (creates, edits, deletes). The
    // local bridge repo alone would miss them.
    const migratedUsers = await svc.entities.User
      .filter({ migrated_from_bluesky: true }, '-created_date', 100).catch(() => []);
    const migratedDids = new Set<string>();
    const migratedUserMap = new Map<string, any>();
    for (const mu of (migratedUsers || [])) {
      if (mu.did && mu.did !== localDid) {
        remoteDids.add(mu.did);
        migratedDids.add(mu.did);
        migratedUserMap.set(mu.did, mu);
      }
    }

    const reposToScan = [localDid, ...remoteDids];

    let ingested = 0, updated = 0, deleted = 0, errors = 0;
    let records_scanned = 0, records_skipped = 0, rate_limited = 0;
    const collectionStats: Record<string, number> = {};

    for (const [collection, entityName] of Object.entries(COLLECTIONS)) {
      const mapper = FIELD_MAPPERS[collection];
      if (!mapper) continue;
      collectionStats[collection] = 0;

      for (const repoDid of reposToScan) {
        try {
          const isLocal = repoDid === localDid;
          let listUrl = isLocal ? pdsUrl : APPVIEW;
          let listJwt = isLocal ? accessJwt : undefined;

          // For migrated users, prefer the per-user PDS session (authoritative,
          // zero indexing lag) over the eventually-consistent AppView. Fall
          // back to the AppView if the per-user session can't be resolved.
          if (!isLocal && migratedDids.has(repoDid)) {
            const mUser = migratedUserMap.get(repoDid);
            if (mUser) {
              const identity = await getUserIdentity(svc, mUser);
              if (identity) {
                try {
                  const mSession = (await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword)).session;
                  listUrl = identity.pdsUrl;
                  listJwt = mSession.accessJwt;
                } catch (e) {
                  console.error(`firehose-ingest: per-user session failed for ${repoDid}, falling back to AppView`, e?.message || e);
                }
              }
            }
          }

          const records = await listRecords(listUrl, repoDid, collection, listJwt);
          if (!records) {
            rate_limited++;
            continue;
          }
          records_scanned += records.length;
          const pdsUriSet = new Set(records.map((r: any) => r.uri));

          // Read the high-water cursor for this repo+collection
          const cursorDocs = await svc.entities.IngestCursor.filter(
            { repo_did: repoDid, collection }, '-created_date', 1,
          ).catch(() => []);
          const cursor = cursorDocs?.[0]?.last_rkey || '';
          const cursorId = cursorDocs?.[0]?.id || '';
          let maxRkey = cursor;

          // Resolve the remote actor's profile once per repo for post records
          const profile = !isLocal && collection === 'app.bsky.feed.post'
            ? await getProfile(repoDid) : undefined;

          for (const rec of records) {
            try {
              const atUri = rec.uri || '';
              const val = rec.value || {};
              if (!atUri) continue;

              // Skip promotional posts
              if (promoUris.has(atUri)) continue;

              // High-water cursor: skip records already processed in a prior run.
              // For post records on migrated-user repos (and the local repo),
              // don't skip past-cursor records — compare CIDs to detect edits
              // made on Bluesky and update the local record. This closes the
              // inbound half of two-way post edit sync.
              const rkey = atUri.split('/').pop() || '';
              const isMigratedRepo = migratedDids.has(repoDid) || isLocal;
              const isPostCollection = collection === 'app.bsky.feed.post';
              if (cursor && rkey && rkey <= cursor) {
                if (isMigratedRepo && isPostCollection && rec.cid) {
                  try {
                    const existing = await svc.entities[entityName].filter({ at_uri: atUri }, '-created_date', 1).catch(() => []);
                    if (existing && existing.length > 0 && rec.cid !== existing[0].cid) {
                      const mappedEdit = mapper(val, atUri, repoDid, profile);
                      await svc.entities[entityName].update(existing[0].id, mappedEdit).catch(() => {});
                      updated++;
                    }
                  } catch (e) {
                    console.error(`firehose-ingest: edit-detect error for ${collection} ${repoDid}`, e?.message || e);
                  }
                }
                records_skipped++;
                continue;
              }
              if (rkey > maxRkey) maxRkey = rkey;

              // Skip records already local (authored by the local PDS account)
              if (isLocal) {
                const existing = await svc.entities[entityName].filter({ at_uri: atUri }, '-created_date', 1).catch(() => []);
                if (existing && existing.length > 0) continue;
              }

              const mapped = mapper(val, atUri, repoDid, profile);
              const { created: isNew, id: createdId } = await upsertEntity(svc, entityName, mapped, atUri);
              if (isNew) ingested++; else updated++;
              collectionStats[collection]++;
              if (isNew && !isLocal) {
                await maybeNotifyInteraction(base44, collection, val, repoDid, atUri, rec.cid || '', createdId || '');
              }
            } catch (e) {
              errors++;
              console.error(`firehose-ingest: record error for ${collection}`, e?.message || e);
            }
          }

          // Advance the high-water cursor for this repo+collection
          if (maxRkey > cursor) {
            const now = new Date().toISOString();
            if (cursorId) {
              await svc.entities.IngestCursor.update(cursorId, { last_rkey: maxRkey, last_run_at: now }).catch(() => {});
            } else {
              await svc.entities.IngestCursor.create({ repo_did: repoDid, collection, last_rkey: maxRkey, last_run_at: now }).catch(() => {});
            }
          }

          // Delete detection: local bridged records authored by this repo whose
          // at_uri is gone from the PDS are tombstoned locally.
          try {
            const localByDid = await svc.entities[entityName]
              .filter({ did: repoDid, bridged: true }, '-created_date', 500).catch(() => []);
            // Safety guard: if the PDS/AppView returned fewer records than we
            // have locally, the fetch may be incomplete (rate limiting, indexing
            // lag, or pagination issues). Skip deletion for this cycle to avoid
            // wiping valid records — they'll be re-checked next cycle.
            if (pdsUriSet.size > 0 && pdsUriSet.size < (localByDid || []).length) {
              console.log(`firehose-ingest: skipping delete-detect for ${collection} ${repoDid} — PDS ${pdsUriSet.size} < local ${(localByDid || []).length}`);
              continue;
            }
            for (const local of localByDid || []) {
              if (!local.at_uri) continue;
              if (!pdsUriSet.has(local.at_uri)) {
                // Decrement the parent post's counter when a remote like/repost
                // is tombstoned, so counts stay accurate over time.
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
                // reply is tombstoned.
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
                // Decrement the recommend_count on the target entity when a
                // remote recommend is tombstoned.
                if (entityName === 'StandardRecommend' && local.document_uri) {
                  const targetEntityTypes = ['Journal', 'CardReview', 'Binder'];
                  for (const targetName of targetEntityTypes) {
                    const matches = await svc.entities[targetName]
                      .filter({ standard_doc_uri: local.document_uri }, '-created_date', 1).catch(() => []);
                    const target = matches?.[0];
                    if (target) {
                      const current = target.recommend_count || 0;
                      if (current > 0) {
                        await svc.entities[targetName].update(target.id, { recommend_count: current - 1 }).catch(() => {});
                      }
                      break;
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

    // Catch replies from Bluesky users the bridge account doesn't follow
    const replies_synced = await syncInboundReplies(base44, svc);

    // Catch likes/reposts from non-followed Bluesky users
    const { likes_synced, reposts_synced } = await syncInboundInteractions(base44, svc);

    // Resolve ingested DMs to their local conversations
    const dms_synced = await syncInboundDms(base44, svc);

    // Two-way identity: pull remote Bluesky profile edits back into local users
    const profiles_synced = await syncInboundProfiles(base44, svc);

    // Broad ingestion: search the public AppView for PokemonTCG posts
    const searchResult = await searchAppViewPosts(base44, svc, pdsUrl, accessJwt, promoUris);

    return Response.json({
      ingested, updated, deleted, errors,
      collections: collectionStats,
      repos_scanned: reposToScan.length,
      replies_synced,
      likes_synced,
      reposts_synced,
      dms_synced,
      profiles_synced,
      search_found: searchResult.found,
      search_ingested: searchResult.ingested,
      records_scanned,
      records_skipped,
      rate_limited,
    });
  } catch (error) {
    console.error('firehose-ingest error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}