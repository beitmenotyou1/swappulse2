import React, { useState, useEffect } from 'react';
import { TrendingUp, Fuel } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';
import { formatNumber } from '@/lib/explorerFormat';

// Two minimal charts (daily tx count + daily gas used) for a chain,
// rendered with Recharts in a clean, non-technical style.
export default function ExplorerCharts({ chainKey }) {
  const t = useT();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    base44.functions.invoke('multi-chain-charts', { chain: chainKey })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [chainKey]);

  if (loading) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const txData = (data.txCounts || []).map((d) => ({
    date: d.date.slice(5),
    count: d.count,
  }));
  const gasData = (data.gasUsed || []).map((d) => ({
    date: d.date.slice(5),
    gas: Number(BigInt(d.gas || '0') / 10n ** 9n),
  }));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ChartCard
        icon={TrendingUp}
        title={t('explorer.chart.txCount')}
        data={txData}
        dataKey="count"
        color="hsl(var(--primary))"
        format={(v) => formatNumber(v)}
      />
      <ChartCard
        icon={Fuel}
        title={t('explorer.chart.gasUsed')}
        data={gasData}
        dataKey="gas"
        color="hsl(var(--warning))"
        format={(v) => `${formatNumber(v)} Gwei`}
      />
    </div>
  );
}

function ChartCard({ icon: Icon, title, data, dataKey, color, format }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-base">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => formatNumber(v)} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
            formatter={(v) => [format(v), '']}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#grad-${dataKey})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}