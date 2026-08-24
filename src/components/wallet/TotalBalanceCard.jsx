import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, RotateCcw, QrCode } from 'lucide-react';

// MetaMask/Brave-style balance hero card: large total balance on a gradient
// background with a row of quick-action buttons (Buy, Send, Receive, Swap).
export default function TotalBalanceCard({
  balance, cryptoEnabled, formatFiat, formatUsdc,
  onTopUp, onSend, onReceive, onConvert, onRefund, hasWallet,
}) {
  const fiatCents = balance?.fiat_cents || 0;
  const currency = balance?.currency || 'GBP';
  const usdcWei = balance?.usdc_wei || '0';
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';

  const actions = [
    { icon: ArrowDownToLine, label: 'Buy', onClick: onTopUp, primary: true },
  ];
  if (cryptoEnabled && hasWallet) {
    actions.push(
      { icon: ArrowUpFromLine, label: 'Send', onClick: onSend },
      { icon: QrCode, label: 'Receive', onClick: onReceive },
      { icon: RefreshCw, label: 'Swap', onClick: onConvert },
    );
  }
  if (balance && fiatCents > 0) {
    actions.push({ icon: RotateCcw, label: 'Refund', onClick: onRefund });
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-muted shadow-elevated">
      <div className="px-5 pt-5 pb-4 text-white">
        <p className="text-sm font-medium text-white/70">Total Balance</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">
          {formatFiat(fiatCents, currency)}
        </p>
        {cryptoEnabled && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/60">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            {formatUsdc(usdcWei)} USDC
          </p>
        )}
      </div>
      <div className="flex gap-2 px-4 pb-4">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-xs font-bold transition ${
              action.primary
                ? 'bg-white text-primary hover:bg-white/90'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <action.icon className="h-5 w-5" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}