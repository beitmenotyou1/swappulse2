// resolve-atproto-actor — resolves an AT Protocol handle (or DID) to a full
// actor profile via the public AppView, and reports whether that actor is
// already a SwapPulse member.
//
// Used by the "Find people" UI to let SwapPulse users discover and follow
// accounts from other AT Protocol PDSs (federation follows).
//
// Input:  { handle }  — handle (e.g. "alice.bsky.social") or DID
// Output: { found, did, handle, displayName, avatar, banner, description,
//           followersCount, followsCount, postsCount, isMember }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const APPVIEW = 'https://public.api.bsky.app';

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

    const body = await req.json().catch(() => ({}));
    const handle = String(body.handle || '').trim().replace(/^@/, '');
    if (!handle) return Response.json({ error: 'handle required' }, { status: 400 });

    // 1. Resolve handle → DID
    let did = '';
    if (handle.startsWith('did:')) {
      did = handle;
    } else {
      try {
        const res = await fetch(
          `${APPVIEW}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
        );
        if (!res.ok) {
          return Response.json({ found: false, error: 'Could not resolve handle' });
        }
        const data = await res.json();
        did = data.did;
      } catch {
        return Response.json({ found: false, error: 'Could not resolve handle' });
      }
    }
    if (!did) return Response.json({ found: false });

    // 2. Fetch full profile from the AppView
    let profile: any = {};
    try {
      const res = await fetch(
        `${APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
      );
      if (res.ok) profile = await res.json();
    } catch {}

    // 3. Check if this actor is already a SwapPulse member
    const svc = base44.asServiceRole;
    let isMember = false;
    try {
      const users = await svc.entities.User.filter({ did }, '-created_date', 1);
      isMember = users.length > 0;
    } catch {}

    return Response.json({
      found: true,
      did: profile.did || did,
      handle: profile.handle || handle,
      displayName: profile.displayName || '',
      avatar: profile.avatar || '',
      banner: profile.banner || '',
      description: profile.description || '',
      followersCount: profile.followersCount || 0,
      followsCount: profile.followsCount || 0,
      postsCount: profile.postsCount || 0,
      isMember,
    });
  } catch (error) {
    console.error('resolve-atproto-actor error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});