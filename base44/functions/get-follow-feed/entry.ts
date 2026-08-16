// get-follow-feed — personalized "For You" feed: returns only posts from
// accounts the current user follows. Splits follows into SwapPulse-member
// DIDs (posts fetched from the local Post table) and external Bluesky DIDs
// (posts fetched via the public AppView getAuthorFeed), merges and time-sorts
// them. Replaces the old global Post.list firehose on Home.
//
// Input:  { limit?: number }
// Output: { items: Post[], source: 'follow', authed: boolean }
//
// Guest/unauthenticated users get an empty feed (the UI prompts them to follow
// accounts / log in).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const APPVIEW = 'https://public.api.bsky.app';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ items: [], source: 'follow', authed: false });
    const myDid = user.did || '';
    if (!myDid) return Response.json({ items: [], source: 'follow', authed: true });

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);

    // 1. The user's follows
    const follows = await base44.entities.Follow.filter({ did: myDid }, '-created_date', 200).catch(() => []);
    const subjectDids = Array.from(new Set((follows || []).map((f: any) => f.subject_did).filter(Boolean)));

    // 2. Resolve which follows are SwapPulse members (local Post table) vs external
    const svc = base44.asServiceRole;
    const memberDids = new Set<string>();
    await Promise.all(subjectDids.map(async (d) => {
      const users = await svc.entities.User.filter({ did: d }, '-created_date', 1).catch(() => []);
      if (users && users.length) memberDids.add(d);
    }));
    const externalDids = subjectDids.filter((d) => !memberDids.has(d));

    const items: any[] = [];

    // 3. Member posts from the local DB
    if (memberDids.size) {
      const posts = await base44.entities.Post
        .filter({ did: { $in: Array.from(memberDids) } }, '-created_date', limit)
        .catch(() => []);
      for (const p of posts || []) items.push({ ...p, external: false });
    }

    // 4. External posts via the AppView getAuthorFeed
    const externalToFetch = externalDids.slice(0, 20);
    if (externalToFetch.length) {
      const perActor = Math.max(3, Math.ceil(limit / externalToFetch.length));
      const fetches = externalToFetch.map((d) =>
        fetch(`${APPVIEW}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(d)}&limit=${perActor}`)
          .then((r) => (r.ok ? r.json() : { feed: [] }))
          .catch(() => ({ feed: [] }))
      );
      const results = await Promise.all(fetches);
      for (const res of results) {
        for (const item of res.feed || []) {
          const post = item.post || {};
          const author = post.author || {};
          const record = post.record || {};
          if (record.reply) continue; // skip replies — show original posts only
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
          });
        }
      }
    }

    // 5. Merge + time-sort — For You is strictly followed accounts only;
    // discovery of new collectors happens in the Explore tab.
    items.sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime());
    const followedCount = items.length;

    return Response.json({
      items: items.slice(0, limit),
      source: 'follow',
      followed_count: followedCount,
      authed: true,
    });
  } catch (error) {
    console.error('get-follow-feed error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}