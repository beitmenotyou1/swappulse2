import React from 'react';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'follows', label: 'Follows' },
];

export default function NotificationFilterTabs({ active, onChange, counts = {} }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            active === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
          }`}
        >
          {f.label}
          {counts[f.key] > 0 && <span className="ml-1 opacity-70">{counts[f.key]}</span>}
        </button>
      ))}
    </div>
  );
}