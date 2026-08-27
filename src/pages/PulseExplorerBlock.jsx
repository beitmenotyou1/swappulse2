import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Blocks, Clock, Fuel, Hash, ArrowRight, FileCode2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import ExplorerSearchBar from '@/components/explorer/ExplorerSearchBar';
import TransactionsTable from '@/components/explorer/TransactionsTable';
import HashLink from '@/components/explorer/HashLink';
import { formatNumber, formatTimestamp, formatAge } from '@/lib/explorerFormat';

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="inline-flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
        {Icon && <Icon className="w-4 h-4" />} {label}
      </span>
      <span className="text-right text-sm">{children}</span>
    </div>
  );
}

export default function PulseExplorerBlock() {
  const { blockNumber } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    base44.functions.invoke('pulse-explorer-block', { block_number: parseInt(blockNumber, 10) })
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.error || e?.message || 'Failed to load block'))
      .finally(() => setLoading(false));
  }, [blockNumber]);

  const block = data?.block;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Block" subtitle={`#${blockNumber}`} />
      <div className="mx-auto max-w-5xl px-4 py-4 space-y-4">
        <ExplorerSearchBar />

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        {data && block && (
          <>
            <div className="rounded-xl border border-border bg-card shadow-base">
              <div className="border-b border-border px-4 py-3">
                <h2 className="inline-flex items-center gap-2 text-sm font-semibold"><Blocks className="w-4 h-4 text-primary" /> Block #{block.block_number}</h2>
              </div>
              <div className="divide-y divide-border">
                <Row label="Block Height"><span className="font-mono font-medium">#{formatNumber(block.block_number)}</span></Row>
                <Row icon={Hash} label="Block Hash">
                  <span className="flex items-center gap-2"><span className="font-mono text-xs break-all">{block.hash}</span><HashLink hash={block.hash} to={`/pulse-explorer/block/${block.block_number}`} /></span>
                </Row>
                <Row icon={Hash} label="Parent Hash">
                  <HashLink hash={block.parent_hash} to={`/pulse-explorer/block/${Math.max(0, block.block_number - 1)}`} />
                </Row>
                <Row icon={Clock} label="Timestamp">
                  <span>{formatTimestamp(block.timestamp)} <span className="text-muted-foreground">({formatAge(block.timestamp)})</span></span>
                </Row>
                <Row icon={ArrowRight} label="Miner">
                  <HashLink hash={block.miner} to={`/pulse-explorer/address/${block.miner}`} />
                </Row>
                <Row icon={Fuel} label="Gas Used"><span className="font-mono">{formatNumber(block.gas_used)}</span></Row>
                <Row label="Size"><span className="font-mono">{formatNumber(block.size)} bytes</span></Row>
                <Row label="Transactions"><span className="font-mono">{formatNumber(block.tx_count)}</span></Row>
                {block.extra_data && (
                  <div className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2"><FileCode2 className="w-4 h-4" /> Extra Data</span>
                    <pre className="max-h-24 overflow-auto rounded-lg border border-border bg-secondary/30 p-3 font-mono text-xs break-all whitespace-pre-wrap">
                      {block.extra_data}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-base">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Transactions in Block #{block.block_number}</h2>
              </div>
              <TransactionsTable transactions={data.transactions || []} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}