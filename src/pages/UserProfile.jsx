import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import Avatar from '@/components/Avatar';
import PostCard from '@/components/feed/PostCard';
import FollowBellButton from '@/components/follow/FollowBellButton';
import FriendsBadge from '@/components/follow/FriendsBadge';
import AddFriendLink from '@/components/follow/AddFriendLink';

// Other-user profile, reached from feed author links. Hosts the follow+bell
// control, the Friends badge, and the add-friend flow.
export default function UserProfile() {
  const { did: subjectDid } = useParams();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [friendship, setFriendship] = useState({ my: null, their: null });

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const me = await base44.auth.me().catch(() => null);
        const { did: myDid } = await ensureUserDid().catch(() => ({ did: me?.did || '' }));
        const [p, mine, theirs] = await Promise.all([
          base44.entities.Post.filter({ did: subjectDid }, '-created_date', 50).catch(() => []),
          myDid ? base44.entities.Friendship.filter({ did: myDid, friend_did: subjectDid }).catch(() => []) : [],
          myDid ? base44.entities.Friendship.filter({ did: subjectDid, friend_did: myDid }).catch(() => []) : [],
        ]);
        if (!active) return;
        setPosts(p);
        const head = p[0];
        setProfile({
          name: head?.author_name || 'Collector',
          handle: head?.author_handle || 'collector',
          avatar: head?.author_avatar || '',
        });
        setFriendship({ my: mine[0] || null, their: theirs[0] || null });
      } catch {} finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [subjectDid]);

  const isFriend = friendship.my?.status === 'accepted' && friendship.their?.status === 'accepted';

  return (
    <div>
      <div className="h-32 w-full bg-gradient-to-r from-primary/40 via-rarity-holo/30 to-accent/30" />
      <div className="px-4">
        <Link to="/" className="-mt-10 mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="-mt-6 flex items-end justify-between">
          <Avatar name={profile?.name} src={profile?.avatar} size={96} className="ring-4 ring-background" />
          <FollowBellButton
            subjectDid={subjectDid}
            subjectName={profile?.name}
            subjectHandle={profile?.handle}
            subjectAvatar={profile?.avatar}
          />
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold">{profile?.name || 'Collector'}</h1>
            <FriendsBadge isFriend={isFriend} />
          </div>
          <p className="text-sm text-muted-foreground">@{profile?.handle || 'collector'}</p>
          <div className="mt-2 text-sm text-muted-foreground">
            <span><b className="text-foreground">{posts.length}</b> Posts</span>
          </div>
          <AddFriendLink
            subjectDid={subjectDid}
            subjectName={profile?.name}
            subjectHandle={profile?.handle}
          />
        </div>
        <div className="mt-4">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : posts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      </div>
    </div>
  );
}