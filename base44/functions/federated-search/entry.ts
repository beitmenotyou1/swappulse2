// federated-search — searches across the AT Protocol network (Bluesky AppView)
// for actors and posts from any PDS, not just SwapPulse. Lets collectors
// discover content and people from the broader fediverse without leaving
// SwapPulse.
//
// Calls the public AppView search endpoints:
//   - app.bsky.actor.searchActors  → federated collector profiles
//   - app.bsky.feed.searchPosts    → federated posts (text, pack openings, etc.)
//
// Results are annotated with isMember so the UI can badge SwapPulse locals
// vs. external federated accounts. Post results include the author DID,
// display name, handle, avatar, text, and at:// URI so the UI can render a
// preview card and link to the post detail.
//
// Input:  { query: string, limit?: number }
// Output: { actors: [{ did, handle, displayName, avatar, description, isMember }],
//           posts:  [{ uri, cid, text, authorDid, authorHandle, authorName, authorAvatar, indexedAt }] }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const APPVIEW = 'https://public.api.bsky.app';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {}
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const query = String(body.query || '').trim();
    const limit = Math.min(Math.max(parseInt(body.limit, 10) || 12, 1), 25);
    if (!query) {
      return Response.json({ actors: [], posts: [] });
    }

    // Fire both searches in parallel
    const [actorsRes, postsRes] = await Promise.all([
      fetch(
        `${APPVIEW}/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(query)}&limit=${limit}`,
      ).catch(() => null),
      fetch(
        `${APPVIEW}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${limit}`,
      ).catch(() => null),
    ]);

    const actorsJson = actorsRes?.ok ? await actorsRes.json() : { actors: [] };
    const postsJson = postsRes?.ok ? await postsRes.json() : { posts: [] };

    // Batch-check which actor DIDs are SwapPulse members
    const actorDids: string[] = (actorsJson.actors || [])
      .map((a: any) => a.did)
      .filter(Boolean);
    const postAuthorDids: string[] = (postsJson.posts || [])
      .map((p: any) => p.author?.did)
      .filter(Boolean);
    const allDids = Array.from(new Set([...actorDids, ...postAuthorDids]));

    const memberDids = new Set<string>();
    if (allDids.length > 0) {
      const svc = base44.asServiceRole;
      // Check membership in chunks of 50 (filter with $in)
      for (let i = 0; i < allDids.length; i += 50) {
        const chunk = allDids.slice(i, i + 50);
        try {
          const users = await svc.entities.User.filter({ did: { $in: chunk } }, '-created_date', 50);
          (users || []).forEach((u: any) => { if (u.did) memberDids.add(u.did); });
        } catch {}
      }
    }

    const actors = (actorsJson.actors || []).map((a: any) => ({
      did: a.did || '',
      handle: a.handle || '',
      displayName: a.displayName || a.handle || '',
      avatar: a.avatar || '',
      description: a.description || '',
      isMember: memberDids.has(a.did),
    }));

    const posts = (postsJson.posts || []).map((p: any) => ({
      uri: p.uri || '',
      cid: p.cid || '',
      text: (p.record?.text || '').slice(0, 500),
      authorDid: p.author?.did || '',
      authorHandle: p.author?.handle || '',
      authorName: p.author?.displayName || p.author?.handle || '',
      authorAvatar: p.author?.avatar || '',
      isMember: memberDids.has(p.author?.did),
      indexedAt: p.indexedAt || '',
    }));

    return Response.json({ actors, posts });
  } catch (error: any) {
    console.error('federated-search error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}