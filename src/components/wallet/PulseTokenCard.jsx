import React from 'react';
import { ArrowUpFromLine, QrCode, RefreshCw, Zap, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

// Prominent $PULSE token card displayed at the very top of the wallet.
// Shows the native PulseChain $PULSE balance with quick-action buttons
// (Send, Receive, Swap) and a link to the explorer. The card uses a
// distinct gradient to stand out from the fiat/USDC balance card below.
export default function PulseTokenCard({ pulse, pulsePrice, formatFiat, onSend, hasWallet }) {
  // pulse = { native_balance, chain_id, explorer_url, is_native } from get-wallet-balance
  const balanceWei = pulse?.native_balance || '0';
  const balanceCoins = Number(BigInt(balanceWei)) / 1e18;
  const formattedBalance = balanceCoins.toLocaleString('en-US', { maximumFractionDigits: 6 });

  // Fiat equivalent using cached PULSE price
  const usdValue = balanceCoins * (pulsePrice?.usd || 0);
  const fiatValue = formatFiat ? formatFiat(Math.round(usdValue * 100), 'USD') : `$${usdValue.toFixed(2)}`;

  const explorerUrl = pulse?.explorer_url || '';

  return (
    <div className="overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/15 via-card to-card shadow-raised">
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent to-amber-500 text-sm font-extrabold text-accent-foreground shadow-md">
            Ξ
          </div>
          <div>
            <p className="text-sm font-extrabold text-foreground">$PULSE</p>
            <p className="text-[10px] font-medium text-muted-foreground">PulseChain Native</p>
          </div>
        </div>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground transition hover:text-primary"
          >
            Explorer <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="px-5 pb-3 pt-2">
        <p className="text-2xl font-extrabold tracking-tight text-foreground">
          {formattedBalance} <span className="text-base font-bold text-muted-foreground">PULSE</span>
        </p>
        {usdValue > 0 && (
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">≈ {fiatValue}</p>
        )}
      </div>

      <div className="flex gap-2 px-4 pb-4">
        <button
          onClick={onSend}
          disabled={!hasWallet}
          className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-accent px-1 py-2.5 text-xs font-bold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
        >
          <ArrowUpFromLine className="h-4 w-4" />
          Send
        </button>
        <Link
          to="/wallet/receive?chain=pulse"
          className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-secondary px-1 py-2.5 text-xs font-bold text-foreground transition hover:bg-secondary/80"
        >
          <QrCode className="h-4 w-4" />
          Receive
        </Link>
        <Link
          to="/wallet/convert"
          className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-secondary px-1 py-2.5 text-xs font-bold text-foreground transition hover:bg-secondary/80"
        >
          <RefreshCw className="h-4 w-4" />
          Swap
        </Link>
      </div>

      {!hasWallet && (
        <div className="border-t border-border/50 px-5 py-2">
          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Zap className="h-3 w-3 text-accent" />
            Create a wallet in Settings to send and receive $PULSE
          </p>
        </div>
      )}
    </div>
  );
}