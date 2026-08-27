import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, ArrowRightLeft, Activity, Zap, Database, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';
import BlocksTable from '@/components/explorer/BlocksTable';
import TransactionsTable from '@/components/explorer/TransactionsTable';
import ExplainBox from '@/components/explorer/ExplainBox';
import { formatNumber } from '@/lib/explorerFormat';

// Stat card — icon, big number, label. Used on the homepage overview.
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useSEO({
    title: t('explorer.seo.title'),
    description: t('explorer.seo.description'),
    canonicalPath: '/blockchain',
  });

  useEffect(() => {
    base44.functions.invoke('pulse-explorer-home', {})
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.message || t('explorer.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  const cursor = data?.cursor;
  const chainHead = data?.chain_head;
  const blocks = data?.latest_blocks || [];
  const txs = data?.latest_transactions || [];

  // Compute avg gas from latest blocks for the stat card
  const avgGas = blocks.length
    ? Math.round(blocks.reduce((sum, b) => sum + Number(b.gas_used || 0), 0) / blocks.length)
    : 0;

  const explanation = cursor
    ? t('explainer.home.summary', {
        chainHead: formatNumber(chainHead ?? cursor.last_indexed_block),
        blocks: formatNumber(cursor.blocks_indexed_total || 0),
        txs: formatNumber(cursor.txs_indexed_total || 0),
      })
    : '';

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Activity} value={chainHead != null ? `#${formatNumber(chainHead)}` : '—'} label={t('explorer.stat.chainHead')} accent="success" />
        <StatCard icon={TrendingUp} value={formatNumber(cursor?.txs_indexed_total || 0)} label={t('explorer.stat.totalTxs')} accent="primary" />
        <StatCard icon={Zap} value={formatNumber(avgGas)} label={t('explorer.stat.avgGas')} accent="warning" />
        <StatCard icon={Database} value={formatNumber(cursor?.blocks_indexed_total || 0)} label={t('explorer.stat.indexerStatus')} accent="primary" />
      </div>

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

      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card shadow-base">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                <Boxes className="h-4 w-4 text-primary" /> {t('explorer.latestBlocks')}
              </h2>
              <Link to="/blockchain" className="text-xs text-primary hover:underline">{t('explorer.viewAll')}</Link>
            </div>
            <BlocksTable blocks={blocks} />
          </section>

          <section className="rounded-xl border border-border bg-card shadow-base">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                <ArrowRightLeft className="h-4 w-4 text-primary" /> {t('explorer.latestTransactions')}
              </h2>
              <Link to="/blockchain" className="text-xs text-primary hover:underline">{t('explorer.viewAll')}</Link>
            </div>
            <TransactionsTable transactions={txs} />
          </section>
        </div>
      )}
    </div>
  );
}