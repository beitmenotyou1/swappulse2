import React, { useRef, useState } from 'react';
import { ScanLine, Camera, Loader2, X, Upload, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { uploadMedia } from '@/lib/pdsBlob';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';

// Scan-to-attach modal for the composer. Uploads a photo, runs the existing
// scan-card backend function, shows candidates, and calls onAttach with a
// card normalised to the attachedCard shape ComposeBox expects. Does NOT add
// the card to the collection — that stays a separate action on the Scanner
// page, per the approved PRD.
export default function CardScanModal({ open, onClose, onAttach, title = 'Scan a card' }) {
  const inputRef = useRef(null);
  const [stage, setStage] = useState('idle'); // idle | uploading | scanning | done | fallback | error
  const [candidates, setCandidates] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState('');

  const reset = () => {
    setStage('idle');
    setCandidates([]);
    setPrediction(null);
    setImageUrl(null);
    setError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const runScan = async (file) => {
    if (!file) return;
    setStage('uploading');
    setError('');
    setCandidates([]);
    setPrediction(null);
    try {
      const url = await uploadMedia(file);
      setImageUrl(url);
      setStage('scanning');
      const res = await base44.functions.invoke('scan-card', { image_url: url });
      const data = res?.data || res || {};
      if (data.fallback || !data.candidates?.length) {
        setStage('fallback');
        setPrediction(data.prediction || {});
        return;
      }
      setCandidates(data.candidates);
      setPrediction(data.prediction || null);
      setStage('done');
    } catch (e) {
      setStage('error');
      setError(e?.message || 'Scan failed');
    }
  };

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
      <div
        className="mt-8 w-full max-w-lg animate-slide-up rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={close} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) runScan(f);
              e.target.value = '';
            }}
          />

          {stage === 'idle' && (
            <button
              onClick={() => inputRef.current?.click()}
              className="grid w-full place-items-center gap-3 rounded-2xl border-2 border-dashed border-border py-14 text-center transition-colors hover:border-primary/60 hover:bg-secondary"
            >
              <ScanLine className="h-9 w-9 text-primary" />
              <div>
                <p className="font-semibold">Tap to scan a card</p>
                <p className="text-sm text-muted-foreground">Take a photo or upload an image — we'll identify it</p>
              </div>
            </button>
          )}

          {(stage === 'uploading' || stage === 'scanning') && (
            <div className="flex flex-col items-center gap-3 py-14">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {stage === 'uploading' ? 'Uploading image…' : 'Identifying card…'}
              </p>
            </div>
          )}

          {stage === 'error' && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={() => inputRef.current?.click()}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Try again
              </button>
            </div>
          )}

          {stage === 'fallback' && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {prediction?.card_name
                  ? `Couldn't confidently match "${prediction.card_name}" to a catalog card.`
                  : 'Could not identify this card from the photo.'}
              </p>
              <button
                onClick={() => inputRef.current?.click()}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Scan another
              </button>
            </div>
          )}

          {stage === 'done' && (
            <>
              {imageUrl && (
                <div className="mb-3 flex justify-center">
                  <img src={imageUrl} alt="Scanned card" className="h-40 rounded-lg border border-border object-contain" />
                </div>
              )}
              <p className="mb-2 text-sm text-muted-foreground">
                {prediction?.card_name ? `Detected: ${prediction.card_name}` : 'Top matches — tap the right one'}
              </p>
              <div className="grid max-h-[45vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                {candidates.map((c) => {
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
              <button
                onClick={() => inputRef.current?.click()}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Camera className="h-3.5 w-3.5" /> Scan another
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}