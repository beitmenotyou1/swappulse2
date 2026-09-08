import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

function shortRevision(value) {
  const revision = String(value || '');
  return revision.length > 16 ? revision.slice(0, 12) + '…' : revision;
}

export default function AgentKnowledgeReviewSection() {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [refreshReport, setRefreshReport] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await base44.entities.AgentKnowledgeRevision.filter(
        { review_status: 'pending_review' },
        '-fetched_at',
        100,
      );
      setRevisions(rows || []);
    } catch (requestError) {
      setError(
        requestError?.message ||
        'Could not load the project knowledge review queue.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const refreshSources = async () => {
    setRefreshing(true);
    setError('');
    setRefreshReport(null);
    try {
      const response =
        await base44.functions.invoke('refresh-agent-knowledge', {});
      const report = response.data || response;
      setRefreshReport(report);
      await load();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
        requestError?.message ||
        'The allowlisted sources could not be refreshed.',
      );
    } finally {
      setRefreshing(false);
    }
  };

  const review = async (revision, decision) => {
    let acknowledgeFlagged = false;
    if (decision === 'approve' && revision.safety_status === 'flagged') {
      acknowledgeFlagged = window.confirm(
        'This source contains a safety flag. Approve only after reading the source and confirming that its text is factual project documentation, not an instruction to the agent.',
      );
      if (!acknowledgeFlagged) return;
    }

    setWorkingId(revision.id);
    setError('');
    try {
      await base44.functions.invoke('review-agent-knowledge', {
        revision_id: revision.id,
        decision,
        acknowledge_flagged: acknowledgeFlagged,
        review_notes: decision === 'approve'
          ? 'Reviewed and approved in the SwapPulse admin knowledge queue.'
          : 'Rejected in the SwapPulse admin knowledge queue.',
      });
      setRevisions((current) =>
        current.filter((item) => item.id !== revision.id),
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
        requestError?.message ||
        'The review decision could not be saved.',
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
            <BookOpenCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold">Collector Copilot source review</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Refresh checks only fixed SwapPulse GitHub files used to
              publish the project's GitBook guidance. Changes remain private
              and unavailable to the Copilot until an administrator approves them.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading || refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Reload queue
          </Button>
          <Button
            size="sm"
            onClick={refreshSources}
            disabled={loading || refreshing}
          >
            {refreshing
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ShieldCheck className="h-4 w-4" />}
            Check approved sources
          </Button>
        </div>
      </div>

      {refreshReport && (
        <div className="mt-4 rounded-xl border border-border bg-secondary p-3 text-sm">
          <p className="font-semibold">Last source check</p>
          <p className="mt-1 text-muted-foreground">
            Revision {shortRevision(refreshReport.source_revision)}:
            {' '}{refreshReport.queued_count || 0} queued,
            {' '}{refreshReport.skipped_count || 0} unchanged,
            {' '}{refreshReport.error_count || 0} errors.
            No source was published automatically.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : revisions.length === 0 ? (
        <p className="mt-4 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
          No project knowledge changes are waiting for review.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {revisions.map((revision) => {
            const reasons = Array.isArray(revision.safety_reasons)
              ? revision.safety_reasons
              : [];
            return (
              <article
                key={revision.id}
                className="rounded-xl border border-border p-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-secondary px-2 py-1 font-semibold">
                    {revision.source_type}
                  </span>
                  <span>{shortRevision(revision.source_revision)}</span>
                  <span>{revision.content_hash?.slice(0, 12)}…</span>
                  <span>
                    {String(revision.content || '').length.toLocaleString()}
                    {' '}characters
                  </span>
                  {revision.safety_status === 'flagged' && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 font-semibold text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-3 w-3" />
                      Safety review required
                    </span>
                  )}
                </div>

                <h3 className="mt-3 font-semibold">{revision.title}</h3>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {revision.source_url}
                </p>

                {reasons.length > 0 && (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                    Flags: {reasons.join(', ')}
                  </p>
                )}

                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-secondary p-3 font-sans text-xs">
                  {revision.content}
                </pre>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => review(revision, 'approve')}
                    disabled={workingId === revision.id}
                  >
                    {workingId === revision.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Check className="h-4 w-4" />}
                    Approve and publish
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => review(revision, 'reject')}
                    disabled={workingId === revision.id}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
