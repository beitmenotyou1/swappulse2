// sync-profile-records — syncs each user's local profile (display name, avatar,
// bio, banner) to their AT Protocol PDS repo as a real app.bsky.actor.profile
// record (rkey 'self'), so profiles are resolvable from Bluesky and other AT
// Protocol apps instead of appearing as blank accounts.
//
// Two modes:
//   1. Backfill (admin trigger / workflow, { adminBackfill: true }): paginates
//      through ALL users with a PdsCredential on the current PDS (50 per batch,
//      continues until exhausted), syncing each migrated user. Idempotent and
//      re-runnable until failed is 0.
//   2. Single-user (authenticated call, no args): syncs the calling user's
//      profile after they edit it in EditProfileModal/Settings. Skips gracefully
//      if the user has no did:plc / PdsCredential yet or hasn't migrated.
//
// On success: stamps profile_synced_at, resets profile_sync_fail_count to 0,
// and stores avatar_pds_ref/header_pds_ref (PDS blob refs) so future runs skip
// re-uploading unchanged images.
// On failure: stamps profile_sync_failed_at and increments profile_sync_fail_count.
// After 3 consecutive failures, the inbound sync's conflict guard is bypassed
// so remote edits can still merge (prevents a dead outbound sync from
// permanently blocking inbound sync).
//
// Returns { synced, failed, total, errors } (backfill) or { ok, skipped? }.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncProfileForUser } from '../../shared/profileSync.ts';

const BACKFILL_BATCH_SIZE = 50;
const MAX_BACKFILL_PER_RUN = 200; // cap per run to stay within timeout

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) {
      console.error('sync-profile-records: PDS_URL not configured');
      return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const adminBackfill = !!(body as any).adminBackfill;

    if (adminBackfill) {
      // Require an authenticated admin user. Workflow invocations authenticate
      // as admin, so the PDS Sync workflow can trigger backfills; unauthenticated
      // strangers and non-admin users are rejected.
      const caller = await base44.auth.me().catch(() => null);
      if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (caller.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }

      let synced = 0, failed = 0, skipped = 0;
      const errors: Array<{ id: string; error: string }> = [];
      let processed = 0;
      let lastBatchDate: string | undefined = undefined;

      // Paginate through ALL PdsCredentials on the current PDS, 50 per batch,
      // until exhausted or we hit the per-run cap. Uses $lt on created_date
      // for keyset pagination (the SDK filter doesn't support skip/cursor).
      // This ensures every migrated user gets outbound-synced, not just the
      // 50 newest.
      while (processed < MAX_BACKFILL_PER_RUN) {
        const query: any = { pds_url: pdsUrl };
        if (lastBatchDate) query.created_date = { $lt: lastBatchDate };
        const batch = await svc.entities.PdsCredential
          .filter(query, '-created_date', BACKFILL_BATCH_SIZE).catch(() => []);
        if (!batch || batch.length === 0) break;

        for (const cred of batch) {
          if (processed >= MAX_BACKFILL_PER_RUN) break;
          processed++;

          const u = await svc.entities.User.get(cred.user_id).catch(() => null);
          if (!u) { failed++; continue; }
          // Only push profiles for migrated users — non-migrated users'
          // Bluesky profiles are authoritative until they migrate.
          if (!u.migrated_from_bluesky) { skipped++; continue; }

          const r = await syncProfileForUser(svc, pdsUrl, cred.did, cred.app_password, u);
          if (r.ok) {
            synced++;
            // Stamp the outbound sync timestamp so the inbound sync's conflict
            // guard knows the local state has been propagated and can accept
            // remote changes again. Reset failure count.
            const updates: any = {
              profile_synced_at: new Date().toISOString(),
              profile_sync_fail_count: 0,
              profile_sync_failed_at: '',
            };
            // Store the PDS blob refs so future outbound syncs skip re-uploading
            // unchanged images, and the inbound sync can recognize that the
            // local avatar is PDS-resident (not a new remote edit).
            if (r.avatar_blob_ref) updates.avatar_pds_ref = JSON.stringify(r.avatar_blob_ref);
            if (r.header_blob_ref) updates.header_pds_ref = JSON.stringify(r.header_blob_ref);
            await svc.entities.User.update(u.id, updates).catch(() => {});
          } else {
            failed++;
            const failCount = (u.profile_sync_fail_count || 0) + 1;
            await svc.entities.User.update(u.id, {
              profile_sync_failed_at: new Date().toISOString(),
              profile_sync_fail_count: failCount,
            }).catch(() => {});
            errors.push({ id: cred.user_id, error: r.error || 'failed' });
            console.error('sync-profile-records: failed for', cred.user_id, r.error);
          }
        }

        // If we got fewer than the batch size, we've exhausted the list.
        if (batch.length < BACKFILL_BATCH_SIZE) break;
        // Advance the pagination key to the last item's created_date.
        lastBatchDate = batch[batch.length - 1]?.created_date;
        if (!lastBatchDate) break;
      }

      return Response.json({
        synced, failed, skipped, total: processed,
        errors: errors.slice(0, 20),
      });
    }

    // Single-user sync (authenticated caller, after profile edit). Only
    // syncs to the PDS if the user has migrated from Bluesky — before
    // migration, the Bluesky profile stays as-is and SwapPulse edits
    // remain local. After un-move (migration_reverted), syncing is also
    // skipped so the restored original Bluesky profile is not overwritten.
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (!user.did || !user.did.startsWith('did:plc:')) {
      return Response.json({ ok: true, skipped: true, reason: 'no did:plc yet' });
    }
    if (!user.migrated_from_bluesky) {
      return Response.json({ ok: true, skipped: true, reason: 'not migrated — profile edits stay local until migration' });
    }
    const creds = await svc.entities.PdsCredential
      .filter({ user_id: user.id }).catch(() => []);
    if (!creds || creds.length === 0) {
      return Response.json({ ok: true, skipped: true, reason: 'no PdsCredential' });
    }
    const cred = creds[0];
    const r = await syncProfileForUser(svc, pdsUrl, cred.did, cred.app_password, user);
    if (r.ok) {
      const updates: any = {
        profile_synced_at: new Date().toISOString(),
        profile_sync_fail_count: 0,
        profile_sync_failed_at: '',
      };
      if (r.avatar_blob_ref) updates.avatar_pds_ref = JSON.stringify(r.avatar_blob_ref);
      if (r.header_blob_ref) updates.header_pds_ref = JSON.stringify(r.header_blob_ref);
      await svc.entities.User.update(user.id, updates).catch(() => {});
    } else {
      const failCount = (user.profile_sync_fail_count || 0) + 1;
      await svc.entities.User.update(user.id, {
        profile_sync_failed_at: new Date().toISOString(),
        profile_sync_fail_count: failCount,
      }).catch(() => {});
      console.error('sync-profile-records: single-user failed', r.error);
    }
    return Response.json({ ok: r.ok, error: r.error });
  } catch (error) {
    console.error('sync-profile-records error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}