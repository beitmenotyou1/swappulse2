// sync-profile-records — syncs each user's local profile (display name, avatar,
// bio) to their AT Protocol PDS repo as a real app.bsky.actor.profile record
// (rkey 'self'), so profiles are resolvable from Bluesky and other AT Protocol
// apps instead of appearing as blank accounts.
//
// Two modes:
//   1. Backfill (admin trigger, { adminBackfill: true }): loops users with a
//      PdsCredential on the current PDS (up to 50/run), syncing each. Idempotent
//      and re-runnable until failed is 0.
//   2. Single-user (authenticated call, no args): syncs the calling user's
//      profile after they edit it in ProfileSetup/Settings. Skips gracefully
//      if the user has no did:plc / PdsCredential yet (provision-identity may
//      not have completed).
//
// Returns { synced, failed, total, errors } (backfill) or { ok, skipped? }.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncProfileForUser } from '../../shared/profileSync.ts';

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
      const caller = await base44.auth.me().catch(() => null);
      if (!caller || caller.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
      const creds = await svc.entities.PdsCredential
        .filter({ pds_url: pdsUrl }, '-created_date', 50).catch(() => []);
      let synced = 0, failed = 0;
      const errors: Array<{ id: string; error: string }> = [];
      for (const cred of (creds || [])) {
        const u = await svc.entities.User.get(cred.user_id).catch(() => null);
        if (!u) { failed++; continue; }
        const r = await syncProfileForUser(svc, pdsUrl, cred.did, cred.app_password, u);
        if (r.ok) {
          synced++;
        } else {
          failed++;
          errors.push({ id: cred.user_id, error: r.error || 'failed' });
          console.error('sync-profile-records: failed for', cred.user_id, r.error);
        }
      }
      return Response.json({
        synced, failed, total: (creds || []).length,
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
    if (!r.ok) console.error('sync-profile-records: single-user failed', r.error);
    return Response.json({ ok: r.ok, error: r.error });
  } catch (error) {
    console.error('sync-profile-records error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}