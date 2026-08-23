import React from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Square } from 'lucide-react';
import { rarityClasses, cardSetName } from '@/lib/tcgdex';
import CardImage from '@/components/cards/CardImage';

export default function ExploreCardTile({ card, selected, selectMode, onToggleSelect }) {
  const { text, glow } = rarityClasses(card.rarity);
  const setName = cardSetName(card);

  const inner = (
    <>
      <div className="aspect-[3/4] overflow-hidden bg-secondary">
        <CardImage card={card} alt={card.name} />
      </div>
      <div className="p-2">
        <p className="truncate text-xs font-semibold">{card.name}</p>
        <p className={`truncate text-[10px] ${text}`}>{card.rarity || '-'}</p>
        {setName && <p className="truncate text-[10px] text-muted-foreground">{setName}</p>}
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