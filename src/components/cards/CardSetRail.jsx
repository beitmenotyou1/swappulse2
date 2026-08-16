import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Layers, ArrowRight } from 'lucide-react';
import { getSet, cardImageUrl, normalizeSetId } from '@/lib/tcgdex';

// CardSetRail — "More from this set" discovery rail. Fetches the full set
// checklist from TCGDex and shows a horizontal scroll of sibling cards,
// excluding the current card. Links to the set page and each card.
export default function CardSetRail({ card }) {
  const [cards, setCards] = useState([]);
  const [setName, setSetName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!card?.set?.id) { setLoading(false); return; }
      try {
        const set = await getSet(card.set.id);
        if (cancelled) return;
        setSetName(set?.name || card.set?.name || '');
        const siblings = (set?.cards || [])
          .filter((c) => c.id !== card.id)
          .slice(0, 12);
        setCards(siblings);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [card?.id, card?.set?.id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading set cards…
      </div>
    );
  }

  if (cards.length === 0) return null;
  const setId = normalizeSetId(card.set?.id);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Layers className="h-4 w-4 text-primary" /> More from {setName}
        </h3>
        <Link to={`/set/${setId}`} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          View set <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {cards.map((c) => (
          <Link
            key={c.id}
            to={`/card/${c.id}`}
            className="group shrink-0"
          >
            <div className="h-20 w-14 overflow-hidden rounded-lg border border-border bg-secondary transition-transform group-hover:scale-105">
              {cardImageUrl(c.image) ? (
                <img src={cardImageUrl(c.image, 'low')} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-1 text-center text-[8px] text-muted-foreground/50">{c.name}</div>
              )}
            </div>
            <p className="mt-1 max-w-[56px] truncate text-[10px] font-medium">{c.name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}