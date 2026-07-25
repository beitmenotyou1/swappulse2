import React, { useState } from 'react';
import { Image, Sparkles, ArrowLeftRight, Send, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';
import CardSearchModal from '@/components/cards/CardSearchModal';
import { cardImageUrl } from '@/lib/tcgdex';
import { useAuth } from '@/lib/AuthContext';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { dispatchCrossPost } from '@/lib/crosspost';

export default function ComposeBox({ onPosted }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('text');
  const [attachedCard, setAttachedCard] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  const typeButtons = [
    { key: 'pack_opening', icon: Sparkles, label: 'Pack Pull' },
    { key: 'trade', icon: ArrowLeftRight, label: 'Trade' },
    { key: 'showcase', icon: Image, label: 'Showcase' },
  ];

  const handlePost = async () => {
    if (!content.trim() && !attachedCard) return;
    setPosting(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const stamped = await stampRecord({
        content: content.trim(),
        post_type: attachedCard ? postType : 'text',
        card_id: attachedCard?.id,
        card_name: attachedCard?.name,
        card_image: attachedCard?.image,
        card_rarity: attachedCard?.rarity,
        set_name: attachedCard?.set?.name,
        author_name: user?.full_name,
        author_handle: user?.email?.split('@')[0],
        likes: 0,
        reposts: 0,
        replies: 0,
      }, NSID.POST, did, signingKey);
      const created = await base44.entities.Post.create(stamped);
      // Bell notification dispatch — Web Push to bell-enabled followers.
      const cat = stamped.post_type === 'pack_opening' ? 'pack_opening'
        : stamped.post_type === 'trade' ? 'trade_listing'
        : stamped.post_type === 'showcase' ? 'binder' : null;
      if (cat) {
        base44.functions.invoke('dispatchBellNotifications', {
          author_did: did, author_name: user?.full_name, category: cat,
          preview: content.trim() || stamped.card_name || 'New post', url: '/',
        }).catch(() => {});
      }
      if (cat && created?.id) {
        dispatchCrossPost(cat, created.id, {
          url: window.location.origin + '/',
          authorName: user?.full_name,
          authorHandle: user?.email?.split('@')[0],
        });
      }
      setContent('');
      setAttachedCard(null);
      setPostType('text');
      onPosted?.();
    } catch (e) {
      alert('Could not post: ' + e.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="border-b border-border p-4">
      <div className="flex gap-3">
        <Avatar name={user?.full_name} size={44} />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="What did you pull today?"
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

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/10"
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
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
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
              className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
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