import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, ArrowUpDown, Zap, Activity, Trophy, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';
import { formatNumber, formatGwei, formatPls } from '@/lib/explorerFormat';
import { getActiveChain, setActiveChain } from '@/lib/explorerChain';
import { getChainMeta } from '@/lib/explorerChains';
import ChainLogo from './ChainLogo';

// Collapsible comparison table showing gas price and recent transaction
// volume for all supported chains. Helps users pick the best chain for
// their next trade. The "best for trading" chain is highlighted.
export default function ChainComparisonTable() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeChain = getActiveChain(searchParams);
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState('score');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    if (!expanded || data) return;
    setLoading(true);
    base44.functions.invoke('multi-chain-comparison', {})
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [expanded, data]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'score' || key === 'recentTxCount' || key === 'chainHead' ? 'desc' : 'asc');
    }
  };

  const handleSelectChain = (key) => {
    setActiveChain(key, searchParams, setSearchParams);
  };

  const chains = data?.chains || [];
  const sorted = [...chains].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === 'asc' ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
  });

  const bestChain = data?.bestChain;

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-base">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-secondary/30"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-primary" />
          {t('explorer.compareChains')}
        </span>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          {expanded ? t('explorer.collapse') : t('explorer.expand')}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Collapsible table */}
      {expanded && (
        <div className="border-t border-border">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-secondary border-t-primary" />
            </div>
          )}

          {!loading && data?.error && (
            <div className="px-4 py-8 text-center text-sm text-destructive">{t('explorer.loadFailed')}</div>
          )}

          {!loading && !data?.error && (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="cursor-pointer px-4 py-2.5 font-semibold hover:text-foreground" onClick={() => handleSort('name')}>
                        <span className="inline-flex items-center gap-1">{t('explorer.chain')} <SortIcon col="name" /></span>
                      </th>
                      <th className="cursor-pointer px-4 py-2.5 font-semibold hover:text-foreground" onClick={() => handleSort('gasPriceGwei')}>
                        <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" /> {t('explorer.gasPrice')} <SortIcon col="gasPriceGwei" /></span>
                      </th>
                      <th className="cursor-pointer px-4 py-2.5 font-semibold hover:text-foreground" onClick={() => handleSort('recentTxCount')}>
                        <span className="inline-flex items-center gap-1">{t('explorer.txVolume')} <SortIcon col="recentTxCount" /></span>
                      </th>
                      <th className="cursor-pointer px-4 py-2.5 font-semibold hover:text-foreground" onClick={() => handleSort('chainHead')}>
                        <span className="inline-flex items-center gap-1">{t('explorer.blockHeight')} <SortIcon col="chainHead" /></span>
                      </th>
                      <th className="px-4 py-2.5 font-semibold">{t('explorer.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((chain) => {
                      const isBest = chain.key === bestChain;
                      const isActive = chain.key === activeChain;
                      const isUnreachable = chain.error || chain.chainHead == null;
                      return (
                        <tr
                          key={chain.key}
                          className={`border-b border-border last:border-0 transition-colors hover:bg-secondary/20 ${
                            isBest ? 'bg-primary/5' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2">
                              {chain.isMain && <span className="text-primary">★</span>}
                              <ChainLogo chainKey={chain.key} size={18} />
                              <span className="font-semibold">{chain.name}</span>
                              {isBest && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                  <Trophy className="h-3 w-3" /> {t('explorer.bestForTrading')}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums">
                            {isUnreachable ? <span className="text-muted-foreground">—</span> : `${formatGwei(chain.gasPriceWei)} Gwei`}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums">
                            {isUnreachable ? <span className="text-muted-foreground">—</span> : formatNumber(chain.recentTxCount)}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums">
                            {isUnreachable ? (
                              <span className="inline-flex items-center gap-1 text-muted-foreground"><AlertCircle className="h-3 w-3" /> {t('explorer.unreachable')}</span>
                            ) : `#${formatNumber(chain.chainHead)}`}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleSelectChain(chain.key)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                                isActive
                                  ? 'bg-primary text-primary-foreground'
                                  : 'border border-border hover:bg-secondary'
                              }`}
                            >
                              {isActive ? t('explorer.active') : t('explorer.view')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 p-3 md:hidden">
                {sorted.map((chain) => {
                  const isBest = chain.key === bestChain;
                  const isActive = chain.key === activeChain;
                  const isUnreachable = chain.error || chain.chainHead == null;
                  return (
                    <div
                      key={chain.key}
                      className={`rounded-lg border p-3 ${isBest ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                          {chain.isMain && <span className="text-primary">★</span>}
                          <ChainLogo chainKey={chain.key} size={16} />
                          {chain.name}
                          {isBest && <Trophy className="h-3.5 w-3.5 text-primary" />}
                        </span>
                        <button
                          onClick={() => handleSelectChain(chain.key)}
                          className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                            isActive ? 'bg-primary text-primary-foreground' : 'border border-border'
                          }`}
                        >
                          {isActive ? t('explorer.active') : t('explorer.view')}
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t('explorer.gasPrice')}: <span className="font-mono font-semibold text-foreground">{isUnreachable ? '—' : `${formatGwei(chain.gasPriceWei)} Gwei`}</span></span>
                        <span className="text-muted-foreground">{t('explorer.txVolume')}: <span className="font-mono font-semibold text-foreground">{isUnreachable ? '—' : formatNumber(chain.recentTxCount)}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}