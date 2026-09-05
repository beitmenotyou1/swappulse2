import React, { useEffect, useState } from 'react';
import { TrendingUp, ArrowLeftRight, Sparkles, UserPlus, Loader2, Github, BookOpen, ExternalLink, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';
import OnlineNow from '@/components/OnlineNow';
import TrendingTopics from '@/components/sidebar/TrendingTopics';
import { formatPrice } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';
import { createBridgedFollow } from '@/lib/followBridge';
import { useT } from '@/lib/i18n/I18nProvider';
import { SITE_LINKS } from '@/lib/siteLinks';

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
  const tr = useT();
  const [portfolio, setPortfolio] = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [trending, setTrending] = useState([]);
  const [recs, setRecs] = useState([]);
  const [actorDid, setActorDid] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [isAuthed, setIsAuthed] = useState(false);

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

        setIsAuthed(!!isAuthed);
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
      await createBridgedFollow(rec.did, rec.displayName, rec.handle, rec.avatarUrl);
      setRecs((rs) => rs.filter((r) => r.did !== rec.did));
      toast({ title: tr('toast.following'), description: rec.displayName || rec.handle });
    } catch (err) {
      toast({ title: tr('toast.couldNotFollow'), description: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-4 py-4 pl-2 lg:flex">
      {isAuthed && portfolio && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold">{tr('sidebar.yourPortfolio')}</h3>
          <p className="text-2xl font-extrabold">{formatPrice(portfolio.total)}</p>
          <p className="text-xs text-muted-foreground">{portfolio.count} {tr('page.collection.cardsTracked')}</p>
        </section>
      )}

      {recentTrades.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <ArrowLeftRight className="h-4 w-4 text-primary" /> {tr('sidebar.activeTrades')}
          </h3>
          <div className="space-y-2">
            {recentTrades.map((trade) => (
              <Link to="/trades" key={trade.id} className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary">
                <p className="text-sm font-medium truncate">{tr('sidebar.offering')} {trade.offer_card_names?.[0] || tr('sidebar.cards')}</p>
                <p className="text-xs text-muted-foreground truncate">{tr('sidebar.wants')} {trade.wanted_card_names?.[0] || tr('sidebar.cards')}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <OnlineNow users={online} />

      {trending.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="h-4 w-4 text-primary" /> {tr('sidebar.trendingCards')}
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

      {recs.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="h-4 w-4 text-accent" /> {tr('page.whoToFollow.title')}
            </h3>
            <Link to="/who-to-follow" className="text-xs font-semibold text-primary hover:underline">{tr('common.viewAll')}</Link>
          </div>
          <div className="space-y-3">
            {recs.map((rec) => (
              <div key={rec.did} className="flex items-center gap-3">
                <Link to={`/u/${rec.handle || ''}`}>
                  <Avatar name={rec.displayName || rec.handle} src={rec.avatarUrl} size={36} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/u/${rec.handle || ''}`} className="block truncate text-sm font-semibold hover:underline">
                    {rec.displayName || rec.handle || tr('common.collector')}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {rec.mutualVouchCount > 0
                      ? `${rec.mutualVouchCount} ${rec.mutualVouchCount === 1 ? tr('sidebar.mutualVouch') : tr('sidebar.mutualVouches')}`
                      : `${tr('sidebar.trustScore')} ${Math.round(rec.trustScore || 0)}/100`}
                  </p>
                </div>
                <button
                  onClick={() => follow(rec)}
                  disabled={busyId === rec.did}
                  className="flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busyId === rec.did ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                  {tr('common.follow')}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <TrendingTopics />

      <div className="mt-auto rounded-2xl px-4 py-4 text-muted-foreground">
        <p className="text-xs font-medium">{tr('sidebar.copyright')}</p>
        <nav className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
          <a href={SITE_LINKS.documentation} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:underline">
            <BookOpen className="h-3 w-3" aria-hidden="true" /> {tr('footer.documentation')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
          <Link to="/status" className="inline-flex items-center gap-1 text-xs font-semibold text-success transition-colors hover:underline">
            <Activity className="h-3 w-3" aria-hidden="true" /> {tr('nav.status')}
          </Link>
          <Link to="/terms" className="text-xs font-medium transition-colors hover:text-foreground">{tr('nav.terms')}</Link>
          <Link to="/privacy" className="text-xs font-medium transition-colors hover:text-foreground">{tr('nav.privacy')}</Link>
          <Link to="/chain/" className="text-xs font-medium transition-colors hover:text-foreground">{tr('footer.chainExplorer')}</Link>
          <Link to="/donate" className="text-xs font-medium transition-colors hover:text-foreground">{tr('nav.donate')}</Link>
          <a
            href={SITE_LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={tr('footer.githubNewTab')}
            className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Github className="h-3 w-3" aria-hidden="true" /> {tr('footer.github')}
          </a>
        </nav>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
          {tr('footer.disclaimer')}
        </p>
      </div>
    </aside>
  );
}