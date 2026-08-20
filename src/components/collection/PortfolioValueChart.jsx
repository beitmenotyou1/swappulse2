import React, { useEffect, useState } from 'react';
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

// PortfolioValueChart — plots the collector's total portfolio value over time
// from daily PortfolioSnapshot records. Shown as the first card in the
// Collection analytics tab. Falls back to a friendly empty state when there
// are fewer than 2 snapshots (the chart needs a line to draw).
export default function PortfolioValueChart() {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    base44.entities.PortfolioSnapshot.list('-date', 90)
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

  const data = snapshots.map((s) => ({
    date: s.date,
    value: s.total_value / 100, // pence → major units
  }));

  const latest = snapshots[snapshots.length - 1];
  const first = snapshots[0];
  const change = (latest.total_value - first.total_value) / 100;
  const pctChange = first.total_value > 0
    ? ((latest.total_value - first.total_value) / first.total_value) * 100
    : 0;
  const up = change >= 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio Value History</p>

      {/* Compact stat strip */}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <span className="text-xs text-muted-foreground">Current </span>
          <span className="text-lg font-extrabold">{formatPrice(latest.total_value)}</span>
        </div>
        {snapshots.length > 1 && (
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
          {snapshots.length} day{snapshots.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Area chart */}
      {snapshots.length >= 2 ? (
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
        <p className="py-8 text-center text-sm text-muted-foreground">
          Check back tomorrow to see your value trend.
        </p>
      )}
    </div>
  );
}