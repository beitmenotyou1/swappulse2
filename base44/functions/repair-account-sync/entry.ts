// repair-account-sync — admin-only one-time repair for a migrated user whose
// post backfill stalled or accumulated duplicate records. Resets the user's
// backfill state (post_backfill_complete=false, post_backfill_cursor='') so the
// PDS Sync workflow resumes paging through their full history, and
// deduplicates existing Post records for that DID (keeps the most recently
// updated per at_uri, deletes the rest).
//
// Accepts { did } in the body; defaults to the caller's DID. The caller must
// be an admin.
//
// Output: { ok, did, reset, dedup: { kept, deleted } }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { deduplicatePostsForDid } from '../../shared/entityDedup.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const did = (body as any).did || caller.did;
    if (!did || !did.startsWith('did:plc:')) {
      return Response.json({ error: 'No valid DID — link Bluesky first' }, { status: 400 });
    }

    // Find the user record by did.
    const users = await svc.entities.User.filter({ did }, '-created_date', 1).catch(() => []);
    const user = users?.[0];
    if (!user) return Response.json({ error: 'User not found for DID' }, { status: 404 });

    // Reset backfill state so the PDS Sync workflow resumes from the start.
    await svc.entities.User.update(user.id, {
      post_backfill_complete: false,
      post_backfill_cursor: '',
    }).catch(() => {});

    // Deduplicate existing Post records for this DID.
    const dedup = await deduplicatePostsForDid(svc, did);

    return Response.json({
      ok: true,
      did,
      reset: { post_backfill_complete: false, post_backfill_cursor: '' },
      dedup,
    });
  } catch (error) {
    console.error('repair-account-sync error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}