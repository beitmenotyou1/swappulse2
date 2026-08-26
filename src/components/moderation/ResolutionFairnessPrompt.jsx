import React, { useState } from 'react';
import { Star, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useT } from '@/lib/i18n/I18nProvider';

// ResolutionFairnessPrompt — a lightweight post-resolution feedback widget.
// Shown once after an escrow dispute or moderation action is resolved, letting
// the affected user rate the fairness (1-5 stars) with an optional comment.
// The rating is logged to ModerationDecisionLog and feeds the learning loop.
export default function ResolutionFairnessPrompt({ decisionLogId, caseLabel, onClose }) {
  const t = useT();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (rating < 1 || rating > 5) return;
    setSubmitting(true);
    try {
      await base44.functions.invoke('moderation-review', {
        op: 'fairness',
        decision_log_id: decisionLogId,
        rating,
        comment: comment.trim(),
      });
      setSubmitted(true);
      toast({ title: 'Thank you', description: 'Your feedback helps the agent improve.' });
      setTimeout(() => onClose?.(), 1500);
    } catch (e) {
      toast({ title: 'Could not submit', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <span className="text-muted-foreground">Thank you — your feedback was recorded.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">
        How fair was this resolution?
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {caseLabel ? `Regarding: ${caseLabel}. ` : ''}Your rating helps the moderation agent learn and improve.
      </p>

      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-1 transition-transform hover:scale-110"
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              className={`h-7 w-7 transition-colors ${(hover || rating) >= star ? 'fill-accent text-accent' : 'text-border-strong'}`}
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 500))}
        placeholder="Optional comment…"
        rows={2}
        className="mt-3 w-full resize-none rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
      />

      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={submit} disabled={rating < 1 || submitting}>
          {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Submit
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} disabled={submitting}>
          Skip
        </Button>
      </div>
    </div>
  );
}