// get-bluesky-mutuals — discovers a SwapPulse user's Bluesky/AT Protocol mutuals
// (accounts they follow who also follow them back) via the public AppView, and
// flags which mutuals are already SwapPulse members vs. external accounts to
// invite. This makes the user's portable AT Protocol social graph the seed for
// their SwapPulse network.
//
// Input:  { }  (uses the authenticated user's did)
// Output: { mutuals: [{ did, handle, displayName, avatar, description,
//                       followersCount, followsCount, isMember, isFollowed }],
//            total, onSwapPulse, hasIdentity }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const APPVIEW = 'https://public.api.bsky.app';
const MAX_PAGES = 3; // up to 300 follows + 300 followers
const MAX_MUTUALS = 100;

async function fetchGraph(endpoint: string, actor: string, listKey: string) {
  const out = new Map();
  let cursor = '';
  for (let i = 0; i < MAX_PAGES; i++) {
    const url = `${APPVIEW}/xrpc/app.bsky.graph.${endpoint}?actor=${encodeURIComponent(actor)}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    let res;
    try {
      res = await fetch(url);
    } catch {
      break;
    }
    if (!res.ok) break;
    const data = await res.json().catch(() => ({}));
    const items = data[listKey] || [];
    for (const it of items) {
      if (it.did) {
        out.set(it.did, {
          did: it.did,
          handle: it.handle || '',
          displayName: it.displayName || '',
          avatar: it.avatar || '',
          description: it.description || '',
          followersCount: it.followersCount || 0,
          followsCount: it.followsCount || 0,
        });
      }
    }
    cursor = data.cursor;
    if (!cursor) break;
  }
  return out;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const myDid = user.did || '';
    if (!myDid) {
      return Response.json({ hasIdentity: false, mutuals: [], total: 0, onSwapPulse: 0 });
    }

    // Fetch follows + followers in parallel
    const [followsMap, followersMap] = await Promise.all([
      fetchGraph('getFollows', myDid, 'follows'),
      fetchGraph('getFollowers', myDid, 'followers'),
    ]);

    // Mutuals = people I follow who also follow me
    const mutuals: any[] = [];
    for (const [did, profile] of followsMap) {
      if (followersMap.has(did)) {
        mutuals.push(profile);
      }
    }
    mutuals.sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0));
    const capped = mutuals.slice(0, MAX_MUTUALS);

    // Check SwapPulse membership for each mutual (service role, parallel)
    const svc = base44.asServiceRole;
    const membershipChecks = await Promise.all(
      capped.map((m) =>
        svc.entities.User.filter({ did: m.did }, '-created_date', 1)
          .then((users) => ({ did: m.did, isMember: users.length > 0 }))
          .catch(() => ({ did: m.did, isMember: false })),
      ),
    );
    const memberMap = new Map(membershipChecks.map((c) => [c.did, c.isMember]));

    // Check which mutuals the user already follows on SwapPulse
    const existingFollows = await base44.entities.Follow
      .filter({ did: myDid }, '-created_date', 500)
      .catch(() => []);
    const followedDids = new Set(existingFollows.map((f: any) => f.subject_did));

    const result = capped.map((m) => ({
      ...m,
      isMember: memberMap.get(m.did) || false,
      isFollowed: followedDids.has(m.did),
    }));

    return Response.json({
      hasIdentity: true,
      mutuals: result,
      total: result.length,
      onSwapPulse: result.filter((m) => m.isMember).length,
    });
  } catch (error) {
    console.error('get-bluesky-mutuals error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}