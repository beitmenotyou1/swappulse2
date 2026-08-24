import React from 'react';
import { Boxes, Wallet } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import { clearCryptoEnabledCache, useCryptoEnabled } from '@/hooks/useCryptoEnabled';

// Crypto features toggle shown in Account settings (not wallet settings).
// When off, the wallet is hidden from navigation and all crypto UI is
// hidden, but the wallet and on-chain assets are preserved. When
// re-enabled, the wallet reappears in the navigation menu.
export default function CryptoFeaturesSection() {
  const { settings, update } = useSettings();
  const { cryptoEnabled } = useCryptoEnabled();

  const handleToggle = (enabled) => {
    update({ crypto: { enabled } });
    clearCryptoEnabledCache();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold">Crypto Features</h3>
            <p className="text-xs text-muted-foreground">
              {cryptoEnabled
                ? 'Your SwapPulse account is your wallet. Mint NFTs, verify ownership, and trade on Polygon. The wallet appears in your navigation.'
                : 'All blockchain features are hidden and the wallet is removed from navigation. Your wallet and NFTs are preserved.'}
            </p>
          </div>
        </div>
        <Switch checked={cryptoEnabled} onCheckedChange={handleToggle} aria-label="Toggle crypto features" />
      </div>
      {cryptoEnabled && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/5 p-2.5 text-xs">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">
            Wallet is visible in your navigation. Minting of username and card NFTs is on Polygon only — gas is paid by you.
          </span>
        </div>
      )}
    </div>
  );
}