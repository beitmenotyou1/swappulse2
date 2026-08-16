import React, { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { TrendingUp, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatPrice } from '@/lib/format';

// PriceHistoryChart — a compact sparkline + stat block showing a card's price
// trend from stored CardPricing snapshots. Since CardPricing stores the
// current avg/avg7/avg30, we render those as a 3-point trend. If no pricing
// record exists, we show an empty state prompting the user to sync.
export default function PriceHistoryChart({ card }) {
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!card?.id && !card?.name) { setLoading(false); return; }
      try {
        const filter = card.id
          ? { card_id: card.id }
          : { card_name: card.name };
        const items = await base44.entities.CardPricing.filter(filter, '-updated_date', 5);
        if (!cancelled && items.length > 0) setPricing(items[0]);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [card?.id, card?.name]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pricing) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-4 text-center">
        <TrendingUp className="mx-auto h-5 w-5 text-muted-foreground/50" />
        <p className="mt-1.5 text-xs text-muted-foreground">No price history yet. Prices sync from TCGDex periodically.</p>
      </div>
    );
  }

  const avg = pricing.avg ?? 0;
  const avg7 = pricing.avg7 ?? avg;
  const avg30 = pricing.avg30 ?? avg7;
  const currencySymbol = pricing.unit === 'EUR' ? '€' : pricing.unit === 'USD' ? '$' : '£';
  const data = [
    { label: '30d', price: avg30 },
    { label: '7d', price: avg7 },
    { label: 'now', price: avg },
  ];
  const change = avg30 > 0 ? ((avg - avg30) / avg30) * 100 : 0;
  const isUp = change >= 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold">Price History</h3>
        <span className={`text-xs font-bold ${isUp ? 'text-success' : 'text-destructive'}`}>
          {isUp ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
        </span>
      </div>
      <div className="h-20">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <YAxis domain={['dataMin', 'dataMax']} hide />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(v) => [`${currencySymbol}${(v / 100).toFixed(2)}`, 'Price']}
              labelFormatter={(l) => `${l} avg`}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={isUp ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>30d: {formatPrice(Math.round((avg30 || 0) * 100))}</span>
        <span>7d: {formatPrice(Math.round((avg7 || 0) * 100))}</span>
        <span className="font-semibold text-foreground">Now: {formatPrice(Math.round((avg || 0) * 100))}</span>
      </div>
    </div>
  );
}