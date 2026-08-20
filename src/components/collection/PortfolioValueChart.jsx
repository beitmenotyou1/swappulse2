import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { base44 } from '@/api/base44Client';
import { formatPrice } from '@/lib/format';
import { useT } from '@/lib/i18n/I18nProvider';

const RANGES = [
  { id: 30, tKey: 'portfolio.range30' },
  { id: 90, tKey: 'portfolio.range90' },
  { id: 365, tKey: 'portfolio.range365' },
  { id: 'all', tKey: 'portfolio.rangeAll' },
];

// PortfolioValueChart — plots the collector's total portfolio value over time
// from daily PortfolioSnapshot records. A 30D / 90D / 1Y / All segmented toggle
// zooms the window; the summary deltas recompute against the first snapshot in
// the selected window. Shown as the first card in the Collection analytics tab.
export default function PortfolioValueChart() {
  const tr = useT();
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(90);

  useEffect(() => {
    let active = true;
    base44.entities.PortfolioSnapshot.list('-date', 400)
      .then((rows) => {
        if (active) {
          // Oldest → newest for the chart x-axis
          setSnapshots([...rows].reverse());
          setLoading(false);
        }
      })
      .catch(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const windowed = useMemo(() => {
    if (range === 'all') return snapshots;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (range - 1));
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return snapshots.filter((s) => s.date >= cutoffStr);
  }, [snapshots, range]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio Value History</p>
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio Value History</p>
        <p className="py-10 text-center text-sm text-muted-foreground">
          Your portfolio value history will appear here after the first daily snapshot.
        </p>
      </div>
    );
  }

  const data = windowed.map((s) => ({ date: s.date, value: s.total_value / 100 }));
  const latest = windowed[windowed.length - 1];
  const first = windowed[0];
  const change = (latest.total_value - first.total_value) / 100;
  const pctChange = first.total_value > 0
    ? ((latest.total_value - first.total_value) / first.total_value) * 100
    : 0;
  const up = change >= 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio Value History</p>
        <div className="flex rounded-full border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${range === r.id ? 'bg-primary text-white' : 'text-muted-foreground'}`}
            >
              {tr(r.tKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Compact stat strip */}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <span className="text-xs text-muted-foreground">Current </span>
          <span className="text-lg font-extrabold">{formatPrice(latest.total_value)}</span>
        </div>
        {windowed.length > 1 && (
          <div className={`flex items-center gap-1 ${up ? 'text-success' : 'text-destructive'}`}>
            {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span className="text-sm font-bold">
              {up ? '+' : ''}{formatPrice(latest.total_value - first.total_value)}
            </span>
            <span className="text-xs text-muted-foreground">
              ({up ? '+' : ''}{pctChange.toFixed(1)}%)
            </span>
          </div>
        )}
        <span className="text-xs text-muted-foreground">
          {windowed.length} day{windowed.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Area chart */}
      {windowed.length >= 2 ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(252 100% 64%)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="hsl(252 100% 64%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
            <XAxis dataKey="date" stroke="hsl(215 16% 47%)" fontSize={11} />
            <YAxis
              stroke="hsl(215 16% 47%)"
              fontSize={11}
              tickFormatter={(v) => formatPrice(v * 100)}
              width={60}
            />
            <Tooltip
              contentStyle={{ background: 'hsl(0 0% 100%)', border: '1px solid hsl(214 32% 91%)', borderRadius: 8 }}
              formatter={(v) => [formatPrice(v * 100), 'Value']}
            />
            <Area type="monotone" dataKey="value" stroke="hsl(252 100% 64%)" strokeWidth={2} fill="url(#portfolioGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{tr('portfolio.emptyWindow')}</p>
      )}
    </div>
  );
}