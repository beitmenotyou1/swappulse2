import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Repeat2, MessageCircle, Bookmark, Share2, Sparkles, ArrowLeftRight, Image as ImageIcon, Flag } from 'lucide-react';
import LiveAvatar from '@/components/LiveAvatar';
import LiveBadge from '@/components/LiveBadge';
import { useLivePresence } from '@/lib/livePresence';
import ReactionBar from '@/components/feed/ReactionBar';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import { timeAgo, formatNumber } from '@/lib/format';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import ReportDialog from '@/components/moderation/ReportDialog';

const TYPE_META = {
  pack_opening: { icon: Sparkles, label: 'Pack Pull', color: 'text-accent' },
  trade: { icon: ArrowLeftRight, label: 'Trade', color: 'text-primary' },
  showcase: { icon: ImageIcon, label: 'Showcase', color: 'text-rarity-holo' },
};

export default function PostCard({ post, reactions, myRepost }) {
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [repostId, setRepostId] = useState(null);
  const [pendingRepost, setPendingRepost] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const { user } = useAuth();
  const { liveByDid } = useLivePresence();
  const navigate = useNavigate();

  // Sync existing repost state from the batched map (avoids a per-card API call).
  useEffect(() => {
    if (myRepost) {
      setReposted(true);
      setRepostId(myRepost.id);
    }
  }, [myRepost?.id]);

  const toggleRepost = async () => {
    if (pendingRepost) return;
    if (!user?.id) return; // guests get the optimistic toggle only
    setPendingRepost(true);
    if (reposted && repostId) {
      setReposted(false);
      try {
        const r = await base44.entities.Repost.get(repostId).catch(() => null);
        await base44.entities.Repost.delete(repostId);
        setRepostId(null);
        if (r?.at_uri?.startsWith('at://did:')) {
          base44.functions.invoke('atproto-bridge', { action: 'delete', uri: r.at_uri }).catch(() => {});
        }
      } catch {
        setReposted(true);
      }
    } else {
      setReposted(true);
      try {
        const { did, signingKey } = await ensureUserDid();
        const me = await base44.auth.me();
        const stamped = await stampRecord(
          {
            post_id: post.id,
            post_uri: post.at_uri,
            post_cid: post.cid,
            reposter_name: me?.full_name || '',
            reposter_handle: me?.email?.split('@')[0] || '',
          },
          NSID.REPOST,
          did,
          signingKey,
        );
        const created = await base44.entities.Repost.create(stamped);
        setRepostId(created.id);
        // AT Protocol PDS bridge — mirror as a real app.bsky.feed.repost (only for genuinely bridged posts).
        if (post.bridged && post.at_uri && post.cid) {
          base44.functions.invoke('atproto-bridge', {
            collection: 'app.bsky.feed.repost',
            record: { subject: { uri: post.at_uri, cid: post.cid }, createdAt: new Date().toISOString() },
          }).then((res) => {
            if (res?.uri) base44.entities.Repost.update(created.id, { at_uri: res.uri, cid: res.cid }).catch(() => {});
          }).catch(() => {});
        }
      } catch {
        setReposted(false);
      }
    }
    setPendingRepost(false);
  };
  const liveInfo = post.did ? liveByDid.get(post.did) : null;
  const meta = TYPE_META[post.post_type];
  const likeCount = post.likes + (liked ? 1 : 0);
  const repostCount = post.reposts + (reposted ? 1 : 0);

  return (
    <article className="relative border-b border-border p-4 transition-colors hover:bg-card/50">
      {liveInfo && <span className="absolute right-3 top-3 z-10"><LiveBadge title={liveInfo.title} /></span>}
      <div className="flex gap-3">
        <LiveAvatar did={post.did} name={post.author_name} src={post.author_avatar} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            {post.did ? (
              <Link to={`/profile/${post.did}`} className="font-bold truncate hover:underline">{post.author_name || 'Collector'}</Link>
            ) : (
              <span className="font-bold truncate">{post.author_name || 'Collector'}</span>
            )}
            <span className="text-muted-foreground truncate">@{post.author_handle || 'user'}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{timeAgo(post.created_date)}</span>
            {meta && (
              <span className={`ml-auto flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                <meta.icon className="h-3 w-3" /> {meta.label}
              </span>
            )}
          </div>

          {post.content && (
            <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>
          )}

          {post.card_id && (
            <div className="mt-3 flex overflow-hidden rounded-xl border border-border bg-secondary">
              <img
                src={cardImageUrl(post.card_image)}
                alt={post.card_name}
                className="h-44 w-36 shrink-0 object-cover"
              />
              <div className="flex flex-col justify-center px-4 py-3">
                <p className="font-bold">{post.card_name}</p>
                <p className="text-sm text-muted-foreground">{post.set_name}</p>
                {post.card_rarity && (
                  <span className={`mt-1 inline-block w-fit text-xs font-semibold ${rarityClasses(post.card_rarity).text}`}>
                    {post.card_rarity}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between max-w-md text-muted-foreground">
            <button
              onClick={() => navigate('/compose', { state: { replyTo: post } })}
              aria-label="Reply"
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{formatNumber(post.replies)}</span>
            </button>
            <button
              onClick={toggleRepost}
              disabled={pendingRepost}
              aria-label="Repost"
              aria-pressed={reposted}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50 ${reposted ? 'text-emerald-400' : ''}`}
            >
              <Repeat2 className={`h-4 w-4 ${reposted ? 'fill-current' : ''}`} />
              <span>{formatNumber(repostCount)}</span>
            </button>
            <button
              onClick={() => setLiked(!liked)}
              aria-label="Like"
              aria-pressed={liked}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors hover:bg-red-500/10 hover:text-red-400 ${liked ? 'text-red-500' : ''}`}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              <span>{formatNumber(likeCount)}</span>
            </button>
            <button
              onClick={() => setSaved(!saved)}
              aria-label="Save"
              aria-pressed={saved}
              className={`rounded-full px-2 py-1 transition-colors hover:bg-primary/10 hover:text-primary ${saved ? 'text-primary' : ''}`}
            >
              <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
            </button>
            <button aria-label="Share" className="rounded-full px-2 py-1 transition-colors hover:bg-primary/10 hover:text-primary">
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setReportOpen(true)}
              aria-label="Report"
              className="rounded-full px-2 py-1 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Flag className="h-4 w-4" />
            </button>
          </div>
          <ReactionBar post={post} initial={reactions} />
        </div>
      </div>
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        contentType="post"
        contentId={post.id}
        contentPreview={post.content}
        authorHandle={post.author_handle}
      />
    </article>
  );
}