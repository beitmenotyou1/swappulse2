import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, X, CornerDownRight } from 'lucide-react';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';

const MAX_LEN = 500;

// Build a card-mention facet for the bridged app.bsky.feed.post record.
// Appends the card name to the post text and facets that range with a custom
// org.swappulse.cardMention feature so SwapPulse-aware clients render a rich
// card chip, while plain Bluesky clients just see the card name in the text.
function buildCardFacet(text, card) {
  if (!card?.id && !card?.name) return { text, facets: undefined };
  const encoder = new TextEncoder();
  const separator = '\n\n';
  const suffix = card.name || '';
  const fullText = text + separator + suffix;
  const textBytes = encoder.encode(text).length;
  const sepBytes = encoder.encode(separator).length;
  const byteStart = textBytes + sepBytes;
  const byteEnd = byteStart + encoder.encode(suffix).length;
  return {
    text: fullText,
    facets: [{
      index: { byteStart, byteEnd },
      features: [{
        $type: 'org.swappulse.cardMention',
        cardId: card.id || '',
        cardName: card.name || '',
        cardUri: card.id ? `${window.location.origin}/card/${card.id}` : '',
      }],
    }],
  };
}

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

      // Stamp the local Post with AT Protocol metadata before persisting.
      const { did, signingKey } = await ensureUserDid();
      const parentUri = replyTarget?.at_uri || null;
      const parentCid = replyTarget?.cid || null;
      const rootUri = replyTarget?.root_uri || replyTarget?.at_uri || null;
      const rootCid = replyTarget?.root_cid || replyTarget?.cid || null;
      const stamped = await stampRecord({
        content: trimmed,
        post_type: 'text',
        card_id: cardId,
        card_name: cardName || '',
        card_image: cardImage || '',
        reply_to: replyTo,
        parent_uri: parentUri,
        parent_cid: parentCid,
        root_uri: rootUri,
        root_cid: rootCid,
        author_name: user?.full_name || 'Collector',
        author_handle: user?.handle || '',
        author_avatar: user?.avatar_url || '',
        likes: 0,
        reposts: 0,
        replies: 0,
      }, NSID.POST, did, signingKey);
      const post = await base44.entities.Post.create(stamped);

      // Run auto-mod on the new comment (non-blocking — labels apply async)
      base44.functions
        .invoke('autoModerateComment', { post_id: post.id })
        .catch(() => {});

      // Bridge to the PDS as a real app.bsky.feed.post so the comment federates.
      // Includes a card-mention facet and a reply ref when replying to a bridged post.
      if (post?.id) {
        const card = { id: cardId, name: cardName };
        const { text: bridgedText, facets } = buildCardFacet(trimmed, card);
        const replyRef = parentUri && parentCid && rootUri && rootCid
          ? { root: { uri: rootUri, cid: rootCid }, parent: { uri: parentUri, cid: parentCid } }
          : undefined;
        base44.functions.invoke('atproto-bridge', {
          collection: 'app.bsky.feed.post',
          record: {
            text: bridgedText.slice(0, 3000),
            createdAt: new Date().toISOString(),
            langs: ['en'],
            ...(facets ? { facets } : {}),
            ...(replyRef ? { reply: replyRef } : {}),
          },
        }).then((res) => {
          if (res?.uri) base44.entities.Post.update(post.id, { at_uri: res.uri, cid: res.cid, bridged: true }).catch(() => {});
        }).catch(() => {});
      }

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