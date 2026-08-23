import React from 'react';
import { Link } from 'react-router-dom';
import { rarityClasses, cardSetName } from '@/lib/tcgdex';
import CardImage from '@/components/cards/CardImage';

export default function CardThumb({ card, size = 'md' }) {
  const { text, glow } = rarityClasses(card.rarity);
  const setName = cardSetName(card);
  const sizes = {
    sm: 'w-24',
    md: 'w-32',
    lg: 'w-44',
  };
  return (
    <Link
      to={`/card/${card.id}`}
      className={`group block ${sizes[size]} shrink-0 overflow-hidden rounded-xl border border-border bg-secondary transition-all hover:border-primary/50 ${glow}`}
    >
      <div className="aspect-[3/4] overflow-hidden bg-muted">
        <CardImage card={card} alt={card.name} />
      </div>
      <div className="p-2">
        <p className="truncate text-xs font-semibold">{card.name}</p>
        <p className={`truncate text-[10px] ${text}`}>{card.rarity || setName || '-'}</p>
        {setName && card.rarity && <p className="truncate text-[10px] text-muted-foreground">{setName}</p>}
      </div>
    </Link>
  );
}