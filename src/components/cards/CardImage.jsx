import React, { useState } from 'react';
import { cardImageUrl } from '@/lib/tcgdex';
import { Layers } from 'lucide-react';

// Shared card image renderer with broken-image fallback and object-contain
// so the full card is always visible (never cropped). Used by CardThumb,
// ExploreCardTile, CardDetail, CardOfTheDay, TrendingRail, and feed embeds.
//
// Accepts either a full card object (card.image) or a raw image path/URL
// via the `src` prop. Falls back to a branded placeholder on load error.
export default function CardImage({
  card,
  src,
  quality = 'high',
  alt,
  className = '',
  fallbackClassName = '',
  imgClassName = '',
}) {
  const [errored, setErrored] = useState(false);
  const imageField = src ?? card?.image ?? card?.card_image;
  const url = cardImageUrl(imageField, quality);
  const name = alt || card?.name || card?.card_name || '';

  if (!url || errored) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-secondary to-muted p-2 text-center ${fallbackClassName}`}>
        <Layers className="h-5 w-5 text-muted-foreground/40" />
        {name && <p className="line-clamp-2 text-[10px] font-medium text-muted-foreground/60">{name}</p>}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      loading="lazy"
      onError={() => setErrored(true)}
      className={`h-full w-full object-contain ${className} ${imgClassName}`}
    />
  );
}