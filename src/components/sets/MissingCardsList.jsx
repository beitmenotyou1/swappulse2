import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { rarityClasses } from '@/lib/tcgdex';

const RARITY_ORDER = {
  'Secret Rare': 1,
  'Rare Holo': 2,
  'Rare VMAX': 3,
  'Rare V': 4,
  'Rare EX': 5,
  'Illustration Rare': 6,
  'Rare ACE': 7,
  'Rare': 8,
  'Uncommon': 9,
  'Common': 10,
};

export default function MissingCardsList({ cards }) {
  const missing = useMemo(() => {
    return cards
      .filter((c) => !c.is_owned)
      .sort((a, b) => {
        const rarityDiff = (RARITY_ORDER[a.rarity] || 99) - (RARITY_ORDER[b.rarity] || 99);
        if (rarityDiff !== 0) return rarityDiff;
        return parseInt(a.local_id) - parseInt(b.local_id);
      });
  }, [cards]);

  if (missing.length === 0) {
    return (
      <div className="rounded-xl border border-success/20 bg-success/5 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success" />
        <p className="text-lg font-bold text-success">You've completed this set!</p>
        <p className="mt-1 text-sm text-muted-foreground">Time to hunt down the next one.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="font-bold">Still Needed ({missing.length})</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Sorted by rarity (hardest first)</p>
        </div>
      </div>
      <div className="max-h-96 divide-y divide-border/50 overflow-y-auto">
        {missing.map((card) => {
          const { text: rarityText } = rarityClasses(card.rarity);
          return (
            <div key={card.tcgdex_id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/40">
              <div className="h-12 w-9 shrink-0 overflow-hidden rounded border border-border bg-secondary">
                {card.image_available && card.image ? (
                  <img src={card.image} alt={card.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="text-[8px] text-muted-foreground">N/A</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-muted-foreground">#{card.local_id}</span>
                  <p className="truncate text-sm font-medium">{card.name}</p>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className={`text-[10px] ${rarityText}`}>{card.rarity}</span>
                  {card.illustrator && (
                    <>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="truncate text-[10px] text-muted-foreground">{card.illustrator}</span>
                    </>
                  )}
                </div>
              </div>
              <Link
                to={`/card/${card.tcgdex_id}`}
                className="flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                Find Trade <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}