import React from 'react';
import { Repeat2, MessageCircle } from 'lucide-react';
import BlockRenderer, { BlockShell } from '@/components/profile/BlockRenderer';
import PostCard from '@/components/feed/PostCard';

// MastodonTheme — purple-accented toot cards with boost/reply affordances.
// Left sidebar with follower/following stats; main toot feed. Interactions
// reuse PostCard (repost = boost, reply = reply).
export default function MastodonTheme({ data, blockOrder, did, isOwner, profile, posts }) {
  return (
    <div className="py-4">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <BlockShell title="Profile" accent="border-[#6364FF]/30">
            <div className="space-y-2 text-sm">
              {data?.bio && <p>{data.bio}</p>}
              <div className="flex gap-4 text-sm">
                <span><b>{profile?.following || 0}</b> <span className="text-muted-foreground">Following</span></span>
                <span><b>{profile?.followers || 0}</b> <span className="text-muted-foreground">Followers</span></span>
              </div>
            </div>
          </BlockShell>

          {data?.interests?.length > 0 && (
            <BlockShell title="Tags" accent="border-[#6364FF]/30">
              <div className="flex flex-wrap gap-1.5">
                {data.interests.map((v, i) => (
                  <span key={i} className="rounded bg-[#6364FF]/10 px-1.5 py-0.5 text-xs font-medium text-[#6364FF]">#{v.replace(/\s+/g, '').toLowerCase()}</span>
                ))}
              </div>
            </BlockShell>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-[#6364FF]/30 bg-card px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Repeat2 className="h-3.5 w-3.5" /> Boost = Repost</span>
            <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> Reply</span>
          </div>
          {(posts || []).length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No toots yet.</p>
          ) : (
            (posts || []).slice(0, 10).map((p) => (
              <div key={p.id} className="rounded-2xl border border-[#6364FF]/20 bg-card">
                <PostCard post={p} />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {['milestones', 'binder', 'trades', 'collections', 'hub'].map((key) => (
          <BlockRenderer key={key} blockKey={key} data={data} did={did} isOwner={isOwner} />
        ))}
      </div>
    </div>
  );
}