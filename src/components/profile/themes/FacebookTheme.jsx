import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, MapPin, Mail, PenLine } from 'lucide-react';
import BlockRenderer, { BlockShell } from '@/components/profile/BlockRenderer';
import PostCard from '@/components/feed/PostCard';
import Avatar from '@/components/Avatar';
import { base44 } from '@/api/base44Client';

// FacebookTheme — two-column layout: left sidebar with intro, friends grid,
// and circles; right main with a timeline of posts. Blue (#1877F2) accents.
// Interactions reuse PostCard (like/comment), AddFriendLink (in header).
export default function FacebookTheme({ data, did, isOwner, posts }) {
  const [friends, setFriends] = useState([]);
  const [circles, setCircles] = useState([]);

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
    })();
    return () => { active = false; };
  }, [did]);

  return (
    <div className="py-4">
      <div className="mb-4 h-1.5 rounded-full bg-[#1877F2]" />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <BlockShell title="Intro" className="bg-[#f0f2f5]">
            <div className="space-y-2 text-sm">
              {data?.bio && <p className="text-center">{data.bio}</p>}
              {data?.location && <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {data.location}</p>}
              {data?.contact_email && <p className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {data.contact_email}</p>}
            </div>
          </BlockShell>

          <BlockShell title="Friends" className="bg-[#f0f2f5]">
            {friends.length === 0 ? (
              <p className="text-xs text-muted-foreground">No friends yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {friends.map((f) => (
                  <Link key={f.id} to={`/profile/${f.friend_did}`} className="flex flex-col items-center gap-1">
                    <Avatar name={f.friend_name} size={56} />
                    <span className="w-full truncate text-center text-[10px] font-medium">{f.friend_name}</span>
                  </Link>
                ))}
              </div>
            )}
          </BlockShell>

          {circles.length > 0 && (
            <BlockShell title="Circles" className="bg-[#f0f2f5]">
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

        <div className="space-y-3">
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