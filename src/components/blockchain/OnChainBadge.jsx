import React from 'react';
import { ShieldCheck } from 'lucide-react';

// Small badge shown on profiles and card detail pages when an on-chain
// NFT (username or card) is minted. Low-key: a single icon + label.
export default function OnChainBadge({ label = 'On-chain verified', size = 'sm' }) {
  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  return (
    <span className={`inline-flex items-center rounded-full bg-primary/10 font-bold text-primary ${sizes[size]}`}>
      <ShieldCheck className={iconSize} />
      {label}
    </span>
  );
}