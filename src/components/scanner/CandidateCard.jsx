import React from 'react';
import { rarityClasses } from '@/lib/tcgdex';

export default function CandidateCard({ candidate, onSelect, isSelected }) {
  const confidencePct = Math.round((candidate.confidence || 0) * 100);
  const confidenceColor =
    candidate.confidence >= 0.85 ? 'bg-success' :
    candidate.confidence >= 0.6 ? 'bg-warning' :
    'bg-destructive';
  const textColor =
    candidate.confidence >= 0.85 ? 'text-success' :
    candidate.confidence >= 0.6 ? 'text-warning' :
    'text-destructive';
  const { text } = rarityClasses(candidate.rarity);

  return (
    <button
      onClick={() => onSelect(candidate)}
      className={`overflow-hidden rounded-lg border text-left transition-all hover:border-primary/60 hover:shadow-md ${
        isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'
      }`}
    >
      <div className="aspect-[3/4] overflow-hidden bg-muted">
        {candidate.image ? (
          <img src={candidate.image} alt={candidate.card_name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-[10px] text-muted-foreground">No image</div>
        )}
      </div>
      <div className="p-1.5">
        <p className="truncate text-[10px] font-semibold">{candidate.card_name}</p>
        <p className={`truncate text-[9px] ${text}`}>{candidate.rarity || '-'}</p>
        <div className="mt-1 flex items-center gap-1">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div className={`h-full rounded-full ${confidenceColor}`} style={{ width: `${confidencePct}%` }} />
          </div>
          <span className={`text-[9px] font-bold ${textColor}`}>{confidencePct}%</span>
        </div>
      </div>
    </button>
  );
}