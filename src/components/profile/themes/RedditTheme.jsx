import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowBigUp, MessageSquare, Users } from 'lucide-react';
import BlockRenderer, { BlockShell } from '@/components/profile/BlockRenderer';
import { base44 } from '@/api/base44Client';
import { timeAgo, formatNumber } from '@/lib/format';

// RedditTheme — card feed of posts with orange upvote tallies on the left
// and community/circle labels. The upvote count reflects the post's like
// count (like = upvote, mapped to the existing PostCard heart action).
// Full interactions (like/repost/reply) are on the Posts tab via PostCard.
export default function RedditTheme({ data, did, isOwner, profile, posts }) {
  const [circles, setCircles] = useState([]);

  useEffect(() => {
    if (!did) return;
    let active = true;
    (async () => {
      const c = await base44.entities.Circle.filter({}, '-updated_date', 50).catch(() => []);
      if (!active) return;
      setCircles((c || []).filter((x) => (x.member_dids || []).includes(did)).slice(0, 3));
    })();
    return () => { active = false; };
  }, [did]);

  return (
    <div className="py-4">
      <div className="mb-4 h-1.5 rounded-full bg-[#FF4500]" />

      {(data?.bio || profile?.description) && (
        <BlockShell className="mb-3 border-[#FF4500]/30 bg-[#FFF3E0] dark:bg-[#FF4500]/5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#FF4500] text-white"><Users className="h-4 w-4" /></span>
            <div>
              <p className="text-sm font-bold">u/{profile?.handle || 'collector'}</p>
              {data?.bio && <p className="text-xs text-muted-foreground">{data.bio}</p>}
            </div>
          </div>
        </BlockShell>
      )}

      <div className="space-y-2">
        {(posts || []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          (posts || []).slice(0, 12).map((p) => (
            <Link key={p.id} to={`/post/${p.id}`} className="block">
              <div className="flex gap-2 rounded-xl border border-border bg-card p-2 hover:border-[#FF4500]/40">
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-[#FFF3E0] px-1.5 py-2 dark:bg-[#FF4500]/5">
                  <ArrowBigUp className="h-5 w-5 text-[#FF4500]" />
                  <span className="text-xs font-bold text-[#FF4500]">{formatNumber((p.likes || 0))}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {circles.length > 0 && (
                      <span className="rounded-full bg-[#FF4500]/10 px-1.5 py-0.5 font-medium text-[#FF4500]">r/{circles[0].name}</span>
                    )}
                    <span>· {timeAgo(p.created_date)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-3 text-sm">{p.content || p.text || ''}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" /> {formatNumber(p.replies || 0)}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="mt-4 space-y-3">
        {['interests', 'favourite_pokemon', 'favourite_sets', 'milestones', 'contact', 'binder', 'trades', 'collections', 'hub'].map((key) => (
          <BlockRenderer key={key} blockKey={key} data={data} did={did} isOwner={isOwner} />
        ))}
      </div>
    </div>
  );
}