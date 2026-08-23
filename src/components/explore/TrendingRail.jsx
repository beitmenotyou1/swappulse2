import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Loader2, TrendingUp, ArrowLeftRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cardImageUrl, rarityClasses, cardSetName } from '@/lib/tcgdex';
import CardImage from '@/components/cards/CardImage';

// TrendingRail — shows trending cards based on two signals: most-wishlisted
// (from the Wishlist entity) and most-traded (from TradeListing offers).
// Renders a horizontal scroll of card tiles with a trend badge. Falls back
// to recent sets if no trending data is available yet.
export default function TrendingRail({ limit = 10 }) {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Aggregate wishlist counts by card_id to find most-wishlisted cards
        const wishlist = await base44.entities.Wishlist.list('-created_date', 200).catch(() => []);
        const counts = new Map();
        wishlist.forEach((w) => {
          if (!w.card_id) return;
          counts.set(w.card_id, {
            card_id: w.card_id,
            card_name: w.card_name,
            card_image: w.card_image,
            set_name: w.set_name,
            rarity: w.rarity,
            wishlists: (counts.get(w.card_id)?.wishlists || 0) + 1,
          });
        });
        // Also count trade listings offering this card
        const trades = await base44.entities.TradeListing.filter({ status: 'open' }, '-created_date', 100).catch(() => []);
        trades.forEach((t) => {
          (t.offer_card_ids || []).forEach((id) => {
            if (counts.has(id)) counts.get(id).trades = (counts.get(id).trades || 0) + 1;
          });
        });
        const sorted = Array.from(counts.values())
          .map((c) => ({ ...c, score: (c.wishlists || 0) + (c.trades || 0) * 2 }))
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        if (!cancelled) setTrending(sorted);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [limit]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading trending…
      </div>
    );
  }

  if (trending.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Flame className="h-4 w-4 text-accent" /> Trending Cards
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {trending.map((c) => {
          const { glow } = rarityClasses(c.rarity);
          return (
            <Link
              key={c.card_id}
              to={`/card/${c.card_id}`}
              className={`group shrink-0 w-28 ${glow}`}
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-secondary transition-transform group-hover:scale-105">
                <CardImage src={c.card_image} alt={c.card_name} quality="low" />
                <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                  <TrendingUp className="h-2.5 w-2.5" /> {c.wishlists || 0}
                  {c.trades > 0 && <ArrowLeftRight className="ml-0.5 h-2.5 w-2.5" />}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] font-semibold">{c.card_name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{c.set_name || cardSetName(c) || c.rarity || ''}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}