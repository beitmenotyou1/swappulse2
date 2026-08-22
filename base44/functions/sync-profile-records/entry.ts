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

      // Paginate through ALL migrated users, 50 per batch, until exhausted or
      // we hit the per-run cap. Uses $lt on created_date for keyset pagination.
      // This ensures every migrated user gets outbound-synced, not just the
      // 50 newest. Reads identity from the consolidated User record.
      const { getUserIdentity } = await import('../../shared/userIdentity.ts');
      while (processed < MAX_BACKFILL_PER_RUN) {
        const query: any = { migrated_from_bluesky: true };
        if (lastBatchDate) query.created_date = { $lt: lastBatchDate };
        const batch = await svc.entities.User
          .filter(query, '-created_date', BACKFILL_BATCH_SIZE).catch(() => []);
        if (!batch || batch.length === 0) break;

        for (const u of batch) {
          if (processed >= MAX_BACKFILL_PER_RUN) break;
          processed++;
          if (!u.migrated_from_bluesky) { skipped++; continue; }

          const identity = await getUserIdentity(svc, u);
          if (!identity) { skipped++; continue; }

          const r = await syncProfileForUser(svc, identity.pdsUrl, identity.did, identity.appPassword, u);
          if (r.ok) {
            if (r.changed) synced++; else skipped++;
            // Only advance profile_synced_at when the profile actually changed.
            // Advancing it on every run (even no-op syncs) blocks the inbound
            // sync's 10-min AppView indexing grace period forever (the workflow
            // runs every 5 min), preventing remote profile edits from merging.
            const updates: any = {
              profile_sync_fail_count: 0,
              profile_sync_failed_at: '',
            };
            if (r.changed) {
              updates.profile_synced_at = new Date().toISOString();
            }
            // Store the PDS blob refs and source URLs so future outbound syncs
            // skip re-uploading unchanged images, and the inbound sync can
            // recognize that the local avatar is PDS-resident.
            if (r.avatar_blob_ref) {
              updates.avatar_pds_ref = JSON.stringify(r.avatar_blob_ref);
            }
            if (r.header_blob_ref) {
              updates.header_pds_ref = JSON.stringify(r.header_blob_ref);
            }
            if (r.avatar_source_url !== undefined) {
              updates.avatar_source_url = r.avatar_source_url;
            }
            if (r.header_source_url !== undefined) {
              updates.header_source_url = r.header_source_url;
            }
            await svc.entities.User.update(u.id, updates).catch(() => {});
          } else {
            failed++;
            const failCount = (u.profile_sync_fail_count || 0) + 1;
            await svc.entities.User.update(u.id, {
              profile_sync_failed_at: new Date().toISOString(),
              profile_sync_fail_count: failCount,
            }).catch(() => {});
            errors.push({ id: u.id, error: r.error || 'failed' });
            console.error('sync-profile-records: failed for', u.id, r.error);
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
    if (user.migration_reverted) {
      return Response.json({ ok: true, skipped: true, reason: 'migration reverted — original Bluesky profile preserved' });
    }
    // Allow sync for linked users who have a did:plc even before migration
    // completes, so profile edits propagate to Bluesky as soon as the account
    // is linked. Previously this was skipped with 'not migrated', leaving
    // pre-migration profile edits stranded locally.
    const { getUserIdentity } = await import('../../shared/userIdentity.ts');
    const identity = await getUserIdentity(svc, user);
    if (!identity) {
      return Response.json({ ok: true, skipped: true, reason: 'no PDS identity' });
    }
    const r = await syncProfileForUser(svc, identity.pdsUrl, identity.did, identity.appPassword, user);
    if (r.ok) {
      // Only advance profile_synced_at when the profile actually changed.
      const updates: any = {
        profile_sync_fail_count: 0,
        profile_sync_failed_at: '',
        profile_sync_pending: false,
      };
      if (r.changed) {
        updates.profile_synced_at = new Date().toISOString();
      }
      if (r.avatar_blob_ref) {
        updates.avatar_pds_ref = JSON.stringify(r.avatar_blob_ref);
      }
      if (r.header_blob_ref) {
        updates.header_pds_ref = JSON.stringify(r.header_blob_ref);
      }
      if (r.avatar_source_url !== undefined) {
        updates.avatar_source_url = r.avatar_source_url;
      }
      if (r.header_source_url !== undefined) {
        updates.header_source_url = r.header_source_url;
      }
      await svc.entities.User.update(user.id, updates).catch(() => {});
    } else {
      const failCount = (user.profile_sync_fail_count || 0) + 1;
      await svc.entities.User.update(user.id, {
        profile_sync_failed_at: new Date().toISOString(),
        profile_sync_fail_count: failCount,
        profile_sync_pending: true,
      }).catch(() => {});
      console.error('sync-profile-records: single-user failed', r.error);
    }
    // Nudge the Bluesky AppView to re-index this user's repo so the updated
    // avatar/banner are reflected promptly on bsky.app and other AT Protocol
    // clients. The AppView crawls repos via the firehose automatically, but
    // calling getProfile for the actor prompts indexing if it hasn't happened
    // yet; for already-indexed actors the firehose commit from the putRecord
    // above drives the refresh. Best-effort and non-fatal.
    if (r.ok && r.changed && user.did) {
      try {
        await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(user.did)}`);
      } catch { /* best-effort refresh nudge */ }
    }
    return Response.json({ ok: r.ok, error: r.error });
  } catch (error) {
    console.error('sync-profile-records error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}