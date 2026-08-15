import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Loader2, Send, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { createLike, deleteLike, createReply } from '@/lib/postInteractions';

// Inline Like + Reply actions shown on like/repost/comment notification cards.
// Both create real federated records against the triggering post (resolved via
// metadata.postId), so the response appears on SwapPulse and Bluesky and the
// original actor is notified in turn.
export default function InteractionActions({ n, onResponded }) {
  const { user } = useAuth();
  const postId = n?.metadata?.postId;
  const isInteraction = ['like', 'repost', 'comment'].includes(n?.action_type);
  const [busy, setBusy] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeId, setLikeId] = useState(null);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);

  // Check whether the current user already liked the triggering post.
  useEffect(() => {
    if (!isInteraction || !postId || !user?.id) return;
    let alive = true;
    (async () => {
      try {
        const likes = await base44.entities.Like.filter({ post_id: postId }, '-created_date', 50);
        const mine = likes.find((l) => l.created_by_id === user.id);
        if (alive && mine) { setLiked(true); setLikeId(mine.id); }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [postId, user?.id, isInteraction]);

  if (!isInteraction || !postId || !user?.id) return null;

  const toggleLike = async (e) => {
    e?.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const post = await base44.entities.Post.get(postId).catch(() => null);
      if (!post) return;
      if (liked && likeId) {
        const l = await base44.entities.Like.get(likeId).catch(() => null);
        await deleteLike(l, post);
        setLiked(false);
        setLikeId(null);
      } else {
        const created = await createLike(post);
        setLiked(true);
        setLikeId(created.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const submitReply = async (e) => {
    e?.stopPropagation();
    const trimmed = replyText.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      const post = await base44.entities.Post.get(postId).catch(() => null);
      if (post) await createReply(post, trimmed, user);
      setReplyText('');
      setShowReply(false);
      onResponded?.();
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={toggleLike}
        disabled={busy}
        aria-label="Like the post"
        aria-pressed={liked}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${liked ? 'border-red-200 bg-red-50 text-red-500 dark:border-red-900/50 dark:bg-red-950/30' : 'border-border bg-card hover:bg-secondary'}`}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Heart className={`h-3.5 w-3.5 ${liked ? 'fill-current' : ''}`} />}
        {liked ? 'Liked' : 'Like'}
      </button>
      <button
        onClick={() => setShowReply((v) => !v)}
        aria-label="Reply to the post"
        aria-pressed={showReply}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${showReply ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-secondary'}`}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Reply
      </button>
      {showReply && (
        <div className="mt-2 w-full">
          <div className="relative">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
              placeholder="Write a reply…"
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              onClick={() => { setShowReply(false); setReplyText(''); }}
              className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-secondary"
              aria-label="Cancel reply"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
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
    </div>
  );
}