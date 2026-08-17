import React, { useState } from 'react';
import { Flag, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';

const REASONS = [
  { value: 'spam', label: 'Spam', desc: 'Repeated low-effort or flooding' },
  { value: 'scam', label: 'Scam / Fraud', desc: 'Soliciting money, phishing, fake giveaways' },
  { value: 'harassment', label: 'Harassment', desc: 'Personal attacks or bullying' },
  { value: 'nsfw', label: 'NSFW', desc: 'Sexual or graphic content' },
  { value: 'off_topic', label: 'Off-topic', desc: 'Derailing discussions' },
  { value: 'misgraded', label: 'Misgraded card', desc: 'Deliberate condition misrepresentation' },
  { value: 'impersonation', label: 'Impersonation', desc: 'Pretending to be someone else' },
  { value: 'other', label: 'Other', desc: 'Something else' },
];

export default function ReportDialog({ open, onOpenChange, contentType, contentId, contentPreview, authorHandle }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    if (!reason || !contentId) return;
    setSubmitting(true);
    try {
      const preview = (contentPreview || '').slice(0, 500);
      await base44.entities.ContentReport.create({
        content_type: contentType || 'post',
        content_id: contentId,
        content_preview: preview,
        author_handle: authorHandle || '',
        reason,
        details: details.trim(),
        status: 'pending',
      });
      // Feed the report into the moderation agent's learning loop so the agent
      // learns what the community considers reportable. The daily learning loop
      // workflow processes this into AgentInsight records the agent reads.
      base44.entities.AgentFeedback.create({
        agent_name: 'moderation_agent',
        feedback_type: 'correction',
        original_content: `User reported ${contentType} ${contentId} by @${authorHandle || 'unknown'}: "${preview}"`,
        corrected_content: `Report reason: ${reason}. Details: ${details.trim() || 'N/A'}`,
        context_summary: `Community report, ${reason}`,
        processed: false,
      }).catch((e) => console.error('ReportDialog: AgentFeedback log failed', e?.message));

      toast({ title: 'Report submitted', description: 'Thank you, our moderation team will review it.' });
      setReason('');
      setDetails('');
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Could not submit report', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" /> Report content
          </DialogTitle>
          <DialogDescription>
            Help us keep SwapPulse safe. Reports are reviewed by our moderation team and help our AI agent learn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-semibold">Why are you reporting this?</p>
            <div className="grid grid-cols-2 gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`rounded-lg border p-2 text-left text-xs transition-colors ${
                    reason === r.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-secondary'
                  }`}
                >
                  <p className="font-bold">{r.label}</p>
                  <p className="text-muted-foreground">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold">Additional details (optional)</p>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Tell us more about what's wrong…"
              className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={submitting || !reason}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
              Submit report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}