// §2.5 resolveUser - resolves a collector handle (email local-part or name) to
// their AT Protocol DID + display info, for vouch/journal/meetup targeting.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const handle = String(body.handle || '').trim().replace(/^@/, '').toLowerCase();
    if (!handle) return Response.json({ error: 'handle required' }, { status: 400 });

    const users = await svc.entities.User.list('-created_date', 500);
    const found = users.find((u) => {
      const emailHandle = (u.email || '').split('@')[0].toLowerCase();
      const full = (u.full_name || '').toLowerCase().replace(/\s+/g, '');
      // Match the federated handle (username.swappulse.org or a verified
      // custom domain like swappulse.org) so /u/<domain> resolves after a
      // domain-handle claim.
      const bsky = (u.bsky_handle || '').toLowerCase().replace(/^@/, '');
      const custom = (u.custom_handle || '').toLowerCase().replace(/^@/, '');
      return bsky === handle || custom === handle || emailHandle === handle || full === handle || (u.email || '').toLowerCase() === handle;
    });

    // Only return users who have a real PDS-backed DID — never fabricate a
    // did:plc from the user id, which would create fake federated identities.
    if (!found || !found.did || !found.did.startsWith('did:plc:')) {
      return Response.json({ found: false });
    }
    return Response.json({
      found: true,
      did: found.did,
      name: found.full_name || '',
      handle: found.bsky_handle || found.custom_handle || (found.email || '').split('@')[0] || handle,
      avatar: found.avatar || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});