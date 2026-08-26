// §Alpha 1.4 Podcast Feed Generator - org.swappulse.podcasts
// Returns podcast episodes across the platform, sortable by recency,
// most played (play_count), or most liked (no like records yet → falls back
// to play_count). A real feed generator would be an independent XRPC service
// users subscribe to; this is the SwapPulse-hosted view of the feed.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const sort = url.searchParams.get('sort') || 'recent'; // recent | played | liked
    const base44 = createClientFromRequest(req);
    // Verify caller authentication — this function queries PodcastEpisode
    // records via the service role, so it must not be callable by
    // unauthenticated strangers.
    try {
      const me = await base44.auth.me();
      if (!me?.id) throw new Error('unauthenticated');
    } catch {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    const svc = base44.asServiceRole;

    let eps = await svc.entities.PodcastEpisode.list('-published_at', 100).catch(() => []);
    if (sort === 'played' || sort === 'liked') {
      eps = [...eps].sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
    }
    return Response.json({ feed: 'org.swappulse.podcasts', sort, episodes: eps });
  } catch (error) {
    console.error('podcasts feed error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});