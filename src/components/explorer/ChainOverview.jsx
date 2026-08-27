import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, AlertCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import { formatNumber } from '@/lib/explorerFormat';
import { OVERVIEW_CHAIN_KEYS, getChainMeta } from '@/lib/explorerChains';

// Grid of chain cards showing each chain's current block height.
// Gives a quick multi-chain overview on the explorer homepage.
export default function ChainOverview({ chains = [] }) {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get('chain') || 'pulse';

  const handleSelect = (key) => {
    if (key === 'pulse') {
      searchParams.delete('chain');
    } else {
      searchParams.set('chain', key);
    }
    setSearchParams(searchParams, { replace: true });
  };

  // Build a map of chain data from the overview response
  const chainMap = new Map(chains.map((c) => [c.key, c]));

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4">
      {OVERVIEW_CHAIN_KEYS.map((key) => {
        const meta = getChainMeta(key);
        const data = chainMap.get(key);
        const isActive = selected === key;
        const isUnreachable = data?.error || data?.head == null;
        return (
          <button
            key={key}
            onClick={() => handleSelect(key)}
            className={`rounded-xl border p-3 text-left transition-colors ${
              isActive
                ? 'border-primary bg-primary/5 shadow-raised'
                : 'border-border bg-card hover:border-border-strong'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${meta.isMain ? 'text-primary' : 'text-foreground'}`}>
                {meta.isMain && `${t('explorer.main')} · `}{meta.name}
              </span>
              {isUnreachable ? (
                <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Activity className="h-3.5 w-3.5 text-success" />
              )}
            </div>
            <p className="mt-1.5 font-mono text-lg font-bold tabular-nums text-foreground">
              {isUnreachable ? '—' : `#${formatNumber(data.head)}`}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {meta.symbol} · {t('explorer.chainId')}: {meta.chainId}
            </p>
          </button>
        );
      })}
    </div>
  );
}