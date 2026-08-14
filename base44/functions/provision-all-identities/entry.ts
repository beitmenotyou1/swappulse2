// provision-all-identities — admin-triggered backfill that provisions a PDS
// identity for every existing User who doesn't have a did:plc yet.
//
// Idempotent: skips users who already have a did:plc. Processes up to 50 per
// run to stay within function time limits. Returns { provisioned, skipped,
// failed, errors }. Re-run until failed=0 and provisioned stops increasing.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { provisionIdentityForUser } from '../../shared/provisionIdentity.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const LIMIT = 50;
    const users = await svc.entities.User.list('-created_date', LIMIT);

    let provisioned = 0, skipped = 0, failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const u of users) {
      if (u.did?.startsWith('did:plc:')) {
        skipped++;
        continue;
      }
      try {
        await provisionIdentityForUser(
          svc,
          u.id,
          u.username || u.full_name || (u.email ? u.email.split('@')[0] : '') || 'collector',
          u.email || `collector@swappulse.org`,
        );
        provisioned++;
      } catch (err: any) {
        failed++;
        errors.push({ id: u.id, error: err?.message || 'provision failed' });
        console.error('provision-all-identities: failed for', u.id, err?.message || err);
      }
    }

    return Response.json({
      provisioned,
      skipped,
      failed,
      total: users.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error('provision-all-identities error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}