import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp } from 'lucide-react';
import LiveAvatar from '@/components/LiveAvatar';
import RichText from '@/components/RichText';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import { timeAgo } from '@/lib/format';

// Compact, read-only, clickable ancestor card rendered above a reply in
// PostDetail. The whole card is a Link to the ancestor's post detail page so
// users can navigate up the conversation. Kept lightweight (no action bar)
// because ancestors are context, not interactive surfaces.
export default function AncestorCard({ post }) {
  if (!post) return null;
  const detailPath = post.id
    ? `/post/${post.id}`
    : post.at_uri
      ? `/post/at/${encodeURIComponent(post.at_uri)}`
      : '#';

  return (
    <Link
      to={detailPath}
      onClick={(e) => e.stopPropagation()}
      className="block rounded-lg border border-border bg-card/60 px-3 py-2.5 transition-colors hover:bg-secondary hover:border-border-strong"
    >
      <div className="flex items-center gap-2">
        <LiveAvatar did={post.did} name={post.author_name} src={post.author_avatar} size={20} />
        <span className="truncate text-xs font-semibold hover:underline">
          {post.author_name || 'Collector'}
        </span>
        <span className="truncate text-xs text-muted-foreground">@{post.author_handle || 'user'}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(post.created_date)}</span>
        <ChevronUp className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-label="View post" />
      </div>
      {post.content && (
        <RichText
          text={post.content}
          as="p"
          className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground"
          linkClassName="font-medium text-primary hover:underline"
        />
      )}
      {post.card_id && (
        <div className="mt-1.5 flex items-center gap-2 overflow-hidden rounded-md border border-border bg-background/50">
          <img
            src={cardImageUrl(post.card_image)}
            alt={post.card_alt_text || post.card_name}
            className="h-14 w-11 shrink-0 object-cover"
          />
          <div className="min-w-0 py-1 pr-2">
            <p className="truncate text-xs font-semibold">{post.card_name}</p>
            {post.card_rarity && (
              <span className={`text-[11px] font-medium ${rarityClasses(post.card_rarity).text}`}>
                {post.card_rarity}
              </span>
            )}
          </div>
        </div>
      )}
    </Link>
  );
}