import React, { useState } from 'react';
import { MessageSquare, X, Loader2, Send, Camera } from 'lucide-react';
import html2canvas from 'html2canvas';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const capture = async () => {
    setCapturing(true);
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        backgroundColor: null,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        logging: false,
      });
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png', 0.8));
      if (!blob) throw new Error('capture failed');
      const file = new File([blob], 'feedback.png', { type: 'image/png' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setScreenshotUrl(file_url || '');
    } catch {
      setScreenshotUrl('');
    } finally {
      setCapturing(false);
    }
  };

  const start = async () => {
    setComment('');
    setScreenshotUrl('');
    setOpen(true);
    await capture();
  };

  const submit = async () => {
    if (!comment.trim()) {
      toast({ title: 'Add a comment', description: 'Tell us what you noticed.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await base44.functions.invoke('submit-feedback', {
        comment,
        page: window.location.pathname,
        screenshotUrl,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      });
      toast({ title: 'Feedback sent', description: 'Thanks - our team will review it.' });
      setOpen(false);
    } catch (e) {
      toast({ title: 'Could not send feedback', description: e?.message || 'Please try again later.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={start}
        aria-label="Send feedback"
        className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 rotate-180 items-center gap-2 rounded-l-xl bg-primary px-3 py-3 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary/90 [writing-mode:vertical-rl] md:flex"
      >
        <MessageSquare className="h-4 w-4" /> Feedback
      </button>

      {/* Mobile FAB */}
      <button
        onClick={start}
        aria-label="Send feedback"
        className="fixed bottom-36 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 md:hidden"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => !submitting && setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MessageSquare className="h-5 w-5 text-primary" /> Send feedback
              </h2>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-secondary" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-3 text-sm text-muted-foreground">
              We captured a snapshot of this page to help us see what you see. Add your comments below.
            </p>

            <div className="mb-3 overflow-hidden rounded-xl border border-border bg-secondary/50">
              {capturing ? (
                <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Capturing page…
                </div>
              ) : screenshotUrl ? (
                <img src={screenshotUrl} alt="Page snapshot" className="max-h-48 w-full object-top object-contain" />
              ) : (
                <div className="flex h-40 flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
                  <Camera className="h-6 w-6" />
                  Snapshot unavailable - your comments still help.
                </div>
              )}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="What did you spot? A bug, a confusing bit, a feature wish…"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />

            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || capturing}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}