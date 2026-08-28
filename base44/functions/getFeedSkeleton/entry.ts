// getFeedSkeleton — AT Protocol feed generator endpoint (public).
//
// Serves multiple SwapPulse feeds so external Bluesky clients can discover
// and subscribe to them from within the Bluesky app, and the internal SwapPulse
// feed UI calls the same endpoint:
//   - trade-listings: active public trade listings
//   - collection-posts: pack openings and showcases
//   - fresh-pulls: recent pack-opening posts (pull reveals)
//   - showcase: card showcase posts + public binders
//   - journals: public collector journal entries
//   - card-reviews: public multi-axis card reviews
//   - whoto-follow: trust-based collector recommendations (auth required)
//
// Local entity queries already include firehose-ingested remote records
// (firehose-ingest upserts them into the same entities by at_uri), so each
// feed automatically serves the merged local+remote dataset — no separate
// merge step is needed. Dedup is handled at ingest time via IngestCursor.
//
// Query params: feed=<feed_uri>, limit=<int>, cursor=<str>
// Public feeds (trade-listings, collection-posts, fresh-pulls, showcase,
// journals, card-reviews) require no auth.
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
  if ([
    'trade-listings', 'collection-posts', 'whoto-follow',
    'fresh-pulls', 'showcase', 'journals', 'card-reviews',
  ].includes(last)) return last;
  return 'trade-listings';
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const url = new URL(req.url);
    // Parse JSON body for internal SDK calls (base44.functions.invoke sends
    // a POST body, not URL query params). External Bluesky clients call via
    // GET with query params, so we merge both, with query params taking priority.
    let body: any = {};
    try {
      const text = await req.clone().text();
      if (text) body = JSON.parse(text);
    } catch {}

    const feedParam = parseFeedParam(url.searchParams.get('feed') || body.feed || null);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || body.limit) || 20, 1), 100);
    const cursorParam = url.searchParams.get('cursor') || body.cursor;
    const cursor = cursorParam ? Number(cursorParam) : 0;

    // Granular feed filters (query params or body):
    //   set    — filter posts by card set name (case-insensitive substring)
    //   labels — comma-separated community label values; only posts carrying
    //            at least one matching CommunityLabel are returned
    const setFilter = (url.searchParams.get('set') || body.set || '').trim();
    const labelFilter = (url.searchParams.get('labels') || body.labels || '').trim();
    const labelValues = labelFilter
      ? labelFilter.split(',').map((v) => v.trim()).filter(Boolean)
      : [];

    // Resolve label filter → set of subject URIs that carry matching labels.
    // Computed once, reused by every post-based feed below.
    let labelledUris: Set<string> | null = null;
    if (labelValues.length > 0) {
      try {
        const labels = await svc.entities.CommunityLabel.filter(
          { label_value: { $in: labelValues } },
          '-created_date',
          500,
        );
        labelledUris = new Set((labels || []).map((l: any) => l.subject_uri).filter(Boolean));
      } catch {
        labelledUris = new Set();
      }
    }

    // Apply granular filters to a list of posts (all post-based feeds share this).
    const applyFilters = (posts: any[]) => {
      let out = posts;
      if (setFilter) {
        const sf = setFilter.toLowerCase();
        out = out.filter((p: any) =>
          (p.set_name || '').toLowerCase().includes(sf) ||
          (p.card_name || '').toLowerCase().includes(sf),
        );
      }
      if (labelledUris !== null) {
        out = out.filter((p: any) =>
          labelledUris.has(p.at_uri) || labelledUris.has(`at://${FEED_DID}/app.bsky.feed.post/${p.id}`),
        );
      }
      return out;
    };

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
        { post_type: { $in: ['pack_opening', 'showcase'] }, visibility_scope: 'public' },
        '-created_date',
        200,
      );
      const enforcedIds = await getEnforcedUserIds(svc);
      const visible = applyFilters(enforcedIds.size > 0
        ? posts.filter((p: any) => !enforcedIds.has(p.created_by_id))
        : posts);
      const slice = visible.slice(cursor, cursor + limit);
      return Response.json({
        cursor: cursor + limit < visible.length ? String(cursor + limit) : undefined,
        feed: slice.map((p: any) => ({
          post: p.at_uri || `at://${FEED_DID}/app.bsky.feed.post/${p.id}`,
          reason: { $type: 'org.swappulse.feedReason', kind: 'collection_post' },
        })),
      });
    }

    // --- fresh-pulls feed (public) ---
    // Recent pack-opening reveal posts. Includes both locally-authored and
    // firehose-ingested remote pack-opening posts (already merged in the Post
    // entity table by firehose-ingest). Enforces public visibility and excludes
    // enforced/suspended users.
    if (feedParam === 'fresh-pulls') {
      const posts = await svc.entities.Post.filter(
        { post_type: 'pack_opening', visibility_scope: 'public' },
        '-created_date',
        200,
      );
      const enforcedIds = await getEnforcedUserIds(svc);
      const visible = applyFilters(enforcedIds.size > 0
        ? posts.filter((p: any) => !enforcedIds.has(p.created_by_id))
        : posts);
      const slice = visible.slice(cursor, cursor + limit);
      return Response.json({
        cursor: cursor + limit < visible.length ? String(cursor + limit) : undefined,
        feed: slice.map((p: any) => ({
          post: p.at_uri || `at://${FEED_DID}/app.bsky.feed.post/${p.id}`,
          reason: { $type: 'org.swappulse.feedReason', kind: 'fresh_pull' },
        })),
      });
    }

    // --- showcase feed (public) ---
    // Card showcase posts plus public binders. Showcase posts are app.bsky.feed
    // records (render in Bluesky); binders are org.swappulse.binder records
    // (discoverable via the feed, rendered natively in SwapPulse). Both are
    // already merged with firehose-ingested remote records in their entity
    // tables. Enforces public visibility and excludes enforced users.
    if (feedParam === 'showcase') {
      const [posts, binders] = await Promise.all([
        svc.entities.Post.filter(
          { post_type: 'showcase', visibility_scope: 'public' },
          '-created_date',
          200,
        ),
        svc.entities.Binder.filter(
          { visibility: 'public' },
          '-created_date',
          200,
        ),
      ]);
      const enforcedIds = await getEnforcedUserIds(svc);
      const visiblePosts = applyFilters(enforcedIds.size > 0
        ? posts.filter((p: any) => !enforcedIds.has(p.created_by_id))
        : posts);
      // Skip binders when granular post filters are active — binders have no
      // set_name or community labels to match against.
      const visibleBinders = (setFilter || labelledUris !== null)
        ? []
        : (enforcedIds.size > 0
          ? binders.filter((b: any) => !enforcedIds.has(b.created_by_id))
          : binders);
      // Merge and sort by created_date descending
      const merged: any[] = [
        ...visiblePosts.map((p: any) => ({
          at_uri: p.at_uri || `at://${FEED_DID}/app.bsky.feed.post/${p.id}`,
          created_date: p.created_date,
          kind: 'showcase_post',
        })),
        ...visibleBinders.map((b: any) => ({
          at_uri: b.at_uri || `at://${FEED_DID}/org.swappulse.binder/${b.id}`,
          created_date: b.created_date,
          kind: 'binder',
        })),
      ].sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
      const slice = merged.slice(cursor, cursor + limit);
      return Response.json({
        cursor: cursor + limit < merged.length ? String(cursor + limit) : undefined,
        feed: slice.map((r: any) => ({
          post: r.at_uri,
          reason: { $type: 'org.swappulse.feedReason', kind: r.kind },
        })),
      });
    }

    // --- journals feed (public) ---
    // Public collector journal entries (org.swappulse.journal records). Already
    // merged with firehose-ingested remote journals. Excludes enforced users.
    if (feedParam === 'journals') {
      const journals = await svc.entities.Journal.filter(
        { visibility: 'public' },
        '-created_date',
        200,
      );
      const enforcedIds = await getEnforcedUserIds(svc);
      const visible = enforcedIds.size > 0
        ? journals.filter((j: any) => !enforcedIds.has(j.created_by_id))
        : journals;
      const slice = visible.slice(cursor, cursor + limit);
      return Response.json({
        cursor: cursor + limit < visible.length ? String(cursor + limit) : undefined,
        feed: slice.map((j: any) => ({
          post: j.at_uri || `at://${FEED_DID}/org.swappulse.journal/${j.id}`,
          reason: { $type: 'org.swappulse.feedReason', kind: 'journal' },
        })),
      });
    }

    // --- card-reviews feed (public) ---
    // Public multi-axis card reviews (org.swappulse.cardReview records). Already
    // merged with firehose-ingested remote reviews. Excludes enforced users.
    if (feedParam === 'card-reviews') {
      const reviews = await svc.entities.CardReview.list('-created_date', 200);
      const enforcedIds = await getEnforcedUserIds(svc);
      const visible = enforcedIds.size > 0
        ? reviews.filter((r: any) => !enforcedIds.has(r.created_by_id))
        : reviews;
      const slice = visible.slice(cursor, cursor + limit);
      return Response.json({
        cursor: cursor + limit < visible.length ? String(cursor + limit) : undefined,
        feed: slice.map((r: any) => ({
          post: r.at_uri || `at://${FEED_DID}/org.swappulse.cardReview/${r.id}`,
          reason: { $type: 'org.swappulse.feedReason', kind: 'card_review' },
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
      // Privacy containment: do not use private collection holdings for
      // cross-user recommendation profiling. Phase 1 will supply only explicit
      // public projection data here.
      Promise.resolve([]),
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