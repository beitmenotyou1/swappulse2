import React, { useEffect, useState } from 'react';
import { Loader2, TrendingUp, Bell, Plus } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Link } from 'react-router-dom';

const movers = [
  { name: 'Charizard ex', set: 'SV4a', change: 18, price: 45.0 },
  { name: 'Mew ex', set: 'SV2A', change: 7, price: 32.0 },
  { name: 'Umbreon VMAX', set: 'EVS', change: -3, price: 28.0 },
  { name: 'Pikachu SV2A', set: 'SV2A', change: 12, price: 22.0 },
  { name: 'Lugia V', set: 'SIT', change: -5, price: 18.0 },
];

export default function MarketWatch() {
  const [portfolio, setPortfolio] = useState(null);

  useEffect(() => {
    import('@/api/base44Client').then(async ({ base44 }) => {
      try {
        const items = await base44.entities.CollectionEntry.list('-updated_date', 200);
        const total = items.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
        setPortfolio({ total, count: items.length });
      } catch {
        setPortfolio({ total: 0, count: 0 });
      }
    });
  }, []);

  return (
    <div>
      <PageHeader title="Market Watch" subtitle="Track prices and your portfolio" />
      <div className="p-4 space-y-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold">Today's Movers</h3>
          <div className="space-y-2">
            {movers.map((m, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-secondary">
                <div>
                  <p className="text-sm font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.set}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">£{m.price.toFixed(2)}</p>
                  <p className={`text-xs font-bold ${m.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.change >= 0 ? '↑' : '↓'}{Math.abs(m.change)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
              <span>Charizard ex &gt; £50</span>
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
              <span>Mew ex &lt; £25</span>
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground hover:bg-secondary">
              <Plus className="h-4 w-4" /> Add Alert
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}