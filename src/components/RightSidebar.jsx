import React, { useEffect, useState } from 'react';
import { TrendingUp, ArrowLeftRight, Sparkles, UserPlus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';
import OnlineNow from '@/components/OnlineNow';
import { formatPrice } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';

// Compute real trending cards from live CardPricing movers (public read).
// Returns [] when there is no meaningful price movement — the section hides.
function computeTrending(pricing) {
  const byName = new Map();
  for (const p of pricing) {
    if (!p.card_name) continue;
    const now = p.avg7 ?? p.avg;
    const prev = p.avg30 ?? p.avg;
    if (!now || !prev) continue;
    const pct = ((now - prev) / prev) * 100;
    if (Math.abs(pct) < 5) continue;
    const existing = byName.get(p.card_name);
    if (!existing || Math.abs(pct) > Math.abs(existing.pct)) {
      byName.set(p.card_name, { card_id: p.card_id, card_name: p.card_name, set_id: p.set_id, pct });
    }
  }
  return [...byName.values()]
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 3);
}

export default function RightSidebar({ online = [] }) {
  const { toast } = useToast();
  const [portfolio, setPortfolio] = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [trending, setTrending] = useState([]);
  const [recs, setRecs] = useState([]);
  const [actorDid, setActorDid] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [items, trades, pricing, isAuthed] = await Promise.all([
          base44.entities.CollectionEntry.list('-updated_date', 200).catch(() => []),
          base44.entities.TradeListing.filter({ status: 'open' }, '-created_date', 3),
          base44.entities.CardPricing.list('-updated_date', 200),
          base44.auth.isAuthenticated().catch(() => false),
        ]);
        const total = items.reduce((sum, c) => sum + (c.market_value || c.purchase_price || 0), 0);
        setPortfolio({ total, count: items.length });
        setRecentTrades(trades);
        setTrending(computeTrending(pricing));

        // Who to Follow — real trust-graph recommendations (auth only).
        if (isAuthed) {
          const res = await base44.functions.invoke('getFeedSkeleton', { limit: 3 });
          setRecs(res.data?.recommendations || []);
          setActorDid(res.data?.actorDid || '');
        } else {
          setRecs([]);
        }
      } catch {
        setPortfolio({ total: 0, count: 0 });
        setRecs([]);
      }
    };
    load();
    const unsub = base44.entities.CollectionEntry.subscribe(() => load());
    return unsub;
  }, []);

  const follow = async (rec) => {
    setBusyId(rec.did);
    try {
      await base44.entities.Follow.create({
        subject_did: rec.did,
        subject_name: rec.displayName,
        subject_handle: rec.handle,
        subject_avatar: rec.avatarUrl,
        did: actorDid,
      });
      setRecs((rs) => rs.filter((r) => r.did !== rec.did));
      toast({ title: 'Following', description: rec.displayName || rec.handle });
    } catch (err) {
      toast({ title: 'Could not follow', description: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-80 shrink-0 flex-col gap-4 overflow-y-auto py-4 pl-2 lg:flex">
      <OnlineNow users={online} />

      {trending.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="h-4 w-4 text-primary" /> Trending Cards
          </h3>
          <div className="space-y-2">
            {trending.map((c) => (
              <Link
                to={`/card/${c.card_id}`}
                key={c.card_id}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.card_name}</p>
                  {c.set_id && <p className="text-xs text-muted-foreground">{c.set_id}</p>}
                </div>
                <span className={`text-xs font-bold ${c.pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {c.pct >= 0 ? '↑' : '↓'}{Math.abs(c.pct).toFixed(1)}%
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentTrades.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <ArrowLeftRight className="h-4 w-4 text-primary" /> Active Trades
          </h3>
          <div className="space-y-2">
            {recentTrades.map((t) => (
              <Link to="/trades" key={t.id} className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary">
                <p className="text-sm font-medium truncate">Offering {t.offer_card_names?.[0] || 'cards'}</p>
                <p className="text-xs text-muted-foreground truncate">Wants {t.wanted_card_names?.[0] || 'cards'}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {portfolio && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold">Your Portfolio</h3>
          <p className="text-2xl font-extrabold">{formatPrice(portfolio.total)}</p>
          <p className="text-xs text-muted-foreground">{portfolio.count} cards tracked</p>
        </section>
      )}

      {recs.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="h-4 w-4 text-accent" /> Who to Follow
            </h3>
            <Link to="/who-to-follow" className="text-xs font-semibold text-primary hover:underline">See all</Link>
          </div>
          <div className="space-y-3">
            {recs.map((rec) => (
              <div key={rec.did} className="flex items-center gap-3">
                <Link to={`/u/${rec.handle || ''}`}>
                  <Avatar name={rec.displayName || rec.handle} src={rec.avatarUrl} size={36} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/u/${rec.handle || ''}`} className="block truncate text-sm font-semibold hover:underline">
                    {rec.displayName || rec.handle || 'Collector'}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {rec.mutualVouchCount > 0
                      ? `${rec.mutualVouchCount} mutual vouch${rec.mutualVouchCount === 1 ? '' : 'es'}`
                      : `Trust ${Math.round(rec.trustScore || 0)}/100`}
                  </p>
                </div>
                <button
                  onClick={() => follow(rec)}
                  disabled={busyId === rec.did}
                  className="flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busyId === rec.did ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                  Follow
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="px-2 text-xs text-muted-foreground">
        © SwapPulse - Built on the AT Protocol · Powered by TCGdex
      </p>
    </aside>
  );
}