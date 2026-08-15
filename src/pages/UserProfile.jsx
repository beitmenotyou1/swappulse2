import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import Avatar from '@/components/Avatar';
import PostCard from '@/components/feed/PostCard';
import FollowBellButton from '@/components/follow/FollowBellButton';
import FriendsBadge from '@/components/follow/FriendsBadge';
import FollowsYouBadge from '@/components/follow/FollowsYouBadge';
import AddFriendLink from '@/components/follow/AddFriendLink';
import ReputationSummary from '@/components/profile/ReputationSummary';
import ProfileHandle from '@/components/profile/ProfileHandle';
import ProfileMetricsBar from '@/components/profile/ProfileMetricsBar';
import ActivityTab from '@/components/profile/ActivityTab';
import { useMergedProfile } from '@/hooks/useMergedProfile';

// Other-user profile, reached from feed author links. Hosts the follow+bell
// control, the Friends badge, and the add-friend flow. Renders the merged
// SwapPulse + Bluesky profile (remote wins for shared identity fields).
export default function UserProfile() {
  const { did: subjectDid } = useParams();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [friendship, setFriendship] = useState({ my: null, their: null });
  const [tab, setTab] = useState('Posts');
  const { profile: merged, loading: merging } = useMergedProfile({ did: subjectDid });

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
        setFriendship({ my: mine[0] || null, their: theirs[0] || null });
      } catch {} finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [subjectDid]);

  // Derive display values from the merged profile, falling back to the first
  // post's author metadata while the merge is loading or if it fails.
  const head = posts[0];
  const profile = {
    name: merged?.name || head?.author_name || 'Collector',
    bsky_handle: merged?.bsky_handle || '',
    username: merged?.username || head?.author_handle || 'collector',
    avatar: merged?.avatar || head?.author_avatar || '',
    header: merged?.header || '',
    did: subjectDid,
    handle_verified: merged?.handle_verified || false,
    description: merged?.description || '',
    followers_count: merged?.followers_count || 0,
    follows_count: merged?.follows_count || 0,
    posts_count: merged?.posts_count || 0,
    remote_synced: !!merged?.remote_synced,
  };

  const isFriend = friendship.my?.status === 'accepted' && friendship.their?.status === 'accepted';

  return (
    <div>
      <div className="h-32 w-full overflow-hidden bg-gradient-to-r from-primary/40 via-rarity-holo/30 to-accent/30">
        {profile?.header ? (
          <img src={profile.header} alt="Profile header" className="h-full w-full object-cover" />
        ) : null}
      </div>
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
            <FollowsYouBadge subjectDid={subjectDid} />
            <FriendsBadge isFriend={isFriend} />
          </div>
          <ProfileHandle
            bskyHandle={profile?.bsky_handle}
            username={profile?.username}
            did={profile?.did}
            verified={profile?.handle_verified}
            syncedFromBsky={profile?.remote_synced}
          />
          <ProfileMetricsBar
            followers={profile?.followers_count || 0}
            following={profile?.follows_count || 0}
            posts={profile?.posts_count || posts.length}
          />
          {profile?.description && (
            <p className="mt-2 text-sm">{profile.description}</p>
          )}
          <AddFriendLink
            subjectDid={subjectDid}
            subjectName={profile?.name}
            subjectHandle={profile?.bsky_handle || profile?.username}
          />
        </div>
        <div className="mt-4 flex overflow-x-auto border-b border-border">
          {['Posts', 'Activity'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex-1 shrink-0 whitespace-nowrap px-2 py-3 text-sm font-semibold transition-colors ${tab === t ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
            >
              {t}
              {tab === t && <span className="absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-4">
          <ReputationSummary did={subjectDid} />
          {tab === 'Activity' ? (
            <ActivityTab did={subjectDid} />
          ) : loading ? (
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