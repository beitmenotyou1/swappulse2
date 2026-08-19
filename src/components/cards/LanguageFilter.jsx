import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';

// LanguageFilter — reusable dropdown for narrowing card catalogue searches by
// TCGDex language. Defaults to 'all' (search every language catalog). Used on
// every card search entry point so results surface cards in their native
// language regardless of the site UI language.
export const TCGDEX_LANG_OPTIONS = [
  { value: 'all', label: 'All Languages' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'jp', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'ko', label: '한국어' },
];

export default function LanguageFilter({ value = 'all', onChange, compact = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const current = TCGDEX_LANG_OPTIONS.find((o) => o.value === value) || TCGDEX_LANG_OPTIONS[0];

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Filter card language"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50"
      >
        <Globe className="h-3.5 w-3.5" />
        {!compact && <span>{current.label}</span>}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Select card language"
          className="absolute right-0 top-full z-50 mt-1 max-h-72 w-44 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-elevated"
        >
          {TCGDEX_LANG_OPTIONS.map((o) => (
            <button
              key={o.value}
              role="option"
              aria-selected={value === o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                value === o.value ? 'bg-primary/15 font-semibold text-primary' : 'text-foreground hover:bg-secondary'
              }`}
            >
              {o.label}
              {value === o.value && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}