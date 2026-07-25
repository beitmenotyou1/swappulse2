import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Repeat2, MessageCircle, Bookmark, Share2, Sparkles, ArrowLeftRight, Image as ImageIcon } from 'lucide-react';
import Avatar from '@/components/Avatar';
import ReactionBar from '@/components/feed/ReactionBar';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import { timeAgo, formatNumber } from '@/lib/format';

const TYPE_META = {
  pack_opening: { icon: Sparkles, label: 'Pack Pull', color: 'text-accent' },
  trade: { icon: ArrowLeftRight, label: 'Trade', color: 'text-primary' },
  showcase: { icon: ImageIcon, label: 'Showcase', color: 'text-rarity-holo' },
};

export default function PostCard({ post, reactions }) {
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [saved, setSaved] = useState(false);

  const meta = TYPE_META[post.post_type];
  const likeCount = post.likes + (liked ? 1 : 0);
  const repostCount = post.reposts + (reposted ? 1 : 0);

  return (
    <article className="border-b border-border p-4 transition-colors hover:bg-card/50">
      <div className="flex gap-3">
        <Avatar name={post.author_name} src={post.author_avatar} size={44} />
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
            <button className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors hover:bg-primary/10 hover:text-primary">
              <MessageCircle className="h-4 w-4" />
              <span>{formatNumber(post.replies)}</span>
            </button>
            <button
              onClick={() => setReposted(!reposted)}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors hover:bg-emerald-500/10 hover:text-emerald-400 ${reposted ? 'text-emerald-400' : ''}`}
            >
              <Repeat2 className="h-4 w-4" />
              <span>{formatNumber(repostCount)}</span>
            </button>
            <button
              onClick={() => setLiked(!liked)}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors hover:bg-red-500/10 hover:text-red-400 ${liked ? 'text-red-500' : ''}`}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              <span>{formatNumber(likeCount)}</span>
            </button>
            <button
              onClick={() => setSaved(!saved)}
              className={`rounded-full px-2 py-1 transition-colors hover:bg-primary/10 hover:text-primary ${saved ? 'text-primary' : ''}`}
            >
              <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
            </button>
            <button className="rounded-full px-2 py-1 transition-colors hover:bg-primary/10 hover:text-primary">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
          <ReactionBar post={post} initial={reactions} />
        </div>
      </div>
    </article>
  );
}