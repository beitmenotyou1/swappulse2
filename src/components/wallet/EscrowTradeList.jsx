import React, { useState, useEffect } from 'react';
import { Package, Loader2, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';

const STATUS_STEPS = [
  { key: 'created', label: 'Created' },
  { key: 'funded', label: 'Funded' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'released', label: 'Released' },
];

const STATUS_COLORS = {
  created: 'bg-secondary text-foreground',
  funded: 'bg-primary/15 text-primary',
  shipped: 'bg-accent/20 text-accent',
  delivered: 'bg-warning/15 text-warning',
  released: 'bg-success/15 text-success',
  disputed: 'bg-destructive/15 text-destructive',
  cancelled: 'bg-destructive/10 text-destructive',
  refunded: 'bg-secondary text-muted-foreground',
};

export default function EscrowTradeList({ userDid, onUpdated }) {
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!userDid) { setLoading(false); return; }
      try {
        // Get escrows where the user is buyer or seller
        const [asBuyer, asSeller] = await Promise.all([
          base44.entities.EscrowTrade.filter({ buyer_did: userDid }, '-created_date', 10).catch(() => []),
          base44.entities.EscrowTrade.filter({ seller_did: userDid }, '-created_date', 10).catch(() => []),
        ]);
        const all = [...asBuyer, ...asSeller];
        // Deduplicate by id
        const seen = new Set();
        const unique = all.filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
        // Only show active (not released/cancelled/refunded)
        const active = unique.filter((e) => !['released', 'cancelled', 'refunded'].includes(e.status));
        setEscrows(active);
      } catch (e) {
        console.error('Escrow load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [userDid]);

  if (loading) {
    return (
      <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
    );
  }

  if (!escrows.length) return null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Package className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-bold">Active Escrow Trades</h2>
      </div>
      <div className="space-y-2">
        {escrows.map((escrow) => (
          <Link
            key={escrow.id}
            to={`/trade/${escrow.trade_listing_id}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-secondary transition-colors"
          >
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${STATUS_COLORS[escrow.status] || 'bg-secondary'}`}>
              <Package className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {escrow.trade_type === 'usdc_purchase' ? 'Card Purchase' : 'Card Swap'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {escrow.card_names?.join(', ') || 'Trade'}
              </p>
            </div>
            <div className="text-right">
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[escrow.status] || 'bg-secondary'}`}>
                {escrow.status}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}