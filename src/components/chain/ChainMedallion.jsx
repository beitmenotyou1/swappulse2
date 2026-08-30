import React from 'react';
import { BadgeCheck, ScanLine, ShieldCheck, Sparkles } from 'lucide-react';

// Verification-level medallion. The glow reuses the rarity overlay system so a
// fully graded (level 3) attestation carries the secret-rarity rainbow glow.
const LEVELS = {
  0: { label: 'Self-attested', glow: '', ring: 'border-border', text: 'text-muted-foreground', Icon: BadgeCheck },
  1: { label: 'Scanned', glow: 'rarity-glow-rare', ring: 'border-rarity-rare/40', text: 'text-rarity-rare', Icon: ScanLine },
  2: { label: 'AI-verified', glow: 'rarity-glow-holo', ring: 'border-rarity-holo/50', text: 'text-rarity-holo', Icon: ShieldCheck },
  3: { label: 'Graded cert', glow: 'rarity-glow-secret', ring: 'border-rarity-ex/50', text: 'text-rarity-ex', Icon: Sparkles },
};

export default function ChainMedallion({ level = 0, showLabel = true, className = '' }) {
  const config = LEVELS[Number(level)] || LEVELS[0];
  const { Icon } = config;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border bg-card ${config.ring} ${config.glow}`}
        title={`Chain verification level ${level} — ${config.label}`}
      >
        <Icon className={`h-4 w-4 ${config.text}`} aria-hidden="true" />
      </span>
      {showLabel && (
        <span className="text-xs font-semibold">
          <span className={config.text}>L{Number(level)}</span>
          <span className="ml-1 text-muted-foreground">{config.label}</span>
        </span>
      )}
    </span>
  );
}