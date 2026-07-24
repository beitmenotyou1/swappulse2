import React, { useEffect, useState } from 'react';
import { TrendingUp, ArrowLeftRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';
import { formatPrice } from '@/lib/format';

const trendingMock = [
  { name: 'Charizard ex', set: 'SV4a', change: 18, mentions: 42 },
  { name: 'Mew ex', set: 'SV2A', change: 7, mentions: 31 },
  { name: 'Umbreon VMAX', set: 'EVS', change: -3, mentions: 28 },
];

export default function RightSidebar() {
  const [portfolio, setPortfolio] = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [items, trades] = await Promise.all([
          base44.entities.CollectionEntry.list('-updated_date', 200),
          base44.entities.TradeListing.filter({ status: 'open' }, '-created_date', 3),
        ]);
        const total = items.reduce((sum, c) => sum + (c.market_value || 0), 0);
        setPortfolio({ total, count: items.length });
        setRecentTrades(trades);
      } catch {
        setPortfolio({ total: 0, count: 0 });
      }
    })();
  }, []);

  return (
    <aside className="sticky top-0 hidden h-screen w-80 shrink-0 flex-col gap-4 overflow-y-auto py-4 pl-2 lg:flex">
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <TrendingUp className="h-4 w-4 text-primary" /> Trending Cards
        </h3>
        <div className="space-y-2">
          {trendingMock.map((c, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.set} • {c.mentions} mentions</p>
              </div>
              <span className={`text-xs font-bold ${c.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {c.change >= 0 ? '↑' : '↓'}{Math.abs(c.change)}%
              </span>
            </div>
          ))}
        </div>
      </section>

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

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-accent" /> Who to Follow
        </h3>
        <div className="space-y-3">
          {[
            { name: 'ShinyHunter', desc: '34 shinies' },
            { name: 'CardKingUK', desc: 'Trusted Trader' },
            { name: 'PokeProf', desc: 'Set completionist' },
          ].map((u, i) => (
            <div key={i} className="flex items-center gap-3">
              <Avatar name={u.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{u.name}</p>
                <p className="truncate text-xs text-muted-foreground">{u.desc}</p>
              </div>
              <button className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background transition-opacity hover:opacity-90">
                Follow
              </button>
            </div>
          ))}
        </div>
      </section>

      <p className="px-2 text-xs text-muted-foreground">
        © SwapPulse — Built on the AT Protocol · Powered by TCGdex
      </p>
    </aside>
  );
}