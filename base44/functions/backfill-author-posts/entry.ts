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
import { constructBskyCdnUrl, pullProfileFromPds } from '../../shared/profileSync.ts';

const POST_COLLECTION = 'app.bsky.feed.post';
const APPVIEW = 'https://public.api.bsky.app';
const PAGE_LIMIT = 100;
const MAX_CONTINUE_USERS = 15; // cap per 5-minute cycle
const MAX_CONTINUE_PAGES = 5; // pages per user per continue cycle
const TIME_BUDGET_MS = 25000; // single-user mode: loop pages until this budget

// Load promo post at_uris so they're never ingested as local Posts.
// Promo posts exist on the PDS only — they should never appear in the
// SwapPulse local feed. Without this check, backfill would ingest them
// and they'd render as plain text (no embed round-trips through the mapper).
async function loadPromoUris(svc: any): Promise<Set<string>> {
  const promoPosts = await svc.entities.PromoPost.list('-created_date', 500).catch(() => []);
  return new Set((promoPosts || []).map((p: any) => p.at_uri).filter(Boolean));
}

// Resolve the user's profile so backfilled posts carry author metadata.
// Tries the public AppView first (returns resolved CDN avatar URLs), then
// falls back to a direct PDS profile read (constructs the CDN URL from the
// blob ref) so avatars are populated even when the AppView is rate-limited.
async function getProfile(did: string, pdsUrl?: string, accessJwt?: string): Promise<any> {
  try {
    const url = new URL(`${APPVIEW}/xrpc/app.bsky.actor.getProfile`);
    url.searchParams.set('actor', did);
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch {
    // fall through to PDS read
  }
  // Fallback: read the profile record directly from the PDS and construct
  // the avatar CDN URL from the blob ref.
  if (pdsUrl && accessJwt) {
    try {
      const { ok, profile } = await pullProfileFromPds(pdsUrl, accessJwt, did);
      if (ok && profile) return profile;
    } catch {
      // ignore
    }
  }
  return null;
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
  promoUris: Set<string>,
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
  // A cursor means the PDS has more records to page through — don't require
  // a full page (the last page can be partial with a cursor in some PDS
  // implementations). Only mark complete when there's truly no cursor.
  hasMore = !!nextCursor && records.length > 0;

  for (const rec of records) {
    try {
      const atUri = rec.uri || '';
      const val = rec.value || {};
      if (!atUri) { skipped++; continue; }

      // Skip promotional posts — they exist on the PDS only and should
      // never be ingested into the local feed.
      if (promoUris.has(atUri)) { skipped++; continue; }

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

  // Avatar enrichment: if we have a profile with an avatar, update any posts
  // by this user that have empty author_avatar (from a prior import where the
  // AppView was rate-limited). Bounded to one batch of 100 to stay fast.
  if (profile?.avatar) {
    try {
      const stale = await svc.entities.Post.filter(
        { did: userDid, author_avatar: '' }, '-created_date', 100,
      ).catch(() => []);
      for (const p of stale || []) {
        await svc.entities.Post.update(p.id, {
          author_avatar: profile.avatar,
          author_name: profile.displayName || p.author_name || '',
          author_handle: profile.handle || p.author_handle || '',
        }).catch(() => {});
      }
      if (stale?.length > 0) {
        console.log(`[backfill-author-posts] enriched ${stale.length} posts with avatar for ${userDid}`);
      }
    } catch (e) {
      console.error('backfill-author-posts: avatar enrichment error', e?.message || e);
    }
  }

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

      const promoUris = await loadPromoUris(svc);

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

          const profile = await getProfile(u.did, identity.pdsUrl, session.accessJwt);
          let cursor = u.post_backfill_cursor || null;
          let userHasMore = true;
          let pagesThisUser = 0;
          while (userHasMore && pagesThisUser < MAX_CONTINUE_PAGES) {
            const result = await processPage(
              svc, identity.pdsUrl, session.accessJwt, identity.did, cursor, profile,
              async (updates) => { await svc.entities.User.update(u.id, updates).catch(() => {}); },
              promoUris,
            );
            totalBackfilled += result.backfilled;
            totalUpdated += result.updated;
            totalSkipped += result.skipped;
            userHasMore = result.hasMore;
            cursor = result.nextCursor;
            pagesThisUser++;
          }
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

    const promoUris = await loadPromoUris(svc);

    const profile = await getProfile(userDid, pdsUrl, sess.accessJwt);
    let cursor = user.post_backfill_cursor || null;
    const startTime = Date.now();
    let totalBackfilled = 0, totalUpdated = 0, totalSkipped = 0;
    let hasMore = true;

    // Loop through all pages until complete or the time budget is exhausted.
    // The cursor is persisted after each page so a timeout resumes on the next
    // call — most users with < a few hundred posts complete in one trigger.
    while (hasMore && (Date.now() - startTime) < TIME_BUDGET_MS) {
      const result = await processPage(
        svc, pdsUrl, sess.accessJwt, userDid, cursor, profile,
        async (updates) => { await svc.entities.User.update(user.id, updates).catch(() => {}); },
        promoUris,
      );
      totalBackfilled += result.backfilled;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      hasMore = result.hasMore;
      cursor = result.nextCursor;
    }

    return Response.json({
      ok: true,
      backfilled: totalBackfilled,
      updated: totalUpdated,
      skipped: totalSkipped,
      hasMore,
      cursor: cursor || '',
      complete: !hasMore,
    });
  } catch (error) {
    console.error('backfill-author-posts error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}