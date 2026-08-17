import React, { useState } from 'react';
import { Image, Sparkles, ArrowLeftRight, Send, Loader2, X, Globe, Users, AtSign, ScanLine, FolderOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';
import CardSearchModal from '@/components/cards/CardSearchModal';
import CardScanModal from '@/components/feed/CardScanModal';
import CollectionPickerModal from '@/components/feed/CollectionPickerModal';
import { cardImageUrl } from '@/lib/tcgdex';
import { useAuth } from '@/lib/AuthContext';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { getCurrentTcgdexLang } from '@/lib/i18n/currentLang';
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

// Visibility scope (who can SEE the post) — independent from reply_policy.
const SCOPES = [
  { key: 'public', icon: Globe, label: 'Public' },
  { key: 'followers', icon: Users, label: 'Followers' },
  { key: 'mentioned', icon: AtSign, label: 'Mentioned' },
];

// Extract @handles from post text for the mentioned-only scope.
function extractMentions(text) {
  const matches = text.match(/@([\w.]+)/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

export default function ComposeBox({ onPosted, replyTo }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('text');
  const [attachedCard, setAttachedCard] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [replyPolicy, setReplyPolicy] = useState('everybody');
  const [visibilityScope, setVisibilityScope] = useState('public');
  const [cardAltText, setCardAltText] = useState('');

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

      // Resolve @handles to DIDs for the mentioned-only visibility scope.
      let mentionedDids = [];
      if (visibilityScope === 'mentioned') {
        const handles = extractMentions(content);
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

      const stamped = await stampRecord({
        content: content.trim(),
        post_type: attachedCard ? postType : 'text',
        hashtags,
        canonical_tags,
        visibility_scope: visibilityScope,
        mentioned_dids: mentionedDids,
        card_id: attachedCard?.id,
        card_name: attachedCard?.name,
        card_image: attachedCard?.image,
        card_rarity: attachedCard?.rarity,
        card_alt_text: cardAltText.trim() || null,
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
        // Card embed — upload the card image to the PDS as a blob so the post
        // renders as a rich link card on Bluesky (app.bsky.embed.external).
        // Best-effort: fall back to a thumb-less embed or no embed on failure.
        let cardEmbed = null;
        if (attachedCard) {
          try {
            const imgUrl = cardImageUrl(attachedCard.image);
            const ext = (imgUrl.split('.').pop() || '').toLowerCase();
            const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            const blobRes = await base44.functions.invoke('atproto-bridge', {
              action: 'uploadBlob', imageUrl: imgUrl, mimeType: mime,
            });
            const thumb = blobRes?.blob || blobRes?.data?.blob;
            if (thumb) {
              cardEmbed = {
                $type: 'app.bsky.embed.external',
                external: {
                  uri: `${window.location.origin}/card/${attachedCard.id}`,
                  title: stamped.card_name || attachedCard.name || 'Pokémon card',
                  description: [stamped.set_name, stamped.card_rarity].filter(Boolean).join(' · ') || 'SwapPulse card',
                  thumb,
                },
              };
            }
          } catch (e) {
            console.warn('card embed blob upload failed', e?.message || e);
          }
        }
        base44.functions.invoke('atproto-bridge', {
          collection: 'app.bsky.feed.post',
          record: {
            text: (content.trim() || stamped.card_name || 'New SwapPulse post').slice(0, 3000),
            createdAt: new Date().toISOString(),
            langs: [getCurrentTcgdexLang()],
            ...(replyRef ? { reply: replyRef } : {}),
            ...(cardEmbed ? { embed: cardEmbed } : {}),
          },
        }).then((res) => {
          if (res?.uri) {
            base44.entities.Post.update(created.id, { at_uri: res.uri, cid: res.cid, bridged: true }).catch(() => {});
            // Bridge a postgate record for non-public visibility or non-default reply
            // policy. Visibility takes precedence (a followers-only post is also
            // reply-restricted to followers); reply_policy is used when the post is
            // public but replies are gated.
            const needsGate = visibilityScope !== 'public' || replyPolicy !== 'everybody';
            if (needsGate) {
              const allowRules = visibilityScope === 'followers'
                ? [{ $type: 'app.bsky.feed.postgate#followersRule' }]
                : visibilityScope === 'mentioned'
                ? [{ $type: 'app.bsky.feed.postgate#mentionRule' }]
                : replyPolicy === 'nobody'
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
      setCardAltText('');
      setPostType('text');
      setVisibilityScope('public');
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
            onChange={(e) => setContent(e.target.value.slice(0, 300))}
            rows={2}
            maxLength={300}
            placeholder={replyTo ? 'Write your reply...' : 'What did you pull today?'}
            className="w-full resize-none bg-transparent text-lg outline-none placeholder:text-muted-foreground"
          />
          <div className={`text-right text-xs ${300 - content.length < 20 ? 'text-destructive' : 300 - content.length < 50 ? 'text-warning' : 'text-muted-foreground'}`}>
            {300 - content.length} left
          </div>

          {attachedCard && (
            <>
              <div className="relative mb-2 inline-flex overflow-hidden rounded-xl border border-border bg-secondary">
                <button
                  onClick={() => setAttachedCard(null)}
                  className="absolute right-1.5 top-1.5 z-10 rounded-full bg-background/80 p-1 hover:bg-background"
                >
                  <X className="h-4 w-4" />
                </button>
                <img
                  src={cardImageUrl(attachedCard.image)}
                  alt={cardAltText || attachedCard.name}
                  className="h-40 w-32 object-cover"
                />
                <div className="flex flex-col justify-center px-3 py-2">
                  <p className="text-sm font-bold">{attachedCard.name}</p>
                  <p className="text-xs text-muted-foreground">{attachedCard.set?.name}</p>
                  <p className="text-xs text-primary">{attachedCard.rarity}</p>
                </div>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Image description (alt text)
                </label>
                <input
                  type="text"
                  value={cardAltText}
                  onChange={(e) => setCardAltText(e.target.value.slice(0, 300))}
                  placeholder="Describe the card image for screen readers..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </>
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

          {!replyTo && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Who can see:</span>
              {SCOPES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setVisibilityScope(s.key)}
                  title={s.label}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                    visibilityScope === s.key ? 'bg-primary/15 font-semibold text-primary' : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <s.icon className="h-3.5 w-3.5" /> {s.label}
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
              <button
                onClick={() => setScanOpen(true)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10 sm:px-3 sm:text-sm"
              >
                <ScanLine className="h-4 w-4" /> Scan
              </button>
              <button
                onClick={() => setCollectionOpen(true)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10 sm:px-3 sm:text-sm"
              >
                <FolderOpen className="h-4 w-4" /> Collection
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
      <CardScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onAttach={setAttachedCard}
      />
      <CollectionPickerModal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        onAttach={setAttachedCard}
      />
    </div>
  );
}