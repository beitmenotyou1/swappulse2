import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Bell, Plus, RefreshCw, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PriceAlertModal from '@/components/market/PriceAlertModal';
import PriceAlertsList from '@/components/market/PriceAlertsList';
import useSEO from '@/hooks/useSEO';

export default function MarketWatch() {
  useSEO({
    title: 'Market Watch',
    description: 'Track Pokémon TCG card prices, monitor your portfolio, and set price alerts on SwapPulse, the decentralized collector community.',
    canonicalPath: '/market',
  });
  const [portfolio, setPortfolio] = useState(null);
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertRefreshKey, setAlertRefreshKey] = useState(0);

  const loadPrices = async () => {
    try {
      const items = await base44.entities.CardPricing.list('-updated_date', 60);
      setPrices(items);
    } catch {
      setPrices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Parallelize portfolio calc and price loading (independent fetches).
    (async () => {
      const [entries, prices] = await Promise.all([
        base44.entities.CollectionEntry.list('-updated_date', 200).catch(() => []),
        base44.entities.CardPricing.list('-updated_date', 60).catch(() => []),
      ]);
      const total = entries.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
      setPortfolio({ total, count: entries.length });
      setPrices(prices);
      setLoading(false);
    })();

    // Real-time price updates (§7.5 emitPriceUpdate → entity subscription)
    const unsub = base44.entities.CardPricing.subscribe((event) => {
      setPrices((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        if (event.type === 'delete') map.delete(event.data.id);
        else map.set(event.data.id, event.data);
        return [...map.values()].sort(
          (a, b) => new Date(b.updated_date) - new Date(a.updated_date)
        );
      });
    });
    return unsub;
  }, []);

  const runSync = async () => {
    setSyncing(true);
    try {
      await base44.functions.invoke('syncPricing', {});
      await loadPrices();
    } catch {
      /* ignore */
    } finally {
      setSyncing(false);
    }
  };

  const movers = prices
    .map((p) => {
      const change =
        p.avg30 && p.avg7 ? Math.round(((p.avg7 - p.avg30) / p.avg30) * 100) : p.trend ? Math.round(p.trend) : 0;
      const price = p.avg ?? p.low ?? p.holofoil_market ?? p.normal_market ?? 0;
      return { ...p, change, price };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 8);

  return (
    <div>
      <PageHeader title="Market Watch" subtitle="Track prices and your portfolio">
        <button
          onClick={runSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:border-primary/50 disabled:opacity-60"
        >
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sync now
        </button>
      </PageHeader>
      <div className="p-4 space-y-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">Tracked Card Prices</h3>
            <span className="text-xs text-muted-foreground">
              {prices.length} cards · synced from TCGDex
            </span>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : movers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No prices yet. Add cards to your collection or wishlist, then hit “Sync now”.
            </p>
          ) : (
            <div className="space-y-2">
              {movers.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-secondary">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{m.card_name}</p>
                    <p className="text-xs text-muted-foreground">{m.set_id || m.source}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      {m.unit === 'EUR' ? '€' : m.unit === 'USD' ? '$' : '£'}
                      {(m.price / 100).toFixed(2)}
                    </p>
                    <p className={`text-xs font-bold ${m.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {m.change >= 0 ? '↑' : '↓'}{Math.abs(m.change)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {portfolio && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><TrendingUp className="h-4 w-4 text-primary" /> Your Portfolio</h3>
            <p className="text-3xl font-extrabold">£{(portfolio.total / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{portfolio.count} cards tracked</p>
            <Link to="/collection" className="mt-3 inline-block rounded-full bg-primary px-4 py-2 text-xs font-bold text-white">View Collection</Link>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Bell className="h-4 w-4 text-accent" /> Price Alerts</h3>
          <PriceAlertsList
            onCreate={() => setShowAlertModal(true)}
            refreshKey={alertRefreshKey}
          />
        </section>

        {movers.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><TrendingUp className="h-4 w-4 text-success" /> Top Gainers</h3>
            <div className="space-y-2">
              {movers.filter((m) => m.change > 0).slice(0, 4).map((m) => (
                <Link key={m.id} to={`/card/${m.card_id}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-secondary">
                  <p className="truncate text-sm font-semibold">{m.card_name}</p>
                  <span className="flex items-center gap-1 text-xs font-bold text-success">
                    <ArrowUpRight className="h-3 w-3" /> {m.change}%
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {movers.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><TrendingDown className="h-4 w-4 text-destructive" /> Top Losers</h3>
            <div className="space-y-2">
              {movers.filter((m) => m.change < 0).slice(0, 4).map((m) => (
                <Link key={m.id} to={`/card/${m.card_id}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-secondary">
                  <p className="truncate text-sm font-semibold">{m.card_name}</p>
                  <span className="flex items-center gap-1 text-xs font-bold text-destructive">
                    <ArrowDownRight className="h-3 w-3" /> {Math.abs(m.change)}%
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {showAlertModal && (
        <PriceAlertModal
          open={showAlertModal}
          onClose={() => {
            setShowAlertModal(false);
            setAlertRefreshKey((k) => k + 1);
          }}
          card={null}
        />
      )}
    </div>
  );
}