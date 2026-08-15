import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, ExternalLink } from 'lucide-react';
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
import ExternalProfileBanner from '@/components/profile/ExternalProfileBanner';
import { useMergedProfile } from '@/hooks/useMergedProfile';

// Other-user profile. Renders the merged SwapPulse + Bluesky profile. For
// non-members (is_member=false, remote_synced=true) it shows a prominent
// external banner strip, hides member-only sections (reputation, friendship,
// add-friend), and pulls the Posts tab from the federated Bluesky author feed.
export default function UserProfile() {
  const { did: subjectDid } = useParams();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [friendship, setFriendship] = useState({ my: null, their: null });
  const [tab, setTab] = useState('Posts');
  const { profile: merged, loading: merging } = useMergedProfile({ did: subjectDid });

  const isExternal = !!merged && !merged.is_member && !!merged.remote_synced;
  const isMember = !!merged && !!merged.is_member;

  // Load posts: federated Bluesky feed for externals, local posts for members.
  useEffect(() => {
    let active = true;
    (async () => {
      if (merging) return;
      setLoading(true);
      try {
        if (isExternal) {
          const res = await base44.functions.invoke('get-author-feed', { did: subjectDid, limit: 50 });
          const data = res?.data ?? res;
          if (active) setPosts(data?.items || []);
        } else {
          const p = await base44.entities.Post.filter({ did: subjectDid }, '-created_date', 50).catch(() => []);
          if (active) setPosts(p);
        }
      } catch {
        if (active) setPosts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [subjectDid, isExternal, merging]);

  // Friendship status — members only.
  useEffect(() => {
    if (!isMember) { setFriendship({ my: null, their: null }); return; }
    let active = true;
    (async () => {
      try {
        const me = await base44.auth.me().catch(() => null);
        const { did: myDid } = await ensureUserDid().catch(() => ({ did: me?.did || '' }));
        if (!myDid || !active) return;
        const [mine, theirs] = await Promise.all([
          base44.entities.Friendship.filter({ did: myDid, friend_did: subjectDid }).catch(() => []),
          base44.entities.Friendship.filter({ did: subjectDid, friend_did: myDid }).catch(() => []),
        ]);
        if (active) setFriendship({ my: mine[0] || null, their: theirs[0] || null });
      } catch {}
    })();
    return () => { active = false; };
  }, [subjectDid, isMember]);

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
      {isExternal && (
        <ExternalProfileBanner did={subjectDid} handle={profile?.bsky_handle} />
      )}
      <div className="px-4">
        <Link to="/" className={`${isExternal ? 'mt-2' : '-mt-10'} mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary`}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className={`${isExternal ? 'mt-2' : '-mt-6'} flex items-end justify-between`}>
          <Avatar name={profile?.name} src={profile?.avatar} size={96} className="ring-4 ring-background" />
          <FollowBellButton
            subjectDid={subjectDid}
            subjectName={profile?.name}
            subjectHandle={profile?.bsky_handle || profile?.username}
            subjectAvatar={profile?.avatar}
          />
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold">{profile?.name || 'Collector'}</h1>
            {!isExternal && <FollowsYouBadge subjectDid={subjectDid} />}
            {!isExternal && <FriendsBadge isFriend={isFriend} />}
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
          {!isExternal && (
            <AddFriendLink
              subjectDid={subjectDid}
              subjectName={profile?.name}
              subjectHandle={profile?.bsky_handle || profile?.username}
            />
          )}
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
          {!isExternal && <ReputationSummary did={subjectDid} />}
          {tab === 'Activity' ? (
            isExternal ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <p>No on-site activity — this collector posts on Bluesky.</p>
                <a href={`https://bsky.app/profile/${subjectDid}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                  View on Bluesky <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
              <ActivityTab did={subjectDid} />
            )
          ) : loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : posts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {isExternal ? 'No posts found on Bluesky.' : 'No posts yet.'}
            </p>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      </div>
    </div>
  );
}