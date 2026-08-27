import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Wallet2, FileCode2, Hash } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import ExplorerSearchBar from '@/components/explorer/ExplorerSearchBar';
import TransactionsTable from '@/components/explorer/TransactionsTable';
import HashLink from '@/components/explorer/HashLink';
import { formatPls, formatNumber } from '@/lib/explorerFormat';

export default function PulseExplorerAddress() {
  const { address } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError('');
    base44.functions.invoke('pulse-explorer-address', { address, page, limit: 25 })
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.error || e?.message || 'Failed to load address'))
      .finally(() => setLoading(false));
  }, [address, page]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Address" subtitle={address} />
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

        {data && (
          <>
            {/* Address overview card */}
            <div className="rounded-xl border border-border bg-card shadow-base">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Address Overview</h2>
              </div>
              <div className="divide-y divide-border">
                <div className="flex items-start justify-between gap-4 px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Hash className="w-4 h-4" /> Address</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs break-all">{data.address}</span>
                    <HashLink hash={data.address} to={`/pulse-explorer/address/${data.address}`} />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Wallet2 className="w-4 h-4" /> PLS Balance</span>
                  <span className="font-mono text-sm font-medium">{formatPls(data.balance_wei)} PLS</span>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><FileCode2 className="w-4 h-4" /> Type</span>
                  <span className={`text-sm font-medium ${data.is_contract ? 'text-primary' : 'text-foreground'}`}>
                    {data.is_contract ? 'Contract' : 'External Account (EOA)'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-sm text-muted-foreground">Nonce</span>
                  <span className="font-mono text-sm">{formatNumber(data.nonce)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-sm text-muted-foreground">Transactions</span>
                  <span className="font-mono text-sm">{formatNumber(data.total)} ({formatNumber(data.pages)} page{data.pages === 1 ? '' : 's'})</span>
                </div>
              </div>
            </div>

            {/* Transaction history */}
            <div className="rounded-xl border border-border bg-card shadow-base">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Transaction History</h2>
              </div>
              <TransactionsTable transactions={data.transactions || []} showDirection />
              {data.pages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-40 transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="text-muted-foreground">Page {data.page} of {data.pages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                    disabled={page >= data.pages}
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-40 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}