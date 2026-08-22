// backfill-reposts — resumable all-time reposts backfill for migrated users.
// Mirrors backfill-author-posts structure. Pages app.bsky.feed.repost records
// from the user's PDS repo, upserts Repost entities by at_uri, and tracks a
// cursor + complete flag on the User record.
//
// Two modes:
//   1. Single-user (authenticated caller, no args): processes one page.
//   2. Continue (admin/workflow, { continue: true }): iterates over migrated
//      users with reposts_backfill_complete=false, one page per user.
//
// Output (single-user): { ok, backfilled, updated, skipped, hasMore, cursor }
// Output (continue):    { ok, users_processed, total_backfilled, total_updated, total_skipped }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getUserIdentity } from '../../shared/userIdentity.ts';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';
import { FIELD_MAPPERS } from '../../shared/firehoseMappers.ts';
import { upsertEntity } from '../../shared/entityDedup.ts';

const REPOST_COLLECTION = 'app.bsky.feed.repost';
const PAGE_LIMIT = 100;
const MAX_CONTINUE_USERS = 15;

async function processPage(
  svc: any,
  pdsUrl: string,
  accessJwt: string,
  userDid: string,
  cursor: string | null,
  updateFn: (updates: any) => Promise<void>,
): Promise<{ backfilled: number; updated: number; skipped: number; hasMore: boolean; nextCursor: string | null }> {
  const mapper = FIELD_MAPPERS[REPOST_COLLECTION];
  let backfilled = 0, updated = 0, skipped = 0;
  let hasMore = false;
  let nextCursor: string | null = null;

  const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
  url.searchParams.set('repo', userDid);
  url.searchParams.set('collection', REPOST_COLLECTION);
  url.searchParams.set('limit', String(PAGE_LIMIT));
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessJwt}` } });
  if (!res.ok) {
    console.error('backfill-reposts: listRecords failed', res.status);
    return { backfilled, updated, skipped, hasMore, nextCursor };
  }
  const data = await res.json();
  const records = data.records || [];
  nextCursor = data.cursor || null;
  hasMore = !!nextCursor && records.length > 0;

  for (const rec of records) {
    try {
      const atUri = rec.uri || '';
      const val = rec.value || {};
      if (!atUri) { skipped++; continue; }
      const mapped = mapper(val, atUri, userDid);
      const { created } = await upsertEntity(svc, 'Repost', mapped, atUri);
      if (created) backfilled++; else updated++;
    } catch (e) {
      skipped++;
      console.error('backfill-reposts: record error', e?.message || e);
    }
  }

  await updateFn({
    reposts_backfill_cursor: nextCursor || '',
    reposts_backfill_complete: !hasMore,
  });

  console.log(`[backfill-reposts] user ${userDid}: +${backfilled} new, ${updated} updated, ${skipped} skipped, hasMore=${hasMore}`);
  return { backfilled, updated, skipped, hasMore, nextCursor };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const continueMode = !!(body as any).continue;

    if (continueMode) {
      const caller = await base44.auth.me().catch(() => null);
      if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (caller.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

      const svc = base44.asServiceRole;
      const incompleteUsers = await svc.entities.User
        .filter({ migrated_from_bluesky: true, reposts_backfill_complete: false }, '-created_date', MAX_CONTINUE_USERS)
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
            console.error(`backfill-reposts: session failed for ${u.did}`, e?.message || e);
            continue;
          }
          const cursor = u.reposts_backfill_cursor || null;
          const result = await processPage(
            svc, identity.pdsUrl, session.accessJwt, identity.did, cursor,
            async (updates) => { await svc.entities.User.update(u.id, updates).catch(() => {}); },
          );
          totalBackfilled += result.backfilled;
          totalUpdated += result.updated;
          totalSkipped += result.skipped;
          usersProcessed++;
        } catch (e) {
          console.error(`backfill-reposts: continue error for user ${u.id}`, e?.message || e);
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

    // Single-user mode
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.did || !user.did.startsWith('did:plc:')) {
      return Response.json({ error: 'No AT Protocol DID — link Bluesky first' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const identity = await getUserIdentity(svc, user);
    if (!identity) return Response.json({ error: 'No PDS identity found' }, { status: 400 });
    let session: any;
    try {
      session = (await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword)).session;
    } catch (e: any) {
      return Response.json({ error: `PDS session failed: ${e?.message || e}` }, { status: 502 });
    }

    const cursor = user.reposts_backfill_cursor || null;
    const result = await processPage(
      svc, identity.pdsUrl, session.accessJwt, identity.did, cursor,
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
    console.error('backfill-reposts error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}