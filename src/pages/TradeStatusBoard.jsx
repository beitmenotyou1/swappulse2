import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, ArrowLeftRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/format';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';
import useSEO from '@/hooks/useSEO';
import DocumentationLink from '@/components/DocumentationLink';
import { useT } from '@/lib/i18n/I18nProvider';

const COLUMN_TKEYS = {
  open: 'tradeStatus.open',
  negotiating: 'tradeStatus.negotiating',
  pending_ship: 'tradeStatus.pendingShip',
  completed: 'tradeStatus.completed',
  cancelled: 'tradeStatus.cancelled',
};
const COLUMN_STYLES = {
  open: { accent: 'border-t-success', dot: 'bg-success', badge: 'bg-success/15 text-success' },
  negotiating: { accent: 'border-t-accent', dot: 'bg-accent', badge: 'bg-accent/20 text-accent' },
  pending_ship: { accent: 'border-t-primary', dot: 'bg-primary', badge: 'bg-primary/15 text-primary' },
  completed: { accent: 'border-t-muted-foreground', dot: 'bg-muted-foreground', badge: 'bg-secondary text-muted-foreground' },
  cancelled: { accent: 'border-t-destructive', dot: 'bg-destructive', badge: 'bg-destructive/15 text-destructive' },
};
const COLUMN_KEYS = ['open', 'negotiating', 'pending_ship', 'completed', 'cancelled'];

export default function TradeStatusBoard() {
  const t = useT();
  useSEO({
    title: 'Trade Status Board',
    description: 'Track the status of Pokémon TCG trades on SwapPulse, open, negotiating, shipping, and completed trades.',
    canonicalPath: '/trade-board',
  });
  const [allTrades, setAllTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [scope, setScope] = useState('all'); // 'all' | 'mine'
  const [query, setQuery] = useState('');
  const [enforcedIds, setEnforcedIds] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [user, tradesRes, enforced] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.functions.invoke('get-visible-trades', { limit: 100 }).catch(() => ({ data: { listings: [] } })),
        base44.functions.invoke('get-enforced-dids', {}).catch(() => ({ data: { user_ids: [] } })),
      ]);
      setMe(user);
      setAllTrades(tradesRes?.data?.listings || []);
      setEnforcedIds(new Set(enforced.data?.user_ids || []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Re-fetch through the server visibility gate rather than trusting raw
  // realtime entity payloads for scoped listings.
  useRealtimeEvent('trade.status_update', () => { load(); });
  useRealtimeEvent('trade.new_listing', () => { load(); });

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
    COLUMN_KEYS.forEach((k) => { map[k] = []; });
    filtered.forEach((t) => {
      if (map[t.status]) map[t.status].push(t);
    });
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title={t('page.tradeStatusBoard.title')} subtitle={t('page.tradeStatusBoard.subtitle')} />

      {/* Controls */}
      <div className="flex flex-col gap-3 px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('tradeStatus.searchPlaceholder')}
              className="w-full rounded-full border border-border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:border-primary"
             aria-label={t('tradeStatus.searchPlaceholder')}/>
          </div>
          <div className="flex items-center rounded-full border border-border bg-background p-0.5">
            <button
              onClick={() => setScope('all')}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${scope === 'all' ? 'bg-primary text-white' : 'text-muted-foreground'}`}
            >
              {t('tradeStatus.all')}
            </button>
            <button
              onClick={() => setScope('mine')}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${scope === 'mine' ? 'bg-primary text-white' : 'text-muted-foreground'}`}
            >
              {t('tradeStatus.mine')}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {COLUMN_KEYS.map((k) => {
            const s = COLUMN_STYLES[k];
            return (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              <span className="font-semibold text-muted-foreground">{t(COLUMN_TKEYS[k])}</span>
              <span className="font-bold">{byStatus[k]?.length || 0}</span>
            </span>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-20 text-center">
          <ArrowLeftRight className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-bold">{t('tradeStatus.noTradesFound')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope === 'mine' ? t('tradeStatus.noTradesMine') : t('tradeStatus.noTradesBoard')}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 min-w-max">
            {COLUMN_KEYS.map((k) => {
              const s = COLUMN_STYLES[k];
              return (
              <div key={k} className="w-72 shrink-0">
                <div className={`rounded-t-xl border-t-4 ${s.accent} bg-card px-3 py-2.5`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                      <h3 className="text-sm font-bold">{t(COLUMN_TKEYS[k])}</h3>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.badge}`}>
                      {byStatus[k]?.length || 0}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 rounded-b-xl bg-secondary/50 p-2 min-h-[120px]">
                  {(byStatus[k] || []).length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">{t('tradeStatus.noTrades')}</p>
                  ) : (
                    byStatus[k].map((tr) => <KanbanCard key={tr.id} trade={tr} t={t} />)
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
      <DocumentationLink slug="trade-status-board" />
    </div>
  );
}

function KanbanCard({ trade, t }) {
  const offer = (trade.offer_card_names || []).slice(0, 2).join(', ') || t('tradeStatus.cards');
  const want = (trade.wanted_card_names || []).slice(0, 2).join(', ') || t('tradeStatus.cards');
  return (
    <Link
      to={`/trade/${trade.id}`}
      className="block rounded-xl border border-border bg-card p-3 hover:border-primary/50 hover:shadow-raised transition-all"
    >
      <div className="flex items-center gap-2">
        <Avatar name={trade.author_name} src={trade.author_avatar} size={24} />
        <span className="flex-1 truncate text-xs font-semibold">{trade.author_name || t('profile.collector')}</span>
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