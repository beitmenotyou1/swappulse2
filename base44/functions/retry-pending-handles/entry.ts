// retry-pending-handles — retries handle updates for migrated users whose
// initial handle update (username.swappulse.org or custom domain) failed
// because DNS verification wasn't ready yet. Called by the PDS Sync workflow
// every 5 minutes so handle updates eventually succeed once DNS propagates.
//
// For each user with handle_update_pending=true:
//   1. Resolve their consolidated PDS identity (did + app password) from User.
//   2. Call com.atproto.identity.updateHandle with the pending_handle.
//   3. On success: clear handle_update_pending, persist bsky_handle.
//   4. On failure: leave the flag set so the next run retries.
//
// Returns { retried, succeeded, failed, errors }.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser, pdsRequest } from '../../shared/pdsSession.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Require an authenticated admin user. Workflow invocations authenticate
    // as admin, so the PDS Sync workflow can trigger retries; unauthenticated
    // strangers and non-admin users are rejected.
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    const svc = base44.asServiceRole;
    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) {
      return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });
    }

    // Find all users with a pending handle update.
    const users = await svc.entities.User
      .filter({ handle_update_pending: true }, '-created_date', 50).catch(() => []);

    let retried = 0, succeeded = 0, failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const user of (users || [])) {
      if (!user.pending_handle || !user.did || !user.did.startsWith('did:plc:')) {
        continue;
      }
      retried++;

      const { getUserIdentity } = await import('../../shared/userIdentity.ts');
      const identity = await getUserIdentity(svc, user);
      if (!identity) {
        failed++;
        errors.push({ id: user.id, error: 'no PDS identity' });
        continue;
      }

      try {
        const { session } = await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword);
        const res = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.identity.updateHandle', {
          handle: user.pending_handle,
        });
        if (res?.error) {
          failed++;
          const errBody = typeof res.body === 'string' ? res.body : JSON.stringify(res.body || {});
          errors.push({ id: user.id, error: `PDS rejected (${res.status})` });
          console.error('retry-pending-handles: PDS rejected for', user.id, res.status, errBody.slice(0, 200));
        } else {
          // Success — clear the pending flag and persist the new handle.
          await svc.entities.User.update(user.id, {
            handle_update_pending: false,
            pending_handle: '',
            bsky_handle: user.pending_handle,
          }).catch(() => {});
          succeeded++;
          console.log('retry-pending-handles: handle updated for', user.id, '→', user.pending_handle);
        }
      } catch (e: any) {
        failed++;
        errors.push({ id: user.id, error: e?.message || 'Unknown error' });
        console.error('retry-pending-handles: error for', user.id, e?.message || e);
      }
    }

    return Response.json({ retried, succeeded, failed, errors: errors.slice(0, 20) });
  } catch (error) {
    console.error('retry-pending-handles error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}