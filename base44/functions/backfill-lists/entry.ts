// backfill-lists — resumable all-time lists + starterpacks backfill for migrated
// users. Pages app.bsky.graph.list and app.bsky.graph.starterpack records from
// the user's PDS repo, upserts BlueskyList entities by at_uri, and populates
// member_dids from app.bsky.graph.listitem records for each list.
//
// Two modes:
//   1. Single-user (authenticated caller, no args): processes one page.
//   2. Continue (admin/workflow, { continue: true }): iterates over migrated
//      users with lists_backfill_complete=false, one page per user.
//
// Output (single-user): { ok, backfilled, updated, skipped, hasMore, cursor }
// Output (continue):    { ok, users_processed, total_backfilled, total_updated, total_skipped }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getUserIdentity } from '../../shared/userIdentity.ts';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';
import { FIELD_MAPPERS } from '../../shared/firehoseMappers.ts';
import { upsertEntity } from '../../shared/entityDedup.ts';

const LIST_COLLECTION = 'app.bsky.graph.list';
const STARTERPACK_COLLECTION = 'app.bsky.graph.starterpack';
const LISTITEM_COLLECTION = 'app.bsky.graph.listitem';
const PAGE_LIMIT = 100;
const MAX_CONTINUE_USERS = 15;

// Fetch all listitem records for a list and return the member DIDs.
async function fetchListMembers(pdsUrl: string, accessJwt: string, userDid: string, listUri: string): Promise<string[]> {
  const members: string[] = [];
  let cursor: string | null = null;
  let pageCount = 0;
  do {
    const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set('repo', userDid);
    url.searchParams.set('collection', LISTITEM_COLLECTION);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessJwt}` } });
    if (!res.ok) break;
    const data = await res.json();
    const records = data.records || [];
    for (const rec of records) {
      const val = rec.value || {};
      if (val.list === listUri) {
        const subjectDid = val.subject || '';
        if (subjectDid) members.push(subjectDid);
      }
    }
    cursor = data.cursor || null;
    pageCount++;
  } while (cursor && pageCount < 10);
  return members;
}

async function processPage(
  svc: any,
  pdsUrl: string,
  accessJwt: string,
  userDid: string,
  cursor: string | null,
  updateFn: (updates: any) => Promise<void>,
): Promise<{ backfilled: number; updated: number; skipped: number; hasMore: boolean; nextCursor: string | null }> {
  const listMapper = FIELD_MAPPERS[LIST_COLLECTION];
  const spMapper = FIELD_MAPPERS[STARTERPACK_COLLECTION];
  let backfilled = 0, updated = 0, skipped = 0;
  let hasMore = false;
  let nextCursor: string | null = null;

  // Phase 1: Lists
  const listUrl = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
  listUrl.searchParams.set('repo', userDid);
  listUrl.searchParams.set('collection', LIST_COLLECTION);
  listUrl.searchParams.set('limit', String(PAGE_LIMIT));
  if (cursor) listUrl.searchParams.set('cursor', cursor);

  const listRes = await fetch(listUrl, { headers: { 'Authorization': `Bearer ${accessJwt}` } });
  if (!listRes.ok) {
    console.error('backfill-lists: listRecords (list) failed', listRes.status);
    return { backfilled, updated, skipped, hasMore, nextCursor };
  }
  const listData = await listRes.json();
  const listRecords = listData.records || [];
  nextCursor = listData.cursor || null;

  for (const rec of listRecords) {
    try {
      const atUri = rec.uri || '';
      const val = rec.value || {};
      if (!atUri) { skipped++; continue; }
      const mapped = listMapper(val, atUri, userDid);
      // Enrich with member_dids from listitem records
      const members = await fetchListMembers(pdsUrl, accessJwt, userDid, atUri);
      mapped.member_dids = members;
      const { created } = await upsertEntity(svc, 'BlueskyList', mapped, atUri);
      if (created) backfilled++; else updated++;
    } catch (e) {
      skipped++;
      console.error('backfill-lists: list record error', e?.message || e);
    }
  }

  // Phase 2: Starter packs (same page)
  const spUrl = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
  spUrl.searchParams.set('repo', userDid);
  spUrl.searchParams.set('collection', STARTERPACK_COLLECTION);
  spUrl.searchParams.set('limit', String(PAGE_LIMIT));

  const spRes = await fetch(spUrl, { headers: { 'Authorization': `Bearer ${accessJwt}` } });
  if (spRes.ok) {
    const spData = await spRes.json();
    const spRecords = spData.records || [];
    for (const rec of spRecords) {
      try {
        const atUri = rec.uri || '';
        const val = rec.value || {};
        if (!atUri) { skipped++; continue; }
        const mapped = spMapper(val, atUri, userDid);
        const { created } = await upsertEntity(svc, 'BlueskyList', mapped, atUri);
        if (created) backfilled++; else updated++;
      } catch (e) {
        skipped++;
        console.error('backfill-lists: starterpack record error', e?.message || e);
      }
    }
  }

  // hasMore: if the list collection returned a cursor, there's more to page
  hasMore = !!nextCursor && listRecords.length > 0;

  await updateFn({
    lists_backfill_cursor: nextCursor || '',
    lists_backfill_complete: !hasMore,
  });

  console.log(`[backfill-lists] user ${userDid}: +${backfilled} new, ${updated} updated, ${skipped} skipped, hasMore=${hasMore}`);
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
        .filter({ migrated_from_bluesky: true, lists_backfill_complete: false }, '-created_date', MAX_CONTINUE_USERS)
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
            console.error(`backfill-lists: session failed for ${u.did}`, e?.message || e);
            continue;
          }
          const cursor = u.lists_backfill_cursor || null;
          const result = await processPage(
            svc, identity.pdsUrl, session.accessJwt, identity.did, cursor,
            async (updates) => { await svc.entities.User.update(u.id, updates).catch(() => {}); },
          );
          totalBackfilled += result.backfilled;
          totalUpdated += result.updated;
          totalSkipped += result.skipped;
          usersProcessed++;
        } catch (e) {
          console.error(`backfill-lists: continue error for user ${u.id}`, e?.message || e);
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

    const cursor = user.lists_backfill_cursor || null;
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
    console.error('backfill-lists error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}