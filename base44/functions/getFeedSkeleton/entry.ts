// §2.2 getFeedSkeleton — Who to Follow feed generator endpoint.
// Runs the trust-based recommendation pipeline over the app's own entities
// (Vouch, Follow, CollectionEntry, User), caches results in the
// RecommendationCache entity (1h TTL), and returns an AT Protocol feed
// skeleton plus an enriched `recommendations` array for the SwapPulse UI.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  runRecommendationPipeline,
  toDid,
  defaultPreferences,
} from '../../shared/recommendationEngine.ts';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;
    const actorDid = toDid(user.id, (user as any).did);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 25);
    const cursor = body.cursor ? Number(body.cursor) : 0;

    // 1. Serve from cache if fresh
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
        actorDid,
        fromCache: true,
        cursor: cursor + limit < recs.length ? String(cursor + limit) : undefined,
        feed: slice.map((r: any) => ({ post: r.did, reason: 'recommendation' })),
        recommendations: slice,
      });
    }

    // 2. Fetch the materialised view (entity rows)
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

    // 3. Persist cache (upsert)
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
      actorDid,
      fromCache: false,
      cursor: cursor + limit < recommendations.length ? String(cursor + limit) : undefined,
      feed: slice.map((r: any) => ({ post: r.did, reason: 'recommendation' })),
      recommendations: slice,
    });
  } catch (error) {
    console.error('[getFeedSkeleton] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}