import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LANGUAGES } from '@/hooks/useSettings';

export default function LanguageSwitcher({ compact = false }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('lang.change')}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 rounded-full p-2.5 text-foreground transition-colors hover:bg-secondary"
      >
        <Globe className="h-5 w-5" />
        {!compact && (
          <span className="hidden text-sm font-semibold xl:inline">{current.name.split(' ')[0]}</span>
        )}
        {!compact && <ChevronDown className="hidden h-4 w-4 text-muted-foreground xl:inline" />}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={t('lang.select')}
          className="absolute right-0 top-full z-50 mt-2 max-h-80 w-52 overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-elevated"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              role="option"
              aria-selected={locale === l.code}
              onClick={() => { setLocale(l.code); setOpen(false); }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                locale === l.code ? 'bg-primary/15 font-semibold text-primary' : 'text-foreground hover:bg-secondary'
              }`}
            >
              {l.name}
              {locale === l.code && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}