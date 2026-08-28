import React from 'react';
import { ShieldCheck, AlertTriangle, Award, Eye, Star, HelpCircle } from 'lucide-react';
import SubscribeLabelerButton from '@/components/labelers/SubscribeLabelerButton';

const CATEGORY_ICON = {
  authenticity: ShieldCheck,
  safety: AlertTriangle,
  grading: Award,
  expertise: Star,
  quality: Eye,
  other: HelpCircle,
};

const CATEGORY_TONE = {
  authenticity: 'text-rarity-holo',
  safety: 'text-destructive',
  grading: 'text-accent',
  expertise: 'text-rarity-ex',
  quality: 'text-rarity-rare',
  other: 'text-muted-foreground',
};

export default function LabelerCard({ labeler, subscribed, onToggle }) {
  const Icon = CATEGORY_ICON[labeler.category] || HelpCircle;
  const approved = labeler.approval_status === 'approved';
  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition hover:shadow-raised">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary ${CATEGORY_TONE[labeler.category] || 'text-muted-foreground'}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-bold">{labeler.name}</h3>
            {approved ? (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">Approved</span>
            ) : (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning">Pending</span>
            )}
          </div>
          {labeler.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{labeler.description}</p>}
          {(labeler.label_values?.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {labeler.label_values.slice(0, 5).map((v) => (
                <span key={v} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{v}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <SubscribeLabelerButton labeler={labeler} subscribed={subscribed} onToggle={onToggle} />
        <span className="ml-auto text-xs text-muted-foreground">{labeler.subscriber_count || 0} subs · {labeler.label_count || 0} labels</span>
      </div>
    </div>
  );
}