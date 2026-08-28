import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Image as ImageIcon, Sparkles, ArrowLeftRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LiveAvatar from '@/components/LiveAvatar';
import ExternalIndicator from '@/components/ExternalIndicator';
import { timeAgo } from '@/lib/format';

// FeedPreview — renders a live preview of filtered feed content. Calls
// getFeedSkeleton with the active filters, then batch-resolves the returned
// at:// URIs to full Post records for display. Shows a compact post card per
// result so users can see exactly what their filters produce before
// subscribing/pinning.
const PREVIEW_FEED = 'fresh-pulls';
const PREVIEW_LIMIT = 12;

const TYPE_ICON = {
  pack_opening: Sparkles,
  trade: ArrowLeftRight,
  showcase: ImageIcon,
};

export default function FeedPreview({ filters }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { feed: PREVIEW_FEED, limit: PREVIEW_LIMIT };
      if (filters.set) params.set = filters.set;
      if (filters.labels?.length) params.labels = filters.labels.join(',');

      const res = await base44.functions.invoke('getFeedSkeleton', params).catch(() => null);
      const feedItems = res?.data?.feed || [];

      if (feedItems.length === 0) {
        setPosts([]);
        return;
      }

      // Batch-resolve at:// URIs to full Post records
      const uris = feedItems.map((f) => f.post).filter(Boolean);
      const resolved = await base44.entities.Post.filter(
        { at_uri: { $in: uris } },
        '-created_date',
        PREVIEW_LIMIT,
      ).catch(() => []);

      // For URIs that didn't resolve (remote-only or stale), try extracting
      // the local id from the URI fallback format and fetch those.
      const resolvedUris = new Set((resolved || []).map((p) => p.at_uri));
      const unresolved = feedItems.filter((f) => f.post && !resolvedUris.has(f.post));
      const fallbackIds = unresolved
        .map((f) => f.post.split('/').pop())
        .filter((id) => id && id.length > 10);

      let extra = [];
      if (fallbackIds.length > 0) {
        extra = await base44.entities.Post.filter(
          { id: { $in: fallbackIds } },
          '-created_date',
          PREVIEW_LIMIT,
        ).catch(() => []);
      }

      setPosts([...(resolved || []), ...extra]);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No posts match your filters. Try adjusting the card series or labels.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((post) => {
        const Icon = TYPE_ICON[post.post_type] || null;
        const detailPath = post.at_uri ? `/post/at/${encodeURIComponent(post.at_uri)}` : `/post/${post.id}`;
        return (
          <Link
            key={post.id}
            to={detailPath}
            className="block rounded-xl border border-border bg-card p-3 transition hover:bg-secondary"
          >
            <div className="flex items-center gap-2">
              <LiveAvatar did={post.did} name={post.author_name} src={post.author_avatar} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{post.author_name || 'Collector'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  @{post.author_handle || 'user'} · {timeAgo(post.created_date)}
                </p>
              </div>
              <ExternalIndicator did={post.did} />
              {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            {post.content && (
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
            )}
            {post.card_name && (
              <p className="mt-1 text-xs font-semibold text-primary">
                {post.card_name}{post.set_name ? ` · ${post.set_name}` : ''}
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}