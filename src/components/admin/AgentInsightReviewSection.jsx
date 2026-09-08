import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function AgentInsightReviewSection() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await base44.entities.AgentInsight.filter(
        { review_status: 'pending_review' },
        '-generated_at',
        100,
      );
      setInsights(rows || []);
    } catch (requestError) {
      setError(requestError?.message || 'Could not load the review queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (insight, decision) => {
    let acknowledgeFlagged = false;
    if (decision === 'approve' && insight.safety_status === 'flagged') {
      acknowledgeFlagged = window.confirm(
        'This candidate contains a possible prompt-injection or sensitive-data pattern. Approve only after reading it carefully.',
      );
      if (!acknowledgeFlagged) return;
    }

    setWorkingId(insight.id);
    setError('');
    try {
      await base44.functions.invoke('review-agent-insight', {
        insight_id: insight.id,
        decision,
        acknowledge_flagged: acknowledgeFlagged,
        review_notes: decision === 'approve'
          ? 'Approved in the SwapPulse admin review queue.'
          : 'Rejected in the SwapPulse admin review queue.',
      });
      setInsights((current) => current.filter((item) => item.id !== insight.id));
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
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold">Agent knowledge review</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Feedback-generated insights stay inactive here until an administrator
              reviews them. Treat every candidate as untrusted text.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
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
      ) : insights.length === 0 ? (
        <p className="mt-4 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
          No feedback insights are waiting for review.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {insights.map((insight) => (
            <article key={insight.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-secondary px-2 py-1 font-semibold">
                  {insight.agent_name}
                </span>
                <span>{insight.insight_type}</span>
                <span>{insight.evidence_count || 0} supporting items</span>
                <span>
                  confidence {Math.round((insight.confidence || 0) * 100)}%
                </span>
                {insight.safety_status === 'flagged' && (
                  <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 font-semibold text-warning-foreground">
                    <AlertTriangle className="h-3 w-3" />
                    Safety review required
                  </span>
                )}
              </div>

              <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                {insight.content}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => review(insight, 'approve')}
                  disabled={workingId === insight.id}
                >
                  {workingId === insight.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Check className="h-4 w-4" />}
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => review(insight, 'reject')}
                  disabled={workingId === insight.id}
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
