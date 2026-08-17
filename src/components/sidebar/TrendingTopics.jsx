import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Hash, Type, CreditCard, Loader2, Globe } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Common English stopwords filtered out of keyword extraction so the list
// surfaces meaningful TCG/collector terms rather than "the", "this", "with".
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was',
  'one', 'our', 'out', 'has', 'have', 'his', 'how', 'its', 'may', 'more', 'most',
  'new', 'now', 'old', 'see', 'way', 'who', 'did', 'get', 'got', 'let', 'say',
  'she', 'too', 'use', 'any', 'been', 'from', 'that', 'this', 'with', 'your',
  'they', 'them', 'what', 'when', 'will', 'would', 'there', 'their', 'about',
  'into', 'than', 'then', 'just', 'like', 'some', 'such', 'very', 'also',
  'over', 'after', 'here', 'only', 'want', 'good', 'know', 'think',
  'much', 'well', 'even', 'still', 'back', 'take',
  'make', 'made', 'look', 'come', 'could', 'should', 'does', 'doing',
]);

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Tokenize post content into meaningful keywords: strip URLs, @mentions,
// #hashtags, keep alphanumeric tokens of 4+ chars, drop stopwords.
function extractKeywords(content) {
  if (!content) return [];
  const cleaned = content
    .replace(/https?:\/\/[^\s]+/g, ' ')
    .replace(/@[a-z0-9._-]+/gi, ' ')
    .replace(/#[\p{L}\p{N}_]+/giu, ' ');
  const tokens = cleaned.match(/[a-z0-9]{4,}/gi) || [];
  return tokens
    .map((t) => t.toLowerCase())
    .filter((t) => !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

// Aggregate recent posts into three trending lists: cards, hashtags, keywords.
function aggregate(posts) {
  const now = Date.now();
  const recent = posts.filter(
    (p) => p.created_date && now - new Date(p.created_date).getTime() < MAX_AGE_MS
  );

  const cardCounts = new Map();
  const tagCounts = new Map();
  const keywordCounts = new Map();

  for (const p of recent) {
    if (p.card_name && p.card_id) {
      const key = `${p.card_id}::${p.card_name}`;
      cardCounts.set(key, (cardCounts.get(key) || 0) + 1);
    }
    if (Array.isArray(p.canonical_tags)) {
      for (const tag of p.canonical_tags) {
        if (!tag) continue;
        const t = tag.toLowerCase();
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }
    for (const kw of extractKeywords(p.content)) {
      keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1);
    }
  }

  const top = (map, n) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));

  return {
    cards: top(cardCounts, 5).map(({ key, count }) => {
      const [card_id, ...rest] = key.split('::');
      return { card_id, card_name: rest.join('::'), count, source: 'community' };
    }),
    hashtags: top(tagCounts, 5).map(({ key, count }) => ({ tag: key, count, source: 'community' })),
    keywords: top(keywordCounts, 5).map(({ key, count }) => ({ key, count, source: 'community' })),
  };
}

// Fetch trending Pokémon TCG topics from the broader web via LLM web search.
// Returns { cards, hashtags, keywords } with source: 'web'. Uses
// add_context_from_internet (gemini_3_flash) so the results reflect current
// online trends — set prices, new set releases, community discussions — that
// may not yet appear in local posts. Works for logged-out users (no auth
// needed for InvokeLLM).
async function fetchWebTrends() {
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a Pokémon TCG trend analyst. Based on current internet trends, news, and community discussions, identify what's trending right now in the Pokémon TCG world. Return three lists:
1. "cards": up to 5 Pokémon cards that are trending online (new pulls, competitive play, price spikes, set reveals). For each, provide "name" (the card name) and "card_id" (the TCGDex-style card id if you can infer it, otherwise leave empty).
2. "hashtags": up to 5 trending Pokémon TCG hashtags (without the # symbol, lowercase).
3. "keywords": up to 5 trending keywords or topics (single words or short phrases, lowercase, no hashtags).
Focus on what collectors and players are actively discussing online this week.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          cards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                card_id: { type: 'string' },
              },
            },
          },
          hashtags: {
            type: 'array',
            items: { type: 'string' },
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    });
    const data = res || {};
    return {
      cards: (data.cards || []).slice(0, 5).map((c) => ({
        card_id: c.card_id || '',
        card_name: c.name || '',
        count: 0,
        source: 'web',
      })).filter((c) => c.card_name),
      hashtags: (data.hashtags || []).slice(0, 5).map((t) => ({
        tag: String(t).toLowerCase().replace(/^#/, ''),
        count: 0,
        source: 'web',
      })).filter((h) => h.tag),
      keywords: (data.keywords || []).slice(0, 5).map((k) => ({
        key: String(k).toLowerCase(),
        count: 0,
        source: 'web',
      })).filter((k) => k.key),
    };
  } catch {
    return { cards: [], hashtags: [], keywords: [] };
  }
}

// Merge community-sourced and web-sourced lists, deduping by key (card_id,
// tag, or keyword). Community items rank first (they have real counts); web
// items fill remaining slots up to 5 total.
function mergeLists(community, web, keyFn) {
  const seen = new Set();
  const merged = [];
  for (const item of community) {
    const k = keyFn(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    merged.push(item);
  }
  for (const item of web) {
    const k = keyFn(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    merged.push(item);
    if (merged.length >= 5) break;
  }
  return merged.slice(0, 5);
}

export default function TrendingTopics() {
  const [postsLoading, setPostsLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [webTrends, setWebTrends] = useState({ cards: [], hashtags: [], keywords: [] });

  useEffect(() => {
    // Load local + federated posts immediately (fast), then fetch internet
    // trends in the background and merge them in when ready. Both work for
    // logged-out users — Post entity has public read RLS, and InvokeLLM
    // doesn't require authentication.
    const loadPosts = async () => {
      try {
        const list = await base44.entities.Post.list('-created_date', 200).catch(() => []);
        setPosts(list || []);
      } catch {
        setPosts([]);
      } finally {
        setPostsLoading(false);
      }
    };
    loadPosts();
    // Fetch web trends once on mount (not on every post subscription refresh)
    fetchWebTrends().then(setWebTrends);
    const unsub = base44.entities.Post.subscribe(() => loadPosts());
    return unsub;
  }, []);

  const community = useMemo(() => aggregate(posts), [posts]);

  const cards = useMemo(
    () => mergeLists(community.cards, webTrends.cards, (c) => c.card_id || c.card_name),
    [community.cards, webTrends.cards]
  );
  const hashtags = useMemo(
    () => mergeLists(community.hashtags, webTrends.hashtags, (h) => h.tag),
    [community.hashtags, webTrends.hashtags]
  );
  const keywords = useMemo(
    () => mergeLists(community.keywords, webTrends.keywords, (k) => k.key),
    [community.keywords, webTrends.keywords]
  );

  const empty = cards.length === 0 && hashtags.length === 0 && keywords.length === 0;

  if (postsLoading && empty) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <TrendingUp className="h-4 w-4 text-primary" /> Trending Topics
        </h3>
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (empty) return null;

  const WebBadge = () => (
    <Globe className="h-3 w-3 shrink-0 text-accent" aria-label="From the web" />
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <TrendingUp className="h-4 w-4 text-primary" /> Trending Topics
      </h3>

      {cards.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <CreditCard className="h-3 w-3" /> Cards
          </p>
          <div className="space-y-0.5">
            {cards.map((c, i) => (
              <Link
                key={`card-${c.card_id || c.card_name}-${i}`}
                to={c.card_id ? `/card/${c.card_id}` : `/explore?q=${encodeURIComponent(c.card_name)}`}
                className="flex items-center justify-between rounded-lg px-2 py-1 transition-colors hover:bg-secondary"
              >
                <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {c.source === 'web' && <WebBadge />}
                  {c.card_name}
                </span>
                {c.count > 0 && (
                  <span className="ml-2 shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {c.count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {hashtags.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Hash className="h-3 w-3" /> Hashtags
          </p>
          <div className="space-y-0.5">
            {hashtags.map((h, i) => (
              <Link
                key={`tag-${h.tag}-${i}`}
                to={`/hashtag/${h.tag}`}
                className="flex items-center justify-between rounded-lg px-2 py-1 transition-colors hover:bg-secondary"
              >
                <span className="flex items-center gap-1.5 truncate text-sm font-medium text-primary">
                  {h.source === 'web' && <WebBadge />}
                  #{h.tag}
                </span>
                {h.count > 0 && (
                  <span className="ml-2 shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {h.count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {keywords.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Type className="h-3 w-3" /> Keywords
          </p>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((k, i) => (
              <Link
                key={`kw-${k.key}-${i}`}
                to={`/explore?q=${encodeURIComponent(k.key)}`}
                className="flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary"
              >
                {k.source === 'web' && <Globe className="h-2.5 w-2.5 text-accent" />}
                {k.key}
                {k.count > 0 && <span className="text-[10px] text-muted-foreground">{k.count}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}