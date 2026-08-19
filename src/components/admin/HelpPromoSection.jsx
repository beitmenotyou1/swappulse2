import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, SkipForward, RotateCcw, BookOpen, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function HelpPromoSection() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('post-help-promo', { op: 'status' });
      setStatus(res.data);
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.error || e.message || 'Failed to load status' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handlePost = async () => {
    setActing(true);
    setMsg(null);
    try {
      const res = await base44.functions.invoke('post-help-promo', { op: 'post' });
      setMsg({ type: 'success', text: `Posted "${res.data?.article?.title}" to Bluesky` });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.error || e.message || 'Failed to post' });
    } finally {
      setActing(false);
    }
  };

  const handleSkip = async () => {
    setActing(true);
    setMsg(null);
    try {
      const res = await base44.functions.invoke('post-help-promo', { op: 'skip' });
      setMsg({ type: 'success', text: `Skipped to index ${res.data?.current_index}` });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.error || e.message || 'Failed to skip' });
    } finally {
      setActing(false);
    }
  };

  const handleReset = async () => {
    setActing(true);
    setMsg(null);
    try {
      await base44.functions.invoke('post-help-promo', { op: 'reset' });
      setMsg({ type: 'success', text: 'Cursor reset to 0' });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.error || e.message || 'Failed to reset' });
    } finally {
      setActing(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Help Article Promo Rotation</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : status ? (
        <div className="space-y-4">
          {/* Current position */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-secondary/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Index</p>
              <p className="mt-1 text-lg font-bold">{status.cursor?.current_index ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Articles</p>
              <p className="mt-1 text-lg font-bold">{status.total_articles}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-border bg-secondary/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Posted</p>
              <p className="mt-1 truncate text-sm font-bold">{status.cursor?.last_posted_slug || 'None yet'}</p>
              {status.cursor?.last_posted_at && (
                <p className="text-xs text-muted-foreground">{new Date(status.cursor.last_posted_at).toLocaleString()}</p>
              )}
            </div>
          </div>

          {/* Current & next article */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Up Next</p>
              <p className="mt-1 text-sm font-bold">{status.current_article?.title}</p>
              <p className="text-xs text-muted-foreground">{status.current_article?.category}</p>
              <p className="mt-1 text-xs text-muted-foreground">{status.current_article?.description}</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">After That</p>
              <p className="mt-1 text-sm font-bold">{status.next_article?.title}</p>
              <p className="text-xs text-muted-foreground">{status.next_article?.category}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handlePost} disabled={acting}>
              <RefreshCw className="h-4 w-4" /> Post now
            </Button>
            <Button size="sm" variant="outline" onClick={handleSkip} disabled={acting}>
              <SkipForward className="h-4 w-4" /> Skip
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset} disabled={acting}>
              <RotateCcw className="h-4 w-4" /> Reset to 0
            </Button>
          </div>

          {msg && (
            <div className={`rounded-lg px-3 py-2 text-sm ${
              msg.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
            }`}>
              {msg.text}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            The rotation posts one help article to the SwapPulse Bluesky account every 8 hours, cycling through all guides in order. Posts are tracked so they appear on Bluesky but not the local feed.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Failed to load rotation status.</p>
      )}
    </section>
  );
}