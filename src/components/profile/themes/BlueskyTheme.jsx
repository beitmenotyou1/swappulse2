import React from 'react';
import BlockRenderer, { BlockShell } from '@/components/profile/BlockRenderer';
import PostCard from '@/components/feed/PostCard';
import { DEFAULT_BLOCK_ORDER } from '@/lib/profileThemes';

// BlueskyTheme — posts are the star. A compact profile summary (bio, handle,
// metrics) sits above a dominant post feed with full interaction controls.
// Personal blocks (contact, milestones) render in a slim section below the
// feed. Stripped to a pure post-showcase experience.
export default function BlueskyTheme({ data, blockOrder, did, isOwner, profile, posts }) {
  const order = blockOrder?.length ? blockOrder : DEFAULT_BLOCK_ORDER;
  const personal = order.filter((k) => ['contact', 'milestones'].includes(k));
  const bio = data?.bio || profile?.description;
  const handle = profile?.handle || profile?.bsky_handle;

  return (
    <div className="py-4">
      {/* Compact profile summary */}
      <BlockShell className="mb-3">
        {bio && <p className="text-sm leading-relaxed">{bio}</p>}
        {handle && <p className="mt-2 text-sm text-sky-600">@{handle}</p>}
        <div className="mt-2 flex gap-4 text-sm">
          <span><b>{profile?.followers || 0}</b> <span className="text-muted-foreground">followers</span></span>
          <span><b>{profile?.following || 0}</b> <span className="text-muted-foreground">following</span></span>
          <span><b>{profile?.posts_count || (posts || []).length || 0}</b> <span className="text-muted-foreground">posts</span></span>
        </div>
      </BlockShell>

      {/* Dominant post feed */}
      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5">
          <h3 className="text-sm font-bold">Posts</h3>
        </div>
        {(posts || []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {(posts || []).map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </section>

      {/* Slim personal blocks below */}
      {personal.length > 0 && (
        <div className="mt-3 space-y-3">
          {personal.map((key) => (
            <BlockRenderer key={key} blockKey={key} data={data} did={did} isOwner={isOwner} />
          ))}
        </div>
      )}
    </div>
  );
}