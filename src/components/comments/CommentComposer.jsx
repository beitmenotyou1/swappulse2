import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, X, CornerDownRight } from 'lucide-react';

const MAX_LEN = 500;

export default function CommentComposer({ cardId, cardName, cardImage, user, replyTarget, onCancelReply, onPosted }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (replyTarget && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTarget]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError('');
    try {
      // Depth-2: if replying to a reply, re-parent to the top-level comment
      let replyTo = replyTarget?.id || null;
      if (replyTarget?.reply_to) {
        replyTo = replyTarget.reply_to; // re-parent to top-level
      }

      const post = await base44.entities.Post.create({
        content: trimmed,
        post_type: 'text',
        card_id: cardId,
        card_name: cardName || '',
        card_image: cardImage || '',
        reply_to: replyTo,
        author_name: user?.full_name || 'Collector',
        author_handle: user?.handle || '',
        author_avatar: user?.avatar_url || '',
      });

      // Run auto-mod on the new comment (non-blocking — labels apply async)
      base44.functions
        .invoke('autoModerateComment', { post_id: post.id })
        .catch(() => {});

      setText('');
      onCancelReply?.();
      onPosted?.();
    } catch (e) {
      setError(e?.message || 'Could not post comment');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      {replyTarget && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CornerDownRight className="h-3.5 w-3.5" />
            Replying to <strong className="text-foreground">{replyTarget.author_name || 'collector'}</strong>
          </span>
          <button onClick={onCancelReply} className="rounded p-0.5 hover:bg-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
        onKeyDown={onKeyDown}
        placeholder={replyTarget ? 'Write a reply…' : 'Share your thoughts on this card…'}
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {text.length}/{MAX_LEN}
        </span>
        <button
          onClick={submit}
          disabled={!text.trim() || busy}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}