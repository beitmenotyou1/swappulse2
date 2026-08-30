// provision-all-identities — admin-triggered backfill that ensures every
// existing User has a PDS identity AND a stored PdsCredential on the current
// self-hosted PDS (PDS_URL).
//
// Three paths per user:
//   1. Already fully provisioned (PdsCredential on current PDS) → skip.
//   2. Has a did:plc that resolves on the current PDS but no credential →
//      repair. The PDS admin write endpoints reject our auth, so repair means
//      creating a fresh account and repointing the user at it. Safe only
//      because no credential was ever stored, so nothing was ever bridged to
//      the abandoned account.
//   3. No did:plc on the current PDS (simulated DID, or DID on another PDS) →
//      provision a new account on the current PDS.
//
// Idempotent. Scans all users, then processes a small batch of those actually
// needing work per run to stay within function time limits (each user costs
// several PDS round-trips).
// Returns { provisioned, repaired, skipped, failed, errors }. Re-run until
// failed=0 and provisioned+repaired stop increasing.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { provisionIdentityForUser, repairCredentialForUser, didResolvesOnPds } from '../../shared/provisionIdentity.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const currentPdsUrl = Deno.env.get('PDS_URL');
    if (!currentPdsUrl) {
      return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });
    }

    // Scan the whole roster, not just the newest page — otherwise a permanent
    // failure among recent signups would starve older users forever.
    const BATCH = 10;
    const allUsers = await svc.entities.User.list('-created_date', 500).catch(() => []);

    // Path 1: users with a consolidated PDS identity (pds_app_password set)
    // on the current PDS are fully done and never re-touched.
    const isDone = (u: any) => Boolean(u.pds_app_password) && (!u.pds_url || u.pds_url === currentPdsUrl);
    const alreadyDone = (allUsers || []).filter(isDone).length;
    const pending = (allUsers || []).filter((u: any) => !isDone(u));
    const users = pending.slice(0, BATCH);
    const credByUser = new Map<string, any>();

    let provisioned = 0, repaired = 0, skipped = 0, failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const u of users) {
      // Path 1: fully provisioned on current PDS.
      if (credByUser.has(u.id)) {
        skipped++;
        continue;
      }

      const hasDidPlc = !!(u.did && u.did.startsWith('did:plc:'));

      if (hasDidPlc) {
        // Does this did:plc resolve on the CURRENT PDS?
        const onCurrentPds = await didResolvesOnPds(u.did, currentPdsUrl);
        if (onCurrentPds) {
          // Path 2: account exists on current PDS but no credential → repair.
          try {
            await repairCredentialForUser(
              svc,
              u.id,
              u.username || u.full_name || (u.email ? u.email.split('@')[0] : '') || 'collector',
              u.email || `collector@swappulse.org`,
            );
            repaired++;
          } catch (err: any) {
            failed++;
            errors.push({ id: u.id, error: `repair: ${err?.message || 'failed'}` });
            console.error('provision-all-identities: repair failed for', u.id, err?.message || err);
          }
        } else {
          // Path 3: did:plc lives on a different PDS → provision a new
          // account on the current PDS (replaces the foreign DID).
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
            errors.push({ id: u.id, error: `provision: ${err?.message || 'failed'}` });
            console.error('provision-all-identities: provision failed for', u.id, err?.message || err);
          }
        }
      } else {
        // Path 3: simulated / no DID → provision a new account.
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
          errors.push({ id: u.id, error: `provision: ${err?.message || 'failed'}` });
          console.error('provision-all-identities: provision failed for', u.id, err?.message || err);
        }
      }
    }

    return Response.json({
      provisioned,
      repaired,
      skipped: alreadyDone,
      failed,
      total: users.length,
      remaining: Math.max(0, pending.length - users.length),
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error('provision-all-identities error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}