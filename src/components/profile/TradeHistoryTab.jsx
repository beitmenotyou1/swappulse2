import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeftRight, CheckCircle2, XCircle, Clock, Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import moment from 'moment';

const STATUS_META = {
  open: { label: 'Open', icon: Clock, cls: 'bg-primary/10 text-primary' },
  negotiating: { label: 'Negotiating', icon: ArrowLeftRight, cls: 'bg-accent/10 text-accent' },
  pending_ship: { label: 'Pending Ship', icon: Package, cls: 'bg-warning/10 text-warning' },
  completed: { label: 'Completed', icon: CheckCircle2, cls: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', icon: XCircle, cls: 'bg-destructive/10 text-destructive' },
};

function TradeRow({ trade }) {
  const meta = STATUS_META[trade.status] || STATUS_META.open;
  const Icon = meta.icon;
  const offerCount = trade.offer_card_names?.length || 0;
  const wantedCount = trade.wanted_card_names?.length || 0;

  return (
    <Link
      to={`/trade/${trade.id}`}
      className="block rounded-xl border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-raised"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
          <Icon className="h-3 w-3" /> {meta.label}
        </span>
        <span className="text-xs text-muted-foreground">{moment(trade.created_date).fromNow()}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Offering</p>
          <p className="truncate text-sm font-medium">
            {trade.offer_card_names?.slice(0, 2).join(', ') || '–'}
            {offerCount > 2 && <span className="text-muted-foreground"> +{offerCount - 2}</span>}
          </p>
        </div>
        <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Wants</p>
          <p className="truncate text-sm font-medium">
            {trade.wanted_card_names?.slice(0, 2).join(', ') || '–'}
            {wantedCount > 2 && <span className="text-muted-foreground"> +{wantedCount - 2}</span>}
          </p>
        </div>
      </div>
      {trade.offer_card_images?.[0] && (
        <div className="mt-2 flex gap-1.5">
          {trade.offer_card_images.slice(0, 4).map((img, i) => (
            <img key={i} src={img} alt="" className="h-12 w-12 rounded-md object-cover ring-1 ring-border" loading="lazy" />
          ))}
        </div>
      )}
    </Link>
  );
}

export default function TradeHistoryTab({ did }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const all = await base44.entities.TradeListing.filter({ did }, '-created_date', 100);
        if (active) setTrades(all || []);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [did]);

  const summary = useMemo(() => {
    const counts = { total: trades.length, completed: 0, active: 0, cancelled: 0 };
    for (const t of trades) {
      if (t.status === 'completed') counts.completed++;
      else if (t.status === 'cancelled') counts.cancelled++;
      else counts.active++;
    }
    return counts;
  }, [trades]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (error) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Couldn't load trade history right now.</p>;
  }
  if (trades.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No trade activity yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold">{summary.total}</p>
          <p className="text-[10px] uppercase text-muted-foreground">Total</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-success">{summary.completed}</p>
          <p className="text-[10px] uppercase text-muted-foreground">Done</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-primary">{summary.active}</p>
          <p className="text-[10px] uppercase text-muted-foreground">Active</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-destructive">{summary.cancelled}</p>
          <p className="text-[10px] uppercase text-muted-foreground">Cancelled</p>
        </div>
      </div>
      {trades.map((t) => <TradeRow key={t.id} trade={t} />)}
    </div>
  );
}