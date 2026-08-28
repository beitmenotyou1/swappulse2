import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import FollowBellButton from '@/components/follow/FollowBellButton';
import MessageButton from '@/components/messages/MessageButton';
import SubscribeToWritingButton from '@/components/standard/SubscribeToWritingButton';
import FriendsBadge from '@/components/follow/FriendsBadge';
import FollowsYouBadge from '@/components/follow/FollowsYouBadge';
import AddFriendLink from '@/components/follow/AddFriendLink';
import ExternalProfileBanner from '@/components/profile/ExternalProfileBanner';
import MovedFromBlueskyBadge from '@/components/profile/MovedFromBlueskyBadge';
import ImmersiveProfile from '@/components/profile/ImmersiveProfile';
import TrustedTraderBadge from '@/components/trust/TrustedTraderBadge';
import LabelBadges from '@/components/labelers/LabelBadges';
import LabelContentButton from '@/components/labelers/LabelContentButton';
import ReportProfileButton from '@/components/moderation/ReportProfileButton';
import ProfileStarterPacks from '@/components/profile/ProfileStarterPacks';
import ProfilePinnedFeeds from '@/components/profile/ProfilePinnedFeeds';
import { useMergedProfile } from '@/hooks/useMergedProfile';
import { usePaginatedPosts } from '@/hooks/usePaginatedPosts';
import { usePostVisibility } from '@/hooks/usePostVisibility';
import { DEFAULT_VISITOR_SECTIONS } from '@/lib/profileThemes';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

// Other-user profile. Renders the merged SwapPulse + Bluesky profile. For
// non-members (is_member=false, remote_synced=true) it shows a prominent
// external banner strip, hides member-only sections (reputation, friendship,
// add-friend), and pulls the Posts tab from the federated Bluesky author feed.
// Enhanced sections (About/Journey/Hub) are shown for members, driven by the
// viewer-filtered get-profile-config resolver.
export default function UserProfile() {
  const t = useT();
  const { did: subjectDid } = useParams();
  const [friendship, setFriendship] = useState({ my: null, their: null });
  const [profileConfig, setProfileConfig] = useState(null);
  const [tab, setTab] = useState('Posts');
  const { profile: merged, loading: merging } = useMergedProfile({ did: subjectDid });
  const { filterPosts } = usePostVisibility();
  useSEO({
    title: merged?.name ? `${merged.name} (Collector Profile)` : 'Collector Profile',
    description: merged?.description ? `${merged.description}` : `${merged?.name || 'Collector'} on SwapPulse, the decentralized Pokémon TCG collector community.`,
    canonicalPath: `/profile/${subjectDid}`,
    ogImage: merged?.avatar || '',
    jsonLd: { '@context': 'https://schema.org', '@type': 'ProfilePage', name: merged?.name || 'Collector', url: `https://swappulse.org/profile/${subjectDid}` },
  });

  const isExternal = !!merged && !merged.is_member && !!merged.remote_synced;
  const isMember = !!merged && !!merged.is_member;
  const { posts, loading: postsLoading, loadingMore, hasMore, loadMore } = usePaginatedPosts(merging ? '' : subjectDid, isExternal);
  const loading = merging || postsLoading;

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

  // Viewer-filtered profile config (personal info, milestones, theme, layout).
  useEffect(() => {
    let active = true;
    (async () => {
      if (merging || !isMember) { if (active) setProfileConfig(null); return; }
      try {
        const res = await base44.functions.invoke('get-profile-config', { did: subjectDid });
        const data = res?.data ?? res;
        if (active) setProfileConfig(data);
      } catch {
        if (active) setProfileConfig(null);
      }
    })();
    return () => { active = false; };
  }, [subjectDid, isMember, merging]);

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
    pinned_post_id: merged?.pinned_post_id || '',
    followers_count: merged?.followers_count || 0,
    follows_count: merged?.follows_count || 0,
    posts_count: merged?.posts_count || 0,
    remote_synced: !!merged?.remote_synced,
    migrated_from_bluesky: !!merged?.migrated_from_bluesky,
  };

  const isFriend = friendship.my?.status === 'accepted' && friendship.their?.status === 'accepted';

  const baseTabs = [
    { key: 'About', label: 'About' },
    { key: 'Posts', label: t('profile.tab.posts') },
    { key: 'Journey', label: 'Journey' },
    { key: 'Hub', label: 'Hub' },
    { key: 'Trades', label: t('profile.tab.trades') },
    { key: 'Collections', label: t('profile.tab.collections') },
    { key: 'Activity', label: t('profile.tab.activity') },
  ];
  const enhancedTabs = isMember ? baseTabs : baseTabs.filter((b) => ['Posts', 'Trades', 'Collections', 'Activity'].includes(b.key));
  const order = profileConfig?.section_order?.length ? profileConfig.section_order : DEFAULT_VISITOR_SECTIONS.filter((k) => enhancedTabs.some((b) => b.key === k));
  const hidden = new Set(profileConfig?.hidden_sections || []);
  const tabs = order
    .map((k) => enhancedTabs.find((b) => b.key === k))
    .filter(Boolean)
    .concat(enhancedTabs.filter((b) => !order.includes(b.key)))
    .filter((b) => b.key === 'Posts' || !hidden.has(b.key));

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <ImmersiveProfile
          theme="default"
          isOwner={false}
          did={subjectDid}
          profile={profile}
          config={profileConfig}
          posts={filterPosts(posts)}
          loadingMore={loadingMore}
          hasMore={hasMore}
          loadMore={loadMore}
          isExternal={isExternal}
          actions={
            <>
              <LabelBadges subjectUri={`at://${subjectDid}`} size="md" className="mr-1" />
              <FollowBellButton
                subjectDid={subjectDid}
                subjectName={profile?.name}
                subjectHandle={profile?.bsky_handle || profile?.username}
                subjectAvatar={profile?.avatar}
              />
              <SubscribeToWritingButton authorDid={subjectDid} />
              <MessageButton
                targetDid={subjectDid}
                targetName={profile?.name}
                targetHandle={profile?.bsky_handle || profile?.username}
                targetAvatar={profile?.avatar}
              />
              <LabelContentButton subjectUri={`at://${subjectDid}`} subjectType="profile" />
              <ReportProfileButton
                profileId={subjectDid}
                profileHandle={profile?.bsky_handle || profile?.username}
                profileName={profile?.name}
              />
            </>
          }
          extra={!isExternal && (
            <div className="space-y-4">
              <AddFriendLink
                subjectDid={subjectDid}
                subjectName={profile?.name}
                subjectHandle={profile?.bsky_handle || profile?.username}
              />
              <ProfileStarterPacks did={subjectDid} />
              <ProfilePinnedFeeds did={subjectDid} />
            </div>
          )}
          badges={
            <>
              <TrustedTraderBadge did={subjectDid} size="md" />
              {profile.migrated_from_bluesky && <MovedFromBlueskyBadge size="md" />}
              {!isExternal && <FollowsYouBadge subjectDid={subjectDid} />}
              {!isExternal && <FriendsBadge isFriend={isFriend} />}
            </>
          }
          backLink={
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4" /> {t('userProfile.back')}
            </Link>
          }
          externalBanner={isExternal && <ExternalProfileBanner did={subjectDid} handle={profile?.bsky_handle} migrated={profile?.migrated_from_bluesky} />}
          visitorExtras={{ tradeFields: profileConfig?.tradeFields }}
        />
      )}
    </div>
  );
}