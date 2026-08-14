// getFeedSkeleton — AT Protocol feed generator endpoint (public).
//
// Serves multiple SwapPulse feeds so external Bluesky clients can discover
// and subscribe to them from within the Bluesky app:
//   - trade-listings: active public trade listings
//   - collection-posts: pack openings and showcases
//   - whoto-follow: trust-based collector recommendations (auth required)
//
// Query params: feed=<feed_uri>, limit=<int>, cursor=<str>
// Public feeds (trade-listings, collection-posts) require no auth.
// The whoto-follow feed requires authentication for personalization.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  runRecommendationPipeline,
  toDid,
  defaultPreferences,
} from '../../shared/recommendationEngine.ts';
import { getEnforcedUserIds } from '../../shared/enforcement.ts';

const FEED_DID = 'did:web:feed.swappulse.org';
const CACHE_TTL_MS = 60 * 60 * 1000;

function parseFeedParam(feedUri: string | null): string {
  if (!feedUri) return 'trade-listings';
  // Accept full at:// URIs or bare feed names
  const parts = feedUri.split('/');
  const last = parts[parts.length - 1];
  if (['trade-listings', 'collection-posts', 'whoto-follow'].includes(last)) return last;
  return 'trade-listings';
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const url = new URL(req.url);
    const feedParam = parseFeedParam(url.searchParams.get('feed'));
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 100);
    const cursor = url.searchParams.get('cursor') ? Number(url.searchParams.get('cursor')) : 0;

    // Try to get user (optional — public feeds don't require auth)
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {}
    const actorDid = user ? toDid(user.id, (user as any).did) : null;

    // --- trade-listings feed (public) ---
    if (feedParam === 'trade-listings') {
      const listings = await svc.entities.TradeListing.filter(
        { status: 'open', visibility: 'public' },
        '-created_date',
        200,
      );
      const enforcedIds = await getEnforcedUserIds(svc);
      const visible = enforcedIds.size > 0
        ? listings.filter((l: any) => !enforcedIds.has(l.created_by_id))
        : listings;
      const slice = visible.slice(cursor, cursor + limit);
      return Response.json({
        cursor: cursor + limit < visible.length ? String(cursor + limit) : undefined,
        feed: slice.map((l: any) => ({
          post: l.at_uri || `at://${FEED_DID}/app.bsky.feed.post/${l.id}`,
          reason: { $type: 'org.swappulse.feedReason', kind: 'trade_listing' },
        })),
      });
    }

    // --- collection-posts feed (public) ---
    if (feedParam === 'collection-posts') {
      const posts = await svc.entities.Post.filter(
        { post_type: { $in: ['pack_opening', 'showcase'] } },
        '-created_date',
        200,
      );
      const enforcedIds = await getEnforcedUserIds(svc);
      const visible = enforcedIds.size > 0
        ? posts.filter((p: any) => !enforcedIds.has(p.created_by_id))
        : posts;
      const slice = visible.slice(cursor, cursor + limit);
      return Response.json({
        cursor: cursor + limit < visible.length ? String(cursor + limit) : undefined,
        feed: slice.map((p: any) => ({
          post: p.at_uri || `at://${FEED_DID}/app.bsky.feed.post/${p.id}`,
          reason: { $type: 'org.swappulse.feedReason', kind: 'collection_post' },
        })),
      });
    }

    // --- whoto-follow feed (requires auth for personalization) ---
    if (!user || !actorDid) {
      return Response.json({ error: 'Authentication required for Who to Follow feed' }, { status: 401 });
    }

    // Check cache
    const cachedRows = await svc.entities.RecommendationCache.filter(
      { did: actorDid },
      '-updated_date',
      1,
    );
    const cached = cachedRows[0];
    if (
      cached &&
      Array.isArray(cached.recommendations) &&
      cached.generated_at &&
      Date.now() - new Date(cached.generated_at).getTime() < CACHE_TTL_MS
    ) {
      const recs = cached.recommendations;
      const slice = recs.slice(cursor, cursor + limit);
      return Response.json({
        cursor: cursor + limit < recs.length ? String(cursor + limit) : undefined,
        feed: slice.map((r: any) => ({
          post: `at://${r.did}/app.bsky.actor.profile/self`,
          reason: { $type: 'org.swappulse.feedReason', kind: 'recommendation' },
        })),
      });
    }

    // Run recommendation pipeline
    const [users, vouches, follows, collectionEntries, prefRows] = await Promise.all([
      svc.entities.User.list('-created_date', 2000),
      svc.entities.Vouch.list('-created_date', 2000),
      svc.entities.Follow.list('-created_date', 2000),
      svc.entities.CollectionEntry.list('-updated_date', 2000),
      svc.entities.RecommendationPreference.filter({ did: actorDid }, '-updated_date', 1),
    ]);

    const p = prefRows[0];
    const prefs = p
      ? {
          dismissedUsers: p.dismissed_users || [],
          targetPersonas: p.target_personas || [],
          excludeRegions: p.exclude_regions || [],
          maxSimilarityScore: p.max_similarity_score ?? 85,
          serendipityEnabled: p.serendipity_enabled ?? true,
          newUserBoost: p.new_user_boost ?? true,
          maxSuggestionsPerBatch: p.max_suggestions_per_batch ?? 10,
          showWhyRecommended: p.show_why_recommended ?? true,
        }
      : defaultPreferences();

    const recommendations = runRecommendationPipeline({
      userDid: actorDid,
      users,
      vouches,
      follows,
      collectionEntries,
      prefs,
    });

    // Persist cache
    if (cached) {
      await svc.entities.RecommendationCache.update(cached.id, {
        recommendations,
        generated_at: new Date().toISOString(),
      });
    } else {
      await svc.entities.RecommendationCache.create({
        did: actorDid,
        recommendations,
        generated_at: new Date().toISOString(),
      });
    }

    const slice = recommendations.slice(cursor, cursor + limit);
    return Response.json({
      cursor: cursor + limit < recommendations.length ? String(cursor + limit) : undefined,
      feed: slice.map((r: any) => ({
        post: `at://${r.did}/app.bsky.actor.profile/self`,
        reason: { $type: 'org.swappulse.feedReason', kind: 'recommendation' },
      })),
    });
  } catch (error) {
    console.error('[getFeedSkeleton] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}