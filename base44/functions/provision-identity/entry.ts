// provision-identity — creates a real AT Protocol account on the self-hosted
// PDS for the calling SwapPulse user, giving them their own did:plc + federated
// identity with a username.swappulse.org handle.
//
// Called from ProfileSetup after the user picks a username. Uses the shared
// provisionIdentityForUser logic (PDS admin API + app password + PdsCredential
// storage). If the PDS is unreachable the call errors — the caller catches it
// so signup completes regardless, and provisioning retries on next attempt.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { provisionIdentityForUser } from '../../shared/provisionIdentity.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const username = String(body.username || body.handle || '').trim();
    if (!username) return Response.json({ error: 'username is required' }, { status: 400 });

    // Already provisioned — skip
    if (me.did?.startsWith('did:plc:')) {
      return Response.json({ skipped: true, did: me.did, handle: me.bsky_handle || '' });
    }

    const svc = base44.asServiceRole;
    const { did, handle } = await provisionIdentityForUser(
      svc, me.id, username, me.email || `${username}@swappulse.org`,
    );

    return Response.json({ provisioned: true, did, handle });
  } catch (error) {
    console.error('provision-identity error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}