import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Brain } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useT } from '@/lib/i18n/I18nProvider';

const TRIGGER_LABELS = {
  high_value: 'High Value',
  low_confidence: 'Low Confidence',
  evidence_conflict: 'Evidence Conflict',
  new_party: 'New Party',
  repeat_offender: 'Repeat Offender',
  novel_pattern: 'Novel Pattern',
};

const TRIGGER_STYLES = {
  high_value: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low_confidence: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  evidence_conflict: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  new_party: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  repeat_offender: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  novel_pattern: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
};

const DECISION_LABELS = {
  release: 'Release to Seller',
  refund: 'Refund to Buyer',
  cancel: 'Cancel Escrow',
  hide: 'Hide Content',
  warn: 'Warn User',
  dismiss: 'Dismiss',
  allow: 'Allow',
  escalate: 'Escalated',
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function RiskScoreBadge({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color = pct >= 75 ? 'text-red-600 dark:text-red-400' : pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative h-12 w-12">
        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
          <circle
            cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
            strokeDasharray={`${pct * 0.94} 100`}
            className={color}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${color}`}>{pct}</span>
      </div>
      <span className="text-xs font-semibold text-muted-foreground">Risk</span>
    </div>
  );
}

export default function ManualReviewQueue() {
  const t = useT();
  const { toast } = useToast();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [adminDecision, setAdminDecision] = useState(null);
  const [overrideDirection, setOverrideDirection] = useState('');
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('moderation-review', { op: 'list' });
      setCases(res.cases || []);
    } catch (e) {
      console.error('load review queue failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = base44.entities.ModerationDecisionLog.subscribe(() => { load(); });
    return unsub;
  }, [load]);

  const openReview = (c, decision) => {
    setReviewing(c);
    setAdminDecision(decision);
    setOverrideDirection(decision === 'overridden' ? c.agent_decision === 'release' ? 'refund' : 'release' : '');
    setRationale('');
  };

  const submitReview = async () => {
    if (!reviewing || !adminDecision) return;
    if (adminDecision === 'overridden' && !rationale.trim()) {
      toast({ title: 'Rationale required', description: 'Your override rationale becomes learning data for the agent.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await base44.functions.invoke('moderation-review', {
        op: 'review',
        decision_log_id: reviewing.id,
        admin_decision: adminDecision,
        admin_override_direction: adminDecision === 'overridden' ? overrideDirection : '',
        admin_rationale: rationale.trim(),
      });
      toast({
        title: adminDecision === 'confirmed' ? 'Agent decision confirmed' : 'Decision overridden',
        description: adminDecision === 'overridden' ? 'The override and your rationale have been logged for the learning loop.' : 'The agent\'s decision has been executed.',
      });
      setReviewing(null);
      setAdminDecision(null);
      setOverrideDirection('');
      setRationale('');
      load();
    } catch (e) {
      toast({ title: 'Review failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (cases.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        <Brain className="mx-auto mb-2 h-8 w-8 text-success" />
        <p className="font-semibold text-foreground">No cases pending manual review</p>
        <p className="mt-1 text-xs">The agent is handling all cases autonomously within safe thresholds.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2">
        <Brain className="h-4 w-4 text-primary" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{cases.length}</span> case{cases.length !== 1 ? 's' : ''} escalated by the agent. Review the evidence, then confirm or override — your decision trains the agent.
        </p>
      </div>

      <div className="space-y-3">
        {cases.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold uppercase text-muted-foreground">
                    {c.case_type.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(c.created_date)}</span>
                </div>
                <p className="mt-1.5 text-sm">
                  <span className="font-semibold">Agent recommendation:</span>{' '}
                  <span className="text-primary font-semibold">{DECISION_LABELS[c.agent_decision] || c.agent_decision}</span>
                </p>
              </div>
              <RiskScoreBadge score={c.risk_score} />
            </div>

            {c.triggers_fired?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.triggers_fired.map((trig) => (
                  <span key={trig} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TRIGGER_STYLES[trig] || 'bg-secondary text-muted-foreground'}`}>
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    {TRIGGER_LABELS[trig] || trig}
                  </span>
                ))}
              </div>
            )}

            {c.agent_reasoning && (
              <div className="mt-3 rounded-lg bg-secondary/50 px-3 py-2">
                <p className="text-xs font-semibold text-muted-foreground">Agent reasoning</p>
                <p className="mt-0.5 text-sm">{c.agent_reasoning}</p>
              </div>
            )}

            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              <Button size="sm" onClick={() => openReview(c, 'confirmed')} className="bg-success text-white hover:bg-success/90">
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={() => openReview(c, 'overridden')}>
                <XCircle className="mr-1.5 h-4 w-4" /> Override
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!reviewing} onOpenChange={(v) => { if (!v) { setReviewing(null); setAdminDecision(null); setRationale(''); setOverrideDirection(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {adminDecision === 'confirmed' ? 'Confirm agent decision' : 'Override agent decision'}
            </DialogTitle>
            <DialogDescription>
              {adminDecision === 'confirmed'
                ? `The agent recommended "${DECISION_LABELS[reviewing?.agent_decision] || reviewing?.agent_decision}". Confirming will execute this decision.`
                : 'Override the agent\'s decision. Your rationale is required and becomes learning data for the agent.'}
            </DialogDescription>
          </DialogHeader>

          {adminDecision === 'overridden' && reviewing?.case_type === 'escrow_dispute' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">Override direction</label>
              <select
                value={overrideDirection}
                onChange={(e) => setOverrideDirection(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="release">Release to Seller</option>
                <option value="refund">Refund to Buyer</option>
                <option value="cancel">Cancel Escrow</option>
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold">
              {adminDecision === 'overridden' ? 'Override rationale (required)' : 'Notes (optional)'}
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value.slice(0, 1000))}
              placeholder={adminDecision === 'overridden' ? 'Explain why you are overriding the agent. This trains the learning loop.' : 'Optional notes…'}
              rows={4}
              className="w-full resize-none rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setReviewing(null); setAdminDecision(null); setRationale(''); setOverrideDirection(''); }} disabled={busy}>Cancel</Button>
            <Button
              onClick={submitReview}
              disabled={busy || (adminDecision === 'overridden' && !rationale.trim())}
              className={adminDecision === 'confirmed' ? 'bg-success text-white hover:bg-success/90' : ''}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {adminDecision === 'confirmed' ? 'Confirm & Execute' : 'Override & Execute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}