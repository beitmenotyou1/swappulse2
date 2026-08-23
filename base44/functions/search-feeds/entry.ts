// search-feeds — feed picker search for the starter pack composer. Returns the
// caller's subscribed/pinned feeds first (from FeedSubscription), then broader
// discoverable feed generators from the Bluesky AppView. Selecting a feed adds
// its at:// URI to the pack's feed_uris.
//
// Input:  { query?: string, limit?: number }
// Output: { subscribed: [{ feed_uri, feed_name }], discoverable: [{ uri, displayName, description, avatar }] }
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

    const myDid = user.data?.did || user.did || '';
    const svc = base44.asServiceRole;

    // Subscribed feeds first.
    const subscribed: { feed_uri: string; feed_name: string }[] = [];
    if (myDid) {
      try {
        const subs = await svc.entities.FeedSubscription.filter({ did: myDid }, '-created_date', 50);
        for (const s of subs || []) {
          if (!s.feed_uri) continue;
          if (query) {
            const name = (s.feed_name || '').toLowerCase();
            if (!name.includes(query.toLowerCase()) && !s.feed_uri.toLowerCase().includes(query.toLowerCase())) continue;
          }
          subscribed.push({ feed_uri: s.feed_uri, feed_name: s.feed_name || s.feed_uri });
        }
      } catch {}
    }

    // Discoverable feed generators from the AppView.
    let discoverable: any[] = [];
    if (query) {
      try {
        const res = await fetch(
          `${APPVIEW}/xrpc/app.bsky.unspecced.getPopularFeedGenerators?q=${encodeURIComponent(query)}&limit=${limit}`,
        ).catch(() => null);
        const json = res?.ok ? await res.json() : { feeds: [] };
        discoverable = (json.feeds || []).map((f: any) => ({
          uri: f.uri || '',
          displayName: f.displayName || f.uri || '',
          description: f.description || '',
          avatar: f.avatar || '',
        }));
      } catch {}
    }

    return Response.json({ subscribed, discoverable });
  } catch (error: any) {
    console.error('search-feeds error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}