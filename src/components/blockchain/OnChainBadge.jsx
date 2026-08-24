import React from 'react';
import { ShieldCheck, Award } from 'lucide-react';
import { useCryptoEnabled } from '@/hooks/useCryptoEnabled';

// Small badge shown on profiles and card detail pages when an on-chain
// NFT (username or card) is minted. Hidden when crypto features are disabled.
// When verificationLevel is provided (card NFTs), the badge reflects the
// trust tier: Level 0 neutral, Level 1–2 primary, Level 3 gold/accent.
export default function OnChainBadge({ label, size = 'sm', verificationLevel }) {
  const { cryptoEnabled } = useCryptoEnabled();
  if (!cryptoEnabled) return null;

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  let badgeClass = 'bg-primary/10 text-primary';
  let Icon = ShieldCheck;
  let text = label || 'On-chain verified';

  if (verificationLevel !== undefined && verificationLevel !== null) {
    if (verificationLevel >= 3) {
      badgeClass = 'bg-accent/15 text-accent';
      Icon = Award;
      text = 'On-chain · Graded';
    } else if (verificationLevel >= 1) {
      badgeClass = 'bg-primary/10 text-primary';
      Icon = ShieldCheck;
      text = 'On-chain · Verified';
    } else {
      badgeClass = 'bg-muted text-muted-foreground';
      Icon = ShieldCheck;
      text = 'On-chain';
    }
  }

  return (
    <span className={`inline-flex items-center rounded-full font-bold ${badgeClass} ${sizes[size]}`}>
      <Icon className={iconSize} />
      {text}
    </span>
  );
}