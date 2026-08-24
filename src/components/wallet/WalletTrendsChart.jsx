import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

const DAYS = 30;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function shortLabel(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function WalletTrendsChart({ transfers = [], topups = [] }) {
  const data = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - (DAYS - 1));
    cutoff.setHours(0, 0, 0, 0);

    // Build a map of day-key -> { date, topups, tradeSpending }
    const dayMap = new Map();
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(cutoff);
      d.setDate(d.getDate() + i);
      dayMap.set(dayKey(d), { date: d, label: shortLabel(d), topups: 0, tradeSpending: 0 });
    }

    // Aggregate top-ups (fiat cents -> major units)
    for (const t of topups) {
      if (t.status !== 'succeeded') continue;
      const created = t.created_at || t.created_date;
      if (!created) continue;
      const d = new Date(created);
      if (d < cutoff) continue;
      const key = dayKey(d);
      const entry = dayMap.get(key);
      if (entry) entry.topups += (t.amount_cents || 0) / 100;
    }

    // Aggregate trade spending (escrow_lock transfers, USDC wei -> USDC)
    for (const tr of transfers) {
      if (tr.transfer_type !== 'escrow_lock') continue;
      const created = tr.created_at || tr.created_date;
      if (!created) continue;
      const d = new Date(created);
      if (d < cutoff) continue;
      const key = dayKey(d);
      const entry = dayMap.get(key);
      if (entry) entry.tradeSpending += Number(BigInt(tr.amount_wei || '0')) / 1_000_000;
    }

    return Array.from(dayMap.values());
  }, [transfers, topups]);

  const hasData = data.some((d) => d.topups > 0 || d.tradeSpending > 0);

  if (!hasData) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">30-Day Trends</h2>
        </div>
        <p className="py-8 text-center text-sm text-muted-foreground">
          No top-up or trade activity in the last 30 days.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">30-Day Trends</h2>
      </div>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              interval={Math.floor(DAYS / 6)}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ fontWeight: 600, color: 'hsl(var(--popover-foreground))' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="topups" name="Top-ups" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="tradeSpending" name="Trade Spending (USDC)" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}