import React from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ExternalLink } from 'lucide-react';

// Two action chips that appear on every transaction row:
// 1. "View in wallet" — deep-links to the SwapPulse wallet activity tab.
// 2. "View on explorer" — deep-links to this explorer's transaction detail page.
export default function TxActionLinks({ txHash, walletUrl = '/wallet' }) {
  const explorerUrl = `/pulse-explorer/tx/${txHash}`;
  return (
    <span className="inline-flex items-center gap-1">
      <Link
        to={walletUrl}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary transition-colors"
        title="View in SwapPulse wallet"
      >
        <Wallet className="w-3 h-3" />
        <span className="hidden sm:inline">Wallet</span>
      </Link>
      <Link
        to={explorerUrl}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
        title="View on explorer"
      >
        <ExternalLink className="w-3 h-3" />
        <span className="hidden sm:inline">Explorer</span>
      </Link>
    </span>
  );
}