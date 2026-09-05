import React, { useEffect, useState } from 'react';
import { Loader2, ArrowLeftRight, BellRing, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import TradeDashboardCard from '@/components/trade/TradeDashboardCard';
import DocumentationLink from '@/components/DocumentationLink';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';

const ACTIVE_STATUSES = ['open', 'negotiating', 'pending_ship'];

export default function TradeDashboard() {
  const t = useT();
  useSEO({
    title: 'Trade Dashboard',
    description: 'Manage your Pokémon TCG trade listings and watched trades on SwapPulse.',
    canonicalPath: '/trade-dashboard',
  });
  const [loading, setLoading] = useState(true);
  const [myListings, setMyListings] = useState([]);
  const [watched, setWatched] = useState([]);
  const [me, setMe] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        setMe(user);
        const [allMine, watches] = await Promise.all([
          base44.entities.TradeListing.filter({}, '-updated_date', 100).catch(() => []),
          base44.entities.TradeWatch.filter({}, '-created_date', 100).catch(() => []),
        ]);
        setMyListings(allMine.filter((t) => t.created_by_id === user.id));
        const watchedIds = new Set(watches.map((w) => w.trade_id));
        const watchedTrades = watchedIds.size > 0
          ? await base44.entities.TradeListing.filter({ id: { $in: [...watchedIds] } }, '-updated_date', 100).catch(() => [])
          : [];
        setWatched(watchedTrades);
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeMine = myListings.filter((t) => ACTIVE_STATUSES.includes(t.status));
  const pendingMine = myListings.filter((t) => t.status === 'pending_ship');
  const completedMine = myListings.filter((t) => t.status === 'completed');
  const cancelledMine = myListings.filter((t) => t.status === 'cancelled');
  const activeWatched = watched.filter((t) => ACTIVE_STATUSES.includes(t.status));

  const summary = [
    { label: t('tradeDashboard.active'), count: activeMine.length, icon: ArrowLeftRight, color: 'text-primary' },
    { label: t('tradeDashboard.pendingShip'), count: pendingMine.length, icon: Clock, color: 'text-accent' },
    { label: t('tradeDashboard.completed'), count: completedMine.length, icon: CheckCircle2, color: 'text-success' },
    { label: t('tradeDashboard.cancelled'), count: cancelledMine.length, icon: XCircle, color: 'text-destructive' },
  ];

  return (
    <div>
      <PageHeader title={t('page.tradeDashboard.title')} subtitle={t('page.tradeDashboard.subtitle')} />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !me ? (
        <div className="px-4 py-20 text-center">
          <p className="text-lg font-bold">{t('tradeDashboard.signIn')}</p>
          <Link to="/login" className="mt-2 inline-block text-sm text-primary">{t('tradeDashboard.goToLogin')}</Link>
        </div>
      ) : (
        <div className="space-y-6 p-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summary.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">{s.label}</span>
                </div>
                <p className="mt-2 text-2xl font-extrabold">{s.count}</p>
              </div>
            ))}
          </div>

          {/* My active trades */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
              <ArrowLeftRight className="h-4 w-4" /> {t('tradeDashboard.myActiveTrades')} ({activeMine.length})
            </h2>
            {activeMine.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {t('tradeDashboard.noActive')} <Link to="/trades" className="text-primary">{t('tradeDashboard.browseBoard')}</Link> {t('tradeDashboard.toStartOne')}
              </p>
            ) : (
              <div className="space-y-3">
                {activeMine.map((t) => <TradeDashboardCard key={t.id} trade={t} />)}
              </div>
            )}
          </section>

          {/* Watched trades */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
              <BellRing className="h-4 w-4" /> {t('tradeDashboard.watching')} ({activeWatched.length})
            </h2>
            {activeWatched.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {t('tradeDashboard.notWatching')}
              </p>
            ) : (
              <div className="space-y-3">
                {activeWatched.map((t) => <TradeDashboardCard key={t.id} trade={t} watching />)}
              </div>
            )}
          </section>
        </div>
      )}
      <DocumentationLink slug="trade-dashboard" />
    </div>
  );
}