import React, { useEffect, useState, useRef } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { getSets, localeToTcgdexLang } from '@/lib/tcgdex';
import { useSettings } from '@/hooks/useSettings';
import { useT } from '@/lib/i18n/I18nProvider';

// SetQuickFilter — searchable set selector for the Explore card search.
// Shows the selected set (with logo) or "All sets" as the trigger, and
// opens a popover with a search input and a scrollable list of all sets
// (logo + name + code) so users can quickly find and filter by a specific
// set. Keyboard accessible: Escape closes, click-outside dismisses.
export default function SetQuickFilter({ value, onChange }) {
  const t = useT();
  const { settings } = useSettings();
  const lang = localeToTcgdexLang(settings?.language?.preferredContent?.[0] || 'en');
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState([]);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSets(lang);
        setSets(s || []);
      } catch { /* ignore */ }
    })();
  }, [lang]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const selectedSet = sets.find((s) => s.id === value);
  const filtered = search.trim()
    ? sets.filter((s) =>
        (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.id || '').toLowerCase().includes(search.toLowerCase()))
    : sets;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          value ? 'bg-primary text-primary-foreground' : 'border border-border bg-secondary text-muted-foreground hover:border-primary/50'
        }`}
      >
        {selectedSet ? (
          <>
            {selectedSet.logo && (
              <img src={selectedSet.logo + '.webp'} alt="" className="h-4 w-4 rounded object-contain" />
            )}
            <span className="max-w-[120px] truncate">{selectedSet.name}</span>
          </>
        ) : (
          t('explore.allSets')
        )}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-xl border border-border bg-card shadow-elevated">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('explore.searchSets')}
                aria-label={t('explore.searchSets')}
                className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1" role="listbox">
            <button
              role="option"
              aria-selected={!value}
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${!value ? 'bg-secondary font-semibold' : 'hover:bg-secondary'}`}
            >
              <div className="h-6 w-6" aria-hidden="true" />
              <span>{t('explore.allSets')}</span>
              {!value && <Check className="ml-auto h-4 w-4 text-primary" aria-hidden="true" />}
            </button>
            {filtered.map((s) => (
              <button
                key={s.id}
                role="option"
                aria-selected={value === s.id}
                onClick={() => { onChange(s.id); setOpen(false); setSearch(''); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${value === s.id ? 'bg-secondary font-semibold' : 'hover:bg-secondary'}`}
              >
                {s.logo ? (
                  <img src={s.logo + '.webp'} alt="" className="h-6 w-6 rounded object-contain" />
                ) : (
                  <div className="h-6 w-6 rounded bg-secondary" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.id}</p>
                </div>
                {value === s.id && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t('explore.noSets')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}