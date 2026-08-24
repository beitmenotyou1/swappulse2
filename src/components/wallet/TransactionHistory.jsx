import React from 'react';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Lock, Unlock, CreditCard } from 'lucide-react';

const TRANSFER_TYPE_LABELS = {
  send: { label: 'Sent', icon: ArrowUpRight, color: 'text-destructive' },
  receive: { label: 'Received', icon: ArrowDownLeft, color: 'text-success' },
  fiat_to_usdc: { label: 'Fiat → USDC', icon: RefreshCw, color: 'text-primary' },
  usdc_to_fiat: { label: 'USDC → Fiat', icon: RefreshCw, color: 'text-primary' },
  token_convert: { label: 'Token Convert', icon: RefreshCw, color: 'text-primary' },
  escrow_lock: { label: 'Escrow Lock', icon: Lock, color: 'text-warning' },
  escrow_release: { label: 'Escrow Release', icon: Unlock, color: 'text-success' },
  fee_sweep: { label: 'Fee', icon: RefreshCw, color: 'text-muted-foreground' },
  topup_credit: { label: 'Top Up', icon: ArrowDownLeft, color: 'text-success' },
};

export default function TransactionHistory({ transfers, topups, formatFiat, formatUsdc }) {
  // Merge and sort by date
  const allTx = [
    ...transfers.map((t) => ({
      ...t,
      _type: 'transfer',
      _date: t.created_at || t.created_date,
      _sortDate: new Date(t.created_at || t.created_date || 0).getTime(),
    })),
    ...topups.map((t) => ({
      ...t,
      _type: 'topup',
      _date: t.created_at || t.created_date,
      _sortDate: new Date(t.created_at || t.created_date || 0).getTime(),
      transfer_type: 'topup_credit',
      amount_wei: '0',
      tx_hash: '',
      status: t.status,
    })),
  ].sort((a, b) => b._sortDate - a._sortDate);

  if (!allTx.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No transactions yet. Top up your wallet to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {allTx.map((tx, i) => {
        const meta = TRANSFER_TYPE_LABELS[tx.transfer_type] || TRANSFER_TYPE_LABELS.send;
        const Icon = meta.icon;
        const isTopup = tx._type === 'topup';
        const amount = isTopup
          ? formatFiat(tx.amount_cents, tx.currency)
          : `${formatUsdc(tx.amount_wei)} USDC`;
        const fee = !isTopup && tx.fee_wei && BigInt(tx.fee_wei) > 0n
          ? `${formatUsdc(tx.fee_wei)} USDC`
          : null;

        return (
          <div key={tx.id || i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary ${meta.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{meta.label}</p>
              <p className="truncate text-xs text-muted-foreground">
                {tx.description || (isTopup ? `Top-up via Stripe` : tx.tx_hash?.slice(0, 20) + '…' || '')}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${meta.color}`}>{amount}</p>
              {fee && <p className="text-xs text-muted-foreground">Fee: {fee}</p>}
              <p className="text-xs text-muted-foreground">
                {tx._date ? new Date(tx._date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}