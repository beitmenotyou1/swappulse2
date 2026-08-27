import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, HelpCircle, ArrowRight, Coins,
  Fuel, Hash, Blocks, Clock, ArrowDownLeft, ArrowUpRight, FileCode2,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import ExplorerSearchBar from '@/components/explorer/ExplorerSearchBar';
import HashLink from '@/components/explorer/HashLink';
import TxActionLinks from '@/components/explorer/TxActionLinks';
import {
  formatPls, formatGwei, formatNumber, formatTimestamp, formatAge, formatTokenAmount,
} from '@/lib/explorerFormat';

function StatusBadge({ status }) {
  if (status === 'success') return <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success"><CheckCircle2 className="w-3.5 h-3.5" /> Success</span>;
  if (status === 'failed') return <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive"><XCircle className="w-3.5 h-3.5" /> Failed</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground"><HelpCircle className="w-3.5 h-3.5" /> Unknown</span>;
}

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

export default function PulseExplorerTx() {
  const { txHash } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    base44.functions.invoke('pulse-explorer-tx', { hash: txHash })
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.error || e?.message || 'Failed to load transaction'))
      .finally(() => setLoading(false));
  }, [txHash]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Transaction" subtitle={txHash} />
      <div className="mx-auto max-w-4xl px-4 py-4 space-y-4">
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
            {/* Action links */}
            <div className="flex items-center gap-2">
              <TxActionLinks txHash={data.tx_hash} walletUrl={data.wallet_url || '/wallet'} />
            </div>

            {/* Transaction detail card */}
            <div className="rounded-xl border border-border bg-card shadow-base">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Transaction Details</h2>
                <StatusBadge status={data.status} />
              </div>
              <div className="divide-y divide-border">
                <Row icon={Hash} label="Txn Hash">
                  <span className="flex items-center gap-2"><span className="font-mono text-xs break-all">{data.tx_hash}</span><HashLink hash={data.tx_hash} to={`/pulse-explorer/tx/${data.tx_hash}`} /></span>
                </Row>
                <Row icon={Blocks} label="Block">
                  {data.block_number != null
                    ? <Link to={`/pulse-explorer/block/${data.block_number}`} className="text-primary hover:underline">#{data.block_number}</Link>
                    : <span className="text-muted-foreground">Pending</span>}
                </Row>
                <Row icon={Clock} label="Timestamp">
                  <span>{formatTimestamp(data.timestamp)} <span className="text-muted-foreground">({formatAge(data.timestamp)})</span></span>
                </Row>
                <Row icon={ArrowRight} label="From">
                  <HashLink hash={data.from_address} to={`/pulse-explorer/address/${data.from_address}`} />
                </Row>
                <Row icon={ArrowRight} label="To">
                  {data.to_address
                    ? <HashLink hash={data.to_address} to={`/pulse-explorer/address/${data.to_address}`} />
                    : <span className="inline-flex items-center gap-1 text-xs italic text-primary"><FileCode2 className="w-3.5 h-3.5" /> Contract Creation</span>}
                </Row>
                {data.created_contract && (
                  <Row icon={FileCode2} label="Created Contract">
                    <HashLink hash={data.created_contract} to={`/pulse-explorer/address/${data.created_contract}`} />
                  </Row>
                )}
                <Row icon={Coins} label="Value">
                  <span className="font-mono">{formatPls(data.value_wei)} PLS</span>
                </Row>
                <Row icon={Fuel} label="Gas Used">
                  <span className="font-mono">{formatNumber(data.gas_used)} <span className="text-muted-foreground">({formatGwei(data.gas_price)} Gwei)</span></span>
                </Row>
                <Row label="Gas Limit">
                  <span className="font-mono">{formatNumber(data.gas_limit)}</span>
                </Row>
                <Row label="Nonce">
                  <span className="font-mono">{formatNumber(data.nonce)}</span>
                </Row>
                <div className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2"><FileCode2 className="w-4 h-4" /> Input Data</span>
                  <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-secondary/30 p-3 font-mono text-xs break-all whitespace-pre-wrap">
                    {data.input_data || '0x'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Token transfers */}
            {data.token_transfers?.length > 0 && (
              <div className="rounded-xl border border-border bg-card shadow-base">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">Token Transfers ({data.token_transfers.length})</h2>
                </div>
                <div className="divide-y divide-border">
                  {data.token_transfers.map((t, i) => (
                    <div key={i} className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-success" />
                        <span className="text-muted-foreground">From</span>
                        <HashLink hash={t.from_address} to={`/pulse-explorer/address/${t.from_address}`} />
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUpRight className="w-3.5 h-3.5 text-warning" />
                        <span className="text-muted-foreground">To</span>
                        <HashLink hash={t.to_address} to={`/pulse-explorer/address/${t.to_address}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">For</span>
                        <span className="font-mono font-medium">{formatTokenAmount(t.value, t.token_decimals)} {t.token_symbol}</span>
                        <span className="text-muted-foreground">·</span>
                        <HashLink hash={t.token_contract} to={`/pulse-explorer/address/${t.token_contract}`} prefixLen={8} suffixLen={6} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}