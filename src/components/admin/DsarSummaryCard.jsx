import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const DAYS = 30;

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

function shortLabel(key) {
  const [y, m, d] = key.split('-');
  return `${d}/${m}`;
}

export default function DsarSummaryCard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await base44.entities.DataSubjectRequest.filter({}, '-created_date', 500).catch(() => []);
        if (mounted) setRequests(all || []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const { openCount, trend } = useMemo(() => {
    const openCount = requests.filter((r) => r.status === 'pending').length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = {};
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets[dayKey(d)] = 0;
    }
    requests.forEach((r) => {
      if (r.status === 'completed' && r.resolved_at) {
        const key = dayKey(new Date(r.resolved_at));
        if (key in buckets) buckets[key]++;
      }
    });
    const trend = Object.entries(buckets).map(([key, count]) => ({ key, label: shortLabel(key), count }));
    return { openCount, trend };
  }, [requests]);

  const totalCompleted = trend.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-base">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        {/* Stat */}
        <div className="flex shrink-0 flex-row items-center gap-4 lg:w-64 lg:flex-col lg:items-start lg:gap-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Open Requests</p>
            {loading ? (
              <Loader2 className="mt-1 h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-4xl font-extrabold tracking-tight text-foreground">{openCount}</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalCompleted} completed in {DAYS}d
            </p>
          </div>
        </div>

        {/* Trend chart */}
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Completion trend — last {DAYS} days
          </p>
          {loading ? (
            <div className="flex h-[140px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dsarTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval={5}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--popover))',
                  }}
                  labelFormatter={(l) => `Day ${l}`}
                  formatter={(v) => [`${v} completed`, '']}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#dsarTrend)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}