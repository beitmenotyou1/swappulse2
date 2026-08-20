import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import Avatar from '@/components/Avatar';
import PostCard from '@/components/feed/PostCard';
import FollowBellButton from '@/components/follow/FollowBellButton';
import MessageButton from '@/components/messages/MessageButton';
import SubscribeToWritingButton from '@/components/standard/SubscribeToWritingButton';
import FriendsBadge from '@/components/follow/FriendsBadge';
import FollowsYouBadge from '@/components/follow/FollowsYouBadge';
import AddFriendLink from '@/components/follow/AddFriendLink';
import ReputationSummary from '@/components/profile/ReputationSummary';
import ProfileHandle from '@/components/profile/ProfileHandle';
import ProfileMetricsBar from '@/components/profile/ProfileMetricsBar';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileTabNav from '@/components/profile/ProfileTabNav';
import ActivityTab from '@/components/profile/ActivityTab';
import TradeHistoryTab from '@/components/profile/TradeHistoryTab';
import SharedCollectionsTab from '@/components/profile/SharedCollectionsTab';
import ExternalProfileBanner from '@/components/profile/ExternalProfileBanner';
import ProfileThemeView from '@/components/profile/ProfileThemeView';
import MilestonesTimeline from '@/components/profile/MilestonesTimeline';
import EngagementHub from '@/components/profile/EngagementHub';
import TrustedTraderBadge from '@/components/trust/TrustedTraderBadge';
import { useMergedProfile } from '@/hooks/useMergedProfile';
import { usePostVisibility } from '@/hooks/usePostVisibility';
import { themeGradient, DEFAULT_VISITOR_SECTIONS } from '@/lib/profileThemes';
import useSEO from '@/hooks/useSEO';
import RichText from '@/components/RichText';
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
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
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
    followers_count: merged?.followers_count || 0,
    follows_count: merged?.follows_count || 0,
    posts_count: merged?.posts_count || 0,
    remote_synced: !!merged?.remote_synced,
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
      <ProfileHeader
        banner={profile?.header}
        bannerHeight="h-28 sm:h-32"
        bannerGradient={themeGradient(profileConfig?.theme)}
        avatarOverlap={isExternal ? 'mt-2' : '-mt-10 sm:-mt-12'}
        backLink={
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> {t('userProfile.back')}
          </Link>
        }
        externalBanner={isExternal && <ExternalProfileBanner did={subjectDid} handle={profile?.bsky_handle} />}
        avatar={<Avatar name={profile?.name} src={profile?.avatar} size={96} className="ring-4 ring-background" />}
        name={profile?.name || 'Collector'}
        badges={
          <>
            <TrustedTraderBadge did={subjectDid} size="md" />
            {!isExternal && <FollowsYouBadge subjectDid={subjectDid} />}
            {!isExternal && <FriendsBadge isFriend={isFriend} />}
          </>
        }
        handleNode={
          <ProfileHandle
            bskyHandle={profile?.bsky_handle}
            username={profile?.username}
            did={profile?.did}
            verified={profile?.handle_verified}
            syncedFromBsky={profile?.remote_synced}
          />
        }
        metricsNode={
          <ProfileMetricsBar
            followers={profile?.followers_count || 0}
            following={profile?.follows_count || 0}
            posts={profile?.posts_count || posts.length}
          />
        }
        description={profile?.description && <RichText text={profile.description} className="text-sm" />}
        actions={
          <>
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
          </>
        }
        extra={!isExternal && (
          <AddFriendLink
            subjectDid={subjectDid}
            subjectName={profile?.name}
            subjectHandle={profile?.bsky_handle || profile?.username}
          />
        )}
      />

      <div className="px-4">
        <ProfileTabNav tabs={tabs} activeTab={tab} onChange={setTab} primaryCount={4} />

        <div className="mt-4 space-y-4">
          {!isExternal && <ReputationSummary did={subjectDid} />}
          {tab === 'About' ? (
            <ProfileThemeView
              theme={profileConfig?.theme || 'default'}
              data={profileConfig?.personal}
              blockOrder={profileConfig?.block_order}
              did={subjectDid}
              profile={{ name: profile?.name, avatar: profile?.avatar, handle: profile?.bsky_handle || profile?.username, followers: profile?.followers_count || 0, following: profile?.follows_count || 0, description: profile?.description }}
              posts={posts}
            />
          ) : tab === 'Journey' ? (
            <MilestonesTimeline milestones={profileConfig?.personal?.milestones || []} />
          ) : tab === 'Hub' ? (
            <EngagementHub did={subjectDid} />
          ) : tab === 'Activity' ? (
            isExternal ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <p>{t('userProfile.noOnSiteActivity')}</p>
                <a href={`https://bsky.app/profile/${subjectDid}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                  {t('userProfile.viewOnBluesky')} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
              <ActivityTab did={subjectDid} />
            )
          ) : tab === 'Trades' ? (
            isExternal ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{t('userProfile.tradeHistoryMembers')}</p>
            ) : (
              <TradeHistoryTab did={subjectDid} permittedFields={profileConfig?.tradeFields} />
            )
          ) : tab === 'Collections' ? (
            isExternal ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{t('userProfile.sharedCollectionsMembers')}</p>
            ) : (
              <SharedCollectionsTab did={subjectDid} />
            )
          ) : loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filterPosts(posts).length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {isExternal ? t('userProfile.noPostsBluesky') : t('userProfile.noPostsYet')}
            </p>
          ) : (
            filterPosts(posts).map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      </div>
    </div>
  );
}