import React from 'react';
import { Coins } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import { formatTokenAmount } from '@/lib/explorerFormat';
import HashLink from './HashLink';

// ERC-20 token balances for an address. Shows each token's symbol,
// current balance, and contract address.
export default function AddressTokens({ tokens = [] }) {
  const t = useT();
  if (!tokens.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-base">
      <div className="border-b border-border px-4 py-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <Coins className="h-4 w-4 text-primary" /> {t('explorer.tokenBalances')}
        </h2>
      </div>
      <div className="divide-y divide-border">
        {tokens.map((token, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{token.symbol}</p>
              <HashLink hash={token.contract} to={`/blockchain/address/${token.contract}`} prefixLen={8} suffixLen={6} />
            </div>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {formatTokenAmount(token.balance, token.decimals)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}