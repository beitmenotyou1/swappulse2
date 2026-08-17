import React, { useEffect, useState } from 'react';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { getRarities, getTypes, getSets } from '@/lib/tcgdex';
import { useSettings } from '@/hooks/useSettings';

// FilterPanel — collapsible faceted filter UI for the Explore page. Supports
// filtering by set, rarity, type, and price range. Fetches filter options from
// TCGDex catalogue endpoints. Calls onApply with the active filter object.
export default function FilterPanel({ onApply, activeFilters }) {
  const { settings } = useSettings();
  const lang = settings?.language?.preferredContent?.[0] || 'en';
  const [open, setOpen] = useState(false);
  const [rarities, setRarities] = useState([]);
  const [types, setTypes] = useState([]);
  const [sets, setSets] = useState([]);
  const [local, setLocal] = useState({
    set: activeFilters?.set || '',
    rarity: activeFilters?.rarity || '',
    type: activeFilters?.type || '',
    minPrice: activeFilters?.minPrice || '',
    maxPrice: activeFilters?.maxPrice || '',
  });

  useEffect(() => {
    (async () => {
      try {
        const [r, t, s] = await Promise.all([
          getRarities(lang).catch(() => []),
          getTypes(lang).catch(() => []),
          getSets(lang).catch(() => []),
        ]);
        setRarities(r || []);
        setTypes(t || []);
        setSets((s || []).slice(-20).reverse());
      } catch { /* ignore */ }
    })();
  }, [lang]);

  const apply = () => {
    onApply(local);
    setOpen(false);
  };

  const clear = () => {
    const empty = { set: '', rarity: '', type: '', minPrice: '', maxPrice: '' };
    setLocal(empty);
    onApply(empty);
    setOpen(false);
  };

  const hasActive = activeFilters && (activeFilters.set || activeFilters.rarity || activeFilters.type || activeFilters.minPrice || activeFilters.maxPrice);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          hasActive ? 'bg-primary text-white' : 'border border-border bg-secondary text-muted-foreground hover:border-primary/50'
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
        {hasActive && <span className="ml-0.5 rounded-full bg-white/20 px-1.5 text-[10px]">●</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-xl border border-border bg-card p-4 shadow-elevated">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Filter cards</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-secondary" aria-label="Close filters">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Set</label>
                <select
                  value={local.set}
                  onChange={(e) => setLocal((p) => ({ ...p, set: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">All sets</option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Rarity</label>
                <select
                  value={local.rarity}
                  onChange={(e) => setLocal((p) => ({ ...p, rarity: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">All rarities</option>
                  {rarities.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Type</label>
                <select
                  value={local.type}
                  onChange={(e) => setLocal((p) => ({ ...p, type: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">All types</option>
                  {types.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Price range ($)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={local.minPrice}
                    onChange={(e) => setLocal((p) => ({ ...p, minPrice: e.target.value }))}
                    placeholder="Min"
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={local.maxPrice}
                    onChange={(e) => setLocal((p) => ({ ...p, maxPrice: e.target.value }))}
                    placeholder="Max"
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={clear}
                  className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                >
                  Clear
                </button>
                <button
                  onClick={apply}
                  className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}