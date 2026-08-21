import React, { useEffect, useState } from 'react';
import { Pin, Loader2 } from 'lucide-react';
import PostCard from '@/components/feed/PostCard';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';

// PinnedPost — displays the user's single pinned post prominently at the top
// of the About tab. Tries to find the post in the already-loaded posts array
// first (avoids an extra API call); falls back to fetching by id. Shows a
// "Pinned" label above the PostCard. Renders nothing if there is no pinned
// post or the post can't be loaded.
export default function PinnedPost({ pinnedPostId, posts = [], onUnpin }) {
  const t = useT();
  const [fetched, setFetched] = useState(null);
  const [loading, setLoading] = useState(false);

  const fromList = posts.find((p) => p.id === pinnedPostId);
  const post = fromList || fetched;

  useEffect(() => {
    if (fromList || !pinnedPostId) {
      setFetched(null);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const p = await base44.entities.Post.get(pinnedPostId);
        if (active) setFetched(p);
      } catch {
        if (active) setFetched(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [pinnedPostId, fromList]);

  if (!pinnedPostId) return null;
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {t('common.loading')}
      </div>
    );
  }
  if (!post) return null;

  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 px-1 pb-1.5 text-sm font-semibold text-primary">
        <Pin className="h-4 w-4" />
        {t('post.pinnedLabel')}
      </div>
      <PostCard post={post} />
    </div>
  );
}