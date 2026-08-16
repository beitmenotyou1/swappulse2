import React from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatPrice } from '@/lib/format';

// PriceHistoryChart — a compact trend chart showing a card's price changes
// over time using the TCGDex pricing data already loaded on the card object.
// CardMarket provides avg30 / avg7 / avg1 (30-day, 7-day, 1-day moving averages)
// which we render as a simple trend sparkline to help users judge market
// direction at a glance. Falls back to TCGPlayer market/low/high if CardMarket
// averages are unavailable. No extra network call — uses card.pricing only.
export default function PriceHistoryChart({ card }) {
  const cm = card?.pricing?.cardmarket || {};
  const tp = card?.pricing?.tcgplayer || {};

  // Prefer CardMarket time-averages (avg30 → avg7 → avg1) for a real trend line.
  const hasCardMarket = cm.avg30 != null || cm.avg7 != null || cm.avg1 != null;
  const currency = cm.currency || tp.currency || 'EUR';
  const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£';

  let data = [];
  let currentPrice = null;
  let changePct = null;

  if (hasCardMarket) {
    const a30 = cm.avg30 ?? cm.avg7 ?? cm.avg1 ?? 0;
    const a7 = cm.avg7 ?? cm.avg1 ?? a30;
    const a1 = cm.avg1 ?? a7;
    currentPrice = a1;
    data = [
      { label: '30d avg', price: a30 },
      { label: '7d avg', price: a7 },
      { label: '1d avg', price: a1 },
    ];
    if (a30 > 0) changePct = ((a1 - a30) / a30) * 100;
  } else if (tp.market != null) {
    // Fallback: TCGPlayer snapshot (no time series, show range as a flat trend)
    currentPrice = tp.market;
    data = [
      { label: 'Low', price: tp.low ?? tp.market },
      { label: 'Market', price: tp.market },
      { label: 'High', price: tp.high ?? tp.market },
    ];
  }

  if (data.length === 0 || currentPrice == null) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-4 text-center">
        <TrendingUp className="mx-auto h-5 w-5 text-muted-foreground/50" />
        <p className="mt-1.5 text-xs text-muted-foreground">No pricing data available for this card yet.</p>
      </div>
    );
  }

  const isUp = changePct == null ? true : changePct >= 0;
  const trendColor = isUp ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
  const gradientId = 'priceTrendGradient';

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Price Trend</h3>
          <p className="text-xs text-muted-foreground">30-day direction from TCGDex</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold leading-none">
            {currencySymbol}{(currentPrice || 0).toFixed(2)}
          </p>
          {changePct != null && (
            <p className={`mt-1 flex items-center justify-end gap-1 text-xs font-bold ${isUp ? 'text-success' : 'text-destructive'}`}>
              {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {isUp ? '+' : ''}{changePct.toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trendColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={trendColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis domain={['dataMin', 'dataMax']} hide />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
                padding: '6px 10px',
              }}
              formatter={(v) => [`${currencySymbol}${Number(v).toFixed(2)}`, 'Price']}
              labelFormatter={(l) => l}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={trendColor}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={{ r: 3, fill: trendColor, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: trendColor, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground/70">
        {hasCardMarket
          ? 'Averages sourced from CardMarket via TCGDex. Use this trend to time trades.'
          : 'Market snapshot from TCGPlayer via TCGDex. Limited trend data for this card.'}
      </p>
    </div>
  );
}