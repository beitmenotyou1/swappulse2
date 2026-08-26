import React from 'react';
import { Wallet, Check } from 'lucide-react';

// Lets the collector choose which wallet is the default for sends and
// displayed balances: their custodial wallet or their linked (external/
// hardware) wallet. Stored in SettingsConfig.config.wallet.default_wallet.
export default function DefaultWalletSelector({ settings, update, linkedWallet, custodialWallet }) {
  const defaultWallet = settings?.wallet?.default_wallet || 'custodial';

  const handleSelect = (value) => {
    update({ wallet: { default_wallet: value } });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Default Wallet</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose which wallet handles your sends and displayed balances. You can switch anytime.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => handleSelect('custodial')}
          disabled={!custodialWallet}
          className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition disabled:opacity-50 ${
            defaultWallet === 'custodial'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-secondary'
          }`}
        >
          <span className="text-xs font-bold">Custodial</span>
          <span className="text-[10px] text-muted-foreground">Platform wallet</span>
          {defaultWallet === 'custodial' && <Check className="h-3.5 w-3.5 text-primary" />}
        </button>
        <button
          onClick={() => handleSelect('linked')}
          disabled={!linkedWallet}
          className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition disabled:opacity-50 ${
            defaultWallet === 'linked'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-secondary'
          }`}
        >
          <span className="text-xs font-bold">Linked</span>
          <span className="text-[10px] text-muted-foreground">
            {linkedWallet?.hardware ? 'Hardware wallet' : 'Browser extension'}
          </span>
          {defaultWallet === 'linked' && <Check className="h-3.5 w-3.5 text-primary" />}
        </button>
      </div>
    </div>
  );
}