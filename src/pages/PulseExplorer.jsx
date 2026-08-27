import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, ArrowRightLeft, Activity, Zap, TrendingUp, Hash } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';
import BlocksTable from '@/components/explorer/BlocksTable';
import TransactionsTable from '@/components/explorer/TransactionsTable';
import ExplainBox from '@/components/explorer/ExplainBox';
import ChainSelector from '@/components/explorer/ChainSelector';
import ChainOverview from '@/components/explorer/ChainOverview';
import ExplorerCharts from '@/components/explorer/ExplorerCharts';
import ChainComparisonTable from '@/components/explorer/ChainComparisonTable';
import PulseChainSummary from '@/components/explorer/PulseChainSummary';
import { formatNumber } from '@/lib/explorerFormat';
import { getChainMeta } from '@/lib/explorerChains';
import ChainLogo from '@/components/explorer/ChainLogo';

function StatCard({ icon: Icon, value, label, accent = 'primary' }) {
  const accentClasses = {
    primary: 'from-primary/10 to-primary/5 text-primary',
    success: 'from-success/10 to-success/5 text-success',
    warning: 'from-warning/10 to-warning/5 text-warning',
  };
  return (
    <div className={`rounded-xl border border-border bg-gradient-to-br ${accentClasses[accent]} p-4 shadow-base`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

export default function PulseExplorer() {
  const t = useT();
  const [searchParams] = useSearchParams();
  const chainKey = searchParams.get('chain') || 'pulse';
  const chainMeta = getChainMeta(chainKey);
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useSEO({
    title: t('explorer.seo.title'),
    description: t('explorer.seo.description'),
    canonicalPath: '/blockchain',
  });

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      base44.functions.invoke('multi-chain-explorer', { chain: chainKey }).catch((e) => ({ data: { error: e?.message } })),
      base44.functions.invoke('multi-chain-explorer', { overview: true }).catch(() => ({ data: { chains: [] } })),
    ])
      .then(([mainRes, overviewRes]) => {
        setData(mainRes.data);
        setOverview(overviewRes.data);
      })
      .finally(() => setLoading(false));
  }, [chainKey, t]);

  const chain = data?.chain;
  const cursor = data?.cursor;
  const chainHead = data?.chain_head;
  const blocks = data?.latest_blocks || [];
  const txs = data?.latest_transactions || [];
  const symbol = chain?.symbol || chainMeta.symbol;

  const avgGas = blocks.length
    ? Math.round(blocks.reduce((sum, b) => sum + Number(b.gas_used || 0), 0) / blocks.length)
    : 0;

  const totalTxsInBlocks = blocks.reduce((sum, b) => sum + (b.tx_count || 0), 0);

  const explanation = cursor
    ? t('explainer.home.summary', {
        chainHead: formatNumber(chainHead ?? cursor.last_indexed_block),
        blocks: formatNumber(cursor.blocks_indexed_total || 0),
        txs: formatNumber(cursor.txs_indexed_total || 0),
      })
    : chain
      ? t('explorer.liveChainSummary', { name: chain.name, head: formatNumber(chainHead), symbol })
      : '';

  return (
    <div className="space-y-5">
      {/* Chain selector */}
      <ChainSelector />

      {/* Multi-chain overview */}
      {overview?.chains?.length > 0 && <ChainOverview chains={overview.chains} />}

      {/* Chain comparison table */}
      <ChainComparisonTable />

      {/* PulseChain activity summary */}
      <PulseChainSummary />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Activity} value={chainHead != null ? `#${formatNumber(chainHead)}` : '—'} label={t('explorer.stat.chainHead')} accent="success" />
        <StatCard icon={TrendingUp} value={formatNumber(totalTxsInBlocks)} label={t('explorer.stat.totalTxs')} accent="primary" />
        <StatCard icon={Zap} value={formatNumber(avgGas)} label={t('explorer.stat.avgGas')} accent="warning" />
        <StatCard icon={Hash} value={chain?.chainId ?? chainMeta.chainId} label={t('explorer.chainId')} accent="primary" />
      </div>

      {/* 7-day activity charts */}
      <ExplorerCharts chainKey={chainKey} />

      {/* Plain-language overview */}
      {explanation && <ExplainBox title={t('explorer.whatHappened')}>{explanation}</ExplainBox>}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {data && !data.error && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card shadow-base">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                <Boxes className="h-4 w-4 text-primary" /> {t('explorer.latestBlocks')}
              </h2>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ChainLogo chainKey={chainKey} size={14} /> {chain?.name}</span>
            </div>
            <BlocksTable blocks={blocks} />
          </section>

          <section className="rounded-xl border border-border bg-card shadow-base">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                <ArrowRightLeft className="h-4 w-4 text-primary" /> {t('explorer.latestTransactions')}
              </h2>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ChainLogo chainKey={chainKey} size={14} /> {chain?.name}</span>
            </div>
            <TransactionsTable transactions={txs} symbol={symbol} />
          </section>
        </div>
      )}
    </div>
  );
}