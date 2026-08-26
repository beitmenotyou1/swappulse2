import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { CARD_LANGUAGES, getCardLanguage, setCardLanguage, subscribeCardLanguage } from '@/lib/cardLanguage';

/**
 * CardLanguageSwitcher — dropdown for selecting the Pokémon TCG card data
 * language. Offers all 17 TCGDex-supported languages with native names.
 *
 * This is separate from the UI language: a user can browse the interface in
 * English while viewing card names/descriptions in Japanese, for example.
 *
 * Accessibility:
 * - Label associated via aria-label
 * - Keyboard navigable (native select)
 * - 44px minimum touch target
 *
 * Documentation: https://tcgdex.dev/errors/language-invalid
 */
export default function CardLanguageSwitcher({ size = 'md', showLabel = false }) {
  const [lang, setLang] = useState(getCardLanguage());

  useEffect(() => {
    const unsub = subscribeCardLanguage(setLang);
    return unsub;
  }, []);

  const sizeClass = size === 'sm' ? 'h-8 text-xs px-2' : size === 'lg' ? 'h-12 text-base px-4' : 'h-10 text-sm px-3';

  return (
    <label className="inline-flex items-center gap-1.5">
      {showLabel && <span className="text-xs text-muted-foreground whitespace-nowrap">Card language</span>}
      <Globe className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <select
        value={lang}
        onChange={(e) => setCardLanguage(e.target.value)}
        className={`${sizeClass} min-h-[44px] rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer`}
        aria-label="Select card data language"
      >
        {CARD_LANGUAGES.map(({ code, native, label }) => (
          <option key={code} value={code}>
            {native} ({label})
          </option>
        ))}
      </select>
    </label>
  );
}