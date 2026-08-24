import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useSettings } from '@/hooks/useSettings';

// NFT portfolio value trends chart. Historical data comes from
// PortfolioSnapshot records (captured daily by a workflow); the live tail
// is computed from the current NFT portfolio value via get-wallet-nfts.
// Both are converted to the user's display currency for the y-axis.

const RANGES = [
  { key: '1W', label: '1W', days: 7 },
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: 'ALL', label: 'All', days: 9999 },
];

export default function NftPortfolioChart() {
  const [range, setRange] = useState('1M');
  const [history, setHistory] = useState([]);
  const [liveValueUsd, setLiveValueUsd] = useState(0);
  const [loading, setLoading] = useState(true);
  const { prices } = useCryptoPrices();
  const { settings } = useSettings();
  const displayCurrency = settings?.crypto?.display_currency || 'USD';

  const loadData = useCallback(async () => {
    try {
      const rangeConfig = RANGES.find(r => r.key === range);
      const limit = rangeConfig ? rangeConfig.days : 30;

      // Fetch historical snapshots and live NFT value in parallel
      const [snapshots, nftRes] = await Promise.all([
        base44.entities.PortfolioSnapshot.filter({}, '-date', limit).catch(() => []),
        base44.functions.invoke('get-wallet-nfts', {}).catch(() => ({ data: { totalValueUsd: 0 } })),
      ]);

      // Convert snapshots to chart points
      // PortfolioSnapshot.total_value is in pence (GBP minor units).
      // Convert to USD: pence → pounds (÷100) → USD (× ~1.25).
      // This is approximate; the trend shape is what matters.
      const points = (snapshots || [])
        .filter(s => s.date && s.total_value != null)
        .map(s => ({
          date: s.date,
          value: s.total_value / 100, // pence → pounds
          isSnapshot: true,
        }))
        .reverse(); // oldest first for the chart

      const liveUsd = nftRes.data?.totalValueUsd || 0;
      setLiveValueUsd(liveUsd);

      // Add live tail point if we have a live value
      if (liveUsd > 0) {
        const today = new Date().toISOString().slice(0, 10);
        // Convert USD live value to pounds for chart consistency
        const usdToGbpRate = prices?.usdc?.gbp || 0.8;
        const liveValueInPounds = liveUsd * usdToGbpRate;
        // Only add if no snapshot for today already
        if (!points.some(p => p.date === today)) {
          points.push({ date: today, value: liveValueInPounds, isSnapshot: false });
        }
      }

      setHistory(points);
    } catch (e) {
      console.error('NFT portfolio chart error:', e);
    } finally {
      setLoading(false);
    }
  }, [range, prices]);

  useEffect(() => { loadData(); }, [loadData]);

  const formatValue = (val) => {
    // Values are in pounds; convert to display currency
    if (displayCurrency === 'GBP') return `£${val.toFixed(2)}`;
    if (displayCurrency === 'EUR') {
      const rate = prices?.usdc?.eur || 1.15;
      return `€${(val * rate).toFixed(2)}`;
    }
    if (displayCurrency === 'USD') {
      const rate = prices?.usdc?.usd || 1.25;
      return `$${(val * rate).toFixed(2)}`;
    }
    if (displayCurrency === 'USDC') {
      const rate = prices?.usdc?.usd || 1.25;
      return `${(val * rate).toFixed(2)} USDC`;
    }
    return `£${val.toFixed(2)}`;
  };

  const chartData = useMemo(() => {
    return history.map(p => ({
      ...p,
      label: p.date, // for XAxis
    }));
  }, [history]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (history.length < 2) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase">Portfolio Value Trend</span>
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground py-6">
          Not enough data yet. Check back after a few days of portfolio snapshots.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-raised">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase text-muted-foreground">Portfolio Value Trend</span>
        </div>
        {/* Time range selector */}
        <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-2 py-1 text-[10px] font-bold transition ${
                range === r.key
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(d) => {
              const date = new Date(d);
              return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            }}
            interval="preserveStartEnd"
            minTickGap={30}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(v) => formatValue(v).replace(/\.\d+/, '')}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelFormatter={(d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            formatter={(val) => [formatValue(val), 'Portfolio Value']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#portfolioGradient)"
            dot={false}
            activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}