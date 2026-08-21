// consolidate-identity — one-time admin function that copies every existing
// PdsCredential record (did, pds_url, app_password) onto the corresponding User
// record as the consolidated pds_url + pds_app_password (encrypted) fields.
// After this runs, backend functions read identity from User via the
// userIdentity helper and the PdsCredential entity is retired.
//
// Idempotent: users who already have pds_app_password set are skipped.
// Admin-only (service role). Safe to re-run.
//
// Output: { consolidated, skipped, failed, errors }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { setUserIdentity } from '../../shared/userIdentity.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    let consolidated = 0, skipped = 0, failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Page through all PdsCredential records (keyset pagination on created_date).
    let lastDate: string | undefined = undefined;
    let hasMore = true;
    while (hasMore) {
      const query: any = {};
      if (lastDate) query.created_date = { $lt: lastDate };
      const batch = await svc.entities.PdsCredential
        .filter(query, '-created_date', 50).catch(() => []);
      if (!batch || batch.length === 0) break;

      for (const cred of batch) {
        try {
          // Look up the user
          const users = await svc.entities.User.filter({ id: cred.user_id }, '-created_date', 1).catch(() => []);
          const user = users?.[0];
          if (!user) { skipped++; continue; }

          // Skip if already consolidated (idempotent)
          if (user.pds_app_password) { skipped++; continue; }

          // Copy the credential onto the User record (encrypts the password)
          await setUserIdentity(svc, user.id, cred.did, cred.pds_url || Deno.env.get('PDS_URL') || '', cred.app_password);
          consolidated++;
        } catch (e: any) {
          failed++;
          errors.push({ id: cred.user_id, error: e?.message || 'failed' });
          console.error('consolidate-identity: failed for', cred.user_id, e?.message || e);
        }
      }

      if (batch.length < 50) break;
      lastDate = batch[batch.length - 1]?.created_date;
      if (!lastDate) break;
    }

    console.log(`[consolidate-identity] consolidated=${consolidated} skipped=${skipped} failed=${failed}`);
    return Response.json({ consolidated, skipped, failed, errors: errors.slice(0, 20) });
  } catch (error) {
    console.error('consolidate-identity error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}