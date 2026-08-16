import React, { useState } from 'react';
import { Image, Sparkles, ArrowLeftRight, Send, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';
import CardSearchModal from '@/components/cards/CardSearchModal';
import { cardImageUrl } from '@/lib/tcgdex';
import { useAuth } from '@/lib/AuthContext';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { dispatchCrossPost } from '@/lib/crosspost';
import { ensureBotAllowed, isBotBlockError } from '@/lib/botGuardClient';

function extractHashtags(text) {
  const matches = text.match(/#([\p{L}\p{N}_]+)/gu) || [];
  return matches.map((m) => m.slice(1));
}
function canonicalise(tags) {
  const seen = new Set();
  const out = [];
  for (const t of tags) {
    const c = t.trim().toLowerCase();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

const POLICY_LABELS = { everybody: 'Everyone', followers: 'Followers', mentioned: 'Mentioned', nobody: 'No one' };

export default function ComposeBox({ onPosted, replyTo }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('text');
  const [attachedCard, setAttachedCard] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [replyPolicy, setReplyPolicy] = useState('everybody');

  const typeButtons = [
    { key: 'pack_opening', icon: Sparkles, label: 'Pack Pull' },
    { key: 'trade', icon: ArrowLeftRight, label: 'Trade' },
    { key: 'showcase', icon: Image, label: 'Showcase' },
  ];

  const handlePost = async () => {
    if (!content.trim() && !attachedCard) return;
    setPosting(true);
    try {
      await ensureBotAllowed('post', content);
      const { did, signingKey } = await ensureUserDid();
      const hashtags = extractHashtags(content).slice(0, 10);
      const canonical_tags = canonicalise(hashtags);
      // Federated reply threading — resolve parent/root refs for the bridge
      const parentUri = replyTo?.at_uri || null;
      const parentCid = replyTo?.cid || null;
      const rootUri = replyTo?.root_uri || replyTo?.at_uri || null;
      const rootCid = replyTo?.root_cid || replyTo?.cid || null;

      const stamped = await stampRecord({
        content: content.trim(),
        post_type: attachedCard ? postType : 'text',
        hashtags,
        canonical_tags,
        card_id: attachedCard?.id,
        card_name: attachedCard?.name,
        card_image: attachedCard?.image,
        card_rarity: attachedCard?.rarity,
        set_name: attachedCard?.set?.name,
        author_name: user?.display_name || user?.full_name,
        author_handle: user?.username || user?.bsky_handle || '',
        likes: 0,
        reposts: 0,
        replies: 0,
        reply_policy: replyPolicy,
        reply_to: replyTo?.id || null,
        parent_uri: parentUri,
        parent_cid: parentCid,
        root_uri: rootUri,
        root_cid: rootCid,
      }, NSID.POST, did, signingKey);
      const created = await base44.entities.Post.create(stamped);
      // Hashtag abuse labeler - evaluates the new post and attaches moderation labels.
      if (created?.id) {
        base44.functions.invoke('moderatePost', { post_id: created.id }).catch(() => {});
        // AT Protocol PDS bridge — mirror as a real app.bsky.feed.post on the federated network.
        const replyRef = parentUri && parentCid && rootUri && rootCid
          ? { root: { uri: rootUri, cid: rootCid }, parent: { uri: parentUri, cid: parentCid } }
          : undefined;
        base44.functions.invoke('atproto-bridge', {
          collection: 'app.bsky.feed.post',
          record: {
            text: (content.trim() || stamped.card_name || 'New SwapPulse post').slice(0, 3000),
            createdAt: new Date().toISOString(),
            langs: ['en'],
            ...(replyRef ? { reply: replyRef } : {}),
          },
        }).then((res) => {
          if (res?.uri) {
            base44.entities.Post.update(created.id, { at_uri: res.uri, cid: res.cid, bridged: true }).catch(() => {});
            // Bridge a postgate record for non-default reply policies.
            if (replyPolicy !== 'everybody') {
              const allowRules = replyPolicy === 'nobody'
                ? [{ $type: 'app.bsky.feed.postgate#disableRule' }]
                : replyPolicy === 'mentioned'
                ? [{ $type: 'app.bsky.feed.postgate#mentionRule' }]
                : replyPolicy === 'followers'
                ? [{ $type: 'app.bsky.feed.postgate#followersRule' }]
                : [];
              base44.functions.invoke('atproto-bridge', {
                collection: 'app.bsky.feed.postgate',
                record: { post: res.uri, createdAt: new Date().toISOString(), allowRules },
              }).catch(() => {});
            }
          }
        }).catch(() => {});
      }
      // Bell notification dispatch - Web Push to bell-enabled followers.
      const cat = stamped.post_type === 'pack_opening' ? 'pack_opening'
        : stamped.post_type === 'trade' ? 'trade_listing'
        : stamped.post_type === 'showcase' ? 'binder' : null;
      if (cat) {
        base44.functions.invoke('dispatchBellNotifications', {
          author_did: did, author_name: user?.display_name || user?.full_name, category: cat,
          preview: content.trim() || stamped.card_name || 'New post', url: '/',
        }).catch(() => {});
      }
      if (cat && created?.id) {
        dispatchCrossPost(cat, created.id, {
          url: window.location.origin + '/',
          authorName: user?.display_name || user?.full_name,
          authorHandle: user?.username || user?.bsky_handle || '',
        });
      }
      setContent('');
      setAttachedCard(null);
      setPostType('text');
      onPosted?.();
    } catch (e) {
      if (isBotBlockError(e)) {
        alert(e.message);
      } else {
        alert('Could not post: ' + e.message);
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="border-b border-border p-4">
      {replyTo && (
        <div className="mb-3 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
          Replying to <span className="font-semibold text-foreground">{replyTo.author_name || 'collector'}</span>
          {replyTo.content ? `: ${replyTo.content.slice(0, 80)}${replyTo.content.length > 80 ? '...' : ''}` : ''}
        </div>
      )}
      <div className="flex gap-3">
        <Avatar name={user?.display_name || user?.full_name} src={user?.avatar} size={44} />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={replyTo ? 'Write your reply...' : 'What did you pull today?'}
            className="w-full resize-none bg-transparent text-lg outline-none placeholder:text-muted-foreground"
          />

          {attachedCard && (
            <div className="relative mb-3 inline-flex overflow-hidden rounded-xl border border-border bg-secondary">
              <button
                onClick={() => setAttachedCard(null)}
                className="absolute right-1.5 top-1.5 z-10 rounded-full bg-background/80 p-1 hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={cardImageUrl(attachedCard.image)}
                alt={attachedCard.name}
                className="h-40 w-32 object-cover"
              />
              <div className="flex flex-col justify-center px-3 py-2">
                <p className="text-sm font-bold">{attachedCard.name}</p>
                <p className="text-xs text-muted-foreground">{attachedCard.set?.name}</p>
                <p className="text-xs text-primary">{attachedCard.rarity}</p>
              </div>
            </div>
          )}

          {!replyTo && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Who can reply:</span>
              {Object.entries(POLICY_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setReplyPolicy(value)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    replyPolicy === value ? 'bg-primary/15 font-semibold text-primary' : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10 sm:px-3 sm:text-sm"
              >
                <Image className="h-4 w-4" /> Card
              </button>
              {typeButtons.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setPostType(t.key);
                    setSearchOpen(true);
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition-colors sm:px-3 sm:text-sm ${
                    postType === t.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <t.icon className="h-4 w-4" /> {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={handlePost}
              disabled={posting || (!content.trim() && !attachedCard)}
              className="flex items-center justify-center gap-1.5 self-end rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-40 sm:self-auto"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Post
            </button>
          </div>
        </div>
      </div>
      <CardSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={setAttachedCard}
        title={postType === 'trade' ? 'Select card to trade' : 'Attach a card'}
      />
    </div>
  );
}