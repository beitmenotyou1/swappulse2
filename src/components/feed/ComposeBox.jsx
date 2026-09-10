import React, { useState } from 'react';
import { Image, Sparkles, ArrowLeftRight, Send, Loader2, X, Globe, Users, AtSign, FolderOpen, ScanLine } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';
import CardSearchModal from '@/components/cards/CardSearchModal';
import CollectionPickerModal from '@/components/feed/CollectionPickerModal';
import { cardImageUrl } from '@/lib/tcgdex';
import { useAuth } from '@/lib/AuthContext';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { dispatchCrossPost } from '@/lib/crosspost';
import { ensureBotAllowed, isBotBlockError } from '@/lib/botGuardClient';
import { extractHashtags, canonicalise } from '@/lib/hashtags';
import { useT } from '@/lib/i18n/I18nProvider';
import { useMediaComposer } from '@/hooks/useMediaComposer';
import MediaComposer from '@/components/feed/MediaComposer';
import VideoComposer from '@/components/feed/VideoComposer';
import PostCardScannerModal from '@/components/feed/PostCardScannerModal';
import { useToast } from '@/components/ui/use-toast';
// Extract @handles from post text for the mentioned-only scope.
function extractMentions(text) {
  const matches = text.match(/@([\w.]+)/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

const POLICY_DEFS = [
  { key: 'everybody', labelKey: 'compose.policy.everyone' },
  { key: 'followers', labelKey: 'compose.policy.followers' },
  { key: 'mentioned', labelKey: 'compose.policy.mentioned' },
  { key: 'nobody', labelKey: 'compose.policy.nobody' },
];
const SCOPE_DEFS = [
  { key: 'public', icon: Globe, labelKey: 'compose.scope.public' },
  { key: 'followers', icon: Users, labelKey: 'compose.scope.followers' },
  { key: 'mentioned', icon: AtSign, labelKey: 'compose.scope.mentioned' },
];

const CATEGORY_DEFS = [
  { key: 'general', labelKey: 'post.category.general' },
  { key: 'top_tier_trade', labelKey: 'post.category.top_tier_trade' },
  { key: 'grading_advice', labelKey: 'post.category.grading_advice' },
  { key: 'local_meetup', labelKey: 'post.category.local_meetup' },
  { key: 'market_analysis', labelKey: 'post.category.market_analysis' },
  { key: 'collection_help', labelKey: 'post.category.collection_help' },
];

export default function ComposeBox({ onPosted, replyTo }) {
  const t = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('text');
  const [postCategory, setPostCategory] = useState('general');
  const [attachedCard, setAttachedCard] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [replyPolicy, setReplyPolicy] = useState('everybody');
  const [visibilityScope, setVisibilityScope] = useState('public');
  const [cardAltText, setCardAltText] = useState('');
  const [nativeVideo, setNativeVideo] = useState(null);
  const media = useMediaComposer();

  const typeButtons = [
    { key: 'pack_opening', icon: Sparkles, labelKey: 'post.type.packPull' },
    { key: 'trade', icon: ArrowLeftRight, labelKey: 'post.type.trade' },
    { key: 'showcase', icon: Image, labelKey: 'post.type.showcase' },
  ];

  const handlePost = async () => {
    if (!content.trim() && !attachedCard && media.images.length === 0 && !media.videoUrl.trim()) return;
    setPosting(true);
    try {
      await ensureBotAllowed('post', content);
      const { did, signingKey } = await ensureUserDid();
      const hashtags = extractHashtags(content).slice(0, 10);
      const canonical_tags = canonicalise(hashtags);
      // Upload images and build embed fields (embed_images, embed_video, embed_external)
      const mediaFields = await media.buildMediaFields();
      // Native uploaded pack-opening video takes precedence over external link.
      if (nativeVideo?.url) mediaFields.embed_video = nativeVideo;
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
        post_category: postCategory,
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
        embed_images: mediaFields.embed_images,
        embed_video: mediaFields.embed_video,
        embed_external: mediaFields.embed_external,
        author_name: user?.display_name || user?.full_name,
        author_handle: user?.username || user?.bsky_handle || '',
        author_avatar: user?.avatar || '',
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

      const shouldFederate = visibilityScope === 'public' && did.startsWith('did:plc:');
      const reservedRkey = shouldFederate
        ? String(stamped.at_uri || '').split('/').pop() || ''
        : '';
      const created = await base44.entities.Post.create({
        ...stamped,
        language: user?.locale || 'en-GB',
        at_uri: '',
        cid: '',
        bridged: false,
        federation_status: shouldFederate ? 'pending' : 'local_only',
        federation_rkey: reservedRkey,
        federation_attempts: 0,
      });

      // Hashtag abuse labeler evaluates the new local post independently from
      // federation. A PDS outage must not lose the user's SwapPulse post.
      if (created?.id) {
        base44.functions.invoke('moderatePost', { post_id: created.id }).catch(() => {});

        if (shouldFederate) {
          try {
            const response = await base44.functions.invoke('atproto-publish-post', {
              post_id: created.id,
            });
            const published = response?.data ?? response;
            if (!published?.uri) {
              throw new Error('BlueSky did not return a post URI.');
            }

            // Postgates control reply policy, not visibility. This is
            // best-effort because the post itself has already been published.
            if (replyPolicy !== 'everybody') {
              const allowRules = replyPolicy === 'nobody'
                ? [{ $type: 'app.bsky.feed.postgate#disableRule' }]
                : replyPolicy === 'mentioned'
                  ? [{ $type: 'app.bsky.feed.postgate#mentionRule' }]
                  : replyPolicy === 'followers'
                    ? [{ $type: 'app.bsky.feed.postgate#followersRule' }]
                    : [];
              await base44.functions.invoke('atproto-bridge', {
                collection: 'app.bsky.feed.postgate',
                record: {
                  post: published.uri,
                  createdAt: new Date().toISOString(),
                  allowRules,
                },
              }).catch((error) => {
                console.warn('BlueSky reply policy could not be applied', error?.message || error);
              });
            }

            toast({
              title: t('compose.federationPublishedTitle'),
              description: t('compose.federationPublishedDescription'),
            });
          } catch (error) {
            console.error('BlueSky publication failed', error?.message || error);
            toast({
              title: t('compose.federationSavedLocallyTitle'),
              description: t('compose.federationSavedLocallyDescription'),
              variant: 'destructive',
            });
          }
        }
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
      setPostCategory('general');
      setVisibilityScope('public');
      media.reset();
      setNativeVideo(null);
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
          {t('compose.replyingTo')} <span className="font-semibold text-foreground">{replyTo.author_name || t('common.collector')}</span>
          {replyTo.content ? `: ${replyTo.content.slice(0, 80)}${replyTo.content.length > 80 ? '...' : ''}` : ''}
        </div>
      )}
      <div className="flex gap-3">
        <Avatar name={user?.display_name || user?.full_name} src={user?.avatar} size={44} />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value.slice(0, 300));
              media.detectLinkPreview(e.target.value);
            }}
            rows={2}
            maxLength={300}
            placeholder={replyTo ? t('compose.placeholder.reply') : t('compose.placeholder.post')}
            className="w-full resize-none bg-transparent text-lg outline-none placeholder:text-muted-foreground"
           aria-label={replyTo ? t('compose.placeholder.reply') : t('compose.placeholder.post')}/>
          <div className={`text-right text-xs ${300 - content.length < 20 ? 'text-destructive' : 300 - content.length < 50 ? 'text-warning' : 'text-muted-foreground'}`}>
            {300 - content.length} {t('compose.charsLeft')}
          </div>

          {attachedCard && (
            <>
              <div className="relative mb-2 inline-flex overflow-hidden rounded-xl border border-border bg-secondary">
                <button aria-label="Remove attached card"
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
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="a11y-2e726f4c25">
                   {t('compose.altTextLabel')}
                 </label>
                <input
                  type="text"
                  value={cardAltText}
                  onChange={(e) => setCardAltText(e.target.value.slice(0, 300))}
                  placeholder={t('compose.altTextPlaceholder')}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                 id="a11y-2e726f4c25" aria-label={t('compose.altTextPlaceholder')}/>
              </div>
            </>
          )}

          <MediaComposer media={media} content={content} />

          {postType === 'pack_opening' && (
            <div className="mt-2">
              <VideoComposer value={nativeVideo} onChange={setNativeVideo} />
            </div>
          )}

          {!replyTo && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t('compose.whoCanReply')}</span>
              {POLICY_DEFS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setReplyPolicy(p.key)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    replyPolicy === p.key ? 'bg-primary/15 font-semibold text-primary' : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {t(p.labelKey)}
                </button>
              ))}
            </div>
          )}

          {!replyTo && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t('compose.whoCanSee')}</span>
              {SCOPE_DEFS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setVisibilityScope(s.key)}
                  title={t(s.labelKey)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                    visibilityScope === s.key ? 'bg-primary/15 font-semibold text-primary' : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <s.icon className="h-3.5 w-3.5" /> {t(s.labelKey)}
                </button>
              ))}
            </div>
          )}

          {!replyTo && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t('compose.category')}</span>
              {CATEGORY_DEFS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setPostCategory(c.key)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    postCategory === c.key ? 'bg-primary/15 font-semibold text-primary' : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {t(c.labelKey)}
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
                <Image className="h-4 w-4" /> {t('compose.card')}
              </button>
              <button
                onClick={() => setScannerOpen(true)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10 sm:px-3 sm:text-sm"
              >
                <ScanLine className="h-4 w-4" /> {t('compose.scanner')}
              </button>
              <button
                onClick={() => setCollectionOpen(true)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10 sm:px-3 sm:text-sm"
              >
                <FolderOpen className="h-4 w-4" /> {t('compose.collection')}
              </button>
              {typeButtons.map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => {
                    setPostType(btn.key);
                    setSearchOpen(true);
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition-colors sm:px-3 sm:text-sm ${
                    postType === btn.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <btn.icon className="h-4 w-4" /> {t(btn.labelKey)}
                </button>
              ))}
            </div>
            <button
              onClick={handlePost}
              disabled={posting || (!content.trim() && !attachedCard && media.images.length === 0 && !media.videoUrl.trim() && !nativeVideo?.url)}
              className="flex items-center justify-center gap-1.5 self-end rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-40 sm:self-auto"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t('compose.post')}
            </button>
          </div>
        </div>
      </div>
      <CardSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={setAttachedCard}
        title={postType === 'trade' ? t('compose.selectTradeCard') : t('compose.attachCard')}
      />
      <CollectionPickerModal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        onAttach={setAttachedCard}
      />
      <PostCardScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onAttach={setAttachedCard}
      />
    </div>
  );
}