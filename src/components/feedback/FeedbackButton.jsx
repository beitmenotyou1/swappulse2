import React, { useState } from 'react';
import { MessageSquare, X, Loader2, Send, Camera, Star, Lightbulb, Bug, MessageCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const CATEGORIES = [
  { id: 'suggestion', label: 'Suggestion', icon: Lightbulb, desc: 'A new feature idea', color: 'text-amber-500' },
  { id: 'bug', label: 'Bug Report', icon: Bug, desc: 'Something is broken', color: 'text-destructive' },
  { id: 'comment', label: 'Comment', icon: MessageCircle, desc: 'General thoughts', color: 'text-primary' },
];

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [category, setCategory] = useState('suggestion');
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
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
    setCategory('suggestion');
    setTitle('');
    setComment('');
    setRating(0);
    setHoverRating(0);
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
        category,
        title,
        comment,
        rating: rating || null,
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
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MessageSquare className="h-5 w-5 text-primary" /> Send feedback
              </h2>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-secondary" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Category selector */}
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">What kind of feedback?</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => {
                    const Icon = c.icon;
                    const active = category === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id)}
                        className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors ${
                          active
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-background hover:bg-secondary/50'
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${active ? c.color : 'text-muted-foreground'}`} />
                        <span className="text-xs font-semibold">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {CATEGORIES.find((c) => c.id === category)?.desc}
                </p>
              </div>

              {/* Title */}
              <div className="mb-4">
                <label htmlFor="feedback-title" className="mb-2 block text-sm font-medium">
                  Title <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="feedback-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Summarise your feedback in a few words"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              {/* Rating */}
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">
                  Rate your experience <span className="text-muted-foreground">(optional)</span>
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="rounded p-0.5 transition-transform hover:scale-110"
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={`h-7 w-7 ${(hoverRating || rating) >= n ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-2 text-sm text-muted-foreground">{rating}/5</span>
                  )}
                </div>
              </div>

              {/* Comment */}
              <div className="mb-4">
                <label htmlFor="feedback-comment" className="mb-2 block text-sm font-medium">
                  Comments <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="feedback-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  maxLength={5000}
                  placeholder="Tell us more about your experience, what you'd like to see, or what went wrong…"
                  className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">{comment.length}/5000</p>
              </div>

              {/* Snapshot */}
              <div>
                <label className="mb-2 block text-sm font-medium">Page snapshot</label>
                <div className="overflow-hidden rounded-xl border border-border bg-secondary/50">
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
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border p-4">
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