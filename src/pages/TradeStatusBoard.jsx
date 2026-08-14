import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, ArrowLeftRight, Search, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { TRADE_STATUS_LABELS, timeAgo } from '@/lib/format';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';

const COLUMNS = [
  { key: 'open', label: 'Open', accent: 'border-t-success', dot: 'bg-success', badge: 'bg-success/15 text-success' },
  { key: 'negotiating', label: 'Negotiating', accent: 'border-t-accent', dot: 'bg-accent', badge: 'bg-accent/20 text-accent' },
  { key: 'pending_ship', label: 'Pending Ship', accent: 'border-t-primary', dot: 'bg-primary', badge: 'bg-primary/15 text-primary' },
  { key: 'completed', label: 'Completed', accent: 'border-t-muted-foreground', dot: 'bg-muted-foreground', badge: 'bg-secondary text-muted-foreground' },
  { key: 'cancelled', label: 'Cancelled', accent: 'border-t-destructive', dot: 'bg-destructive', badge: 'bg-destructive/15 text-destructive' },
];

export default function TradeStatusBoard() {
  const [allTrades, setAllTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [scope, setScope] = useState('all'); // 'all' | 'mine'
  const [query, setQuery] = useState('');
  const [enforcedIds, setEnforcedIds] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [user, trades, enforced] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.TradeListing.filter({}, '-updated_date', 200).catch(() => []),
        base44.functions.invoke('get-enforced-dids', {}).catch(() => ({ data: { user_ids: [] } })),
      ]);
      setMe(user);
      setAllTrades(trades);
      setEnforcedIds(new Set(enforced.data?.user_ids || []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useRealtimeEvent('trade.status_update', (t) => {
    setAllTrades((prev) => {
      const exists = prev.some((x) => x.id === t.id);
      if (exists) return prev.map((x) => (x.id === t.id ? t : x));
      return [t, ...prev];
    });
  });
  useRealtimeEvent('trade.new_listing', (t) => {
    setAllTrades((prev) => (prev.some((x) => x.id === t.id) ? prev : [t, ...prev]));
  });

  const filtered = useMemo(() => {
    let list = allTrades;
    if (enforcedIds.size > 0 && !(scope === 'mine' && me)) {
      list = list.filter((t) => !enforcedIds.has(t.created_by_id));
    }
    if (scope === 'mine' && me) list = list.filter((t) => t.created_by_id === me.id);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((t) =>
        (t.offer_card_names || []).some((n) => n.toLowerCase().includes(q)) ||
        (t.wanted_card_names || []).some((n) => n.toLowerCase().includes(q)) ||
        (t.author_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allTrades, scope, me, query, enforcedIds]);

  const byStatus = useMemo(() => {
    const map = {};
    COLUMNS.forEach((c) => { map[c.key] = []; });
    filtered.forEach((t) => {
      if (map[t.status]) map[t.status].push(t);
    });
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Trade Status Board" subtitle="Track all active trades by status" />

      {/* Controls */}
      <div className="flex flex-col gap-3 px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards or collector…"
              className="w-full rounded-full border border-border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center rounded-full border border-border bg-background p-0.5">
            <button
              onClick={() => setScope('all')}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${scope === 'all' ? 'bg-primary text-white' : 'text-muted-foreground'}`}
            >
              All
            </button>
            <button
              onClick={() => setScope('mine')}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${scope === 'mine' ? 'bg-primary text-white' : 'text-muted-foreground'}`}
            >
              Mine
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {COLUMNS.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${c.dot}`} />
              <span className="font-semibold text-muted-foreground">{c.label}</span>
              <span className="font-bold">{byStatus[c.key]?.length || 0}</span>
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-20 text-center">
          <ArrowLeftRight className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-bold">No trades found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope === 'mine' ? 'You have no trades yet.' : 'No trades on the board yet.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map((col) => (
              <div key={col.key} className="w-72 shrink-0">
                <div className={`rounded-t-xl border-t-4 ${col.accent} bg-card px-3 py-2.5`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                      <h3 className="text-sm font-bold">{col.label}</h3>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${col.badge}`}>
                      {byStatus[col.key]?.length || 0}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 rounded-b-xl bg-secondary/50 p-2 min-h-[120px]">
                  {(byStatus[col.key] || []).length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">No trades</p>
                  ) : (
                    byStatus[col.key].map((t) => <KanbanCard key={t.id} trade={t} />)
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanCard({ trade }) {
  const offer = (trade.offer_card_names || []).slice(0, 2).join(', ') || 'Cards';
  const want = (trade.wanted_card_names || []).slice(0, 2).join(', ') || 'Cards';
  return (
    <Link
      to={`/trade/${trade.id}`}
      className="block rounded-xl border border-border bg-card p-3 hover:border-primary/50 hover:shadow-raised transition-all"
    >
      <div className="flex items-center gap-2">
        <Avatar name={trade.author_name} src={trade.author_avatar} size={24} />
        <span className="flex-1 truncate text-xs font-semibold">{trade.author_name || 'Collector'}</span>
        <span className="text-[10px] text-muted-foreground">{timeAgo(trade.updated_date || trade.created_date)}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        <span className="flex-1 truncate font-medium">{offer}</span>
        <span className="text-muted-foreground">↔</span>
        <span className="flex-1 truncate text-muted-foreground">{want}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {trade.preferred_currency || 'GBP'}
        </span>
        {(trade.shipping_regions || []).slice(0, 2).map((r) => (
          <span key={r} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{r}</span>
        ))}
      </div>
    </Link>
  );
}