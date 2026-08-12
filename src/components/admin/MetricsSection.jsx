import React from 'react';

const LABELS = {
  users: { label: 'Users', color: 'text-primary' },
  trades: { label: 'Open Trade Listings', color: 'text-success' },
  collections: { label: 'Collection Entries', color: 'text-rarity-rare' },
  market: { label: 'Active Market Listings', color: 'text-rarity-holo' },
  posts: { label: 'Posts', color: 'text-rarity-ex' },
  circles: { label: 'Circles', color: 'text-rarity-secret' },
  invites: { label: 'Active Invite Codes', color: 'text-warning' },
};

export default function MetricsSection({ counts }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 font-bold">Platform Metrics</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(LABELS).map(([key, { label, color }]) => {
          const c = counts?.[key] || {};
          return (
            <div key={key} className="rounded-lg border border-border bg-secondary p-3">
              <p className={`text-2xl font-extrabold ${color}`}>
                {c.count ?? 0}
                {c.capped ? '+' : ''}
              </p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}