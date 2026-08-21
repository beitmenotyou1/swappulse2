import React from 'react';
import { useT } from '@/lib/i18n/I18nProvider';

// RarityFilterChips — quick-access rarity tier filter for the Explore card
// search. Each chip represents one of the 6 visual rarity tiers used across
// SwapPulse (common → secret), with a colour-coded dot matching the tier.
// Selecting a chip narrows the current search results to cards of that
// rarity tier (via rarityKey()). "All rarities" clears the filter. The row
// scrolls horizontally on narrow screens so it never overflows.
const RARITY_TIERS = [
  { key: 'common', labelKey: 'explore.rarityCommon' },
  { key: 'uncommon', labelKey: 'explore.rarityUncommon' },
  { key: 'rare', labelKey: 'explore.rarityRare' },
  { key: 'holo', labelKey: 'explore.rarityHolo' },
  { key: 'ex', labelKey: 'explore.rarityEx' },
  { key: 'secret', labelKey: 'explore.raritySecret' },
];

export default function RarityFilterChips({ value, onChange }) {
  const t = useT();
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by rarity">
      <button
        onClick={() => onChange('')}
        aria-pressed={value === ''}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          value === '' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        }`}
      >
        {t('explore.rarityAll')}
      </button>
      {RARITY_TIERS.map((tier) => {
        const active = value === tier.key;
        return (
          <button
            key={tier.key}
            onClick={() => onChange(active ? '' : tier.key)}
            aria-pressed={active}
            className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-secondary'
            }`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: `hsl(var(--rarity-${tier.key}))` }}
              aria-hidden="true"
            />
            {t(tier.labelKey)}
          </button>
        );
      })}
    </div>
  );
}