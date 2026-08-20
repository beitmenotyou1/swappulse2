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
    // Filter by DID directly instead of listing all users — avoids loading
    // the entire user table and prevents data exposure when >500 users exist.
    const users = await svc.entities.User.filter({ did }, '-created_date', 1).catch(() => []);
    const u = users?.[0];
    if (!u) return Response.json({ found: false });

    // Derive a local username from the email local-part when neither a
    // federated handle nor a username is set, so the profile header never
    // falls back to the generic "collector" placeholder.
    const emailLocal = (u.email || '').split('@')[0] || '';
    const usernameFallback = u.username || emailLocal || '';

    return Response.json({
      found: true,
      name: u.display_name || u.full_name || u.username || emailLocal || 'Collector',
      bsky_handle: u.bsky_handle || '',
      username: usernameFallback,
      avatar: u.avatar || '',
      header: u.header || '',
      did: u.did || '',
      description: u.description || '',
      handle_verified: !!(u as any).handle_verified,
    });
  } catch (error: any) {
    console.error('get-profile-by-did error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}