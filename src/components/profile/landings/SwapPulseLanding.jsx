import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ArrowLeftRight, Sparkles } from 'lucide-react';
import BlockRenderer from '@/components/profile/BlockRenderer';
import { cardImageUrl } from '@/lib/tcgdex';
import { formatPrice } from '@/lib/format';

// SwapPulseLanding — comprehensive activity dashboard. Aggregates highlights
// from every section (posts, binder, trades, portfolio, milestones) into a
// single scrollable overview so visitors get the full picture at a glance.
export default function SwapPulseLanding({ data, blockOrder, did, isOwner, profile, posts, collection, trades, reputation, journals }) {
  const binderCards = (collection || []).slice(0, 6);
  const portfolioValue = (collection || []).reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);

  return (
    <div className="py-4 space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
        <HighlightCard icon={ArrowLeftRight} label="Trades" value={trades?.length || 0} />
        <HighlightCard icon={Sparkles} label="Cards" value={collection?.length || 0} />
        <HighlightCard icon={Trophy} label="Value" value={formatPrice(portfolioValue)} />
      </div>

      {['interests', 'favourite_pokemon', 'favourite_sets'].map((key) => (
        <BlockRenderer key={key} blockKey={key} data={data} did={did} isOwner={isOwner} />
      ))}

      {binderCards.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold">Binder Preview</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {binderCards.map((c) => (
              <Link key={c.id} to={`/card/${c.card_id}`}>
                <img src={cardImageUrl(c.card_image)} alt={c.card_name} className="aspect-[3/4] w-full rounded-lg object-cover" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {['milestones', 'contact'].map((key) => (
        <BlockRenderer key={key} blockKey={key} data={data} did={did} isOwner={isOwner} />
      ))}
    </div>
  );
}

function HighlightCard({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-card p-3 text-center">
      <Icon className="h-5 w-5 text-primary" />
      <span className="mt-1 text-lg font-bold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}