import React, { useState, useMemo } from 'react';
import { Search, Check, Plus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToggleCardOwnership } from '@/hooks/useSetChecklist';
import { rarityClasses } from '@/lib/tcgdex';

const FILTER_MODES = ['all', 'owned', 'missing'];

const RARITY_BORDER = {
  common: 'border-rarity-common',
  uncommon: 'border-rarity-uncommon',
  rare: 'border-rarity-rare',
  holo: 'border-rarity-holo',
  ex: 'border-rarity-ex',
  secret: 'border-rarity-secret',
};

export default function ChecklistGrid({ cards, setId, setName, recentlyScannedIds = [] }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const toggleMutation = useToggleCardOwnership(setId);

  const filtered = useMemo(() => {
    let result = cards;
    if (filter === 'owned') result = result.filter((c) => c.is_owned);
    else if (filter === 'missing') result = result.filter((c) => !c.is_owned);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) => c.name.toLowerCase().includes(q) || c.local_id.includes(q) || (c.illustrator || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [cards, filter, search]);

  const handleToggle = (card) => {
    toggleMutation.mutate({ card, isOwned: card.is_owned, setName });
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, illustrator, or number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {FILTER_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                filter === mode ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode} ({mode === 'all' ? cards.length : mode === 'owned' ? cards.filter((c) => c.is_owned).length : cards.filter((c) => !c.is_owned).length})
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No cards match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map((card) => {
            const { key: rarityKey, text: rarityText, glow: rarityGlow } = rarityClasses(card.rarity);
            const wasRecentlyScanned = recentlyScannedIds.includes(card.tcgdex_id);
            return (
              <div
                key={card.tcgdex_id}
                className={`group relative rounded-lg border-2 bg-card p-2 transition-all ${
                  card.is_owned ? 'border-success/40 opacity-90' : 'border-border'
                } ${wasRecentlyScanned ? 'ring-2 ring-accent animate-pulse' : ''} ${rarityGlow}`}
              >
                {/* Card image */}
                <Link to={`/card/${card.tcgdex_id}`} className="block">
                  <div
                    className={`relative aspect-[3/4] overflow-hidden rounded-md border-l-2 ${RARITY_BORDER[rarityKey] || 'border-rarity-common'} ${
                      card.is_owned ? '' : 'opacity-50 grayscale'
                    }`}
                  >
                    {card.image_available && card.image ? (
                      <img src={card.image} alt={card.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-secondary">
                        <span className="text-[10px] text-muted-foreground">No image</span>
                      </div>
                    )}
                    {card.is_owned && (
                      <div className="absolute inset-0 flex items-center justify-center bg-success/10">
                        <Check className="h-8 w-8 text-success opacity-80" />
                      </div>
                    )}
                    {wasRecentlyScanned && (
                      <div className="absolute right-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-background">NEW</div>
                    )}
                  </div>
                </Link>

                {/* Card info */}
                <div className="mt-2 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground">#{card.local_id}</p>
                  <p className="truncate text-xs font-semibold">{card.name}</p>
                  <p className={`truncate text-[10px] ${rarityText}`}>{card.rarity}</p>
                </div>

                {/* Toggle button */}
                <button
                  onClick={() => handleToggle(card)}
                  disabled={toggleMutation.isPending}
                  className={`mt-2 flex w-full items-center justify-center gap-1 rounded-md py-1 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                    card.is_owned
                      ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                      : 'bg-success/10 text-success hover:bg-success/20'
                  }`}
                >
                  {toggleMutation.isPending && toggleMutation.variables?.card?.tcgdex_id === card.tcgdex_id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : card.is_owned ? (
                    <><Check className="h-3 w-3" /> Owned</>
                  ) : (
                    <><Plus className="h-3 w-3" /> Mark Owned</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}