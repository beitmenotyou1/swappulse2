import React, { useEffect, useState } from 'react';
import {
  Check,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

function confidenceLabel(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 100)}%` : 'Unknown';
}

export default function ScannerCorrectionReviewSection() {
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await base44.entities.ScannerCorrection.filter(
        { review_status: 'quarantined' },
        '-created_date',
        100,
      );
      setCorrections(rows || []);
    } catch (requestError) {
      setError(
        requestError?.message ||
        'Could not load the quarantined scanner labels.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (correction, decision) => {
    if (decision === 'approve') {
      const confirmed = window.confirm(
        'Approve this label only after checking the predicted and selected catalogue identities. Approval can count towards scanner achievements and makes the label eligible for a separately reviewed future training export.',
      );
      if (!confirmed) return;
    }

    setWorkingId(correction.id);
    setError('');
    try {
      const me = await base44.auth.me();
      await base44.entities.ScannerCorrection.update(correction.id, {
        review_status: decision === 'approve' ? 'approved' : 'rejected',
        accepted: decision === 'approve',
        reviewed_by: me?.id || '',
        reviewed_at: new Date().toISOString(),
        reversal_reason: decision === 'reject'
          ? 'Rejected in the administrator scanner label queue.'
          : '',
      });
      setCorrections((current) =>
        current.filter((item) => item.id !== correction.id),
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
        'The scanner label review decision could not be saved.',
      );
    } finally {
      setWorkingId('');
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold">Scanner label review</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Confirmed scanner labels remain quarantined here. They cannot
              affect matching, model weights, training exports, or achievements
              until an administrator checks the catalogue identities and
              approves them.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Reload queue
        </Button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          This queue contains catalogue labels only. Private card photos are
          not displayed or copied into the correction record.
        </p>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : corrections.length === 0 ? (
        <p className="mt-4 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
          No scanner labels are waiting for review.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {corrections.map((correction) => (
            <article
              key={correction.id}
              className="rounded-xl border border-border p-3"
            >
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-secondary px-2 py-1 font-semibold">
                  {correction.correction_type || 'scanner label'}
                </span>
                <span>Confidence {confidenceLabel(correction.confidence)}</span>
                <span>Image {Number(correction.image_index) + 1}</span>
                {correction.detected_language && (
                  <span>Language {correction.detected_language}</span>
                )}
              </div>

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">
                    Suggested card
                  </dt>
                  <dd className="break-all">
                    {correction.predicted_card_id || 'No catalogue suggestion'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">
                    Collector selected
                  </dt>
                  <dd className="break-all font-semibold">
                    {correction.selected_card_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">
                    Collection entry
                  </dt>
                  <dd className="break-all">{correction.collection_entry_id}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">
                    Scan session
                  </dt>
                  <dd className="break-all">{correction.scan_session_id}</dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => review(correction, 'approve')}
                  disabled={workingId === correction.id}
                >
                  {workingId === correction.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Check className="h-4 w-4" />}
                  Approve label
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => review(correction, 'reject')}
                  disabled={workingId === correction.id}
                >
                  <X className="h-4 w-4" />
                  Reject label
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
