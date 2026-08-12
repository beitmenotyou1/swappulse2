import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ShieldAlert, ShieldCheck, RefreshCw, X } from 'lucide-react';
import AchievementBadge from '@/components/achievements/AchievementBadge';
import { ACHIEVEMENT_ICONS } from '@/lib/achievementSpecs';
import { formatDistanceToNowStrict } from 'date-fns';

// Rich notification card for achievement earned/revoked alerts. The notification
// carries structured data in `metadata` (kind, achievementId, achievementName,
// tier, reason, restorationPath).
export default function AchievementNotificationCard({ n, onDismiss }) {
  const navigate = useNavigate();
  const meta = n.metadata || {};
  const kind = meta.kind || 'earned';
  const Icon = ACHIEVEMENT_ICONS[meta.achievementId] || Trophy;
  const spec = { id: meta.achievementId, name: meta.achievementName, tier: meta.tier, icon: Icon };

  const banner = kind === 'earned'
    ? 'border-success/40 bg-success/5'
    : 'border-destructive/40 bg-destructive/5';
  const titleMap = { earned: 'Achievement Unlocked!', revoked: 'Achievement Status Changed', downgraded: 'Achievement Tier Adjusted' };
  const TitleIcon = kind === 'earned' ? ShieldCheck : ShieldAlert;

  const viewProof = () => navigate('/achievements');
  const restore = () => navigate('/achievements');

  return (
    <div className={`flex items-start gap-3 border-l-4 px-4 py-3 ${banner}`}>
      <div className="shrink-0 pt-1">
        <AchievementBadge spec={spec} size="default" unlocked={kind === 'earned'} revoked={kind === 'revoked'} hoverable={false} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <TitleIcon className={`h-4 w-4 ${kind === 'earned' ? 'text-success' : 'text-destructive'}`} />
          <p className="text-sm font-semibold">{titleMap[kind] || 'Achievement Update'}</p>
        </div>
        <p className="text-sm">{meta.achievementName}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {n.created_date ? formatDistanceToNowStrict(new Date(n.created_date), { addSuffix: true }) : ''}
        </p>

        {kind === 'revoked' && meta.reason && (
          <p className="mt-2 rounded-md bg-secondary/60 p-2 text-xs">
            <span className="font-medium">Reason:</span> {meta.reason}
          </p>
        )}
        {kind === 'revoked' && meta.restorationPath && (
          <div className="mt-2">
            <p className="mb-1.5 text-xs text-muted-foreground">{meta.restorationPath}</p>
            <button
              onClick={restore}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              <RefreshCw className="h-3 w-3" /> Check restoration eligibility
            </button>
          </div>
        )}
        {kind === 'earned' && (
          <button
            onClick={viewProof}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            View achievement proof
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(n.id)}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}