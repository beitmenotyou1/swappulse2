import React, { useState } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CorrectionPanel({ scan, selectedCard, onSubmit, onCancel }) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const predictedName = scan.prediction?.card_name || scan.candidates?.[0]?.card_name || 'Unknown';

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(notes.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <GraduationCap className="h-4 w-4" /> Help the scanner learn
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Scanner predicted <span className="font-medium">{predictedName}</span> — you selected{' '}
        <span className="font-medium">{selectedCard.card_name}</span>. Your correction trains future scans.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value.slice(0, 500))}
        placeholder="Optional notes (e.g. card was in a sleeve, poor lighting…)"
        className="mt-2 w-full resize-none rounded-lg border border-border bg-card p-2 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
        rows={2}
        aria-label="Optional correction notes"
      />
      <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{notes.length}/500</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Submit & Add to Collection
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
      </div>
    </div>
  );
}