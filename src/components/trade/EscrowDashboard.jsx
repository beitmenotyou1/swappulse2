import React, { useState, useEffect } from 'react';
import { Lock, Package, Loader2, ChevronRight, CheckCircle2, Truck, AlertCircle, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';

const STATUS_CONFIG = {
  created:   { label: 'Created',   color: 'bg-secondary text-foreground',     icon: Package },
  funded:    { label: 'Funded',    color: 'bg-primary/15 text-primary',        icon: Lock },
  shipped:   { label: 'Shipped',   color: 'bg-accent/20 text-accent',          icon: Truck },
  delivered: { label: 'Delivered',color: 'bg-warning/15 text-warning',        icon: CheckCircle2 },
  released:  { label: 'Released', color: 'bg-success/15 text-success',        icon: CheckCircle2 },
  disputed:  { label: 'Disputed', color: 'bg-destructive/15 text-destructive',icon: AlertCircle },
  cancelled: { label: 'Cancelled',color: 'bg-destructive/10 text-destructive',icon: AlertCircle },
  refunded:  { label: 'Refunded', color: 'bg-secondary text-muted-foreground',icon: RotateCcw },
};

function ReleaseStatusBadge({ escrow, userDid }) {
  const isBuyer = escrow.buyer_did === userDid;
  const isSeller = escrow.seller_did === userDid;

  if (escrow.status === 'released') {
    return <span className="text-xs font-semibold text-success">Released</span>;
  }
  if (escrow.status === 'disputed') {
    return <span className="text-xs font-semibold text-destructive">Disputed</span>;
  }
  if (escrow.status === 'cancelled') {
    return <span className="text-xs font-semibold text-muted-foreground">Cancelled</span>;
  }

  if (escrow.trade_type === 'usdc_purchase') {
    if (isBuyer && !escrow.buyer_confirmed_at) {
      return <span className="text-xs font-semibold text-warning">Awaiting your confirmation</span>;
    }
    if (isSeller && !escrow.buyer_confirmed_at) {
      return <span className="text-xs font-semibold text-muted-foreground">Waiting for buyer</span>;
    }
  } else {
    const buyerConfirmed = !!escrow.buyer_confirmed_at;
    const sellerConfirmed = !!escrow.seller_confirmed_at;
    if (isBuyer && !buyerConfirmed) {
      return <span className="text-xs font-semibold text-warning">Confirm receipt</span>;
    }
    if (isSeller && !sellerConfirmed) {
      return <span className="text-xs font-semibold text-warning">Confirm receipt</span>;
    }
    if (isBuyer && buyerConfirmed && !sellerConfirmed) {
      return <span className="text-xs font-semibold text-muted-foreground">Waiting for counterparty</span>;
    }
    if (isSeller && sellerConfirmed && !buyerConfirmed) {
      return <span className="text-xs font-semibold text-muted-foreground">Waiting for counterparty</span>;
    }
  }

  return <span className="text-xs font-semibold text-muted-foreground">Pending</span>;
}

function EscrowRow({ escrow, userDid }) {
  const config = STATUS_CONFIG[escrow.status] || STATUS_CONFIG.created;
  const Icon = config.icon;
  const amountUsdc = escrow.trade_type === 'usdc_purchase'
    ? (Number(BigInt(escrow.usdc_amount_wei || '0')) / 1_000_000).toFixed(2)
    : null;
  const feeUsdc = escrow.fee_wei
    ? (Number(BigInt(escrow.fee_wei || '0')) / 1_000_000).toFixed(2)
    : null;

  return (
    <Link
      to={`/trade/${escrow.trade_listing_id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:shadow-raised transition-all"
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${config.color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold">
            {escrow.trade_type === 'usdc_purchase' ? 'Card Purchase' : 'Card Swap'}
          </p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${config.color}`}>
            {config.label}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {escrow.card_names?.length ? escrow.card_names.join(', ') : 'Trade'}
        </p>
        <div className="mt-1">
          <ReleaseStatusBadge escrow={escrow} userDid={userDid} />
        </div>
      </div>
      <div className="text-right">
        {amountUsdc && (
          <>
            <p className="text-sm font-bold">{amountUsdc} <span className="text-xs text-muted-foreground">USDC</span></p>
            {feeUsdc && feeUsdc !== '0.00' && (
              <p className="text-[10px] text-muted-foreground">Fee {feeUsdc}</p>
            )}
          </>
        )}
        {!amountUsdc && (
          <p className="text-xs text-muted-foreground">No funds held</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

// Dashboard section for the Trade Status Board: shows the user's active
// escrow trades with held-payment amounts and release status at a glance.
export default function EscrowDashboard({ userDid }) {
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!userDid) { setLoading(false); return; }
      try {
        const [asBuyer, asSeller] = await Promise.all([
          base44.entities.EscrowTrade.filter({ buyer_did: userDid }, '-created_date', 50).catch(() => []),
          base44.entities.EscrowTrade.filter({ seller_did: userDid }, '-created_date', 50).catch(() => []),
        ]);
        const seen = new Set();
        const unique = [...asBuyer, ...asSeller].filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
        const active = unique.filter((e) =>
          !['released', 'cancelled', 'refunded'].includes(e.status)
        );
        setEscrows(active);
      } catch (e) {
        console.error('Escrow dashboard error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [userDid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!escrows.length) return null;

  const totalHeldWei = escrows
    .filter((e) => e.trade_type === 'usdc_purchase' && ['funded', 'shipped', 'delivered'].includes(e.status))
    .reduce((sum, e) => sum + BigInt(e.usdc_amount_wei || '0'), 0n);
  const totalHeldUsdc = (Number(totalHeldWei) / 1_000_000).toFixed(2);
  const pendingRelease = escrows.filter((e) => e.status === 'delivered').length;

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-raised">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Escrow Dashboard</h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-muted-foreground">
            {totalHeldUsdc} USDC held
          </span>
          {pendingRelease > 0 && (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 font-bold text-warning">
              {pendingRelease} pending release
            </span>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {escrows.map((escrow) => (
          <EscrowRow key={escrow.id} escrow={escrow} userDid={userDid} />
        ))}
      </div>
    </div>
  );
}