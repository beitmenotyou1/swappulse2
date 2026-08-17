import React from 'react';

// Horizontal pill bar that lets users filter the feed by card rarity.
// Posts without a card_rarity are excluded when a specific rarity is selected.
// Matching is case-insensitive substring on the stored card_rarity string,
// so "Holo" catches "Rare Holo", "Secret" catches "Secret Rare", etc.
const RARITY_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'holo', label: 'Holo' },
  { key: 'ultra', label: 'Ultra Rare' },
  { key: 'secret', label: 'Secret Rare' },
];

export default function RarityFilter({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-background/60 px-4 py-2">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">Rarity:</span>
      {RARITY_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          aria-pressed={value === opt.key}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === opt.key
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}