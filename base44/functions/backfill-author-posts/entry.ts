// backfill-author-posts — resumable all-time post backfill for migrated users.
//
// Two modes:
//   1. Single-user (authenticated caller, no args): processes one page of the
//      calling user's PDS post records. Called by migrate-to-swappulse on link
//      (first batch) and re-callable by the user.
//   2. Continue (admin/workflow, { continue: true }): iterates over migrated
//      users with post_backfill_complete=false, processing one page per user.
//      Called by the PDS Sync workflow every 5 minutes until all histories are
//      fully imported.
//
// Stores a cursor on each user (post_backfill_cursor) so large histories can be
// backfilled across multiple calls within function timeouts. Idempotent: re-
// running with the stored cursor continues from where it left off; already-
// ingested posts are skipped via at_uri dedup.
//
// Output (single-user): { ok, backfilled, updated, skipped, hasMore, cursor }
// Output (continue):     { ok, users_processed, total_backfilled, total_updated, total_skipped }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveBridgeSession } from '../../shared/bridgeSession.ts';
import { getUserIdentity } from '../../shared/userIdentity.ts';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';
import { FIELD_MAPPERS } from '../../shared/firehoseMappers.ts';
import { upsertEntity } from '../../shared/entityDedup.ts';

const POST_COLLECTION = 'app.bsky.feed.post';
const APPVIEW = 'https://public.api.bsky.app';
const PAGE_LIMIT = 100;
const MAX_CONTINUE_USERS = 10; // cap per 5-minute cycle

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

// Process one page of post records for a single user. Shared by both modes.
async function processPage(
  svc: any,
  pdsUrl: string,
  accessJwt: string,
  userDid: string,
  cursor: string | null,
  profile: any,
  updateFn: (updates: any) => Promise<void>,
): Promise<{ backfilled: number; updated: number; skipped: number; hasMore: boolean; nextCursor: string | null }> {
  const postMapper = FIELD_MAPPERS[POST_COLLECTION];
  let backfilled = 0, updated = 0, skipped = 0;
  let hasMore = false;
  let nextCursor: string | null = null;

  const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
  url.searchParams.set('repo', userDid);
  url.searchParams.set('collection', POST_COLLECTION);
  url.searchParams.set('limit', String(PAGE_LIMIT));
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessJwt}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('backfill-author-posts: listRecords failed', res.status, t.slice(0, 200));
    return { backfilled, updated, skipped, hasMore, nextCursor };
  }
  const data = await res.json();
  const records = data.records || [];
  nextCursor = data.cursor || null;
  // Mark "more available" only when the PDS returned a full page AND a cursor.
  // A partial page, or a full page with no cursor, means the history is
  // exhausted — prevents the premature-complete bug where an empty/falsy
  // cursor on a full page stalled the backfill for good.
  hasMore = !!nextCursor && records.length >= PAGE_LIMIT;

  for (const rec of records) {
    try {
      const atUri = rec.uri || '';
      const val = rec.value || {};
      if (!atUri) { skipped++; continue; }

      const mapped = postMapper(val, atUri, userDid, profile);
      const { created } = await upsertEntity(svc, 'Post', mapped, atUri);
      if (created) backfilled++; else updated++;
    } catch (e) {
      skipped++;
      console.error('backfill-author-posts: record error', e?.message || e);
    }
  }

  await updateFn({
    post_backfill_cursor: nextCursor || '',
    post_backfill_complete: !hasMore,
  });

  console.log(`[backfill-author-posts] user ${userDid}: +${backfilled} new, ${updated} updated, ${skipped} skipped, hasMore=${hasMore}`);
  return { backfilled, updated, skipped, hasMore, nextCursor };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const continueMode = !!(body as any).continue;

    if (continueMode) {
      // Admin/workflow mode: iterate over users with incomplete backfills.
      const caller = await base44.auth.me().catch(() => null);
      if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (caller.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }

      const svc = base44.asServiceRole;
      const incompleteUsers = await svc.entities.User
        .filter({ migrated_from_bluesky: true, post_backfill_complete: false }, '-created_date', MAX_CONTINUE_USERS)
        .catch(() => []);

      let totalBackfilled = 0, totalUpdated = 0, totalSkipped = 0;
      let usersProcessed = 0;

      for (const u of incompleteUsers || []) {
        try {
          if (!u.did || !u.did.startsWith('did:plc:')) continue;
          const identity = await getUserIdentity(svc, u);
          if (!identity) continue;

          let session: any;
          try {
            session = (await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword)).session;
          } catch (e) {
            console.error(`backfill-author-posts: session failed for ${u.did}`, e?.message || e);
            continue;
          }

          const profile = await getProfile(u.did);
          const cursor = u.post_backfill_cursor || null;

          const result = await processPage(
            svc, identity.pdsUrl, session.accessJwt, identity.did, cursor, profile,
            async (updates) => { await svc.entities.User.update(u.id, updates).catch(() => {}); },
          );

          totalBackfilled += result.backfilled;
          totalUpdated += result.updated;
          totalSkipped += result.skipped;
          usersProcessed++;
        } catch (e) {
          console.error(`backfill-author-posts: continue error for user ${u.id}`, e?.message || e);
        }
      }

      return Response.json({
        ok: true,
        users_processed: usersProcessed,
        total_backfilled: totalBackfilled,
        total_updated: totalUpdated,
        total_skipped: totalSkipped,
      });
    }

    // Single-user mode (authenticated caller).
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.did || !user.did.startsWith('did:plc:')) {
      return Response.json({ error: 'No AT Protocol DID — link Bluesky first' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const { pdsUrl, session: sess } = await resolveBridgeSession(req);
    const userDid = sess.did;

    const profile = await getProfile(userDid);
    const cursor = user.post_backfill_cursor || null;

    const result = await processPage(
      svc, pdsUrl, sess.accessJwt, userDid, cursor, profile,
      async (updates) => { await svc.entities.User.update(user.id, updates).catch(() => {}); },
    );

    return Response.json({
      ok: true,
      backfilled: result.backfilled,
      updated: result.updated,
      skipped: result.skipped,
      hasMore: result.hasMore,
      cursor: result.nextCursor || '',
    });
  } catch (error) {
    console.error('backfill-author-posts error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}