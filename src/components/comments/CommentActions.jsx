import React, { useState, useEffect } from 'react';
import { Heart, Repeat2, MessageCircle, Loader2, Send, X, Quote, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  createLike, deleteLike, createRepost, deleteRepost,
  createReply, createQuoteRepost, deleteReply, normalizeRef,
} from '@/lib/postInteractions';
import { loadViewerLikes, isLikedByViewer, getViewerLike, setViewerLiked, unsetViewerLiked } from '@/lib/viewerLikes';

const MAX_LEN = 500;

// Shared Like + Repost (with direct/quote menu) + Reply actions for comments.
// Works for both local Post comments (has .id) and external Bluesky strongRefs
// ({ at_uri, cid, did, content }). When onReply is provided (card comments),
// the Reply button delegates to the parent's composer; otherwise an inline
// reply composer is shown. The quote composer opens inline beneath the row.
export default function CommentActions({ comment, onReply, onPosted, compact = false }) {
  const { user } = useAuth();
  const ref = normalizeRef(comment);
  const isLocal = !!comment?.id;
  const [liked, setLiked] = useState(false);
  const [likeId, setLikeId] = useState(null);
  const [reposted, setReposted] = useState(false);
  const [repostId, setRepostId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [quotePosting, setQuotePosting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch existing like + repost state for this comment.
  useEffect(() => {
    if (!user?.id || !ref) return;
    let alive = true;
    (async () => {
      try {
        const filter = isLocal ? { post_id: comment.id } : { post_uri: ref.at_uri };
        const [likes, reposts] = await Promise.all([
          base44.entities.Like.filter({ ...filter, created_by_id: user.id }, '-created_date', 5).catch(() => []),
          base44.entities.Repost.filter({ ...filter, created_by_id: user.id }, '-created_date', 5).catch(() => []),
        ]);
        // Also check PDS viewer-state for likes made directly on bsky.app.
        await loadViewerLikes();
        if (!alive) return;
        if (likes[0]) { setLiked(true); setLikeId(likes[0].id); }
        else if (ref.at_uri && isLikedByViewer(ref.at_uri)) { setLiked(true); }
        if (reposts[0]) { setReposted(true); setRepostId(reposts[0].id); }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [comment?.id, ref?.at_uri, user?.id]);

  if (!user?.id || !ref || (!ref.at_uri && !ref.id)) return null;

  const toggleLike = async (e) => {
    e?.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (liked && likeId) {
        setLiked(false);
        const l = await base44.entities.Like.get(likeId).catch(() => null);
        await deleteLike(l, comment);
        setLikeId(null);
        unsetViewerLiked(ref.at_uri);
      } else if (liked && !likeId && ref.at_uri) {
        // PDS-only like (made on bsky.app) — delete via bridge.
        setLiked(false);
        const viewerLike = getViewerLike(ref.at_uri);
        if (viewerLike?.likeUri) {
          base44.functions.invoke('atproto-bridge', { action: 'delete', uri: viewerLike.likeUri }).catch(() => {});
        }
        unsetViewerLiked(ref.at_uri);
      } else {
        setLiked(true);
        const created = await createLike(comment);
        setLikeId(created.id);
        setViewerLiked(ref.at_uri, created.at_uri, created.cid);
      }
    } finally {
      setBusy(false);
    }
  };

  const doRepost = async (e) => {
    e?.stopPropagation();
    setRepostOpen(false);
    if (busy) return;
    setBusy(true);
    try {
      if (reposted && repostId) {
        setReposted(false);
        const r = await base44.entities.Repost.get(repostId).catch(() => null);
        await deleteRepost(r, comment);
        setRepostId(null);
      } else {
        setReposted(true);
        const created = await createRepost(comment);
        setRepostId(created.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const openQuote = (e) => {
    e?.stopPropagation();
    setRepostOpen(false);
    setQuoteOpen(true);
  };

  const submitQuote = async (e) => {
    e?.stopPropagation();
    const trimmed = quoteText.trim();
    if (!trimmed || quotePosting) return;
    setQuotePosting(true);
    try {
      await createQuoteRepost(comment, trimmed, user);
      setQuoteText('');
      setQuoteOpen(false);
      onPosted?.();
    } finally {
      setQuotePosting(false);
    }
  };

  const submitReply = async (e) => {
    e?.stopPropagation();
    const trimmed = replyText.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    setReplyError('');
    try {
      await createReply(comment, trimmed, user);
      setReplyText('');
      setShowReply(false);
      onPosted?.();
    } catch (err) {
      setReplyError(err?.message || 'Could not post reply');
    } finally {
      setPosting(false);
    }
  };

  const handleReplyClick = (e) => {
    e?.stopPropagation();
    if (onReply) {
      onReply(comment);
    } else {
      setShowReply((v) => !v);
    }
  };

  const isAuthor = !!user?.id && !!comment?.id && (comment.created_by_id === user.id || (!!user.did && comment.did === user.did));

  const handleDelete = async (e) => {
    e?.stopPropagation();
    if (deleting || !isAuthor) return;
    if (!window.confirm('Delete this comment? This removes it from SwapPulse and Bluesky.')) return;
    setDeleting(true);
    try {
      await deleteReply(comment, null);
      onPosted?.();
    } finally {
      setDeleting(false);
    }
  };

  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnBase = 'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-40';

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleReplyClick}
          aria-label="Reply to comment"
          className={`${btnBase} text-muted-foreground hover:text-primary`}
        >
          <MessageCircle className={iconSize} /> Reply
        </button>

        <Popover open={repostOpen} onOpenChange={setRepostOpen}>
          <PopoverTrigger asChild>
            <button
              disabled={busy}
              aria-label="Repost comment"
              aria-pressed={reposted}
              className={`${btnBase} ${reposted ? 'text-emerald-500' : 'text-muted-foreground hover:text-emerald-500'}`}
            >
              <Repeat2 className={`${iconSize} ${reposted ? 'fill-current' : ''}`} /> Repost
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={doRepost}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-secondary"
            >
              <Repeat2 className="h-4 w-4" /> {reposted ? 'Undo repost' : 'Repost'}
            </button>
            <button
              onClick={openQuote}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-secondary"
            >
              <Quote className="h-4 w-4" /> Quote
            </button>
          </PopoverContent>
        </Popover>

        <button
          onClick={toggleLike}
          disabled={busy}
          aria-label="Like comment"
          aria-pressed={liked}
          className={`${btnBase} ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
        >
          {busy ? <Loader2 className={`${iconSize} animate-spin`} /> : <Heart className={`${iconSize} ${liked ? 'fill-current' : ''}`} />} Like
        </button>

        {isAuthor && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete comment"
            className={`${btnBase} text-muted-foreground hover:text-destructive`}
          >
            {deleting ? <Loader2 className={`${iconSize} animate-spin`} /> : <Trash2 className={iconSize} />} Delete
          </button>
        )}
      </div>

      {showReply && !onReply && (
        <div className="mt-1.5">
          <div className="relative">
            <textarea
              value={replyText}
              onChange={(e) => { setReplyText(e.target.value.slice(0, MAX_LEN)); setReplyError(''); }}
              placeholder="Write a reply…"
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              onClick={() => { setShowReply(false); setReplyText(''); setReplyError(''); }}
              className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-secondary"
              aria-label="Cancel reply"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {replyError && (
            <p className="mt-1 text-xs text-destructive">{replyError}</p>
          )}
          <button
            onClick={submitReply}
            disabled={!replyText.trim() || posting}
            className="mt-1.5 flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Post reply
          </button>
        </div>
      )}

      {quoteOpen && (
        <div className="mt-1.5">
          <div className="mb-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold">Quoting @{comment.author_handle || 'user'}:</span>{' '}
            <span className="italic">{(comment.content || '').slice(0, 120)}</span>
          </div>
          <div className="relative">
            <textarea
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value.slice(0, MAX_LEN))}
              placeholder="Add your commentary…"
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              onClick={() => { setQuoteOpen(false); setQuoteText(''); }}
              className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-secondary"
              aria-label="Cancel quote"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={submitQuote}
            disabled={!quoteText.trim() || quotePosting}
            className="mt-1.5 flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            {quotePosting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Post quote
          </button>
        </div>
      )}
    </div>
  );
}