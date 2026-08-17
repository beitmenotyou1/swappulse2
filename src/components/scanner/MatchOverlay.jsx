import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';

// Floating live-match card shown over the camera viewfinder. `locked` switches
// it to the solid "Match found" state.
export default function MatchOverlay({ candidate, locked, onClick }) {
  if (!candidate) return null;
  const { text, glow } = rarityClasses(candidate.rarity);
  const confidence = Math.round((candidate.confidence ?? 0) * 100);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute bottom-3 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-3 rounded-2xl border bg-card/95 p-2 pr-4 shadow-elevated backdrop-blur transition-all ${
        locked ? 'border-success ring-2 ring-success/40' : 'border-border'
      } ${onClick ? 'cursor-pointer hover:bg-card' : 'cursor-default'}`}
    >
      <div className={`h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-muted ${glow || ''}`}>
        {cardImageUrl(candidate.image) ? (
          <img src={cardImageUrl(candidate.image)} alt={candidate.card_name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-[9px] text-muted-foreground">No image</div>
        )}
      </div>
      <div className="min-w-0 text-left">
        {locked ? (
          <p className="flex items-center gap-1 text-xs font-bold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Match found
          </p>
        ) : (
          <p className="text-[10px] font-medium text-muted-foreground">Top match</p>
        )}
        <p className="truncate text-sm font-bold">{candidate.card_name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{candidate.set_name}</p>
        <p className={`truncate text-[10px] ${text}`}>{candidate.rarity || ''}</p>
        {!locked && (
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-1 w-20 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${confidence}%` }} />
            </div>
            <span className="text-[9px] font-semibold">{confidence}%</span>
          </div>
        )}
      </div>
    </button>
  );
}