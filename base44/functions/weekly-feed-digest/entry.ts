// weekly-feed-digest — publishes a weekly digest of platform news and
// community highlights to the SwapPulse local feed. Aggregates activity from
// the past 7 days (new members, pack openings, posts, trade listings,
// achievements, circles, meetups) and creates a Post entity as the SwapPulse
// official account. If there is no new activity across all categories, the
// function returns without posting — "if there is no new update, don't post
// at all."
//
// Invoked by the "Weekly Feed Digest" workflow every Monday at 9am (Europe/London).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const PROMO_USER_ID = '6a6422a1b8cda8ece8138c87';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    const since = new Date(Date.now() - WEEK_MS).toISOString();

    // Gather recent records (sorted by newest first, capped to avoid over-fetching)
    const [recentPosts, recentUsers, recentTrades, recentAchievements, recentCircles, recentMeetups] = await Promise.all([
      svc.entities.Post.list('-created_date', 500).catch(() => []),
      svc.entities.User.list('-created_date', 200).catch(() => []),
      svc.entities.TradeListing.list('-created_date', 200).catch(() => []),
      svc.entities.Achievement.list('-created_date', 200).catch(() => []),
      svc.entities.Circle.list('-created_date', 200).catch(() => []),
      svc.entities.Meetup.list('-created_date', 200).catch(() => []),
    ]);

    // Filter to the past 7 days (ISO string comparison is lexicographic and correct for ISO-8601)
    const isNew = (r: any) => (r.created_date || r.created_at || '') >= since;
    const newPosts = recentPosts.filter(isNew);
    const packOpenings = newPosts.filter((p: any) => p.post_type === 'pack_opening');
    const newUsers = recentUsers.filter(isNew);
    const newTrades = recentTrades.filter(isNew);
    const newAchievements = recentAchievements.filter(isNew);
    const newCircles = recentCircles.filter(isNew);
    const newMeetups = recentMeetups.filter(isNew);

    const highlights = {
      newMembers: newUsers.length,
      newPosts: newPosts.length,
      packOpenings: packOpenings.length,
      newTrades: newTrades.length,
      newAchievements: newAchievements.length,
      newCircles: newCircles.length,
      newMeetups: newMeetups.length,
    };

    // Don't post at all if there's no new activity
    const hasActivity = Object.values(highlights).some((v) => v > 0);
    if (!hasActivity) {
      console.log('weekly-feed-digest: no new activity in the past 7 days — skipping post');
      return Response.json({ posted: false, reason: 'No new activity in the past 7 days', highlights });
    }

    // Compose the digest message (Post.content max 500 chars)
    const lines: string[] = ['📋 This Week on SwapPulse', ''];
    if (highlights.newMembers > 0) lines.push(`👋 ${highlights.newMembers} new collector${highlights.newMembers > 1 ? 's' : ''} joined`);
    if (highlights.packOpenings > 0) lines.push(`🔥 ${highlights.packOpenings} pack opening${highlights.packOpenings > 1 ? 's' : ''} shared`);
    if (highlights.newPosts > 0) lines.push(`💬 ${highlights.newPosts} post${highlights.newPosts > 1 ? 's' : ''} in the feed`);
    if (highlights.newTrades > 0) lines.push(`🔄 ${highlights.newTrades} new trade listing${highlights.newTrades > 1 ? 's' : ''}`);
    if (highlights.newAchievements > 0) lines.push(`🏆 ${highlights.newAchievements} achievement${highlights.newAchievements > 1 ? 's' : ''} earned`);
    if (highlights.newCircles > 0) lines.push(`🎪 ${highlights.newCircles} new circle${highlights.newCircles > 1 ? 's' : ''} created`);
    if (highlights.newMeetups > 0) lines.push(`📅 ${highlights.newMeetups} new meetup${highlights.newMeetups > 1 ? 's' : ''}`);
    lines.push('');
    lines.push('Thanks for being part of the community.');
    lines.push('');
    lines.push('#WeeklyDigest #PokemonTCG');

    const content = lines.join('\n').slice(0, 500);
    const hashtags = ['WeeklyDigest', 'PokemonTCG'];
    const canonicalTags = hashtags.map((h) => h.toLowerCase());

    // Look up the promo account for author identity
    const promoUsers = await svc.entities.User
      .filter({ id: PROMO_USER_ID }, '-created_date', 1)
      .catch(() => []);
    const promoUser = promoUsers?.[0];
    const { getUserIdentity } = await import('../../shared/userIdentity.ts');
    const identity = promoUser ? await getUserIdentity(svc, promoUser) : null;

    // Create the post in the local feed
    const post = await svc.entities.Post.create({
      content,
      post_type: 'text',
      post_category: 'general',
      visibility_scope: 'public',
      did: identity?.did || '',
      author_name: 'SwapPulse',
      author_handle: 'swappulse.org',
      hashtags,
      canonical_tags: canonicalTags,
      bridged: false,
    });

    console.log('weekly-feed-digest: posted weekly digest', post.id, JSON.stringify(highlights));
    return Response.json({
      posted: true,
      post_id: post.id,
      content,
      highlights,
    });
  } catch (error) {
    console.error('weekly-feed-digest error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});