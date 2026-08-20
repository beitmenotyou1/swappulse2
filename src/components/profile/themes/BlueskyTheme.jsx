import React from 'react';
import BlockRenderer from '@/components/profile/BlockRenderer';
import PostCard from '@/components/feed/PostCard';
import { BLOCK_LABELS, DEFAULT_BLOCK_ORDER } from '@/lib/profileThemes';

// BlueskyTheme — clean, minimalist, rounded cards. Bio and interest blocks
// at top, then a feed of recent posts. Closest to the SwapPulse default look.
// Interactions reuse PostCard (like/repost/reply/quote).
export default function BlueskyTheme({ data, blockOrder, did, isOwner, posts }) {
  const order = blockOrder?.length ? blockOrder : DEFAULT_BLOCK_ORDER;
  const personal = order.filter((k) => ['bio', 'interests', 'favourite_pokemon', 'favourite_sets', 'milestones', 'contact'].includes(k));
  const activity = order.filter((k) => ['binder', 'trades', 'collections', 'hub'].includes(k));

  return (
    <div className="py-4">
      <div className="space-y-3">
        {personal.map((key) => (
          <BlockRenderer key={key} blockKey={key} data={data} did={did} isOwner={isOwner} />
        ))}
      </div>

      <section className="my-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-bold">Posts</h3>
        {(posts || []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {(posts || []).slice(0, 8).map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </section>

      <div className="space-y-3">
        {activity.map((key) => (
          <BlockRenderer key={key} blockKey={key} data={data} did={did} isOwner={isOwner} />
        ))}
      </div>
    </div>
  );
}