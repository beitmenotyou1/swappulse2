import React from 'react';
import { Zap, ExternalLink } from 'lucide-react';

// $PULSE token display card shown at the top of the wallet. Displays the
// native PulseChain $PULSE balance and a link to the explorer. Action
// buttons (Send/Receive/Swap) are handled by the main wallet interface
// (TotalBalanceCard and the Convert page) so this card is display-only.
export default function PulseTokenCard({ pulse, pulsePrice, formatFiat, hasWallet }) {
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

      <div className="px-5 pb-4 pt-2">
        <p className="text-2xl font-extrabold tracking-tight text-foreground">
          {formattedBalance} <span className="text-base font-bold text-muted-foreground">PULSE</span>
        </p>
        {usdValue > 0 && (
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">≈ {fiatValue}</p>
        )}
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