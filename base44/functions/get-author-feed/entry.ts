// get-author-feed — fetches an actor's posts from the public Bluesky AppView
// (app.bsky.feed.getAuthorFeed) and maps them to the local Post shape PostCard
// consumes. Powers the federated Posts tab on external (non-member) profiles so
// visitors see a Bluesky-only collector's actual posts in-place.
//
// Input:  { did, limit? }
// Output: { items: Post[], source: 'appview' }
//
// Works unauthenticated (public AppView). Filters out posts from shadow-banned
// or suspended DIDs via the shared enforcement helper.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAuthorFeed } from '../../shared/appviewProfile.ts';
import { getEnforcedDids } from '../../shared/enforcement.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const did = String(body.did || '').trim();
    const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 50);
    if (!did) {
      return Response.json({ error: 'did required' }, { status: 400 });
    }

    const feed = await fetchAuthorFeed(did, limit);
    if (!feed) {
      return Response.json({ items: [], source: 'appview' });
    }

    const svc = base44.asServiceRole;
    const enforcedDids = await getEnforcedDids(svc);

    const items = feed
      .filter((entry: any) => {
        const authorDid = entry?.post?.author?.did || '';
        return !enforcedDids.has(authorDid);
      })
      .map((entry: any) => {
        const post = entry.post || {};
        const author = post.author || {};
        const record = post.record || {};
        return {
          id: post.uri,
          did: author.did || '',
          author_name: author.displayName || author.handle || 'Collector',
          author_handle: author.handle || '',
          author_avatar: author.avatar || '',
          content: record.text || '',
          created_date: record.createdAt || post.indexedAt || new Date().toISOString(),
          post_type: '',
          card_id: '',
          card_name: '',
          card_image: '',
          set_name: '',
          card_rarity: '',
          replies: post.replyCount || 0,
          likes: post.likeCount || 0,
          reposts: post.repostCount || 0,
          at_uri: post.uri,
          cid: post.cid || '',
        };
      });

    return Response.json({ items, source: 'appview' });
  } catch (error: any) {
    console.error('get-author-feed error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}