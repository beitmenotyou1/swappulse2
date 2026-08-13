// fetch-external-feed — fetches recent posts from external AT Protocol accounts
// that the current user follows (accounts on other PDSs that are not SwapPulse
// members), via the public AppView's getAuthorFeed endpoint.
//
// Returns a merged, time-sorted feed of external posts in a Post-compatible
// shape so the Home feed can render them alongside local SwapPulse posts.
//
// Input:  { limit?: number }
// Output: { items: Post[], source: 'external' }

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

    const myDid = user.did || '';
    if (!myDid) return Response.json({ items: [], source: 'external' });

    const body = await req.json().catch(() => ({}));
    const totalLimit = Math.min(Math.max(Number(body.limit) || 30, 1), 100);

    // 1. Get the user's follows
    const follows = await base44.entities.Follow.filter({ did: myDid }, '-created_date', 100).catch(() => []);

    // 2. Get SwapPulse member DIDs to filter out internal follows
    const svc = base44.asServiceRole;
    let swappulseDids = new Set<string>();
    try {
      const allUsers = await svc.entities.User.list('-created_date', 500);
      swappulseDids = new Set(allUsers.map((u: any) => u.did).filter(Boolean));
    } catch {}

    // 3. Filter to external follows only
    const externalFollows = follows.filter((f: any) => f.subject_did && !swappulseDids.has(f.subject_did));
    if (!externalFollows.length) {
      return Response.json({ items: [], source: 'external' });
    }

    // 4. Fetch posts from up to 20 external follows (5 posts each)
    const followsToFetch = externalFollows.slice(0, 20);
    const perActor = 5;

    const fetches = followsToFetch.map((f: any) =>
      fetch(
        `${APPVIEW}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(f.subject_did)}&limit=${perActor}`,
      )
        .then((res) => (res.ok ? res.json() : { feed: [] }))
        .catch(() => ({ feed: [] }))
    );

    const results = await Promise.all(fetches);

    // 5. Transform and merge posts
    const items: any[] = [];
    for (let i = 0; i < results.length; i++) {
      const feed = results[i].feed || [];
      for (const item of feed) {
        const post = item.post || {};
        const author = post.author || {};
        const record = post.record || {};

        // Skip reposts and replies (only show original posts)
        if (record.reply) continue;

        items.push({
          id: post.uri,
          content: record.text || '',
          author_name: author.displayName || author.handle || '',
          author_handle: author.handle || '',
          author_avatar: author.avatar || '',
          did: author.did || '',
          at_uri: post.uri,
          cid: post.cid || '',
          created_date: record.createdAt || post.indexedAt || '',
          post_type: 'text',
          likes: post.likeCount || 0,
          reposts: post.repostCount || 0,
          replies: post.replyCount || 0,
          external: true,
          external_source: 'bluesky',
        });
      }
    }

    // 6. Sort by creation time (newest first) and cap
    items.sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime());

    return Response.json({ items: items.slice(0, totalLimit), source: 'external' });
  } catch (error) {
    console.error('fetch-external-feed error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});