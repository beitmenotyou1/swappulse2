// backfill-author-posts — resumable all-time post backfill for a migrated user.
// Pages through the user's PDS repo (com.atproto.repo.listRecords on
// app.bsky.feed.post) and upserts each post into the local Post entity (deduped
// by at_uri, marked bridged) so the user's full Bluesky history renders on
// SwapPulse after linking.
//
// Stores a cursor on the user (post_backfill_cursor) so large histories can be
// backfilled across multiple calls within function timeouts. Called by
// migrate-to-swappulse on link (first batch) and re-callable until hasMore is
// false. Idempotent: re-running with the stored cursor continues from where it
// left off; already-ingested posts are skipped via at_uri dedup.
//
// Output: { ok, backfilled, updated, skipped, hasMore, cursor }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveBridgeSession } from '../../shared/bridgeSession.ts';
import { FIELD_MAPPERS } from '../../shared/firehoseMappers.ts';

const POST_COLLECTION = 'app.bsky.feed.post';
const APPVIEW = 'https://public.api.bsky.app';
const PAGE_LIMIT = 100;

// Resolve the user's profile once so backfilled posts carry author metadata.
async function getProfile(did: string): Promise<any> {
  try {
    const url = new URL(`${APPVIEW}/xrpc/app.bsky.actor.getProfile`);
    url.searchParams.set('actor', did);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.did || !user.did.startsWith('did:plc:')) {
      return Response.json({ error: 'No AT Protocol DID — link Bluesky first' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const { pdsUrl, session: sess } = await resolveBridgeSession(req);
    const userDid = sess.did;

    const postMapper = FIELD_MAPPERS[POST_COLLECTION];
    if (!postMapper) return Response.json({ error: 'No post mapper' }, { status: 500 });

    // Resolve author profile once for metadata on all backfilled posts.
    const profile = await getProfile(userDid);

    // Resume from the stored cursor (if any).
    let cursor: string | null = user.post_backfill_cursor || null;
    let backfilled = 0, updated = 0, skipped = 0;
    let hasMore = false;
    let nextCursor: string | null = null;

    // Page through the user's post records. One page per call to stay within
    // function timeouts; the caller re-invokes until hasMore is false.
    const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set('repo', userDid);
    url.searchParams.set('collection', POST_COLLECTION);
    url.searchParams.set('limit', String(PAGE_LIMIT));
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${sess.accessJwt}` },
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('backfill-author-posts: listRecords failed', res.status, t.slice(0, 200));
      return Response.json({ error: `listRecords failed (${res.status})` }, { status: 502 });
    }
    const data = await res.json();
    const records = data.records || [];
    nextCursor = data.cursor || null;
    hasMore = !!nextCursor;

    for (const rec of records) {
      try {
        const atUri = rec.uri || '';
        const val = rec.value || {};
        if (!atUri) { skipped++; continue; }

        // Dedup by at_uri — skip if already local.
        const existing = await svc.entities.Post.filter({ at_uri: atUri }, '-created_date', 1).catch(() => []);
        const mapped = postMapper(val, atUri, userDid, profile);

        if (existing && existing.length > 0) {
          // Update in place (catches edits made on Bluesky before backfill).
          await svc.entities.Post.update(existing[0].id, mapped).catch(() => {});
          updated++;
        } else {
          await svc.entities.Post.create(mapped).catch(() => null);
          backfilled++;
        }
      } catch (e) {
        skipped++;
        console.error('backfill-author-posts: record error', e?.message || e);
      }
    }

    // Persist the cursor and completion flag on the user.
    const updates: any = {
      post_backfill_cursor: nextCursor || '',
      post_backfill_complete: !hasMore,
    };
    await base44.auth.updateMe(updates).catch(() => {});

    console.log(`[backfill-author-posts] user ${user.id}: +${backfilled} new, ${updated} updated, ${skipped} skipped, hasMore=${hasMore}`);
    return Response.json({
      ok: true,
      backfilled,
      updated,
      skipped,
      hasMore,
      cursor: nextCursor || '',
    });
  } catch (error) {
    console.error('backfill-author-posts error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}