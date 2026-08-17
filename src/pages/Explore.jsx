import React, { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, Flame, CheckSquare, Square, Heart, X } from 'lucide-react';
import { searchCards, getSets, localeToTcgdexLang } from '@/lib/tcgdex';
import { useSettings } from '@/hooks/useSettings';
import PageHeader from '@/components/PageHeader';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import ExploreCardTile from '@/components/cards/ExploreCardTile';
import PostCard from '@/components/feed/PostCard';
import NetworkFeedSection from '@/components/feed/NetworkFeedSection';
import ExternalActorSearch from '@/components/follow/ExternalActorSearch';
import FilterPanel from '@/components/explore/FilterPanel';
import TrendingRail from '@/components/explore/TrendingRail';
import { usePostVisibility } from '@/hooks/usePostVisibility';
import useSEO from '@/hooks/useSEO';

export default function Explore() {
  useSEO({
    title: 'Explore Cards',
    description: 'Search the Pokémon TCG catalog, discover recent sets, and browse community posts on SwapPulse.',
    canonicalPath: '/explore',
  });
  const { settings } = useSettings();
  const lang = localeToTcgdexLang(settings?.language?.preferredContent?.[0] || settings?.language?.targetLanguage);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sets, setSets] = useState([]);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();
  const [selected, setSelected] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [searchMode, setSearchMode] = useState('cards');
  const [latestPosts, setLatestPosts] = useState([]);
  const [feedPosts, setFeedPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [filters, setFilters] = useState({ set: '', rarity: '', type: '', minPrice: '', maxPrice: '' });
  const { filterPosts } = usePostVisibility();

  // Everybody feed — all recent posts, for discovering collectors outside your follows.
  const loadFeedPosts = useCallback(async () => {
    setFeedLoading(true);
    try {
      const p = await base44.entities.Post.list('-created_date', 50);
      setFeedPosts(p || []);
    } catch {
      setFeedPosts([]);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchMode === 'posts' && feedPosts.length === 0) loadFeedPosts();
  }, [searchMode, feedPosts.length, loadFeedPosts]);

  const runSearch = useCallback(async (q, f = filters) => {
    if (q.trim().length < 2 && !f.set && !f.rarity) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const cards = await searchCards(q.trim(), {
        page: 1, perPage: 36, lang,
        setName: f.set || undefined,
        rarity: f.rarity || undefined,
      });
      // Client-side filter for type and price range (TCGDex search doesn't
      // support these params directly, so filter the returned results)
      let filtered = cards;
      if (f.type) {
        filtered = filtered.filter((c) => (c.types || []).some((t) => t.toLowerCase() === f.type.toLowerCase()));
      }
      if (f.minPrice || f.maxPrice) {
        const min = f.minPrice ? parseFloat(f.minPrice) : 0;
        const max = f.maxPrice ? parseFloat(f.maxPrice) : Infinity;
        filtered = filtered.filter((c) => {
          const p = c.pricing?.tcgplayer?.avg || c.pricing?.cardmarket?.avg || 0;
          return p >= min && p <= max;
        });
      }
      setResults(filtered);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [lang, filters]);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSets(lang);
        setSets(s.slice(-12).reverse());
      } catch {}
    })();
  }, [lang]);

  useEffect(() => {
    (async () => {
      try {
        const p = await base44.entities.Post.list('-created_date', 20);
        setLatestPosts(p || []);
      } catch { setLatestPosts([]); }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query, filters), 400);
    return () => clearTimeout(t);
  }, [query, filters, runSearch]);

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => {
    setSelected(new Set());
    setSelectMode(false);
  };

  const allSelected = results.length > 0 && results.every((c) => selected.has(c.id));
  const selectAll = () => setSelected(new Set(results.map((c) => c.id)));

  const addAllToWishlist = async () => {
    const picked = results.filter((c) => selected.has(c.id));
    if (!picked.length) return;
    setAdding(true);
    try {
      await base44.entities.Wishlist.bulkCreate(
        picked.map((c) => ({
          card_id: c.id,
          card_name: c.name,
          card_image: c.image || '',
          set_id: c.set?.id || '',
          set_name: c.set?.name || '',
          rarity: c.rarity || '',
        }))
      );
      toast({ title: 'Added to wishlist', description: `${picked.length} card${picked.length > 1 ? 's' : ''} saved to your wishlist.` });
      clearSelection();
    } catch (e) {
      toast({ title: 'Could not add to wishlist', description: e.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <PageHeader title="Explore" subtitle="Search the Pokémon TCG catalog" />
      <div className="border-b border-border p-4 space-y-3">
        <div className="flex gap-1 rounded-full bg-secondary p-1">
          <button
            onClick={() => setSearchMode('cards')}
            className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors ${searchMode === 'cards' ? 'bg-background text-foreground shadow-base' : 'text-muted-foreground'}`}
          >
            Cards
          </button>
          <button
            onClick={() => setSearchMode('people')}
            className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors ${searchMode === 'people' ? 'bg-background text-foreground shadow-base' : 'text-muted-foreground'}`}
          >
            People
          </button>
          <button
            onClick={() => setSearchMode('posts')}
            className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors ${searchMode === 'posts' ? 'bg-background text-foreground shadow-base' : 'text-muted-foreground'}`}
          >
            Posts
          </button>
        </div>
        {searchMode === 'cards' && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cards by name…"
                className="w-full rounded-full border border-border bg-secondary py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
              />
            </div>
            <FilterPanel onApply={setFilters} activeFilters={filters} />
          </div>
        )}
      </div>

      {searchMode === 'people' && (
        <div className="p-4">
          <ExternalActorSearch />
        </div>
      )}

      {searchMode === 'posts' && (
        <div className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Flame className="h-4 w-4 text-accent" /> Everybody Feed
          </h2>
          {feedLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filterPosts(feedPosts).length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {filterPosts(feedPosts).map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {searchMode === 'cards' && !searched && (
        <div className="p-4">
          <div className="mb-6">
            <TrendingRail limit={10} />
          </div>
          <div className="mb-6">
            <NetworkFeedSection limit={12} title="From the Network" />
          </div>
          {filterPosts(latestPosts).length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Flame className="h-4 w-4 text-accent" /> Latest Posts
              </h2>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {filterPosts(latestPosts).map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </div>
          )}
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Flame className="h-4 w-4 text-accent" /> Recent Sets
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sets.map((s) => (
              <Link
                key={s.id}
                to={`/set/${s.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/50"
              >
                {s.logo ? (
                  <img src={s.logo + '.webp'} alt={s.name} className="h-10 w-10 rounded object-contain" />
                ) : (
                  <div className="h-10 w-10 rounded bg-secondary" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.cardCount?.official || s.cardCount?.total || 0} cards</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {searchMode === 'cards' && loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {searchMode === 'cards' && !loading && searched && results.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">No cards found for "{query}"</p>
      )}

      {searchMode === 'cards' && !loading && results.length > 0 && (
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{results.length} results</p>
            <button
              onClick={() => {
                setSelectMode((s) => !s);
                if (selectMode) setSelected(new Set());
              }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${selectMode ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
            >
              <CheckSquare className="h-3.5 w-3.5" /> {selectMode ? 'Done' : 'Select'}
            </button>
          </div>
          {selected.size > 0 && (
            <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary bg-card p-3 shadow-elevated">
              <span className="text-sm font-bold">{selected.size} selected</span>
              <button onClick={selectAll} className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80">
                {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                {allSelected ? 'All selected' : 'Select all'}
              </button>
              <button onClick={addAllToWishlist} disabled={adding} className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50">
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Heart className="h-3.5 w-3.5" />}
                Add to wishlist
              </button>
              <button onClick={clearSelection} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Clear selection">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {results.map((card) => (
              <ExploreCardTile
                key={card.id}
                card={card}
                selected={selected.has(card.id)}
                selectMode={selectMode}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}