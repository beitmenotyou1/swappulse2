import React, { useRef, useState } from 'react';
import { X, RefreshCw, ExternalLink } from 'lucide-react';
import LiveCameraScanner from '@/components/scanner/LiveCameraScanner';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';

// Scan-to-attach modal for the composer. Live camera auto-scans; tapping the
// auto-locked (or any candidate) match attaches the card to the post via the
// existing onAttach contract. Does NOT add the card to the collection.
export default function CardScanModal({ open, onClose, onAttach, title = 'Scan a card' }) {
  const scannerRef = useRef(null);
  const [locked, setLocked] = useState(null);

  if (!open) return null;

  const pick = (c) => {
    onAttach({
      id: c.card_id,
      name: c.card_name,
      image: c.image,
      rarity: c.rarity,
      set: { name: c.set_name },
    });
    close();
  };

  const close = () => {
    setLocked(null);
    scannerRef.current?.reset();
    onClose();
  };

  const onLock = (data) => setLocked(data);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
      <div
        className="mt-8 w-full max-w-lg animate-slide-up rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={close} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <LiveCameraScanner ref={scannerRef} onLock={onLock} onReset={() => setLocked(null)} />

          {locked?.candidates?.length > 0 && (
            <>
              <p className="mb-2 mt-3 text-sm text-muted-foreground">
                {locked.prediction?.card_name ? `Detected: ${locked.prediction.card_name}` : 'Top matches — tap the right one'}
              </p>
              {locked.candidates[0]?.card_id && (
                <a
                  href={`/card/${locked.candidates[0].card_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View card page
                </a>
              )}
              <div className="grid max-h-[35vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                {locked.candidates.map((c) => {
                  const { text } = rarityClasses(c.rarity);
                  return (
                    <button
                      key={c.card_id}
                      onClick={() => pick(c)}
                      className="group overflow-hidden rounded-lg border border-border bg-secondary text-left transition-all hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10"
                    >
                      <div className="aspect-[3/4] overflow-hidden bg-muted">
                        {cardImageUrl(c.image) ? (
                          <img src={cardImageUrl(c.image)} alt={c.card_name} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <div className="grid h-full place-items-center text-[10px] text-muted-foreground">No image</div>
                        )}
                      </div>
                      <div className="p-1.5">
                        <p className="truncate text-[11px] font-semibold">{c.card_name}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{c.set_name}</p>
                        <p className={`truncate text-[10px] ${text}`}>{c.rarity || '-'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {locked && !locked.candidates?.length && (
            <div className="mt-3 flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm text-muted-foreground">Couldn't confidently identify this card.</p>
              <button
                onClick={() => scannerRef.current?.reset()}
                className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}