import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTrustedTraders } from '@/hooks/useTrustedTraders';

// Inline "Trusted Trader" badge — shown next to a handle or display name when
// the collector holds the granted trusted_trader achievement (50+ vouches).
// Compact by default so it fits in a feed post header row without overflow.
export default function TrustedTraderBadge({ did, size = 'sm', className = '' }) {
  const { isTrusted } = useTrustedTraders();
  if (!did || !isTrusted(did)) return null;

  const icon = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const pad = size === 'md' ? 'px-1.5 py-0.5' : 'px-1 py-0';

  return (
    <span
      title="Trusted Trader — 50+ vouches"
      className={`inline-flex items-center gap-0.5 rounded-full bg-accent/15 ${pad} text-accent ${className}`}
    >
      <ShieldCheck className={`${icon} fill-accent/20`} />
      {size === 'md' && <span className="text-[10px] font-bold leading-none">Trusted</span>}
    </span>
  );
}