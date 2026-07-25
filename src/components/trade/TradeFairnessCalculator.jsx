import React, { useEffect, useMemo, useState } from 'react';
import { Scale, Loader2, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatPrice } from '@/lib/format';

// §4.2 Trade Fairness Calculator - client-side using cached CardPricing.
// differential = abs(offerValue - wantValue); percentDiff = differential / max * 100
// Fairness bands: green <5%, amber 5-15%, red >15%. Non-blocking.

const TIER = (pct) => {
  if (pct < 5) return { key: 'fair', color: 'text-success', bg: 'bg-success/15', icon: CheckCircle2, label: 'Fair trade' };
  if (pct <= 15) return { key: 'amber', color: 'text-warning', bg: 'bg-warning/15', icon: AlertTriangle, label: 'Slightly unbalanced' };
  return { key: 'red', color: 'text-destructive', bg: 'bg-destructive/15', icon: AlertCircle, label: 'Significant imbalance' };
};

function pickPrice(record) {
  if (!record) return null;
  return record.trend ?? record.avg ?? record.avg7 ?? record.low ?? null;
}

export default function TradeFairnessCalculator({ trade }) {
  const [pricingMap, setPricingMap] = useState({});
  const [loading, setLoading] = useState(true);

  const offerIds = trade?.offer_card_ids || [];
  const wantIds = trade?.wanted_card_ids || [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = [...new Set([...offerIds, ...wantIds])];
      if (ids.length === 0) { if (!cancelled) setPricingMap({}); setLoading(false); return; }
      setLoading(true);
      try {
        const all = await base44.entities.CardPricing.list('-updated_date', 200);
        const map = {};
        for (const p of all) {
          if (!p.card_id) continue;
          const price = pickPrice(p);
          if (price == null) continue;
          // keep the most recent / highest-confidence price per card
          if (!map[p.card_id] || (p.trend && !map[p.card_id]._trend)) map[p.card_id] = { ...p, _price: price, _trend: !!p.trend };
        }
        if (!cancelled) setPricingMap(map);
      } catch {
        if (!cancelled) setPricingMap({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [offerIds.join(','), wantIds.join(',')]);

  const calc = useMemo(() => {
    const offerValue = offerIds.reduce((s, id) => s + (pricingMap[id]?._price || 0), 0);
    const wantValue = wantIds.reduce((s, id) => s + (pricingMap[id]?._price || 0), 0);
    const differential = Math.abs(offerValue - wantValue);
    const maxVal = Math.max(offerValue, wantValue);
    const percentDiff = maxVal > 0 ? (differential / maxVal) * 100 : 0;
    const hasData = (offerIds.length > 0 && wantIds.length > 0) && (offerValue > 0 || wantValue > 0);
    return { offerValue, wantValue, differential, percentDiff, hasData };
  }, [offerIds, wantIds, pricingMap]);

  const tier = TIER(calc.percentDiff);
  const TierIcon = tier.icon;
  const heavier = calc.offerValue >= calc.wantValue ? 'offer' : 'want';
  const barPct = Math.min(calc.percentDiff, 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" /> Checking trade fairness…
      </div>
    );
  }

  if (!calc.hasData) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Fairness check needs pricing data for both sides - add cards with known market prices to see a balance estimate.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <Scale className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Trade Fairness Calculator</h3>
        <span className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${tier.bg} ${tier.color}`}>
          <TierIcon className="h-3 w-3" /> {tier.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-lg border p-2.5 ${heavier === 'offer' ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary'}`}>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Offering value</p>
          <p className="text-base font-extrabold">{formatPrice(calc.offerValue)}</p>
          <p className="truncate text-[10px] text-muted-foreground">{offerIds.length} card{offerIds.length === 1 ? '' : 's'}</p>
        </div>
        <div className={`rounded-lg border p-2.5 ${heavier === 'want' ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary'}`}>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Wants value</p>
          <p className="text-base font-extrabold">{formatPrice(calc.wantValue)}</p>
          <p className="truncate text-[10px] text-muted-foreground">{wantIds.length} card{wantIds.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      {/* Balance bar */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Balance</span>
          <span>{calc.differential > 0 ? `${formatPrice(calc.differential)} gap` : 'Even'} · {calc.percentDiff.toFixed(1)}%</span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${tier.key === 'fair' ? 'bg-success' : tier.key === 'amber' ? 'bg-warning' : 'bg-destructive'}`}
            style={{ width: `${Math.max(4, barPct)}%` }}
          />
        </div>
      </div>

      {/* Suggestion for 5-15% gap */}
      {tier.key === 'amber' && (
        <p className="mt-2.5 text-xs text-muted-foreground">
          <AlertTriangle className="mr-1 inline h-3 w-3 text-warning" />
          {heavier === 'offer'
            ? `You're offering ~${formatPrice(calc.differential)} more. Consider asking for a small added card or cash to balance.`
            : `They're offering ~${formatPrice(calc.differential)} more than your wants - you could add a card from your duplicates to even it out.`}
        </p>
      )}
      {tier.key === 'red' && (
        <p className="mt-2.5 text-xs text-muted-foreground">
          <AlertCircle className="mr-1 inline h-3 w-3 text-destructive" />
          This deal is significantly unbalanced. Double-check the values - you can still complete it if the cards are emotionally valuable to you.
        </p>
      )}
    </div>
  );
}