import React from 'react';
import { Repeat2, MessageCircle, Heart } from 'lucide-react';
import BlockRenderer, { BlockShell } from '@/components/profile/BlockRenderer';
import PostCard from '@/components/feed/PostCard';
import RichText from '@/components/RichText';

// XTheme — high-contrast, single-column scrollable feed. Pinned bio at top,
// then a continuous stream of posts. Interactions reuse PostCard
// (heart = like, repost = retweet, reply = reply).
export default function XTheme({ data, did, isOwner, profile, posts }) {
  return (
    <div className="py-4">
      <div className="mb-4 h-1.5 rounded-full bg-slate-900 dark:bg-white" />

      {(data?.bio || profile?.description) && (
        <BlockShell className="border-slate-900/10 dark:border-white/10">
          <RichText text={data?.bio || profile?.description} className="text-sm leading-relaxed" />
          {data?.interests?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {data.interests.map((v, i) => (
                <span key={i} className="text-xs font-medium text-primary">#{v.replace(/\s+/g, '').toLowerCase()}</span>
              ))}
            </div>
          )}
        </BlockShell>
      )}

      <div className="flex items-center justify-around border-y border-border py-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> Like</span>
        <span className="flex items-center gap-1"><Repeat2 className="h-3.5 w-3.5" /> Repost</span>
        <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> Reply</span>
      </div>

      <div className="divide-y divide-border">
        {(posts || []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          (posts || []).slice(0, 12).map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>

      <div className="mt-4 space-y-3">
        {['milestones', 'contact', 'binder', 'trades', 'collections', 'hub'].map((key) => (
          <BlockRenderer key={key} blockKey={key} data={data} did={did} isOwner={isOwner} />
        ))}
      </div>
    </div>
  );
}