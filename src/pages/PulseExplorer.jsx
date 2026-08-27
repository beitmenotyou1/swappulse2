import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, ArrowRightLeft, Activity } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import ExplorerSearchBar from '@/components/explorer/ExplorerSearchBar';
import BlocksTable from '@/components/explorer/BlocksTable';
import TransactionsTable from '@/components/explorer/TransactionsTable';
import { formatNumber } from '@/lib/explorerFormat';

export default function PulseExplorer() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    base44.functions.invoke('pulse-explorer-home', {})
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.message || 'Failed to load explorer data'))
      .finally(() => setLoading(false));
  }, []);

  const cursor = data?.cursor;
  const chainHead = data?.chain_head;
  const blocksBehind = cursor && chainHead != null ? chainHead - cursor.last_indexed_block : null;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="PulseChain Explorer" subtitle="Trace every transaction on PulseChain" />

      <div className="mx-auto max-w-6xl px-4 py-4 space-y-4">
        <ExplorerSearchBar />

        {/* Chain status strip */}
        {cursor && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-success" />
              Chain Head: <span className="font-medium text-foreground">#{formatNumber(chainHead ?? cursor.chain_head_at_last_run)}</span>
            </span>
            <span>Indexed to: <span className="font-medium text-foreground">#{formatNumber(cursor.last_indexed_block)}</span></span>
            {blocksBehind != null && (
              <span className={blocksBehind > 5 ? 'text-warning' : 'text-success'}>
                {blocksBehind > 0 ? `${formatNumber(blocksBehind)} blocks behind` : 'Up to date'}
              </span>
            )}
            <span>{formatNumber(cursor.blocks_indexed_total || 0)} blocks · {formatNumber(cursor.txs_indexed_total || 0)} txs indexed</span>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        {data && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card shadow-base">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Boxes className="w-4 h-4 text-primary" /> Latest Blocks
                </h2>
                <Link to="/pulse-explorer" className="text-xs text-primary hover:underline">View all</Link>
              </div>
              <BlocksTable blocks={data.latest_blocks || []} />
            </section>

            <section className="rounded-xl border border-border bg-card shadow-base">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                  <ArrowRightLeft className="w-4 h-4 text-primary" /> Latest Transactions
                </h2>
                <Link to="/pulse-explorer" className="text-xs text-primary hover:underline">View all</Link>
              </div>
              <TransactionsTable transactions={data.latest_transactions || []} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}