import React from 'react';
import { BinderIcon } from '@/components/icons/CollectionIcons';

/**
 * Visual preview of the binder page layout — shows a mini 2×3 grid of card
 * slots with owned/placeholder states so the user sees what the printed pages
 * will look like before generating the PDF.
 */
export default function BinderPreview({ cards, ownedLocalIds }) {
  const owned = new Set(ownedLocalIds);
  const previewCards = cards.slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <BinderIcon className="h-5 w-5 text-accent" />
        <h3 className="font-bold">Binder Page Preview</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        A preview of how the first binder page will look when printed.
      </p>

      {/* Mini binder page */}
      <div className="mx-auto max-w-sm rounded-lg border-2 border-border bg-secondary/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground">Page 1 Preview</span>
          <span className="text-[10px] text-muted-foreground">2 × 3 slots</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {previewCards.length > 0 ? previewCards.map((card) => {
            const isOwned = owned.has(card.local_id);
            return (
              <div
                key={card.tcgdex_id}
                className={`relative aspect-[3/4] rounded-md border-2 ${
                  isOwned ? 'border-success/50 bg-success/5' : 'border-dashed border-border bg-background'
                }`}
              >
                <div className="flex h-full flex-col items-center justify-center p-1 text-center">
                  {isOwned ? (
                    <span className="text-[9px] font-bold text-success">OWNED</span>
                  ) : (
                    <span className="text-[9px] text-muted-foreground">PLACEHOLDER</span>
                  )}
                  <span className="mt-0.5 line-clamp-2 text-[8px] font-medium">{card.name}</span>
                  <span className="text-[7px] text-muted-foreground">#{card.local_id}</span>
                </div>
              </div>
            );
          }) : Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-md border-2 border-dashed border-border bg-background" />
          ))}
        </div>
        {/* Hole punch guides */}
        <div className="mt-2 flex justify-start gap-4 pl-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 w-3 rounded-full border border-border bg-secondary" />
          ))}
        </div>
      </div>
    </div>
  );
}