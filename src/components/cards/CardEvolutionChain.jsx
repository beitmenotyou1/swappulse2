import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2, Dna } from 'lucide-react';
import { searchCards, cardImageUrl } from '@/lib/tcgdex';

// CardEvolutionChain — shows the evolution line for a card by searching TCGDex
// for the base stage, mid stages, and final stage using the card's name and
// evolveFrom field. Links each stage to its card detail page.
export default function CardEvolutionChain({ card }) {
  const [chain, setChain] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!card?.name) { setLoading(false); return; }
      try {
        // Search for all cards sharing the same dexId (national dex number)
        // to build the evolution family. Fall back to name-based search.
        const dexId = card.dexId || card.nationalDexId;
        let results = [];
        if (dexId) {
          results = await searchCards(String(dexId), { perPage: 30 });
        }
        // If dex search didn't find siblings, try the card name root
        if (results.length < 2) {
          const nameRoot = card.name.split(/[\s\-]/)[0];
          results = await searchCards(nameRoot, { perPage: 30 });
        }
        // Deduplicate by stage + name, sort by stage order
        const seen = new Set();
        const stages = results
          .filter((c) => {
            const key = `${c.stage || ''}:${c.name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return c.id !== card.id; // exclude current card (shown separately)
          })
          .sort((a, b) => {
            const order = { 'Basic': 0, 'Stage 1': 1, 'STAGE 1': 1, 'Stage 2': 2, 'STAGE 2': 2, 'GX': 3, 'EX': 3, 'V': 3, 'VMAX': 4 };
            return (order[a.stage] ?? 9) - (order[b.stage] ?? 9);
          })
          .slice(0, 4);
        if (!cancelled) setChain(stages);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [card?.id, card?.name, card?.dexId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading evolution line…
      </div>
    );
  }

  if (chain.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Dna className="h-4 w-4 text-primary" /> Evolution Line
      </h3>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {chain.map((c, i) => (
          <React.Fragment key={c.id}>
            <Link
              to={`/card/${c.id}`}
              className="group flex shrink-0 flex-col items-center gap-1"
            >
              <div className="h-16 w-12 overflow-hidden rounded-lg border border-border bg-secondary transition-transform group-hover:scale-105">
                {cardImageUrl(c.image) ? (
                  <img src={cardImageUrl(c.image, 'low')} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[8px] text-muted-foreground/50">{c.name}</div>
                )}
              </div>
              <span className="max-w-[60px] truncate text-[10px] font-medium">{c.name}</span>
              {c.stage && <span className="text-[9px] text-muted-foreground">{c.stage}</span>}
            </Link>
            {i < chain.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}