import React from 'react';
import { Image } from '@/components/ui/image';
import { Loader2, Check, Search, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { rarityClasses } from '@/lib/tcgdex';

export default function ScanResultCard({ scan, onChoose, onManual, onDismiss }) {
  const status = scan.status;
  const top = scan.candidates?.[0];

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-base">
      <div className="flex gap-3">
        <div className="h-40 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
          {scan.imageUrl ? (
            <Image src={scan.imageUrl} alt="Scanned card" className="h-full w-full" fittingType="fill" />
          ) : (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">No image</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {status === 'uploading' && (
            <p className="text-sm text-muted-foreground">Uploading…</p>
          )}
          {status === 'scanning' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Identifying card…
            </div>
          )}
          {status === 'fallback' && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-warning">
                <AlertCircle className="h-4 w-4" /> Couldn't identify automatically
              </p>
              <p className="text-xs text-muted-foreground">{scan.error || 'Try searching the catalog manually.'}</p>
              <Button size="sm" variant="outline" onClick={() => onManual(scan.id)}>
                <Search className="mr-1.5 h-4 w-4" /> Search manually
              </Button>
            </div>
          )}
          {status === 'done' && (
            <div className="space-y-1">
              <p className="truncate text-sm font-bold">{scan.prediction?.card_name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">
                {scan.prediction?.set_name || 'Set unknown'}
                {scan.prediction?.card_number ? ` · ${scan.prediction.card_number}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                Confidence: {Math.round((scan.prediction?.confidence || 0) * 100)}%
              </p>
            </div>
          )}
          {status === 'added' && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-success">
              <Check className="h-4 w-4" /> Added: {scan.addedCard?.card_name}
            </div>
          )}
        </div>

        <button onClick={() => onDismiss(scan.id)} aria-label="Dismiss" className="self-start rounded-full p-1 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>

      {status === 'done' && scan.candidates?.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {scan.candidates.map((c, i) => {
            const { text } = rarityClasses(c.rarity);
            return (
              <button
                key={c.card_id}
                onClick={() => onChoose(scan, c)}
                className={`overflow-hidden rounded-lg border text-left transition-all hover:border-primary/60 hover:shadow-md ${
                  i === 0 ? 'border-primary/60' : 'border-border'
                }`}
              >
                <div className="aspect-[3/4] overflow-hidden bg-muted">
                  {c.image ? (
                    <img src={c.image} alt={c.card_name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-[10px] text-muted-foreground">No image</div>
                  )}
                </div>
                <div className="p-1">
                  <p className="truncate text-[10px] font-semibold">{c.card_name}</p>
                  <p className={`truncate text-[9px] ${text}`}>{c.rarity || '-'}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {status === 'done' && (
        <div className="mt-2">
          <Button size="sm" variant="ghost" onClick={() => onManual(scan.id)}>
            <Search className="mr-1.5 h-4 w-4" /> Not right? Search manually
          </Button>
        </div>
      )}
    </div>
  );
}