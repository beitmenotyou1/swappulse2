import React, { useEffect, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { getTypes } from '@/lib/tcgdex';
import { useSettings } from '@/hooks/useSettings';
import { useT } from '@/lib/i18n/I18nProvider';

// FilterPanel — collapsible filter for secondary card-search filters (type
// and price range). Set and rarity are now quick-access controls on the
// Explore page (SetQuickFilter + RarityFilterChips), so they're preserved
// from activeFilters on apply rather than managed here.
export default function FilterPanel({ onApply, activeFilters }) {
  const t = useT();
  const { settings } = useSettings();
  const lang = settings?.language?.preferredContent?.[0] || 'en';
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState([]);
  const [local, setLocal] = useState({
    type: activeFilters?.type || '',
    minPrice: activeFilters?.minPrice || '',
    maxPrice: activeFilters?.maxPrice || '',
  });

  useEffect(() => {
    (async () => {
      try {
        const t = await getTypes(lang).catch(() => []);
        setTypes(t || []);
      } catch { /* ignore */ }
    })();
  }, [lang]);

  const apply = () => {
    onApply({ ...activeFilters, ...local });
    setOpen(false);
  };

  const clear = () => {
    const cleared = { type: '', minPrice: '', maxPrice: '' };
    setLocal(cleared);
    onApply({ ...activeFilters, ...cleared });
    setOpen(false);
  };

  const hasActive = activeFilters && (activeFilters.type || activeFilters.minPrice || activeFilters.maxPrice);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          hasActive ? 'bg-primary text-primary-foreground' : 'border border-border bg-secondary text-muted-foreground hover:border-primary/50'
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        {t('explore.filters')}
        {hasActive && <span className="ml-0.5 rounded-full bg-white/20 px-1.5 text-[10px]">●</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-xl border border-border bg-card p-4 shadow-elevated">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">{t('explore.filterCards')}</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-secondary" aria-label={t('explore.closeFilters')}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="filter-type">{t('explore.type')}</label>
                <select
                  id="filter-type"
                  value={local.type}
                  onChange={(e) => setLocal((p) => ({ ...p, type: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">{t('explore.allTypes')}</option>
                  {types.map((tp) => (
                    <option key={tp} value={tp}>{tp}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t('explore.priceRange')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={local.minPrice}
                    onChange={(e) => setLocal((p) => ({ ...p, minPrice: e.target.value }))}
                    placeholder={t('explore.min')}
                    aria-label={t('explore.minPrice')}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={local.maxPrice}
                    onChange={(e) => setLocal((p) => ({ ...p, maxPrice: e.target.value }))}
                    placeholder={t('explore.max')}
                    aria-label={t('explore.maxPrice')}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={clear}
                  className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                >
                  {t('explore.clear')}
                </button>
                <button
                  onClick={apply}
                  className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground"
                >
                  {t('explore.apply')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}