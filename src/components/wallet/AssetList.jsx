import React from 'react';
import { Wallet as WalletIcon, Coins } from 'lucide-react';

// MetaMask-style asset rows: each balance is a row with icon, name, amount,
// and a subtitle — cleaner than separate cards and familiar to wallet users.
export default function AssetList({ balance, cryptoEnabled, onChainUsdcWei, formatFiat, formatUsdc, cryptoDisplay }) {
  const fiatCents = balance?.fiat_cents || 0;
  const currency = balance?.currency || 'GBP';
  const usdcWei = balance?.usdc_wei || '0';

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

  if (cryptoEnabled) {
    const displayLabel = cryptoDisplay?.label || 'USDC';
    const displayFormatted = cryptoDisplay?.formatted || `${formatUsdc(usdcWei)} USDC`;
    rows.push({
      icon: Coins,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      name: displayLabel,
      subtitle: 'Polygon · USDC',
      value: displayFormatted,
      subValue: onChainUsdcWei && onChainUsdcWei !== '0'
        ? `On-chain ${formatUsdc(onChainUsdcWei)} USDC`
        : null,
    });
  }

  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-raised">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${row.iconBg}`}>
            <row.icon className={`h-5 w-5 ${row.iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.subtitle}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{row.value}</p>
            {row.subValue && (
              <p className="text-xs text-muted-foreground">{row.subValue}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}