import React from 'react';
import AchievementBadge from './AchievementBadge';

export default function AchievementMedallion({ spec, achievement, onClick }) {
  const unlocked = !!achievement && achievement.status !== 'revoked';
  const revoked = !!achievement && achievement.status === 'revoked';
  const pending = !revoked && !!achievement?.pending_revocation_at;
  const clickable = unlocked || revoked;

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`group flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition ${
        unlocked
          ? 'cursor-pointer border-accent/40 bg-accent/5 hover:bg-accent/10'
          : revoked
            ? 'cursor-pointer border-border bg-secondary/40'
            : 'cursor-default border-border bg-secondary/20 opacity-70'
      }`}
    >
      <AchievementBadge spec={spec} unlocked={unlocked} revoked={revoked} onClick={clickable ? onClick : undefined} />
      <div className="space-y-0.5">
        <p className={`text-sm font-semibold leading-tight ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
          {spec.name}
        </p>
        <p className="text-xs leading-tight text-muted-foreground">
          {pending ? 'At risk, grace period' : unlocked ? spec.description : thresholdLabel(spec)}
        </p>
      </div>
    </button>
  );
}

function thresholdLabel(spec) {
  const req = spec.proof_requirements || {};
  switch (spec.proof_type) {
    case 'coverage': return `${req.unique_card_percent}% of any set`;
    case 'filtered_collection': return `${req.minimum_unique_cards} high-tier cards`;
    case 'count': return `${req.minimum_count} completed trade${req.minimum_count === 1 ? '' : 's'}`;
    case 'content_creation': return `${req.minimum_reviews} card reviews`;
    case 'weighted_vouches': return `${req.minimum_distinct_vouchers} distinct vouches`;
    case 'record_existence': return `1 completed chain (≥${req.minimum_parties} parties)`;
    case 'accepted_submissions': return `${req.minimum_accepted_count} corrections`;
    case 'quality_publication': return `${req.minimum_pages_populated} pages + ${req.minimum_engagement} likes`;
    case 'event_hosting': return `≥${req.minimum_participants} participants, ≥${req.minimum_duration_minutes} min`;
    default: return '';
  }
}