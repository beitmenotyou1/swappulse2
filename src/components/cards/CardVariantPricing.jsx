import React from 'react';
import { Tag } from 'lucide-react';

// CardVariantPricing — full pricing breakdown across all variants and
// timeframes from the TCGDex pricing object. Shows normal vs holofoil market
// prices, low/avg/trend, and the data source.
export default function CardVariantPricing({ card }) {
  const pricing = card?.pricing;
  if (!pricing) return null;

  const sources = Object.entries(pricing).filter(([, v]) => v && typeof v === 'object');
  if (sources.length === 0) return null;

  const currencySymbol = (src) => {
    if (src.unit === 'EUR') return '€';
    if (src.unit === 'USD') return '$';
    return '£';
  };

  const rows = (data) => {
    const r = [];
    if (data.normal_market != null) r.push({ label: 'Normal market', value: data.normal_market });
    if (data.normal_low != null) r.push({ label: 'Normal low', value: data.normal_low });
    if (data.normal_avg != null) r.push({ label: 'Normal avg', value: data.normal_avg });
    if (data.holofoil_market != null) r.push({ label: 'Holofoil market', value: data.holofoil_market });
    if (data.holofoil_low != null) r.push({ label: 'Holofoil low', value: data.holofoil_low });
    if (data.holofoil_avg != null) r.push({ label: 'Holofoil avg', value: data.holofoil_avg });
    if (data.low != null && !r.some((x) => x.value === data.low)) r.push({ label: 'Market low', value: data.low });
    if (data.avg != null && !r.some((x) => x.value === data.avg)) r.push({ label: 'Market avg', value: data.avg });
    if (data.trend != null) r.push({ label: 'Trend', value: data.trend });
    return r;
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Tag className="h-4 w-4 text-primary" /> Variant Pricing
      </h3>
      <div className="space-y-3">
        {sources.map(([sourceName, data]) => {
          const r = rows(data);
          if (r.length === 0) return null;
          const sym = currencySymbol(data);
          return (
            <div key={sourceName}>
              <p className="mb-1.5 text-xs font-semibold capitalize text-muted-foreground">{sourceName}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {r.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold">{sym}{(row.value || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Source: TCGPlayer / CardMarket via TCGdex</p>
    </div>
  );
}