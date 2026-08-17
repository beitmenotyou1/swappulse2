import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LiveAvatar from '@/components/LiveAvatar';
import RichText from '@/components/RichText';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import { timeAgo } from '@/lib/format';
import { usePostVisibility } from '@/hooks/usePostVisibility';
import { visibilityLabel } from '@/lib/postVisibility';

// Renders the embedded original beneath a quote post. Resolves the quoted
// post from the local DB (by id) or the AppView (by at_uri) so the embed
// shows full author + content even when the quoting post only stored a ref.
// If the viewer cannot see the quoted post (visibility gate), a placeholder
// is shown instead of the content. Clicking the embed navigates to the
// original post's detail page.
export default function QuotedPostCard({ quoteOfId, quoteRef }) {
  const [quoted, setQuoted] = useState(null);
  const [loading, setLoading] = useState(true);
  const { canView } = usePostVisibility();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (quoteOfId) {
          const p = await base44.entities.Post.get(quoteOfId).catch(() => null);
          if (alive && p) { setQuoted(p); setLoading(false); return; }
        }
        if (quoteRef) {
          const res = await base44.functions.invoke('resolve-post-by-uri', { at_uri: quoteRef }).catch(() => null);
          const body = res?.data ?? res;
          if (alive && body?.post) { setQuoted(body.post); setLoading(false); return; }
        }
      } catch { /* ignore */ }
      if (alive) { setQuoted(null); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [quoteOfId, quoteRef]);

  if (loading) {
    return (
      <div className="mt-2 animate-pulse rounded-xl border border-border bg-secondary/40 p-3">
        <div className="h-3 w-1/3 rounded bg-secondary" />
        <div className="mt-2 h-3 w-3/4 rounded bg-secondary" />
      </div>
    );
  }

  if (!quoted) {
    return (
      <div className="mt-2 rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
        Quoted post unavailable.
      </div>
    );
  }

  if (!canView(quoted)) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        This post is limited — only the author&apos;s {visibilityLabel(quoted.visibility_scope)} can see it.
      </div>
    );
  }

  const detailPath = quoted.id ? `/post/${quoted.id}` : (quoted.at_uri ? `/post/at/${encodeURIComponent(quoted.at_uri)}` : '#');

  return (
    <Link
      to={detailPath}
      onClick={(e) => e.stopPropagation()}
      className="mt-2 block rounded-xl border border-border bg-secondary/50 p-3 transition-colors hover:bg-secondary"
    >
      <div className="flex items-center gap-2">
        <LiveAvatar did={quoted.did} name={quoted.author_name} src={quoted.author_avatar} size={24} />
        <span className="truncate text-xs font-semibold">{quoted.author_name || 'Collector'}</span>
        <span className="truncate text-xs text-muted-foreground">@{quoted.author_handle || 'user'}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(quoted.created_date)}</span>
      </div>
      {quoted.content && (
        <RichText text={quoted.content} className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground" />
      )}
      {quoted.card_id && (
        <div className="mt-2 flex overflow-hidden rounded-lg border border-border bg-background">
          <img
            src={cardImageUrl(quoted.card_image)}
            alt={quoted.card_alt_text || quoted.card_name}
            className="h-24 w-20 shrink-0 object-cover"
          />
          <div className="flex flex-col justify-center px-3 py-2">
            <p className="text-xs font-bold">{quoted.card_name}</p>
            <p className="text-[11px] text-muted-foreground">{quoted.set_name}</p>
            {quoted.card_rarity && (
              <span className={`mt-0.5 text-[11px] font-semibold ${rarityClasses(quoted.card_rarity).text}`}>
                {quoted.card_rarity}
              </span>
            )}
          </div>
        </div>
      )}
    </Link>
  );
}