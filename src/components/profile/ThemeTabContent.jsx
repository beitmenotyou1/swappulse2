import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import PostCard from '@/components/feed/PostCard';
import MilestonesTimeline from '@/components/profile/MilestonesTimeline';
import EngagementHub from '@/components/profile/EngagementHub';
import ActivityTab from '@/components/profile/ActivityTab';
import NetworkFeedSection from '@/components/feed/NetworkFeedSection';
import TradeActivityTab from '@/components/profile/TradeActivityTab';
import ReputationDashboard from '@/components/profile/ReputationDashboard';
import ReputationSummary from '@/components/profile/ReputationSummary';
import FollowingTab from '@/components/profile/FollowingTab';
import JournalsTab from '@/components/profile/JournalsTab';
import PodcastsTab from '@/components/profile/PodcastsTab';
import CrossPostTab from '@/components/crosspost/CrossPostTab';
import TradeHistoryTab from '@/components/profile/TradeHistoryTab';
import SharedCollectionsTab from '@/components/profile/SharedCollectionsTab';
import DomainHandleCard from '@/components/profile/DomainHandleCard';
import WeeklyDigestToggle from '@/components/profile/WeeklyDigestToggle';
import DataPrivacy from '@/components/profile/DataPrivacy';
import { useT } from '@/lib/i18n/I18nProvider';

import FacebookTheme from '@/components/profile/themes/FacebookTheme';
import BlueskyTheme from '@/components/profile/themes/BlueskyTheme';
import MastodonTheme from '@/components/profile/themes/MastodonTheme';
import XTheme from '@/components/profile/themes/XTheme';
import YouTubeTheme from '@/components/profile/themes/YouTubeTheme';
import RedditTheme from '@/components/profile/themes/RedditTheme';

import SwapPulseLanding from '@/components/profile/landings/SwapPulseLanding';
import VintageLanding from '@/components/profile/landings/VintageLanding';
import CompetitiveLanding from '@/components/profile/landings/CompetitiveLanding';
import ShinyLanding from '@/components/profile/landings/ShinyLanding';
import InvestmentLanding from '@/components/profile/landings/InvestmentLanding';

import {
  LikesTab, BinderTab, TradeStatsTab, AchievementsTab, RewardsTab,
  LeaderboardTab, PortfolioTab, VideosTab, PlaylistsTab, ChannelsTab,
  FriendsTab, PhotosTab,
} from '@/components/profile/ThemeTabRenderers';

const PLATFORM_LANDINGS = {
  facebook: FacebookTheme,
  bluesky: BlueskyTheme,
  mastodon: MastodonTheme,
  x: XTheme,
  youtube: YouTubeTheme,
  reddit: RedditTheme,
};

const NATIVE_LANDINGS = {
  default: SwapPulseLanding,
  vintage: VintageLanding,
  competitive: CompetitiveLanding,
  shiny: ShinyLanding,
  investment: InvestmentLanding,
};

function LandingView({ theme, did, isOwner, config, profile, posts, collection, trades, reputation, journals }) {
  const personalInfo = config?.personal || config;
  const blockOrder = config?.block_order;
  const PlatformLanding = PLATFORM_LANDINGS[theme];
  const NativeLanding = NATIVE_LANDINGS[theme];
  // Normalize profile fields for platform theme components that expect
  // handle/followers/following shorthand rather than the full profile object.
  const platformProfile = {
    ...profile,
    handle: profile?.bsky_handle || profile?.username,
    followers: profile?.followers_count || 0,
    following: profile?.follows_count || 0,
  };
  if (PlatformLanding) {
    return <PlatformLanding data={personalInfo} blockOrder={blockOrder} did={did} isOwner={isOwner} profile={platformProfile} posts={posts} />;
  }
  if (NativeLanding) {
    return <NativeLanding data={personalInfo} blockOrder={blockOrder} did={did} isOwner={isOwner} profile={profile} posts={posts} collection={collection} trades={trades} reputation={reputation} journals={journals} />;
  }
  return <SwapPulseLanding data={personalInfo} blockOrder={blockOrder} did={did} isOwner={isOwner} profile={profile} posts={posts} collection={collection} trades={trades} reputation={reputation} journals={journals} />;
}

// ThemeTabContent — dispatches the active tab to the appropriate content
// renderer. Shared tabs (Posts, Binder, Trades, etc.) reuse existing
// components; theme-specific tabs (Videos, Playlists, Friends, etc.) use
// dedicated renderers from ThemeTabRenderers. The About/Home tab dispatches
// to the theme's landing component.
export default function ThemeTabContent({ theme, tabKey, did, isOwner, isExternal, config, profile, posts, collection, trades, reputation, journals, liveSpace, onReload, visitorExtras }) {
  const t = useT();
  const personalInfo = config?.personal || config;

  // Landing / About / Home
  if (tabKey === 'About' || tabKey === 'Home') {
    return <LandingView theme={theme} did={did} isOwner={isOwner} config={config} profile={profile} posts={posts} collection={collection} trades={trades} reputation={reputation} journals={journals} />;
  }

  // Posts
  if (tabKey === 'Posts') {
    if (!posts || posts.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">{isExternal ? t('userProfile.noPostsBluesky') : t('userProfile.noPostsYet')}</p>;
    return <div>{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>;
  }

  // Replies
  if (tabKey === 'Replies') {
    const replies = (posts || []).filter((p) => p.reply_to || p.parent_uri);
    if (replies.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">No replies yet.</p>;
    return <div>{replies.map((p) => <PostCard key={p.id} post={p} />)}</div>;
  }

  // Media
  if (tabKey === 'Media') {
    const media = (posts || []).filter((p) => p.card_id || p.image_uri);
    if (media.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">No media yet.</p>;
    return <div>{media.map((p) => <PostCard key={p.id} post={p} />)}</div>;
  }

  // Likes
  if (tabKey === 'Likes') return <LikesTab did={did} isOwner={isOwner} />;

  // Binder
  if (tabKey === 'Binder') return <BinderTab collection={collection} did={did} />;

  // Collection
  if (tabKey === 'Collection') {
    if (!isOwner) return <SharedCollectionsTab did={did} />;
    return <div className="p-4"><NetworkFeedSection type="collections" did={did} limit={24} title={t('profile.myCollectionNetwork')} /></div>;
  }

  // Trades
  if (tabKey === 'Trades') {
    if (isExternal) return <p className="py-16 text-center text-sm text-muted-foreground">{t('userProfile.tradeHistoryMembers')}</p>;
    if (!isOwner) return <TradeHistoryTab did={did} permittedFields={visitorExtras?.tradeFields} />;
    return <div className="p-4"><NetworkFeedSection type="trades" did={did} limit={20} title={t('profile.myTradesNetwork')} /></div>;
  }

  // Trade Stats (Competitive)
  if (tabKey === 'TradeStats') return <TradeStatsTab trades={trades} did={did} />;

  // Achievements
  if (tabKey === 'Achievements') return <AchievementsTab did={did} isOwner={isOwner} />;

  // Rewards (Shiny)
  if (tabKey === 'Rewards') return <RewardsTab did={did} />;

  // Milestones / Journey
  if (tabKey === 'Milestones' || tabKey === 'Journey') {
    return <div className="py-4"><MilestonesTimeline milestones={personalInfo?.milestones || config?.milestones || []} /></div>;
  }

  // Leaderboard (Competitive)
  if (tabKey === 'Leaderboard') return <LeaderboardTab did={did} />;

  // Reputation
  if (tabKey === 'Reputation') {
    if (isOwner) return <ReputationDashboard reputation={reputation} trades={trades} />;
    return <ReputationSummary did={did} />;
  }

  // Activity / Comments
  if (tabKey === 'Activity' || tabKey === 'Comments') {
    if (isExternal) {
      return (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <p>{t('userProfile.noOnSiteActivity')}</p>
          <a href={`https://bsky.app/profile/${did}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            {t('userProfile.viewOnBluesky')} <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      );
    }
    return <ActivityTab did={did} />;
  }

  // Hub
  if (tabKey === 'Hub') return <div className="py-4"><EngagementHub did={did} /></div>;

  // Following (owner only)
  if (tabKey === 'Following') return <FollowingTab />;

  // Journals (owner only)
  if (tabKey === 'Journals') return <JournalsTab journals={journals} collection={collection} onSaved={onReload} />;

  // Podcasts
  if (tabKey === 'Podcasts') return <PodcastsTab did={did} />;

  // Portfolio (Investment)
  if (tabKey === 'Portfolio') return <PortfolioTab collection={collection} did={did} />;

  // Market Watch (Investment)
  if (tabKey === 'MarketWatch') {
    return (
      <div className="p-4 text-center">
        <Link to="/market" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          <TrendingUp className="h-4 w-4" /> Open Market Watch
        </Link>
      </div>
    );
  }

  // Videos (YouTube)
  if (tabKey === 'Videos') return <VideosTab did={did} />;

  // Playlists (YouTube)
  if (tabKey === 'Playlists') return <PlaylistsTab did={did} />;

  // Channels (YouTube)
  if (tabKey === 'Channels') return <ChannelsTab did={did} />;

  // Friends (Facebook)
  if (tabKey === 'Friends') return <FriendsTab did={did} />;

  // Photos (Facebook)
  if (tabKey === 'Photos') return <PhotosTab collection={collection} did={did} />;

  // Cross-Posting (owner only)
  if (tabKey === 'Cross-Posting') return <CrossPostTab />;

  // Privacy (owner only)
  if (tabKey === 'Privacy') {
    return (
      <div className="p-4 space-y-4">
        <DomainHandleCard />
        <WeeklyDigestToggle />
        <DataPrivacy />
      </div>
    );
  }

  return null;
}