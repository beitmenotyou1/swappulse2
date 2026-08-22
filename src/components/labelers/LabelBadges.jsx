import React from 'react';
import { ShieldCheck, ShieldAlert, Award, BookOpen, Star, Tag } from 'lucide-react';
import { useCommunityLabels } from '@/lib/communityLabels';

const CATEGORY_META = {
  authenticity: { icon: ShieldCheck, color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  safety: { icon: ShieldAlert, color: 'bg-red-500/15 text-red-600 dark:text-red-400', border: 'border-red-500/30' },
  grading: { icon: Award, color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  expertise: { icon: BookOpen, color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
  quality: { icon: Star, color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  other: { icon: Tag, color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400', border: 'border-slate-500/30' },
};

// LabelBadges — renders opt-in community labels as coloured badges. Shown on
// posts, profiles, and trade listings. Labels come from the viewer's subscribed
// labelers only (enforced by get-community-labels). Category drives the colour;
// the labeler name and note appear in the tooltip.
export default function LabelBadges({ subjectUri, size = 'sm', className = '' }) {
  const labels = useCommunityLabels(subjectUri);
  if (!labels.length) return null;
  const pad = size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]';
  const iconSize = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {labels.map((label) => {
        const meta = CATEGORY_META[label.labeler_category] || CATEGORY_META.other;
        const Icon = meta.icon;
        const tip = `${label.labeler_name || 'Labeler'}: ${label.label_value}${label.note ? ' — ' + label.note : ''}`;
        return (
          <span
            key={label.id}
            title={tip}
            className={`inline-flex items-center gap-1 rounded-full border ${meta.color} ${meta.border} ${pad} font-semibold leading-none`}
          >
            <Icon className={iconSize} />
            <span>{label.label_value}</span>
          </span>
        );
      })}
    </div>
  );
}