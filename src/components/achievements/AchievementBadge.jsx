import './achievements.css';
import React from 'react';
import { Lock } from 'lucide-react';
import { hexToRgba } from '@/lib/achievementSpecs';

// Reusable gold medallion. Glow colour + opacity come from the achievement's
// `visual` config; the glow-pulse animation lives in achievements.css and reads
// the --glow-color CSS variable set inline below.
export default function AchievementBadge({ spec, size = 'default', unlocked, revoked, onClick, hoverable = true }) {
  const Icon = spec.icon;
  const dim = size === 'large' ? 96 : 72;
  const glow = hexToRgba(spec.visual?.glow_color, spec.visual?.glow_opacity ?? 0.3);
  const interactive = hoverable && (unlocked || revoked) && !!onClick;

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      style={{ width: dim, height: dim, '--glow-color': glow }}
      className={`achievement-badge tier-${spec.tier || 'bronze'} ${unlocked ? 'unlocked' : ''} ${revoked ? 'revoked' : ''} ${interactive ? 'interactive' : ''}`}
      aria-label={spec.name}
    >
      <Icon className="medallion-icon" />
      {!unlocked && !revoked && (
        <span className="badge-lock">
          <Lock className="h-3 w-3" />
        </span>
      )}
      {revoked && <span className="badge-revoked-mark">!</span>}
    </div>
  );
}