import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Hash, Type, CreditCard, Loader2 } from 'lucide-react';
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
  'into', 'over', 'after', 'here', 'only', 'want', 'good', 'know', 'think',
  'been', 'were', 'been', 'much', 'well', 'even', 'still', 'back', 'take',
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
      return { card_id, card_name: rest.join('::'), count };
    }),
    hashtags: top(tagCounts, 5).map(({ key, count }) => ({ tag: key, count })),
    keywords: top(keywordCounts, 5),
  };
}

export default function TrendingTopics() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await base44.entities.Post.list('-created_date', 200);
        setPosts(list || []);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
    const unsub = base44.entities.Post.subscribe(() => load());
    return unsub;
  }, []);

  const { cards, hashtags, keywords } = useMemo(() => aggregate(posts), [posts]);
  const empty = cards.length === 0 && hashtags.length === 0 && keywords.length === 0;

  if (loading && empty) {
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
            {cards.map((c) => (
              <Link
                key={c.card_id}
                to={`/card/${c.card_id}`}
                className="flex items-center justify-between rounded-lg px-2 py-1 transition-colors hover:bg-secondary"
              >
                <span className="truncate text-sm font-medium">{c.card_name}</span>
                <span className="ml-2 shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {c.count}
                </span>
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
            {hashtags.map((h) => (
              <Link
                key={h.tag}
                to={`/hashtag/${h.tag}`}
                className="flex items-center justify-between rounded-lg px-2 py-1 transition-colors hover:bg-secondary"
              >
                <span className="truncate text-sm font-medium text-primary">#{h.tag}</span>
                <span className="ml-2 shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {h.count}
                </span>
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
            {keywords.map((k) => (
              <Link
                key={k.key}
                to={`/explore?q=${encodeURIComponent(k.key)}`}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary"
              >
                {k.key}
                <span className="ml-1 text-[10px] text-muted-foreground">{k.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}