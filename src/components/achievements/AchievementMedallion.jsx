import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { GLOW_CLASS } from '@/lib/achievementSpecs';

export default function AchievementMedallion({ spec, achievement, onClick }) {
  const [hover, setHover] = useState(false);
  const unlocked = !!achievement && achievement.status !== 'revoked';
  const revoked = !!achievement && achievement.status === 'revoked';
  const Icon = spec.icon;
  const glow = GLOW_CLASS[spec.glow] || GLOW_CLASS.default;
  const clickable = unlocked || revoked;

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={!clickable}
      className={`group flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition ${
        unlocked
          ? 'cursor-pointer border-accent/40 bg-accent/5 hover:bg-accent/10'
          : revoked
            ? 'cursor-pointer border-border bg-secondary/40'
            : 'cursor-default border-border bg-secondary/20 opacity-60'
      }`}
    >
      <div
        className={`relative grid h-20 w-20 place-items-center rounded-full border-2 transition-transform duration-200 ${
          unlocked
            ? 'border-accent bg-accent/10'
            : revoked
              ? 'border-border bg-secondary'
              : 'border-border bg-secondary/50'
        } ${unlocked && hover ? `${glow} scale-105` : ''}`}
      >
        <Icon
          className={`h-9 w-9 ${unlocked ? 'text-accent' : 'text-muted-foreground'}`}
          strokeWidth={unlocked ? 2.2 : 1.5}
        />
        {!unlocked && !revoked && (
          <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-border bg-background">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
        {revoked && (
          <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-destructive/40 bg-destructive/10 text-[10px] font-bold text-destructive">
            !
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        <p
          className={`text-sm font-semibold leading-tight ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {spec.label}
        </p>
        <p className="text-xs leading-tight text-muted-foreground">
          {unlocked ? spec.description : spec.threshold}
        </p>
      </div>
    </button>
  );
}