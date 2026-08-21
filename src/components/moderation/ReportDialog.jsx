import React, { useState } from 'react';
import { Flag, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';

const REASONS = [
  { value: 'spam', labelKey: 'report.reason.spam.label', descKey: 'report.reason.spam.desc' },
  { value: 'scam', labelKey: 'report.reason.scam.label', descKey: 'report.reason.scam.desc' },
  { value: 'harassment', labelKey: 'report.reason.harassment.label', descKey: 'report.reason.harassment.desc' },
  { value: 'nsfw', labelKey: 'report.reason.nsfw.label', descKey: 'report.reason.nsfw.desc' },
  { value: 'off_topic', labelKey: 'report.reason.off_topic.label', descKey: 'report.reason.off_topic.desc' },
  { value: 'misgraded', labelKey: 'report.reason.misgraded.label', descKey: 'report.reason.misgraded.desc' },
  { value: 'impersonation', labelKey: 'report.reason.impersonation.label', descKey: 'report.reason.impersonation.desc' },
  { value: 'other', labelKey: 'report.reason.other.label', descKey: 'report.reason.other.desc' },
];

export default function ReportDialog({ open, onOpenChange, contentType, contentId, contentPreview, authorHandle }) {
  const t = useT();
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
      base44.entities.AgentFeedback.create({
        agent_name: 'moderation_agent',
        feedback_type: 'correction',
        original_content: `User reported ${contentType} ${contentId} by @${authorHandle || 'unknown'}: "${preview}"`,
        corrected_content: `Report reason: ${reason}. Details: ${details.trim() || 'N/A'}`,
        context_summary: `Community report, ${reason}`,
        processed: false,
      }).catch((e) => console.error('ReportDialog: AgentFeedback log failed', e?.message));

      toast({ title: t('toast.reportSubmitted'), description: t('toast.reportSubmittedDesc') });
      setReason('');
      setDetails('');
      onOpenChange(false);
    } catch (e) {
      toast({ title: t('toast.reportFailed'), description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" /> {t('report.title')}
          </DialogTitle>
          <DialogDescription>
            {t('report.desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-semibold">{t('report.why')}</p>
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
                  <p className="font-bold">{t(r.labelKey)}</p>
                  <p className="text-muted-foreground">{t(r.descKey)}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold">{t('report.details')}</p>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t('report.detailsPlaceholder')}
              className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={submit} disabled={submitting || !reason}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
              {t('report.submit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}