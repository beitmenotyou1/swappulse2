import React, { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { cardImageUrl, rarityKey } from '@/lib/tcgdex';
import { formatPrice } from '@/lib/format';
import { getSets } from '@/lib/tcgdex';
import PortfolioValueChart from '@/components/collection/PortfolioValueChart';

const RARITY_HEX = {
  common: 'hsl(220 9% 64%)',
  uncommon: 'hsl(0 0% 75%)',
  rare: 'hsl(217 91% 60%)',
  holo: 'hsl(45 100% 48%)',
  ex: 'hsl(258 90% 66%)',
  secret: 'hsl(45 100% 48%)',
};

export default function CollectionAnalytics({ items }) {
  const [sets, setSets] = useState({});
  const [loadingSets, setLoadingSets] = useState(true);

  useEffect(() => {
    let active = true;
    getSets()
      .then((all) => {
        const map = {};
        for (const s of all) {
          const cc = s.cardCount;
          map[s.id] = cc && typeof cc === 'object' ? (cc.total ?? cc.official ?? null) : (typeof cc === 'number' ? cc : null);
        }
        if (active) {
          setSets(map);
          setLoadingSets(false);
        }
      })
      .catch(() => active && setLoadingSets(false));
    return () => { active = false; };
  }, []);

  // Portfolio value
  const totalValue = items.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
  const costBasis = items.reduce((s, c) => s + (c.purchase_price || 0), 0);
  const gainLoss = totalValue - costBasis;

  // Rarity distribution
  const rarityBuckets = {};
  for (const it of items) {
    const k = rarityKey(it.rarity);
    rarityBuckets[k] = (rarityBuckets[k] || 0) + 1;
  }
  const rarityData = Object.entries(rarityBuckets).map(([name, value]) => ({
    name,
    value,
    color: RARITY_HEX[name] || RARITY_HEX.common,
  }));

  // Set completion
  const bySet = {};
  for (const it of items) {
    if (!it.set_id) continue;
    if (!bySet[it.set_id]) bySet[it.set_id] = { name: it.set_name || it.set_id, owned: new Set(), total: sets[it.set_id] };
    bySet[it.set_id].owned.add(it.local_id);
  }
  const completionData = Object.entries(bySet).map(([id, v]) => ({
    name: v.name,
    owned: v.owned.size,
    total: v.total ?? null,
    pct: v.total ? Math.round((v.owned.size / v.total) * 100) : null,
  }));

  // Acquisition timeline (by month)
  const monthBuckets = {};
  for (const it of items) {
    if (!it.acquisition_date) continue;
    const m = it.acquisition_date.slice(0, 7);
    monthBuckets[m] = (monthBuckets[m] || 0) + 1;
  }
  const timelineData = Object.entries(monthBuckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  // Best / worst performers (by value vs cost)
  const performers = items
    .filter((c) => c.purchase_price && (c.market_value || c.purchase_price))
    .map((c) => ({
      ...c,
      delta: (c.market_value || c.purchase_price) - c.purchase_price,
    }));
  const sorted = [...performers].sort((a, b) => b.delta - a.delta);
  const best = sorted.slice(0, 3);
  const worst = sorted.slice(-3).reverse();

  const Card = ({ children, label }) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <p className="font-semibold text-foreground">No analytics yet</p>
        <p className="mt-1 text-sm">Add cards to your collection to see portfolio insights.</p>
      </div>
    );
  }

  const PerformerRow = ({ c }) => (
    <Link to={`/card/${c.card_id}`} className="flex items-center gap-2 py-1.5 hover:text-primary">
      {cardImageUrl(c.card_image) ? (
        <img src={cardImageUrl(c.card_image)} alt={c.card_name} className="h-10 w-7 rounded object-cover" />
      ) : (
        <div className="h-10 w-7 rounded bg-secondary" />
      )}
      <span className="flex-1 truncate text-sm">{c.card_name}</span>
      <span className={`text-sm font-bold ${c.delta >= 0 ? 'text-success' : 'text-destructive'}`}>
        {c.delta >= 0 ? '+' : ''}{formatPrice(c.delta)}
      </span>
    </Link>
  );

  return (
    <div className="space-y-4 p-4">
      {/* Portfolio value history chart */}
      <PortfolioValueChart />

      {/* Top stat row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Portfolio Value">
          <p className="text-xl font-extrabold">{formatPrice(totalValue)}</p>
        </Card>
        <Card label="Cost Basis">
          <p className="text-xl font-extrabold">{formatPrice(costBasis)}</p>
        </Card>
        <Card label="Gain / Loss">
          <p className={`text-xl font-extrabold ${gainLoss >= 0 ? 'text-success' : 'text-destructive'}`}>
            {gainLoss >= 0 ? '+' : ''}{formatPrice(gainLoss)}
          </p>
        </Card>
        <Card label="Cards">
          <p className="text-xl font-extrabold">{items.length}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Rarity distribution */}
        <Card label="Rarity Distribution">
          {rarityData.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={rarityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {rarityData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'hsl(227 21% 13%)', border: '1px solid hsl(226 22% 15%)', borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 flex flex-wrap gap-3">
            {rarityData.map((d) => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /> {d.name} ({d.value})
              </span>
            ))}
          </div>
        </Card>

        {/* Set completion */}
        <Card label="Set Completion">
          {loadingSets ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : completionData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No set data available.</p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {completionData.slice(0, 12).map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between text-xs">
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="text-muted-foreground">
                      {s.owned}{s.total ? `/${s.total}` : ''} {s.pct != null ? `· ${s.pct}%` : ''}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: s.pct != null ? `${s.pct}%` : '40%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Acquisition timeline */}
        <Card label="Acquisition Timeline">
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="acqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(226 22% 15%)" />
                <XAxis dataKey="month" stroke="hsl(225 15% 68%)" fontSize={11} />
                <YAxis allowDecimals={false} stroke="hsl(225 15% 68%)" fontSize={11} />
                <Tooltip contentStyle={{ background: 'hsl(227 21% 13%)', border: '1px solid hsl(226 22% 15%)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="count" stroke="hsl(217 91% 60%)" fill="url(#acqGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No acquisition dates recorded.</p>
          )}
        </Card>

        {/* Performers */}
        <Card label="Best / Worst Performers">
          <div className="mb-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-success"><TrendingUp className="h-3.5 w-3.5" /> Top Gainers</p>
            {best.length ? best.map((c) => <PerformerRow key={c.id} c={c} />) : <p className="text-xs text-muted-foreground">No data.</p>}
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-destructive"><TrendingDown className="h-3.5 w-3.5" /> Top Losers</p>
            {worst.length ? worst.map((c) => <PerformerRow key={c.id} c={c} />) : <p className="text-xs text-muted-foreground">No data.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}