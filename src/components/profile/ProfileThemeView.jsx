import React from 'react';
import ProfileBlocks from '@/components/profile/ProfileBlocks';
import FacebookTheme from '@/components/profile/themes/FacebookTheme';
import BlueskyTheme from '@/components/profile/themes/BlueskyTheme';
import MastodonTheme from '@/components/profile/themes/MastodonTheme';
import XTheme from '@/components/profile/themes/XTheme';
import YouTubeTheme from '@/components/profile/themes/YouTubeTheme';
import RedditTheme from '@/components/profile/themes/RedditTheme';

const PLATFORM_THEMES = {
  facebook: FacebookTheme,
  bluesky: BlueskyTheme,
  mastodon: MastodonTheme,
  x: XTheme,
  youtube: YouTubeTheme,
  reddit: RedditTheme,
};

// ProfileThemeView — dispatches the About/landing view to the platform-
// specific layout for platform themes, or falls back to ProfileBlocks for
// gradient themes. Tabbed sections are unaffected; only the About view
// restructures.
export default function ProfileThemeView({ theme, data, blockOrder, did, isOwner, profile, posts }) {
  const Theme = PLATFORM_THEMES[theme];
  if (Theme) {
    return <Theme data={data} blockOrder={blockOrder} did={did} isOwner={isOwner} profile={profile} posts={posts} />;
  }
  return <ProfileBlocks data={data} blockOrder={blockOrder} did={did} isOwner={isOwner} />;
}