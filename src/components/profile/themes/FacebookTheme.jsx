import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, MapPin, Mail, PenLine, Calendar, Rss } from 'lucide-react';
import BlockRenderer, { BlockShell } from '@/components/profile/BlockRenderer';
import PostCard from '@/components/feed/PostCard';
import Avatar from '@/components/Avatar';
import { base44 } from '@/api/base44Client';
import { timeAgo } from '@/lib/format';

// FacebookTheme — social hub layout. Left sidebar: prominent intro card
// (avatar, bio, location, joined date), friends grid with count, and
// communities/circles. Right main: recent activity feed above the post
// timeline. Blue (#1877F2) accents throughout. Interactions reuse PostCard.
export default function FacebookTheme({ data, did, isOwner, profile, posts }) {
  const [friends, setFriends] = useState([]);
  const [circles, setCircles] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    if (!did) return;
    let active = true;
    (async () => {
      const [f, c] = await Promise.all([
        base44.entities.Friendship.filter({ did, status: 'accepted' }, '-created_date', 12).catch(() => []),
        base44.entities.Circle.filter({}, '-updated_date', 50).catch(() => []),
      ]);
      if (!active) return;
      setFriends(f || []);
      setCircles((c || []).filter((x) => (x.member_dids || []).includes(did)).slice(0, 6));
      try {
        const res = await base44.functions.invoke('get-activity', { did });
        const actData = res?.data ?? res;
        if (active) setActivity((actData?.items || actData || []).slice(0, 5));
      } catch {}
    })();
    return () => { active = false; };
  }, [did]);

  return (
    <div className="py-4">
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Left sidebar — social hub info */}
        <div className="space-y-3">
          {/* Intro card */}
          <BlockShell className="bg-[#f0f2f5]">
            <h3 className="mb-2 text-sm font-bold">Intro</h3>
            <div className="flex flex-col items-center gap-2">
              <Avatar name={profile?.name} src={profile?.avatar} size={72} />
              {data?.bio && <p className="text-center text-sm italic">{data.bio}</p>}
            </div>
            <div className="mt-2 space-y-1.5 text-sm">
              {data?.location && <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 text-[#1877F2]" /> Lives in {data.location}</p>}
              {data?.contact_email && <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4 text-[#1877F2]" /> {data.contact_email}</p>}
              <p className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4 text-[#1877F2]" /> Joined SwapPulse</p>
            </div>
          </BlockShell>

          {/* Friends grid */}
          <BlockShell className="bg-[#f0f2f5]">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold">Friends</h3>
              <span className="text-xs font-semibold text-[#1877F2]">{friends.length}</span>
            </div>
            {friends.length === 0 ? (
              <p className="text-xs text-muted-foreground">No friends yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {friends.slice(0, 9).map((f) => (
                  <Link key={f.id} to={`/profile/${f.friend_did}`} className="flex flex-col items-center gap-1">
                    <Avatar name={f.friend_name} size={56} />
                    <span className="w-full truncate text-center text-[10px] font-medium">{f.friend_name}</span>
                  </Link>
                ))}
              </div>
            )}
          </BlockShell>

          {/* Circles / Communities */}
          {circles.length > 0 && (
            <BlockShell className="bg-[#f0f2f5]">
              <h3 className="mb-2 text-sm font-bold">Communities</h3>
              <div className="space-y-1.5">
                {circles.map((c) => (
                  <Link key={c.id} to={`/circles/${c.id}`} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-white">
                    <Users className="h-4 w-4 text-[#1877F2]" />
                    <span className="text-sm font-medium">{c.name}</span>
                  </Link>
                ))}
              </div>
            </BlockShell>
          )}
        </div>

        {/* Right main — activity + posts */}
        <div className="space-y-3">
          {/* Activity feed */}
          {activity.length > 0 && (
            <BlockShell className="bg-[#f0f2f5]">
              <div className="mb-2 flex items-center gap-2">
                <Rss className="h-4 w-4 text-[#1877F2]" />
                <h3 className="text-sm font-bold">Recent Activity</h3>
              </div>
              <div className="space-y-2">
                {activity.map((a, i) => (
                  <div key={a?.id || i} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1877F2]" />
                    <div>
                      <p className="text-sm">{a?.description || a?.message || a?.type || 'Activity'}</p>
                      {a?.created_date && <p className="text-muted-foreground">{timeAgo(a.created_date)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </BlockShell>
          )}

          {isOwner && (
            <Link to="/compose" className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 hover:bg-secondary">
              <PenLine className="h-4 w-4 text-[#1877F2]" />
              <span className="text-sm text-muted-foreground">What's on your mind?</span>
            </Link>
          )}
          {(posts || []).slice(0, 10).map((p) => <PostCard key={p.id} post={p} />)}
          {(!posts || posts.length === 0) && <p className="py-10 text-center text-sm text-muted-foreground">No posts yet.</p>}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {['binder', 'trades', 'collections', 'hub'].map((key) => (
          <BlockRenderer key={key} blockKey={key} data={data} did={did} isOwner={isOwner} />
        ))}
      </div>
    </div>
  );
}