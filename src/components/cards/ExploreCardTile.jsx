import React from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Square, Layers } from 'lucide-react';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';

export default function ExploreCardTile({ card, selected, selectMode, onToggleSelect }) {
  const { text, glow } = rarityClasses(card.rarity);

  const inner = (
    <>
      <div className="aspect-[3/4] overflow-hidden bg-secondary">
        {cardImageUrl(card.image) ? (
          <img
            src={cardImageUrl(card.image)}
            alt={card.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-secondary to-muted p-2 text-center">
            <Layers className="h-5 w-5 text-muted-foreground/40" />
            <p className="line-clamp-2 text-[10px] font-medium text-muted-foreground/60">{card.name}</p>
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-xs font-semibold">{card.name}</p>
        <p className={`truncate text-[10px] ${text}`}>{card.rarity || '-'}</p>
      </div>
    </>
  );

  if (selectMode) {
    return (
      <button
        type="button"
        onClick={() => onToggleSelect(card.id)}
        className={`group relative overflow-hidden rounded-xl border bg-card text-left transition-all ${selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'} ${glow}`}
        aria-pressed={selected}
      >
        {inner}
        <span className="absolute right-1.5 top-1.5 rounded-md bg-black/50 p-1 backdrop-blur-sm">
          {selected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-white" />}
        </span>
      </button>
    );
  }

  return (
    <Link to={`/card/${card.id}`} className={`group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50 ${glow}`}>
      {inner}
    </Link>
  );
}