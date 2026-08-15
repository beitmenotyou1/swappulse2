import React, { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, Flame, CheckSquare, Square, Heart, X } from 'lucide-react';
import { searchCards, getSets, localeToTcgdexLang } from '@/lib/tcgdex';
import { useSettings } from '@/hooks/useSettings';
import PageHeader from '@/components/PageHeader';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import ExploreCardTile from '@/components/cards/ExploreCardTile';
import PostCard from '@/components/feed/PostCard';
import NetworkFeedSection from '@/components/feed/NetworkFeedSection';
import ExternalActorSearch from '@/components/follow/ExternalActorSearch';

export default function Explore() {
  const { settings } = useSettings();
  const lang = localeToTcgdexLang(settings?.language?.preferredContent?.[0] || settings?.language?.targetLanguage);
  const [query, setQuery] = useState('');
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

  const runSearch = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const cards = await searchCards(q.trim(), { page: 1, perPage: 36, lang });
      setResults(cards);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [lang]);

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
    const t = setTimeout(() => runSearch(query), 400);
    return () => clearTimeout(t);
  }, [query, runSearch]);

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
        </div>
        {searchMode === 'cards' && (
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards by name…"
              className="w-full rounded-full border border-border bg-secondary py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {searchMode === 'people' && (
        <div className="p-4">
          <ExternalActorSearch />
        </div>
      )}

      {searchMode === 'cards' && !searched && (
        <div className="p-4">
          <div className="mb-6">
            <NetworkFeedSection limit={12} title="From the Network" />
          </div>
          {latestPosts.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Flame className="h-4 w-4 text-accent" /> Latest Posts
              </h2>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {latestPosts.map((p) => (
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