import React from 'react';
import { useT } from '@/lib/i18n/I18nProvider';

const CATEGORY_TABS = [
  { key: 'top_tier_trade', tKey: 'post.category.top_tier_trade' },
  { key: 'grading_advice', tKey: 'post.category.grading_advice' },
  { key: 'local_meetup', tKey: 'post.category.local_meetup' },
  { key: 'market_analysis', tKey: 'post.category.market_analysis' },
  { key: 'collection_help', tKey: 'post.category.collection_help' },
];

export default function CategoryFilterChips({ value, onChange }) {
  const tr = useT();
  return (
    <div className="flex gap-1.5 overflow-x-auto border-b border-border bg-secondary/30 px-3 py-2">
      <button
        onClick={() => onChange('all')}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${value === 'all' ? 'bg-primary text-white' : 'bg-background text-muted-foreground hover:bg-secondary'}`}
      >
        {tr('feed.allCategories')}
      </button>
      {CATEGORY_TABS.map((c) => (
        <button
          key={c.key}
          onClick={() => onChange(c.key)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${value === c.key ? 'bg-primary text-white' : 'bg-background text-muted-foreground hover:bg-secondary'}`}
        >
          {tr(c.tKey)}
        </button>
      ))}
    </div>
  );
}