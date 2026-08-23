import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { searchCardsMulti, cardImageUrl, rarityClasses, cardSetName } from '@/lib/tcgdex';
import CardImage from '@/components/cards/CardImage';
import LanguageFilter from '@/components/cards/LanguageFilter';
import { useToast } from '@/components/ui/use-toast';

export default function CardSearchModal({ open, onClose, onSelect, title = 'Search cards' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [langFilter, setLangFilter] = useState('all');
  const { toast } = useToast();

  const runSearch = useCallback(async (q) => {
    setLoading(true);
    try {
      const cards = await searchCardsMulti(q, { perPage: 24, langFilter });
      setResults(cards);
      setHasMore(false);
      setPage(1);
    } catch (e) {
      setResults([]);
      setHasMore(false);
      toast({ title: 'Search failed', description: 'Could not reach the card catalogue. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, langFilter]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (query.trim().length >= 2) runSearch(query.trim());
      else setResults([]);
    }, 350);
    return () => clearTimeout(t);
  }, [query, open, runSearch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mt-8 w-full max-w-2xl animate-slide-up rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, set code, or number, e.g. MEW 058, SSH 1, Charizard…"
                className="w-full rounded-xl border border-border bg-secondary py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
              />
            </div>
            <LanguageFilter value={langFilter} onChange={setLangFilter} />
          </div>

          {loading && results.length === 0 && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No cards found. Try another name.</p>
          )}

          {results.length > 0 && (
            <>
              <div className="mt-4 grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
                {results.map((card) => {
                  const { text } = rarityClasses(card.rarity);
                  return (
                    <button
                      key={card.id}
                      onClick={() => {
                        onSelect(card);
                        onClose();
                      }}
                      className="group overflow-hidden rounded-lg border border-border bg-secondary text-left transition-all hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10"
                    >
                      <div className="aspect-[3/4] overflow-hidden bg-muted">
                        <CardImage card={card} alt={card.name} />
                      </div>
                      <div className="p-1.5">
                        <p className="truncate text-[11px] font-semibold">{card.name}</p>
                        <p className={`truncate text-[10px] ${text}`}>{card.rarity || '-'}</p>
                        {cardSetName(card) && <p className="truncate text-[10px] text-muted-foreground">{cardSetName(card)}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => runSearch(query.trim(), page + 1)}
                    disabled={loading}
                    className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                  >
                    {loading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}