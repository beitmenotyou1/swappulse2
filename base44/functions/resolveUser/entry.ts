// §2.5 resolveUser - resolves a collector handle (email local-part or name) to
// their AT Protocol DID + display info, for vouch/journal/meetup targeting.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const handle = String(body.handle || '').trim().replace(/^@/, '').toLowerCase();
    if (!handle) return Response.json({ error: 'handle required' }, { status: 400 });

    const users = await svc.entities.User.list('-created_date', 500);
    const found = users.find((u) => {
      const emailHandle = (u.email || '').split('@')[0].toLowerCase();
      const full = (u.full_name || '').toLowerCase().replace(/\s+/g, '');
      return emailHandle === handle || full === handle || (u.email || '').toLowerCase() === handle;
    });

    if (!found) return Response.json({ found: false });
    return Response.json({
      found: true,
      did: found.did || 'did:plc:' + String(found.id).replace(/-/g, '').slice(0, 24),
      name: found.full_name || '',
      handle: (found.email || '').split('@')[0] || handle,
      avatar: found.avatar_url || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});