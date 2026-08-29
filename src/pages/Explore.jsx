import React, { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, Flame, CheckSquare, Square, Heart, X } from 'lucide-react';
import { searchCardsMulti, getSets, localeToTcgdexLang, rarityKey } from '@/lib/tcgdex';
import { useSettings } from '@/hooks/useSettings';
import PageHeader from '@/components/PageHeader';
import { Image } from '@/components/ui/image';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import ExploreCardTile from '@/components/cards/ExploreCardTile';
import RarityFilterChips from '@/components/cards/RarityFilterChips';
import SetQuickFilter from '@/components/cards/SetQuickFilter';
import PostCard from '@/components/feed/PostCard';
import CategoryFilterChips from '@/components/feed/CategoryFilterChips';
import NetworkFeedSection from '@/components/feed/NetworkFeedSection';
import ExternalActorSearch from '@/components/follow/ExternalActorSearch';
import FilterPanel from '@/components/explore/FilterPanel';
import LanguageFilter from '@/components/cards/LanguageFilter';
import TrendingRail from '@/components/explore/TrendingRail';
import { usePostVisibility } from '@/hooks/usePostVisibility';
import useSEO from '@/hooks/useSEO';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';
import { sortPostsDescending } from '@/lib/postSort';
import PullToRefresh from '@/components/PullToRefresh';

export default function Explore() {
  const tr = useT();
  const LOGO_URL = 'https://media.base44.com/images/public/6a63d9d64a4d65d370c70892/32ce16a82_a_transparent_version_of_the_socialpulse_logo_a_digital_pulse_line_forming_an_s1.png';
  useSEO({
    title: 'Explore Cards',
    description: 'Search the Pokémon TCG catalogue, discover recent sets, and browse community posts on SwapPulse.',
    canonicalPath: '/explore',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Explore Pokémon TCG Cards',
      description: 'Search the Pokémon TCG catalogue, discover recent sets, and browse community posts on SwapPulse.',
      url: 'https://swappulse.org/explore',
    },
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
  const [langFilter, setLangFilter] = useState('all');
  const [category, setCategory] = useState('all');
  const { filterPosts } = usePostVisibility();

  // Everybody feed — all recent posts, for discovering collectors outside your follows.
  const loadFeedPosts = useCallback(async () => {
    setFeedLoading(true);
    try {
      const res = await base44.functions.invoke('get-explore-feed', { limit: 50 });
      const data = res?.data ?? res;
      setFeedPosts(data?.items || []);
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
    const hasQuery = q.trim().length >= 2;
    if (!hasQuery && !f.set) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      // When a set is selected with no text query, use the set ID as the
      // query so the backend fetches all cards in that set.
      const searchQuery = hasQuery ? q.trim() : f.set;
      const cards = await searchCardsMulti(searchQuery, { perPage: 36, lang, langFilter });
      // Client-side filter for set, rarity, type and price range (the
      // multi-identifier search doesn't take these as params, so filter
      // the returned results)
      let filtered = cards;
      if (f.set) {
        filtered = filtered.filter((c) =>
          (c.set?.name || '').toLowerCase() === f.set.toLowerCase() ||
          (c.set?.id || '').toLowerCase() === f.set.toLowerCase());
      }
      if (f.rarity) {
        filtered = filtered.filter((c) => rarityKey(c.rarity) === f.rarity);
      }
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
    } catch (e) {
      setResults([]);
      toast({ title: tr('explore.searchFailed'), description: tr('explore.searchFailedDesc'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [lang, filters, langFilter, toast]);

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
        const res = await base44.functions.invoke('get-explore-feed', { limit: 20 });
        const p = res?.data?.items || [];
        setLatestPosts(sortPostsDescending(p));
      } catch { setLatestPosts([]); }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query, filters), 400);
    return () => clearTimeout(t);
  }, [query, filters, runSearch]);

  const visibleFeedPosts = filterPosts(feedPosts);
  const categoryFilteredFeed =
    category === 'all' ? visibleFeedPosts : visibleFeedPosts.filter((p) => (p.post_category || 'general') === category);

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
      toast({ title: tr('explore.addedToWishlist'), description: tr('explore.cardsSaved').replace('{count}', picked.length) });
      clearSelection();
    } catch (e) {
      toast({ title: tr('explore.couldNotAdd'), description: e.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleRefresh = async () => {
    if (searchMode === 'posts') {
      await loadFeedPosts();
    } else if (searchMode === 'cards') {
      try {
        const s = await getSets(lang);
        setSets(s.slice(-12).reverse());
      } catch {}
      await runSearch(query, filters);
    }
  };

  return (
    <div>
      <PageHeader
        title={tr('page.explore.title')}
        subtitle={tr('page.explore.subtitle')}
        icon={
          <Image
            src={LOGO_URL}
            alt="SwapPulse"
            fittingType="fit"
            className="h-9 w-9 rounded-lg"
          />
        }
      />
      <PullToRefresh onRefresh={handleRefresh}>
      <div className="border-b border-border p-4 space-y-3">
        <div className="flex gap-1 rounded-full bg-secondary p-1">
          <button
            onClick={() => setSearchMode('cards')}
            className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors ${searchMode === 'cards' ? 'bg-background text-foreground shadow-base' : 'text-muted-foreground'}`}
          >
            {tr('page.explore.cards')}
          </button>
          <button
            onClick={() => setSearchMode('people')}
            className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors ${searchMode === 'people' ? 'bg-background text-foreground shadow-base' : 'text-muted-foreground'}`}
          >
            {tr('page.explore.people')}
          </button>
          <button
            onClick={() => setSearchMode('posts')}
            className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors ${searchMode === 'posts' ? 'bg-background text-foreground shadow-base' : 'text-muted-foreground'}`}
          >
            {tr('page.explore.posts')}
          </button>
        </div>
        {searchMode === 'cards' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tr('explore.searchPlaceholder')}
                  className="w-full rounded-full border border-border bg-secondary py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
                 aria-label={tr('explore.searchPlaceholder')}/>
              </div>
              <SetQuickFilter value={filters.set} onChange={(s) => setFilters((f) => ({ ...f, set: s }))} />
              <FilterPanel onApply={setFilters} activeFilters={filters} />
              <LanguageFilter value={langFilter} onChange={setLangFilter} />
            </div>
            <RarityFilterChips value={filters.rarity} onChange={(r) => setFilters((f) => ({ ...f, rarity: r }))} />
          </div>
        )}
      </div>

      {searchMode === 'people' && (
        <div className="p-4">
          <ExternalActorSearch />
        </div>
      )}

      {searchMode === 'posts' && (
        <div>
          <CategoryFilterChips value={category} onChange={setCategory} />
          <div className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Flame className="h-4 w-4 text-accent" /> {tr('explore.everybodyFeed')}
            </h2>
            {feedLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : categoryFilteredFeed.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{tr('explore.noPosts')}</p>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {categoryFilteredFeed.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {searchMode === 'cards' && !searched && (
        <div className="p-4">
          <div className="mb-6">
            <TrendingRail limit={10} />
          </div>
          <div className="mb-6">
            <NetworkFeedSection limit={12} title={tr('explore.fromNetwork')} />
          </div>
          {filterPosts(latestPosts).length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Flame className="h-4 w-4 text-accent" /> {tr('explore.latestPosts')}
              </h2>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {filterPosts(latestPosts).map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </div>
          )}
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Flame className="h-4 w-4 text-accent" /> {tr('explore.recentSets')}
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
                  <p className="text-xs text-muted-foreground">{s.cardCount?.official || s.cardCount?.total || 0} {tr('explore.cardsCount')}</p>
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
        <p className="py-16 text-center text-sm text-muted-foreground">{tr('explore.noCardsFound').replace('{query}', query)}</p>
      )}

      {searchMode === 'cards' && !loading && results.length > 0 && (
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{results.length} {tr('explore.results')}</p>
            <button
              onClick={() => {
                setSelectMode((s) => !s);
                if (selectMode) setSelected(new Set());
              }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${selectMode ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
            >
              <CheckSquare className="h-3.5 w-3.5" /> {selectMode ? tr('explore.done') : tr('explore.select')}
            </button>
          </div>
          {selected.size > 0 && (
            <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary bg-card p-3 shadow-elevated">
              <span className="text-sm font-bold">{selected.size} {tr('explore.selected')}</span>
              <button onClick={selectAll} className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80">
                {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                {allSelected ? tr('explore.allSelected') : tr('explore.selectAll')}
              </button>
              <button onClick={addAllToWishlist} disabled={adding} className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50">
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Heart className="h-3.5 w-3.5" />}
                {tr('explore.addToWishlist')}
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
      <GuideFooterLink slug="explore" />
      </PullToRefresh>
    </div>
  );
}