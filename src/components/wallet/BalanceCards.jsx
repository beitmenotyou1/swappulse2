import React from 'react';
import { Wallet as WalletIcon, Coins } from 'lucide-react';

export default function BalanceCards({ balance, cryptoEnabled, onChainUsdcWei, formatFiat, formatUsdc }) {
  const fiatCents = balance?.fiat_cents || 0;
  const currency = balance?.currency || 'GBP';
  const usdcWei = balance?.usdc_wei || '0';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Fiat Balance Card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-raised">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
            <WalletIcon className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Fiat Balance</p>
            <p className="text-xs text-muted-foreground">{currency}</p>
          </div>
        </div>
        <p className="mt-4 text-3xl font-bold tracking-tight">{formatFiat(fiatCents, currency)}</p>
        {balance && fiatCents > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Refundable: {formatFiat(balance.total_topup_cents || 0, currency)}
          </p>
        )}
      </div>

      {/* USDC Balance Card (crypto on) */}
      {cryptoEnabled ? (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 shadow-raised">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">USDC Balance</p>
              <p className="text-xs text-muted-foreground">Polygon</p>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-primary">
            {formatUsdc(usdcWei)} <span className="text-base font-semibold">USDC</span>
          </p>
          {onChainUsdcWei && onChainUsdcWei !== '0' && (
            <p className="mt-1 text-xs text-muted-foreground">
              On-chain: {formatUsdc(onChainUsdcWei)} USDC
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-secondary/50 p-5">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
              <Coins className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Crypto Disabled</p>
              <p className="text-xs text-muted-foreground">Enable in Settings</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Crypto features are turned off. Enable them in Settings → Polygon to send, receive, and hold USDC.
          </p>
        </div>
      )}
    </div>
  );
}