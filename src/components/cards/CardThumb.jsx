import React from 'react';
import { Link } from 'react-router-dom';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import { Layers } from 'lucide-react';

export default function CardThumb({ card, size = 'md' }) {
  const img = cardImageUrl(card.image);
  const { text, glow } = rarityClasses(card.rarity);
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
        {img ? (
          <img
            src={img}
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
        <p className={`truncate text-[10px] ${text}`}>{card.rarity || card.set?.name || '—'}</p>
      </div>
    </Link>
  );
}