import React from 'react';
import { Wallet as WalletIcon, Coins, AlertTriangle } from 'lucide-react';
import { SUPPORTED_CHAINS, getChain, formatNative } from '@/lib/chains';
import { nativeToUsd, usdcToUsd, usdToDisplay } from '@/hooks/useCryptoPrices';

// MetaMask-style multi-chain asset list. Groups holdings by chain, showing
// native token + USDC per chain. Each row shows the balance and its value in
// the user's display currency. Malicious tokens are auto-hidden (Phantom pattern).
export default function AssetList({
  balance, chainBalances, cryptoEnabled, chainAddresses,
  formatFiat, formatUsdc, displayCurrency, prices, selectedChain, hiddenCount,
}) {
  const fiatCents = balance?.fiat_cents || 0;
  const currency = balance?.currency || 'GBP';

  const rows = [
    {
      icon: WalletIcon,
      iconBg: 'bg-secondary',
      iconColor: 'text-foreground',
      name: currency,
      subtitle: 'Fiat · Stripe',
      value: formatFiat(fiatCents, currency),
      subValue: balance && (balance.total_topup_cents || 0) > 0
        ? `Refundable ${formatFiat(balance.total_topup_cents, currency)}`
        : null,
    },
  ];

  if (cryptoEnabled && chainBalances) {
    for (const cb of chainBalances) {
      if (selectedChain && selectedChain !== 'all' && cb.chain !== selectedChain) continue;

      const chain = getChain(cb.chain);
      if (!chain) continue;

      // Skip zero balances (keep the list clean)
      const hasNative = BigInt(cb.native || '0') > 0n;
      const hasUsdc = cb.usdc && BigInt(cb.usdc) > 0n;
      if (!hasNative && !hasUsdc) continue;

      // Native token row
      if (hasNative) {
        const usdVal = nativeToUsd(cb.native, cb.nativeDecimals, cb.nativeSymbol, prices);
        const display = usdToDisplay(usdVal, displayCurrency, prices);
        rows.push({
          icon: Coins,
          iconBg: 'bg-secondary',
          iconColor: 'text-foreground',
          iconColorCustom: chain.color,
          name: chain.nativeSymbol,
          subtitle: `${chain.name} · Native`,
          value: `${formatNative(cb.native, cb.nativeDecimals)} ${chain.nativeSymbol}`,
          subValue: display.formatted,
        });
      }

      // USDC row (EVM chains only)
      if (hasUsdc && chain.type === 'evm') {
        const usdVal = usdcToUsd(cb.usdc, prices);
        const display = usdToDisplay(usdVal, displayCurrency, prices);
        rows.push({
          icon: Coins,
          iconBg: 'bg-primary/10',
          iconColor: 'text-primary',
          name: 'USDC',
          subtitle: `${chain.name} · USDC`,
          value: `${formatUsdc(cb.usdc)} USDC`,
          subValue: display.formatted,
        });
      }
    }
  }

  return (
    <div>
      <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-raised">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
              style={row.iconColorCustom ? { backgroundColor: `${row.iconColorCustom}20` } : { backgroundColor: undefined }}
            >
              <row.icon
                className="h-5 w-5"
                style={row.iconColorCustom ? { color: row.iconColorCustom } : undefined}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.subtitle}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{row.value}</p>
              {row.subValue && <p className="text-xs text-muted-foreground">{row.subValue}</p>}
            </div>
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <div className="mt-2 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          {hiddenCount} hidden item{hiddenCount > 1 ? 's' : ''} (malicious tokens filtered)
        </div>
      )}
    </div>
  );
}