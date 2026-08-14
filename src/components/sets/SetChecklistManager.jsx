import React, { useState, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import SetSelector from './SetSelector';
import CompletionProgress from './CompletionProgress';
import ChecklistGrid from './ChecklistGrid';
import MissingCardsList from './MissingCardsList';
import PdfDownloadPanel from './PdfDownloadPanel';
import BinderPreview from './BinderPreview';
import ScannerBatchUpload from './ScannerBatchUpload';
import SetBuddiesSection from './SetBuddiesSection';
import { useSetChecklist } from '@/hooks/useSetChecklist';

export default function SetChecklistManager({ userId }) {
  const [selectedSetId, setSelectedSetId] = useState(null);
  const [recentlyScannedIds, setRecentlyScannedIds] = useState([]);

  const { data: checklist, isLoading, error } = useSetChecklist(selectedSetId, userId);

  const handleScanComplete = useCallback((scannedIds) => {
    setRecentlyScannedIds(scannedIds);
    setTimeout(() => setRecentlyScannedIds([]), 5000);
  }, []);

  // No set selected — show selector
  if (!selectedSetId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Set Completion Tracker</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick a set to see your collection progress, download printable checklists, and generate binder placeholder pages.
          </p>
        </div>
        <SetSelector selectedSetId={selectedSetId} onSelect={setSelectedSetId} />
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        <SetSelector selectedSetId={selectedSetId} onSelect={setSelectedSetId} />
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Error
  if (error || !checklist) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <SetSelector selectedSetId={selectedSetId} onSelect={setSelectedSetId} />
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error?.message || 'Could not load checklist data.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + set selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{checklist.set_name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {checklist.release_date ? `Released ${checklist.release_date}` : ''} · {checklist.card_count} cards
          </p>
        </div>
        <div className="w-full sm:w-72">
          <SetSelector selectedSetId={selectedSetId} onSelect={setSelectedSetId} />
        </div>
      </div>

      {/* Progress overview */}
      <CompletionProgress
        percentage={checklist.completion_percentage}
        ownedCount={checklist.owned_count}
        totalCount={checklist.card_count}
        setName={checklist.set_name}
      />

      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Scanner + Checklist grid */}
        <div className="space-y-6 lg:col-span-2">
          <ScannerBatchUpload
            setId={checklist.set_id}
            setName={checklist.set_name}
            onScanComplete={handleScanComplete}
          />
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">Card Checklist</h3>
              <p className="text-xs text-muted-foreground">Click any card to toggle ownership</p>
            </div>
            <ChecklistGrid
              cards={checklist.cards}
              setId={checklist.set_id}
              setName={checklist.set_name}
              recentlyScannedIds={recentlyScannedIds}
            />
          </div>
        </div>

        {/* Right sidebar: Missing cards + PDF downloads + Binder preview */}
        <div className="space-y-6">
          <MissingCardsList cards={checklist.cards} />
          <PdfDownloadPanel
            setId={checklist.set_id}
            setName={checklist.set_name}
            cards={checklist.cards}
            totalCards={checklist.card_count}
            ownedLocalIds={checklist.cards.filter((c) => c.is_owned).map((c) => c.local_id)}
          />
          <BinderPreview
            cards={checklist.cards}
            ownedLocalIds={checklist.cards.filter((c) => c.is_owned).map((c) => c.local_id)}
          />
          <SetBuddiesSection
            setId={checklist.set_id}
            setName={checklist.set_name}
            myCardIds={checklist.cards.filter((c) => c.is_owned).map((c) => c.tcgdex_id)}
          />
        </div>
      </div>

      {/* Rarity breakdown */}
      {checklist.rarity_breakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-bold">Rarity Breakdown</h3>
          <div className="space-y-2">
            {checklist.rarity_breakdown.map((rb) => {
              const pct = rb.total > 0 ? Math.round((rb.owned / rb.total) * 100) : 0;
              return (
                <div key={rb.rarity} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-muted-foreground">{rb.rarity}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                    {rb.owned}/{rb.total} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}