import React, { useState, useEffect } from 'react';
import { Heart, Repeat2, MessageCircle, Loader2, Send, X, Quote } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { createLike, deleteLike, createRepost, deleteRepost, createReply, createQuotePost } from '@/lib/postInteractions';

// Reusable Like + Repost (direct + quote) + Reply action bar for any comment
// surface (card discussions, post reply threads, notification cards). Works
// with both internal comments (local Post records with id/at_uri/cid) and
// external Bluesky-origin comments (at_uri/cid only, no local id) by
// normalising into a ref that the federated interaction helpers accept.
export default function CommentActionBar({ comment, user, compact = false, onPosted }) {
  const { user: me } = useAuth();
  const currentUser = user || me;
  const [liked, setLiked] = useState(false);
  const [likeId, setLikeId] = useState(null);
  const [reposted, setReposted] = useState(false);
  const [repostId, setRepostId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [posting, setPosting] = useState(false);

  // Normalise: internal comments have a local id; external comments have
  // at_uri/cid only. The ref shape is what createLike/createRepost/createReply
  // expect — { id, at_uri, cid, bridged, did, content, likes, reposts, replies,
  // root_uri, root_cid }. For external comments we synthesise bridged=true so
  // the PDS bridge fires against the real Bluesky record.
  const isInternal = !!comment?.id;
  const ref = isInternal
    ? comment
    : {
        id: '',
        bridged: true,
        at_uri: comment?.at_uri || '',
        cid: comment?.cid || '',
        did: comment?.did || '',
        content: comment?.content || '',
        likes: 0, reposts: 0, replies: 0,
        root_uri: comment?.root_uri || comment?.at_uri || '',
        root_cid: comment?.root_cid || comment?.cid || '',
      };

  const atUri = ref.at_uri;

  // Check existing like/repost state by at_uri (works for both internal and
  // external — Like/Repost entities store post_uri for remote-originated ones).
  useEffect(() => {
    if (!currentUser?.id || !atUri) return;
    let alive = true;
    (async () => {
      try {
        const [likes, reposts] = await Promise.all([
          base44.entities.Like.filter({ post_uri: atUri }, '-created_date', 50).catch(() => []),
          base44.entities.Repost.filter({ post_uri: atUri }, '-created_date', 50).catch(() => []),
        ]);
        if (!alive) return;
        const myLike = likes.find((l) => l.created_by_id === currentUser.id);
        const myRepost = reposts.find((r) => r.created_by_id === currentUser.id);
        if (myLike) { setLiked(true); setLikeId(myLike.id); }
        if (myRepost) { setReposted(true); setRepostId(myRepost.id); }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [currentUser?.id, atUri]);

  if (!currentUser?.id || !atUri) return null;

  const toggleLike = async (e) => {
    e?.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (liked && likeId) {
        setLiked(false);
        const l = await base44.entities.Like.get(likeId).catch(() => null);
        await deleteLike(l, ref);
        setLikeId(null);
      } else {
        setLiked(true);
        const created = await createLike(ref);
        setLikeId(created.id);
      }
    } finally { setBusy(false); }
  };

  const doRepost = async (e) => {
    e?.stopPropagation();
    if (busy) return;
    setBusy(true);
    setShowRepostMenu(false);
    try {
      if (reposted && repostId) {
        setReposted(false);
        const r = await base44.entities.Repost.get(repostId).catch(() => null);
        await deleteRepost(r, ref);
        setRepostId(null);
      } else {
        setReposted(true);
        const created = await createRepost(ref);
        setRepostId(created.id);
      }
    } finally { setBusy(false); }
  };

  const submitReply = async (e) => {
    e?.stopPropagation();
    const trimmed = replyText.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      await createReply(ref, trimmed, currentUser);
      setReplyText('');
      setShowReply(false);
      onPosted?.();
    } finally { setPosting(false); }
  };

  const submitQuote = async (e) => {
    e?.stopPropagation();
    const trimmed = quoteText.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      await createQuotePost(ref, trimmed, currentUser);
      setQuoteText('');
      setShowQuote(false);
      onPosted?.();
    } finally { setPosting(false); }
  };

  const btn = compact ? 'px-1.5 py-0.5 text-[11px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5';
  const iconSize = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-0.5">
        <button
          onClick={toggleLike}
          disabled={busy}
          aria-label="Like"
          aria-pressed={liked}
          className={`flex items-center rounded-full transition-colors disabled:opacity-50 ${btn} ${liked ? 'text-red-500' : 'text-muted-foreground hover:bg-red-500/10 hover:text-red-500'}`}
        >
          {busy ? <Loader2 className={`${iconSize} animate-spin`} /> : <Heart className={`${iconSize} ${liked ? 'fill-current' : ''}`} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowRepostMenu((v) => !v)}
            aria-label="Repost"
            aria-pressed={reposted}
            className={`flex items-center rounded-full transition-colors ${btn} ${reposted ? 'text-emerald-500' : 'text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500'}`}
          >
            <Repeat2 className={`${iconSize} ${reposted ? 'fill-current' : ''}`} />
          </button>
          {showRepostMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowRepostMenu(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 flex flex-col rounded-lg border border-border bg-popover p-1 shadow-raised">
                <button
                  onClick={doRepost}
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  <Repeat2 className="h-3.5 w-3.5" /> {reposted ? 'Undo repost' : 'Repost'}
                </button>
                <button
                  onClick={() => { setShowRepostMenu(false); setShowQuote(true); }}
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  <Quote className="h-3.5 w-3.5" /> Quote
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setShowReply((v) => !v)}
          aria-label="Reply"
          aria-pressed={showReply}
          className={`flex items-center rounded-full transition-colors ${btn} ${showReply ? 'text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}
        >
          <MessageCircle className={iconSize} />
        </button>
      </div>

      {showReply && (
        <div className="mt-2">
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

      {showQuote && (
        <div className="mt-2">
          <div className="mb-1.5 rounded-lg border-l-2 border-primary bg-secondary px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{comment?.author_name || 'Collector'}</span>
            <p className="mt-0.5 line-clamp-2">{comment?.content || ''}</p>
          </div>
          <div className="relative">
            <textarea
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value.slice(0, 500))}
              placeholder="Add your commentary…"
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              onClick={() => { setShowQuote(false); setQuoteText(''); }}
              className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-secondary"
              aria-label="Cancel quote"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={submitQuote}
            disabled={!quoteText.trim() || posting}
            className="mt-1.5 flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Post quote
          </button>
        </div>
      )}
    </div>
  );
}