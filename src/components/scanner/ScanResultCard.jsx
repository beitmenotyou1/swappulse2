import React from 'react';
import { Image } from '@/components/ui/image';
import { Loader2, Check, Search, AlertCircle, X, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CandidateCard from '@/components/scanner/CandidateCard';
import CorrectionPanel from '@/components/scanner/CorrectionPanel';

export default function ScanResultCard({ scan, onSelectCandidate, onManual, onDismiss, pendingCorrection, onSubmitCorrection, onCancelCorrection }) {
  const status = scan.status;
  const top = scan.candidates?.[0];
  const isPending = pendingCorrection?.scanId === scan.id;

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
          {status === 'uploading' && <p className="text-sm text-muted-foreground">Uploading…</p>}
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
              {scan.modelVersion && (
                <p className="text-[10px] text-muted-foreground/60">Scanner v{scan.modelVersion}</p>
              )}
            </div>
          )}
          {status === 'added' && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-success">
                <Check className="h-4 w-4" /> Added: {scan.addedCard?.card_name}
              </div>
              {scan.correctionType && scan.correctionType !== 'confirm_correct' && (
                <p className="flex items-center gap-1 text-xs text-primary">
                  <GraduationCap className="h-3 w-3" /> Correction recorded — thanks for helping improve the scanner!
                </p>
              )}
              {scan.correctionType === 'confirm_correct' && (
                <p className="text-xs text-muted-foreground">Scanner confirmed correct — positive signal recorded.</p>
              )}
            </div>
          )}
        </div>

        <button onClick={() => onDismiss(scan.id)} aria-label="Dismiss" className="self-start rounded-full p-1 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>

      {status === 'done' && scan.candidates?.length > 0 && !isPending && (
        <>
          <p className="mt-3 text-xs font-semibold text-muted-foreground">
            {top?.confidence >= 0.85 ? 'Match found — tap to confirm' : 'Possible matches — tap the correct card'}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {scan.candidates.map((c) => (
              <CandidateCard
                key={c.card_id}
                candidate={c}
                onSelect={(candidate) => onSelectCandidate(scan, candidate)}
              />
            ))}
          </div>
          <div className="mt-2">
            <Button size="sm" variant="ghost" onClick={() => onManual(scan.id)}>
              <Search className="mr-1.5 h-4 w-4" /> Not right? Search manually
            </Button>
          </div>
        </>
      )}

      {status === 'fallback' && (
        <div className="mt-2">
          <Button size="sm" variant="ghost" onClick={() => onManual(scan.id)}>
            <Search className="mr-1.5 h-4 w-4" /> Search for your card
          </Button>
        </div>
      )}

      {isPending && (
        <CorrectionPanel
          scan={scan}
          selectedCard={pendingCorrection.card}
          onSubmit={(notes) => onSubmitCorrection(scan, pendingCorrection.card, pendingCorrection.correctionType, notes, pendingCorrection.viaManual)}
          onCancel={onCancelCorrection}
        />
      )}
    </div>
  );
}