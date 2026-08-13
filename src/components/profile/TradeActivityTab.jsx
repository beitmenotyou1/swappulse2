import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp, CheckCircle2, XCircle, Clock } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export default function TradeActivityTab() {
  const { user } = useAuth();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.TradeListing.filter({}, '-created_date', 200);
        const mine = all.filter((t) =>
          t.created_by_id === user?.id || t.author_name === user?.full_name || !t.author_name
        );
        setTrades(mine);
      } catch {
        setTrades([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, user?.full_name]);

  const { chartData, totals } = useMemo(() => {
    const byMonth = {};
    const counts = { completed: 0, cancelled: 0, active: 0, total: trades.length };

    for (const t of trades) {
      const key = monthKey(t.updated_date || t.created_date);
      if (!key) continue;
      if (!byMonth[key]) byMonth[key] = { month: key, completed: 0, cancelled: 0, active: 0 };
      if (t.status === 'completed') {
        byMonth[key].completed++;
        counts.completed++;
      } else if (t.status === 'cancelled') {
        byMonth[key].cancelled++;
        counts.cancelled++;
      } else {
        byMonth[key].active++;
        counts.active++;
      }
    }

    // Fill in the last 6 months so the chart always has a baseline
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(key);
      if (!byMonth[key]) byMonth[key] = { month: key, completed: 0, cancelled: 0, active: 0 };
    }

    const sorted = months.map((key) => ({
      label: monthLabel(key),
      Completed: byMonth[key].completed,
      Cancelled: byMonth[key].cancelled,
      Active: byMonth[key].active,
    }));

    const completionRate = counts.total > 0
      ? Math.round((counts.completed / (counts.completed + counts.cancelled || 1)) * 100)
      : 0;

    return { chartData: sorted, totals: { ...counts, completionRate } };
  }, [trades]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (trades.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No trade activity yet. Start trading to see your trends here.
      </p>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">Total</span>
          </div>
          <p className="mt-1.5 text-2xl font-extrabold">{totals.total}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">Completed</span>
          </div>
          <p className="mt-1.5 text-2xl font-extrabold">{totals.completed}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-accent" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">Active</span>
          </div>
          <p className="mt-1.5 text-2xl font-extrabold">{totals.active}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">Cancelled</span>
          </div>
          <p className="mt-1.5 text-2xl font-extrabold">{totals.cancelled}</p>
        </div>
      </div>

      {/* Completion rate */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Completion Rate</h3>
          <span className="text-2xl font-extrabold text-success">{totals.completionRate}%</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${totals.completionRate}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {totals.completed} of {totals.completed + totals.cancelled} resolved trades completed successfully.
        </p>
      </div>

      {/* Monthly volume chart */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-4 text-sm font-bold">Monthly Trade Volume</h3>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.75rem',
                  fontSize: '0.75rem',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              <Bar dataKey="Completed" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Active" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Cancelled" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}