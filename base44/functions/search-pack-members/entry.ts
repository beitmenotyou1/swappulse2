// search-pack-members — friends-first collector search for the starter pack
// composer. Queries the Bluesky AppView actor search, then annotates and
// re-orders results so the author's friends/follows appear first, then other
// SwapPulse members, then the rest. Friends-first ordering is driven by the
// caller's Follow graph.
//
// Input:  { query: string, limit?: number }
// Output: { results: [{ did, handle, displayName, avatar, isFriend, isMember }] }
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const APPVIEW = 'https://public.api.bsky.app';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({} as any));
    const query = String(body.query || '').trim();
    const limit = Math.min(Math.max(parseInt(body.limit, 10) || 20, 1), 30);
    if (!query) return Response.json({ results: [] });

    const myDid = user.data?.did || user.did || '';
    const svc = base44.asServiceRole;

    // Caller's follows (for friends-first ordering).
    const followedDids = new Set<string>();
    if (myDid) {
      try {
        const follows = await svc.entities.Follow.filter({ did: myDid }, '-created_date', 1000);
        (follows || []).forEach((f: any) => { if (f.subject_did) followedDids.add(f.subject_did); });
      } catch {}
    }

    // AppView actor search.
    const res = await fetch(
      `${APPVIEW}/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(query)}&limit=${limit}`,
    ).catch(() => null);
    const json = res?.ok ? await res.json() : { actors: [] };
    const actors: any[] = json.actors || [];

    // Batch-check SwapPulse membership.
    const actorDids = actors.map((a) => a.did).filter(Boolean);
    const memberDids = new Set<string>();
    if (actorDids.length) {
      for (let i = 0; i < actorDids.length; i += 50) {
        const chunk = actorDids.slice(i, i + 50);
        try {
          const users = await svc.entities.User.filter({ did: { $in: chunk } }, '-created_date', 50);
          (users || []).forEach((u: any) => { if (u.did) memberDids.add(u.did); });
        } catch {}
      }
    }

    const results = actors.map((a) => ({
      did: a.did || '',
      handle: a.handle || '',
      displayName: a.displayName || a.handle || '',
      avatar: a.avatar || '',
      isFriend: followedDids.has(a.did),
      isMember: memberDids.has(a.did),
    }));

    // Friends first, then members, then the rest.
    const rank = (r: any) => (r.isFriend ? 0 : r.isMember ? 1 : 2);
    results.sort((a, b) => rank(a) - rank(b));

    return Response.json({ results });
  } catch (error: any) {
    console.error('search-pack-members error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}