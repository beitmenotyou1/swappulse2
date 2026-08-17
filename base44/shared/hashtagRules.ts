// SwapPulse hashtag abuse labeler — rules engine + label definitions.
// Pure logic ported from the labeler service spec. No infra deps.
// Context (recent posts, trending, canonical matches, clusters) is assembled
// by the caller; rules that lack their context simply don't fire.

export const LABEL_DEFINITIONS = [
  {
    identifier: 'hashtag-spam',
    description: 'Post contains excessive or repetitive hashtags that appear designed to game discovery rather than organise content',
    severity: 'warn',
    blurs: false,
    default: false,
  },
  {
    identifier: 'hashtag-stuffing',
    description: 'Post uses the maximum allowed number of hashtags with low relevance to post content',
    severity: 'warn',
    blurs: false,
    default: false,
  },
  {
    identifier: 'hashtag-hijack',
    description: 'Post uses a trending or popular hashtag with content that is clearly unrelated to that topic',
    severity: 'warn',
    blurs: false,
    default: false,
  },
  {
    identifier: 'hashtag-flooding',
    description: 'User has posted multiple times within a short window using identical or near-identical hashtag sets across unrelated content',
    severity: 'escalate',
    blurs: true,
    default: false,
  },
  {
    identifier: 'hashtag-coordinated-spam',
    description: 'Multiple users posting similar content with coordinated hashtag patterns, indicating organised manipulation',
    severity: 'escalate',
    blurs: true,
    default: false,
  },
  {
    identifier: 'hashtag-misleading',
    description: 'Hashtag suggests content related to a specific card or set but post content does not match',
    severity: 'inform',
    blurs: false,
    default: false,
  },
];

export function severityFor(label) {
  const def = LABEL_DEFINITIONS.find((d) => d.identifier === label);
  return def ? def.severity : 'inform';
}

export const DEFAULT_CONFIG = {
  maxTags: 15,
  stuffingThreshold: 12,
  floodingWindowMinutes: 30,
  floodingMaxIdenticalSets: 3,
  hijackTrendingMinPosts: 50,
  hijackRelevanceThreshold: 0.35,
  misleadingConfidenceThreshold: 0.65,
};

/**
 * Evaluate a post for hashtag-related spam patterns.
 * Returns suggested labels and human-readable reasons.
 */
export function evaluateHashtagRules(post, context, config) {
  config = config || DEFAULT_CONFIG;
  const labels = [];
  const reasons = [];

  const tags = post.hashtags || [];
  const tagCount = tags.length;

  // Rule 1: Hard cap exceeded
  if (tagCount > config.maxTags) {
    labels.push({
      label: 'hashtag-spam',
      confidence: 1.0,
      reason: `Post exceeds maximum of ${config.maxTags} hashtags (${tagCount} detected)`,
    });
    reasons.push(`Exceeds max tags: ${tagCount}/${config.maxTags}`);
  }

  // Rule 2: Hashtag stuffing (near-max tags with low content ratio)
  if (tagCount >= config.stuffingThreshold) {
    const textLength = (post.text || '').length;
    const tagsTextLength = tags.join(' ').length;
    const contentRatio = textLength === 0 ? 0 : (textLength - tagsTextLength) / textLength;

    if (contentRatio < 0.3) {
      labels.push({
        label: 'hashtag-stuffing',
        confidence: 0.85,
        reason: `High tag count (${tagCount}) with low content ratio (${(contentRatio * 100).toFixed(1)}%)`,
      });
      reasons.push(`Stuffing: ${tagCount} tags, ${(contentRatio * 100).toFixed(1)}% actual content`);
    }
  }

  // Rule 3: Flooding (same user, same tags, short window)
  if (context.recentUserPosts) {
    const recentWithSameTags = context.recentUserPosts.filter((recent) => {
      const recentTags = new Set(recent.hashtags || []);
      const currentTags = new Set(tags);
      const overlap = [...currentTags].filter((t) => recentTags.has(t));
      return overlap.length >= Math.ceil(tagCount * 0.7);
    });

    if (recentWithSameTags.length >= config.floodingMaxIdenticalSets) {
      labels.push({
        label: 'hashtag-flooding',
        confidence: 0.90,
        reason: `${recentWithSameTags.length} posts within ${config.floodingWindowMinutes} minutes with ${Math.ceil(tagCount * 0.7)}+ matching hashtags`,
      });
      reasons.push(`Flooding: ${recentWithSameTags.length} similar posts in ${config.floodingWindowMinutes}min`);
    }
  }

  // Rule 4: Trending hashtag hijack
  if (context.trendingHashtags) {
    for (const tag of tags) {
      const trending = context.trendingHashtags.find((t) => t.tag === tag);
      if (!trending || trending.postCount < config.hijackTrendingMinPosts) continue;

      const relevanceScore = calculateRelevance(post, trending);
      if (relevanceScore < config.hijackRelevanceThreshold) {
        labels.push({
          label: 'hashtag-hijack',
          confidence: 1 - relevanceScore,
          reason: `Hashtag ${tag} is trending (${trending.postCount} posts) but content relevance is ${(relevanceScore * 100).toFixed(1)}%`,
        });
        reasons.push(`Hijack: #${tag} trending but relevance ${(relevanceScore * 100).toFixed(1)}%`);
      }
    }
  }

  // Rule 5: Coordinated spam (multiple users, similar tags + content)
  if (context.coordinatedCluster) {
    const clusterSize = context.coordinatedCluster.relatedPostCount;
    const tagSimilarity = context.coordinatedCluster.avgTagSimilarity;

    if (clusterSize >= 5 && tagSimilarity >= 0.8) {
      labels.push({
        label: 'hashtag-coordinated-spam',
        confidence: tagSimilarity,
        reason: `${clusterSize} accounts posting with ${tagSimilarity * 100}% tag similarity in coordinated window`,
      });
      reasons.push(`Coordinated: ${clusterSize} accounts, ${(tagSimilarity * 100).toFixed(0)}% similar`);
    }
  }

  // Rule 6: Misleading hashtags (catalogue mismatch)
  if (context.canonicalMatches && tags.length > 0) {
    for (const tag of tags) {
      const match = context.canonicalMatches.find((m) => m.sourceTag === tag);
      if (!match) continue;

      const mentionsCard = (post.text || '').toLowerCase().includes(match.canonicalName.toLowerCase());
      if (!mentionsCard && match.confidence >= config.misleadingConfidenceThreshold) {
        labels.push({
          label: 'hashtag-misleading',
          confidence: match.confidence,
          reason: `Hashtag ${tag} maps to "${match.canonicalName}" but post content does not mention it`,
        });
        reasons.push(`Misleading: #${tag} -> ${match.canonicalName} (not in content)`);
      }
    }
  }

  return { labels, reasons };
}

/**
 * Calculate rough relevance between post content and a trending topic.
 * Uses keyword overlap scoring (lightweight, no ML needed).
 */
function calculateRelevance(post, trending) {
  const text = (post.text || '').toLowerCase();
  const tagWords = trending.tag.replace('#', '').split(/[-_]/);

  let hits = 0;
  let total = tagWords.length + (trending.keywords || []).length;

  for (const word of tagWords) {
    if (text.includes(word.toLowerCase())) hits++;
  }
  for (const kw of trending.keywords || []) {
    if (text.includes(kw.toLowerCase())) hits++;
  }

  return total === 0 ? 0 : hits / total;
}