import React from 'react';
import { Boxes } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

// Toggle switch at the top of the wallet section that enables/disables all
// crypto/blockchain features. When off, all crypto UI is hidden but the
// wallet and on-chain assets are preserved.
export default function CryptoToggle({ enabled, onToggle }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold">Crypto Features</h3>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? 'Your SwapPulse account is your wallet. Mint NFTs, verify ownership, and trade on Polygon.'
                : 'All blockchain features are hidden. Your wallet and NFTs are preserved.'}
            </p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} aria-label="Toggle crypto features" />
      </div>
    </div>
  );
}