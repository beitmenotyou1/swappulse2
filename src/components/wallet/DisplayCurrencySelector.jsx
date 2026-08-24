import React from 'react';
import { Coins } from 'lucide-react';

const CURRENCIES = [
  { code: 'USDC', label: 'USDC', description: 'USD Coin' },
  { code: 'POL', label: 'POL', description: 'Polygon native token' },
  { code: 'GBP', label: 'GBP', description: 'British Pound' },
  { code: 'EUR', label: 'EUR', description: 'Euro' },
  { code: 'USD', label: 'USD', description: 'US Dollar' },
];

export default function DisplayCurrencySelector({ settings, update }) {
  const current = settings?.crypto?.display_currency || 'USDC';

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Coins className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Display Currency</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Choose how your cryptocurrency holdings are displayed across the wallet.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {CURRENCIES.map((c) => (
          <button
            key={c.code}
            onClick={() => update({ crypto: { display_currency: c.code } })}
            className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
              current === c.code
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-secondary'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Showing: {CURRENCIES.find((c) => c.code === current)?.description || current}
      </p>
    </div>
  );
}