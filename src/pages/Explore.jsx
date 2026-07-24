import React, { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, Flame } from 'lucide-react';
import { searchCards, cardImageUrl, rarityClasses, getSets } from '@/lib/tcgdex';
import PageHeader from '@/components/PageHeader';
import { Link } from 'react-router-dom';

export default function Explore() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sets, setSets] = useState([]);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const cards = await searchCards(q.trim(), { page: 1, perPage: 36 });
      setResults(cards);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSets();
        setSets(s.slice(-12).reverse());
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 400);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  return (
    <div>
      <PageHeader title="Explore" subtitle="Search the Pokémon TCG catalog" />
      <div className="border-b border-border p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards by name…"
            className="w-full rounded-full border border-border bg-secondary py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {!searched && (
        <div className="p-4">
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

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">No cards found for "{query}"</p>
      )}

      {!loading && results.length > 0 && (
        <div className="p-4">
          <p className="mb-3 text-sm text-muted-foreground">{results.length} results</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {results.map((card) => {
              const { text, glow } = rarityClasses(card.rarity);
              return (
                <Link
                  key={card.id}
                  to={`/card/${card.id}`}
                  className={`group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50 ${glow}`}
                >
                  <div className="aspect-[3/4] overflow-hidden bg-secondary">
                    {cardImageUrl(card.image) ? (
                      <img
                        src={cardImageUrl(card.image)}
                        alt={card.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-muted-foreground">No image</div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-semibold">{card.name}</p>
                    <p className={`truncate text-[10px] ${text}`}>{card.rarity || '—'}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}