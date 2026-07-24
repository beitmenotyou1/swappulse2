import React from 'react';
import { Link } from 'react-router-dom';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';

export default function CardThumb({ card, size = 'md' }) {
  const img = cardImageUrl(card.image);
  const { text } = rarityClasses(card.rarity);
  const sizes = {
    sm: 'w-24',
    md: 'w-32',
    lg: 'w-44',
  };
  return (
    <Link
      to={`/card/${card.id}`}
      className={`group block ${sizes[size]} shrink-0 overflow-hidden rounded-xl border border-border bg-secondary transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10`}
    >
      <div className="aspect-[3/4] overflow-hidden bg-muted">
        {img ? (
          <img
            src={img}
            alt={card.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No image</div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-xs font-semibold">{card.name}</p>
        <p className={`truncate text-[10px] ${text}`}>{card.rarity || card.set?.name || '—'}</p>
      </div>
    </Link>
  );
}