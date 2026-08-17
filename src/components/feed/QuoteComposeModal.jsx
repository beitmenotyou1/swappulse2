import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Loader2 } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/lib/AuthContext';
import { createQuoteRepost } from '@/lib/postInteractions';
import { isBotBlockError } from '@/lib/botGuardClient';
import QuotedPostCard from '@/components/feed/QuotedPostCard';
import CardAttachBar from '@/components/feed/CardAttachBar';
import VisibilityControls from '@/components/feed/VisibilityControls';
import { base44 } from '@/api/base44Client';
import { extractHashtags, canonicalise } from '@/lib/hashtags';

const MAX_LEN = 300;

function extractMentions(text) {
  const matches = text.match(/@([\w.]+)/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

// Quote compose sheet: layers commentary over an embedded original post.
// Reuses the visibility + reply-policy selectors and hashtag/mention parsing
// from ComposeBox, then calls createQuoteRepost (local Post + PDS embed bridge).
// `onPosted` receives the created quote post so the caller can navigate or
// refresh the feed.
export default function QuoteComposeModal({ open, onClose, targetPost, onPosted }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [replyPolicy, setReplyPolicy] = useState('everybody');
  const [visibilityScope, setVisibilityScope] = useState('public');
  const [attachedCard, setAttachedCard] = useState(null);

  if (!open) return null;

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting || !user?.id) return;
    setPosting(true);
    setError('');
    try {
      const hashtags = extractHashtags(trimmed).slice(0, 10);
      const canonical_tags = canonicalise(hashtags);
      let mentionedDids = [];
      if (visibilityScope === 'mentioned') {
        const handles = extractMentions(trimmed);
        if (handles.length) {
          const results = await Promise.all(
            handles.map((h) =>
              base44.functions.invoke('resolve-atproto-actor', { handle: h })
                .then((r) => r?.data?.did || r?.did || '')
                .catch(() => '')
            )
          );
          mentionedDids = results.filter(Boolean);
        }
      }
      const created = await createQuoteRepost(targetPost, trimmed, user, {
        visibility_scope: visibilityScope,
        reply_policy: replyPolicy,
        hashtags,
        canonical_tags,
        mentioned_dids: mentionedDids,
        card_id: attachedCard?.id || '',
        card_name: attachedCard?.name || '',
        card_image: attachedCard?.image || '',
        card_rarity: attachedCard?.rarity || '',
        set_name: attachedCard?.set?.name || '',
      });
      setText('');
      setAttachedCard(null);
      onClose?.();
      if (onPosted) {
        onPosted(created);
      } else if (created?.id) {
        navigate(`/post/${created.id}`);
      }
    } catch (e) {
      if (isBotBlockError(e)) setError(e.message);
      else setError(e?.message || 'Could not post quote');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-background p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Quote Post</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-3">
          <Avatar name={user?.display_name || user?.full_name} src={user?.avatar} size={40} />
          <div className="flex-1">
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value.slice(0, MAX_LEN)); setError(''); }}
              rows={3}
              autoFocus
              placeholder="Add your commentary…"
              className="w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <div className={`mt-1 text-right text-xs ${MAX_LEN - text.length < 20 ? 'text-destructive' : MAX_LEN - text.length < 50 ? 'text-warning' : 'text-muted-foreground'}`}>
              {MAX_LEN - text.length} left
            </div>

            <VisibilityControls
              replyPolicy={replyPolicy}
              setReplyPolicy={setReplyPolicy}
              visibilityScope={visibilityScope}
              setVisibilityScope={setVisibilityScope}
            />

            <CardAttachBar value={attachedCard} onChange={setAttachedCard} />

            <div className="mt-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Quoting</p>
              <QuotedPostCard quoteOfId={targetPost?.id} quoteRef={targetPost?.at_uri} />
            </div>

            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

            <div className="mt-3 flex justify-end">
              <button
                onClick={submit}
                disabled={posting || !text.trim()}
                className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Quote
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}