// fetch-card-thread — fetches external Bluesky replies to bridged card-channel
// posts via the public AppView's getPostThread endpoint.
//
// Given an array of bridged post at:// URIs, walks each post's reply thread on
// the wider network and returns replies in a Post-compatible shape so the card
// discussion tab can render cross-network replies alongside local ones.
//
// Input:  { uris: string[] }   — bridged app.bsky.feed.post at:// URIs
// Output: { repliesByUri: Record<string, Post[]> }
//
// Replies whose at:// URI already exists as a local SwapPulse post are still
// returned — the frontend dedupes by at_uri so bridged local replies aren't
// shown twice. Only top-level post URIs are queried; their reply trees are
// flattened into a single reply list per URI.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const APPVIEW = 'https://public.api.bsky.app';

interface ThreadNode {
  type?: string;
  post?: {
    uri?: string;
    cid?: string;
    author?: { did?: string; handle?: string; displayName?: string; avatar?: string };
    record?: { text?: string; createdAt?: string; reply?: any };
    likeCount?: number;
    repostCount?: number;
    replyCount?: number;
  };
  replies?: ThreadNode[];
}

function flattenReplies(node: ThreadNode | undefined, out: any[]) {
  if (!node) return;
  // 'threadgate' / 'blocked' nodes have no post
  if (node.post) {
    const post = node.post;
    const author = post.author || {};
    const record = post.record || {};
    out.push({
      id: post.uri,
      content: record.text || '',
      author_name: author.displayName || author.handle || '',
      author_handle: author.handle || '',
      author_avatar: author.avatar || '',
      did: author.did || '',
      at_uri: post.uri,
      cid: post.cid || '',
      created_date: record.createdAt || '',
      post_type: 'text',
      likes: post.likeCount || 0,
      reposts: post.repostCount || 0,
      replies: post.replyCount || 0,
      external: true,
      external_source: 'bluesky',
    });
  }
  if (Array.isArray(node.replies)) {
    for (const child of node.replies) flattenReplies(child, out);
  }
}

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
    const uris: string[] = Array.isArray(body.uris) ? body.uris.filter((u) => typeof u === 'string' && u.startsWith('at://')) : [];
    if (!uris.length) return Response.json({ repliesByUri: {} });

    const repliesByUri: Record<string, any[]> = {};

    // Fetch each thread in parallel (cap at 25 to bound the work)
    const toFetch = uris.slice(0, 25);
    const fetches = toFetch.map((uri) =>
      fetch(`${APPVIEW}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=1`)
        .then((res) => (res.ok ? res.json() : { thread: null }))
        .catch(() => ({ thread: null }))
    );
    const results = await Promise.all(fetches);

    for (let i = 0; i < toFetch.length; i++) {
      const thread = (results[i] as any).thread;
      if (!thread || thread.type === 'notFound' || thread.type === 'blocked') {
        repliesByUri[toFetch[i]] = [];
        continue;
      }
      // The thread root is the queried post itself; its replies are what we want.
      // Skip the root post (it's the local card-channel post) and only collect replies.
      const collected: any[] = [];
      if (Array.isArray(thread.replies)) {
        for (const child of thread.replies) flattenReplies(child, collected);
      }
      // Sort oldest first to match discussion order
      collected.sort((a, b) => new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime());
      repliesByUri[toFetch[i]] = collected;
    }

    return Response.json({ repliesByUri });
  } catch (error) {
    console.error('fetch-card-thread error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});