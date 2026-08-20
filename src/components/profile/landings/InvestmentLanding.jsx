import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, BarChart3, Layers, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cardImageUrl } from '@/lib/tcgdex';
import { formatPrice } from '@/lib/format';

// InvestmentLanding — portfolio-forward overview with refined emerald styling.
// Portfolio value, collection stats, and binder highlights are the primary
// content, with a Market Watch call-to-action for value tracking.
export default function InvestmentLanding({ data, did, isOwner, profile, posts, collection }) {
  const [entries, setEntries] = useState(collection || []);
  const [loading, setLoading] = useState(!collection?.length);

  useEffect(() => {
    if (!did || collection?.length) return;
    let active = true;
    base44.entities.CollectionEntry.filter({ did }, '-updated_date', 100)
      .then((e) => { if (active) setEntries(e || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [did]);

  const portfolioValue = entries.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
  const binderCards = entries.slice(0, 8);

  return (
    <div className="py-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <PortfolioStat icon={TrendingUp} label="Portfolio Value" value={formatPrice(portfolioValue)} />
        <PortfolioStat icon={Layers} label="Total Cards" value={entries.length} />
        <PortfolioStat icon={BarChart3} label="Avg Value" value={entries.length ? formatPrice(portfolioValue / entries.length) : '—'} />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-emerald-500" /></div>
      ) : binderCards.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-700">Binder Highlights</h3>
            {isOwner && <Link to="/binders" className="text-xs font-semibold text-emerald-600 hover:underline">Manage binders</Link>}
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {binderCards.map((c) => (
              <Link key={c.id} to={`/card/${c.card_id}`}>
                <img src={cardImageUrl(c.card_image)} alt={c.card_name} className="aspect-[3/4] w-full rounded-lg object-cover shadow-sm" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">No collection entries yet.</p>
      )}

      {isOwner && (
        <Link to="/market" className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 hover:bg-emerald-100">
          <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <TrendingUp className="h-4 w-4" /> Market Watch
          </span>
          <span className="text-xs text-emerald-600">Track card values →</span>
        </Link>
      )}
    </div>
  );
}

function PortfolioStat({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <Icon className="h-5 w-5 text-emerald-600" />
      <span className="mt-2 text-xl font-bold text-emerald-800">{value}</span>
      <span className="text-xs text-emerald-600/70">{label}</span>
    </div>
  );
}