import React from 'react';
import { Image as ImageIcon, ArrowLeftRight, CheckCircle, Award, Star } from 'lucide-react';

const TYPE_META = {
  first_card: { icon: ImageIcon, accent: 'text-rarity-rare', glow: 'rarity-glow-rare' },
  first_trade: { icon: ArrowLeftRight, accent: 'text-rarity-holo', glow: 'rarity-glow-holo' },
  set_completion: { icon: CheckCircle, accent: 'text-rarity-ex', glow: 'rarity-glow-ex' },
  grading: { icon: Award, accent: 'text-accent', glow: 'rarity-glow-secret' },
  custom: { icon: Star, accent: 'text-primary', glow: '' },
};

// MilestonesTimeline — vertical timeline of a collector's journey milestones,
// newest first, with rarity-glow accents on the milestone icons.
export default function MilestonesTimeline({ milestones = [] }) {
  if (!milestones.length) {
    return <div className="p-6 text-center text-sm text-muted-foreground">No journey milestones yet.</div>;
  }
  const sorted = [...milestones].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return (
    <div className="relative p-2">
      <div className="absolute bottom-2 left-[18px] top-2 w-px bg-border" />
      <ol className="space-y-4">
        {sorted.map((m, i) => {
          const meta = TYPE_META[m.milestone_type] || TYPE_META.custom;
          const Icon = meta.icon;
          return (
            <li key={m.id || i} className="relative flex gap-3">
              <span className={`z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card ring-2 ring-border ${meta.accent} ${meta.glow}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{m.title}</p>
                  {m.date && <time className="shrink-0 text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</time>}
                </div>
                {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}