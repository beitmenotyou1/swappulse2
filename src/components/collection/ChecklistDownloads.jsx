import React, { useState } from 'react';
import { ChecklistIcon, BinderIcon } from '@/components/icons/CollectionIcons';
import { Loader2 } from 'lucide-react';
import { generateChecklistPDF, generateBinderPagesPDF } from '@/lib/pdfGenerator';

/**
 * Download buttons for set checklist and binder placeholder PDFs.
 * Shown inside each expanded SetCompletionDashboard row.
 */
export default function ChecklistDownloads({ setName, setId, totalCards, allCards, ownedLocalIds }) {
  const [busy, setBusy] = useState(null); // 'checklist' | 'binder' | null
  const [error, setError] = useState('');

  const handleChecklist = () => {
    setBusy('checklist');
    setError('');
    try {
      generateChecklistPDF({ setName, setId, totalCards, ownedLocalIds, allCards });
    } catch (e) {
      setError(e.message || 'Failed to generate checklist');
    } finally {
      setBusy(null);
    }
  };

  const handleBinder = () => {
    setBusy('binder');
    setError('');
    try {
      generateBinderPagesPDF({ setName, setId, totalCards, ownedLocalIds, allCards });
    } catch (e) {
      setError(e.message || 'Failed to generate binder pages');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Download &amp; Print
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleChecklist}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:border-primary/50 hover:bg-secondary disabled:opacity-50"
        >
          {busy === 'checklist' ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <ChecklistIcon className="h-4 w-4 text-primary" />
          )}
          Checklist PDF
        </button>
        <button
          onClick={handleBinder}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:border-primary/50 hover:bg-secondary disabled:opacity-50"
        >
          {busy === 'binder' ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <BinderIcon className="h-4 w-4 text-primary" />
          )}
          Binder Pages PDF
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}