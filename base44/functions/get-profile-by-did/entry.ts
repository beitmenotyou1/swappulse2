// get-profile-by-did — public lookup that returns a collector's public
// profile info (name, federated handle, username, avatar, bio, DID) for a
// given AT Protocol DID. Used by the public profile page to render the
// @username.swappulse.org header. Returns only public fields — never email
// or credentials. No auth required (visitor profiles work for guests).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const did = String(body.did || '').trim();
    if (!did) return Response.json({ error: 'did required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const users = await svc.entities.User.list('-created_date', 500).catch(() => []);
    const u = (users || []).find((x: any) => x.did === did);
    if (!u) return Response.json({ found: false });

    return Response.json({
      found: true,
      name: u.full_name || u.username || '',
      bsky_handle: u.bsky_handle || '',
      username: u.username || '',
      avatar: u.avatar || '',
      did: u.did || '',
      description: u.description || '',
      handle_verified: !!(u as any).handle_verified,
    });
  } catch (error: any) {
    console.error('get-profile-by-did error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}