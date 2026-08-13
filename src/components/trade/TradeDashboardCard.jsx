import React from 'react';
import { Link } from 'react-router-dom';
import { BellRing, ArrowRight } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { TRADE_STATUS_LABELS, timeAgo } from '@/lib/format';

const STATUS_BADGE = {
  open: 'bg-success/15 text-success',
  negotiating: 'bg-accent/20 text-accent',
  pending_ship: 'bg-primary/15 text-primary',
  completed: 'bg-secondary text-muted-foreground',
  cancelled: 'bg-destructive/15 text-destructive',
};

export default function TradeDashboardCard({ trade, watching = false }) {
  const offer = (trade.offer_card_names || []).slice(0, 2).join(', ') || 'Cards';
  const want = (trade.wanted_card_names || []).slice(0, 2).join(', ') || 'Cards';

  return (
    <Link
      to={`/trade/${trade.id}`}
      className="block rounded-2xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Avatar name={trade.author_name} src={trade.author_avatar} size={32} />
        <span className="flex-1 truncate text-sm font-semibold">{trade.author_name || 'Collector'}</span>
        {watching && <BellRing className="h-4 w-4 text-accent" />}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[trade.status] || 'bg-secondary'}`}>
          {TRADE_STATUS_LABELS[trade.status] || trade.status}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="flex-1 truncate font-medium">{offer}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-muted-foreground">{want}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{timeAgo(trade.updated_date || trade.created_date)}</p>
    </Link>
  );
}