import React from 'react';
import Avatar from '@/components/Avatar';
import RichText from '@/components/RichText';
import ProfileMetricsBar from '@/components/profile/ProfileMetricsBar';
import { themeGradient } from '@/lib/profileThemes';

// ThemeHeader — dispatches to a variant-specific header layout. Each variant
// arranges the same data (banner, avatar, name, handle, metrics, description,
// actions) into a distinct layout matching the theme's personality.
export default function ThemeHeader({ variant, theme, accentHex, profile, actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge, liveSpace, config }) {
  const VARIANTS = {
    default: DefaultHeader,
    vintage: VintageHeader,
    competitive: CompetitiveHeader,
    shiny: ShinyHeader,
    investment: InvestmentHeader,
    youtube: YouTubeHeader,
    reddit: RedditHeader,
    x: XHeader,
    facebook: FacebookHeader,
    bluesky: BlueskyHeader,
    mastodon: MastodonHeader,
  };
  const Header = VARIANTS[variant] || DefaultHeader;
  return (
    <Header
      theme={theme}
      accentHex={accentHex}
      profile={profile}
      actions={actions}
      extra={extra}
      badges={badges}
      reputationNode={reputationNode}
      backLink={backLink}
      externalBanner={externalBanner}
      avatarBadge={avatarBadge}
      liveSpace={liveSpace}
      config={config}
    />
  );
}

function Metrics({ followers, following, posts }) {
  return <ProfileMetricsBar followers={followers || 0} following={following || 0} posts={posts || 0} />;
}

// ── SwapPulse (default) ──────────────────────────────────────────────────
function DefaultHeader({ theme, profile, actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge }) {
  return (
    <div>
      <div className={`w-full overflow-hidden bg-gradient-to-r ${themeGradient('default')} h-32 sm:h-40`}>
        {profile?.header && <img src={profile.header} alt="Profile header" className="h-full w-full object-cover" />}
      </div>
      {externalBanner}
      <div className="px-4">
        {backLink && <div className="mt-2 mb-2">{backLink}</div>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between -mt-10 sm:-mt-12">
          <span className="relative inline-block w-fit">
            <Avatar name={profile?.name} src={profile?.avatar} size={96} className="ring-4 ring-background" />
            {avatarBadge}
          </span>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-4 space-y-2.5 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold">{profile?.name}</h1>
            {badges}
          </div>
          {profile?.bsky_handle && <p className="text-sm text-muted-foreground">@{profile.bsky_handle}</p>}
          <Metrics followers={profile?.followers_count} following={profile?.follows_count} posts={profile?.posts_count} />
          {profile?.description && <RichText text={profile.description} className="text-sm" />}
          {reputationNode}
          {extra}
        </div>
      </div>
    </div>
  );
}

// ── Vintage ──────────────────────────────────────────────────────────────
function VintageHeader({ profile, actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge }) {
  return (
    <div>
      <div className="w-full overflow-hidden bg-gradient-to-r from-amber-100 via-orange-50 to-yellow-50 h-24 sm:h-32">
        {profile?.header && <img src={profile.header} alt="Profile header" className="h-full w-full object-cover opacity-80" />}
      </div>
      {externalBanner}
      <div className="px-6">
        {backLink && <div className="mt-2 mb-2">{backLink}</div>}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between -mt-8 sm:-mt-10">
          <span className="relative inline-block w-fit">
            <Avatar name={profile?.name} src={profile?.avatar} size={80} className="ring-4 ring-amber-50" />
            {avatarBadge}
          </span>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-5 space-y-3 pb-2">
          <h1 className="font-serif text-2xl font-bold text-amber-900">{profile?.name}</h1>
          {badges}
          {profile?.bsky_handle && <p className="text-sm text-amber-700/70">@{profile.bsky_handle}</p>}
          <Metrics followers={profile?.followers_count} following={profile?.follows_count} posts={profile?.posts_count} />
          {profile?.description && <RichText text={profile.description} className="text-sm leading-relaxed text-amber-800/80" />}
          {reputationNode}
          {extra}
        </div>
      </div>
    </div>
  );
}

// ── Competitive ──────────────────────────────────────────────────────────
function CompetitiveHeader({ profile, actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge }) {
  return (
    <div className="bg-slate-900 text-white">
      <div className="w-full overflow-hidden bg-gradient-to-r from-blue-600/40 via-indigo-500/30 to-cyan-400/30 h-32 sm:h-40">
        {profile?.header && <img src={profile.header} alt="Profile header" className="h-full w-full object-cover opacity-60" />}
      </div>
      {externalBanner}
      <div className="px-4">
        {backLink && <div className="mt-2 mb-2">{backLink}</div>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between -mt-10 sm:-mt-12">
          <span className="relative inline-block w-fit">
            <Avatar name={profile?.name} src={profile?.avatar} size={96} className="ring-4 ring-slate-900" />
            {avatarBadge}
          </span>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-4 space-y-2.5 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black uppercase tracking-tight">{profile?.name}</h1>
            {badges}
          </div>
          {profile?.bsky_handle && <p className="text-sm text-slate-400">@{profile.bsky_handle}</p>}
          <div className="flex gap-4 text-sm font-bold">
            <span><b className="text-blue-400">{profile?.followers_count || 0}</b> <span className="text-slate-400">followers</span></span>
            <span><b className="text-blue-400">{profile?.follows_count || 0}</b> <span className="text-slate-400">following</span></span>
            <span><b className="text-blue-400">{profile?.posts_count || 0}</b> <span className="text-slate-400">posts</span></span>
          </div>
          {profile?.description && <RichText text={profile.description} className="text-sm text-slate-300" />}
          {reputationNode}
          {extra}
        </div>
      </div>
    </div>
  );
}

// ── Shiny ────────────────────────────────────────────────────────────────
function ShinyHeader({ profile, actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge }) {
  return (
    <div>
      <div className="w-full overflow-hidden bg-gradient-to-r from-amber-300/60 via-yellow-200/50 to-orange-200/40 h-32 sm:h-40">
        {profile?.header && <img src={profile.header} alt="Profile header" className="h-full w-full object-cover" />}
      </div>
      {externalBanner}
      <div className="px-4">
        {backLink && <div className="mt-2 mb-2">{backLink}</div>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between -mt-10 sm:-mt-12">
          <span className="relative inline-block w-fit">
            <div className="rarity-glow-holo rounded-full">
              <Avatar name={profile?.name} src={profile?.avatar} size={96} className="ring-4 ring-amber-50" />
            </div>
            {avatarBadge}
          </span>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-4 space-y-2.5 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-gradient-pulse">{profile?.name}</h1>
            {badges}
          </div>
          {profile?.bsky_handle && <p className="text-sm text-muted-foreground">@{profile.bsky_handle}</p>}
          <Metrics followers={profile?.followers_count} following={profile?.follows_count} posts={profile?.posts_count} />
          {profile?.description && <RichText text={profile.description} className="text-sm" />}
          {reputationNode}
          {extra}
        </div>
      </div>
    </div>
  );
}

// ── Investment ────────────────────────────────────────────────────────────
function InvestmentHeader({ profile, actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge }) {
  return (
    <div>
      <div className="w-full overflow-hidden bg-gradient-to-r from-emerald-500/40 via-teal-400/30 to-green-300/30 h-32 sm:h-40">
        {profile?.header && <img src={profile.header} alt="Profile header" className="h-full w-full object-cover" />}
      </div>
      {externalBanner}
      <div className="px-4">
        {backLink && <div className="mt-2 mb-2">{backLink}</div>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between -mt-10 sm:-mt-12">
          <span className="relative inline-block w-fit">
            <Avatar name={profile?.name} src={profile?.avatar} size={96} className="ring-4 ring-emerald-50" />
            {avatarBadge}
          </span>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-4 space-y-2.5 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-emerald-700">{profile?.name}</h1>
            {badges}
          </div>
          {profile?.bsky_handle && <p className="text-sm text-muted-foreground">@{profile.bsky_handle}</p>}
          <Metrics followers={profile?.followers_count} following={profile?.follows_count} posts={profile?.posts_count} />
          {profile?.description && <RichText text={profile.description} className="text-sm" />}
          {reputationNode}
          {extra}
        </div>
      </div>
    </div>
  );
}

// ── YouTube ───────────────────────────────────────────────────────────────
function YouTubeHeader({ profile, actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge }) {
  return (
    <div>
      <div className="w-full overflow-hidden bg-gradient-to-r from-red-600/40 via-red-500/30 to-rose-400/30 h-36 sm:h-44">
        {profile?.header && <img src={profile.header} alt="Channel art" className="h-full w-full object-cover" />}
      </div>
      <div className="h-1 bg-red-600" />
      {externalBanner}
      <div className="px-4">
        {backLink && <div className="mt-2 mb-2">{backLink}</div>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between -mt-8 sm:-mt-10">
          <div className="flex items-center gap-4">
            <span className="relative inline-block w-fit">
              <Avatar name={profile?.name} src={profile?.avatar} size={80} className="ring-4 ring-background" />
              {avatarBadge}
            </span>
            <div>
              <h1 className="text-xl font-bold">{profile?.name}</h1>
              <p className="text-sm text-muted-foreground">{profile?.followers_count || 0} subscribers</p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-3 space-y-2 pb-1">
          {badges}
          {profile?.description && <RichText text={profile.description} className="text-sm" />}
          {reputationNode}
          {extra}
        </div>
      </div>
    </div>
  );
}

// ── Reddit ────────────────────────────────────────────────────────────────
function RedditHeader({ profile, actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge }) {
  return (
    <div>
      <div className="w-full overflow-hidden bg-gradient-to-r from-orange-500/40 via-orange-400/30 to-amber-300/30 h-24 sm:h-28">
        {profile?.header && <img src={profile.header} alt="Profile header" className="h-full w-full object-cover" />}
      </div>
      <div className="h-1 bg-orange-500" />
      {externalBanner}
      <div className="px-4">
        {backLink && <div className="mt-2 mb-2">{backLink}</div>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between -mt-6 sm:-mt-8">
          <div className="flex items-center gap-3">
            <span className="relative inline-block w-fit">
              <Avatar name={profile?.name} src={profile?.avatar} size={64} className="ring-4 ring-background" />
              {avatarBadge}
            </span>
            <div>
              <h1 className="text-lg font-bold">u/{profile?.bsky_handle || profile?.name}</h1>
              <p className="text-xs text-muted-foreground">{profile?.followers_count || 0} followers · {profile?.posts_count || 0} posts</p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-3 space-y-2 pb-1">
          {badges}
          {profile?.description && <RichText text={profile.description} className="text-sm" />}
          {reputationNode}
          {extra}
        </div>
      </div>
    </div>
  );
}

// ── X ─────────────────────────────────────────────────────────────────────
function XHeader({ profile, actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge }) {
  return (
    <div>
      {externalBanner}
      <div className="px-4">
        {backLink && <div className="mt-2 mb-2">{backLink}</div>}
        <div className="flex flex-col items-center gap-2 pt-4">
          <span className="relative inline-block w-fit">
            <Avatar name={profile?.name} src={profile?.avatar} size={80} />
            {avatarBadge}
          </span>
          <h1 className="text-xl font-bold">{profile?.name}</h1>
          <p className="text-sm text-muted-foreground">@{profile?.bsky_handle}</p>
          <div className="flex gap-4 text-sm">
            <span><b>{profile?.following_count || 0}</b> <span className="text-muted-foreground">Following</span></span>
            <span><b>{profile?.followers_count || 0}</b> <span className="text-muted-foreground">Followers</span></span>
          </div>
          {badges}
          {profile?.description && <RichText text={profile.description} className="text-center text-sm" />}
          {actions && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
          {reputationNode}
          {extra}
        </div>
      </div>
    </div>
  );
}

// ── Facebook ──────────────────────────────────────────────────────────────
function FacebookHeader({ profile, actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge }) {
  return (
    <div>
      <div className="w-full overflow-hidden bg-gradient-to-r from-blue-600/40 via-blue-500/30 to-blue-400/30 h-32 sm:h-40">
        {profile?.header && <img src={profile.header} alt="Cover photo" className="h-full w-full object-cover" />}
      </div>
      <div className="h-1 bg-blue-600" />
      {externalBanner}
      <div className="px-4">
        {backLink && <div className="mt-2 mb-2">{backLink}</div>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between -mt-10 sm:-mt-12">
          <span className="relative inline-block w-fit">
            <Avatar name={profile?.name} src={profile?.avatar} size={96} className="ring-4 ring-background" />
            {avatarBadge}
          </span>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-4 space-y-2.5 pb-1">
          <h1 className="text-2xl font-bold text-blue-900">{profile?.name}</h1>
          {badges}
          <p className="text-sm text-muted-foreground">{profile?.followers_count || 0} followers · {profile?.following_count || 0} following</p>
          {profile?.description && <RichText text={profile.description} className="text-sm" />}
          {reputationNode}
          {extra}
        </div>
      </div>
    </div>
  );
}

// ── Bluesky ───────────────────────────────────────────────────────────────
function BlueskyHeader({ profile, actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge }) {
  return (
    <div>
      <div className="w-full overflow-hidden bg-gradient-to-r from-sky-400/40 via-blue-400/30 to-indigo-300/30 h-32 sm:h-40">
        {profile?.header && <img src={profile.header} alt="Profile header" className="h-full w-full object-cover" />}
      </div>
      {externalBanner}
      <div className="px-4">
        {backLink && <div className="mt-2 mb-2">{backLink}</div>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between -mt-10 sm:-mt-12">
          <span className="relative inline-block w-fit">
            <Avatar name={profile?.name} src={profile?.avatar} size={96} className="ring-4 ring-background" />
            {avatarBadge}
          </span>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-4 space-y-2.5 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-sky-700">{profile?.name}</h1>
            {badges}
          </div>
          {profile?.bsky_handle && <p className="text-sm text-sky-600">@{profile.bsky_handle}</p>}
          <Metrics followers={profile?.followers_count} following={profile?.follows_count} posts={profile?.posts_count} />
          {profile?.description && <RichText text={profile.description} className="text-sm" />}
          {reputationNode}
          {extra}
        </div>
      </div>
    </div>
  );
}

// ── Mastodon ──────────────────────────────────────────────────────────────
function MastodonHeader({ profile, actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge }) {
  return (
    <div>
      <div className="w-full overflow-hidden bg-gradient-to-r from-purple-500/40 via-violet-400/30 to-fuchsia-300/30 h-32 sm:h-40">
        {profile?.header && <img src={profile.header} alt="Profile header" className="h-full w-full object-cover" />}
      </div>
      <div className="h-1 bg-purple-500" />
      {externalBanner}
      <div className="px-4">
        {backLink && <div className="mt-2 mb-2">{backLink}</div>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between -mt-10 sm:-mt-12">
          <span className="relative inline-block w-fit">
            <Avatar name={profile?.name} src={profile?.avatar} size={96} className="ring-4 ring-background" />
            {avatarBadge}
          </span>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-4 space-y-2.5 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-purple-700">{profile?.name}</h1>
            {badges}
          </div>
          {profile?.bsky_handle && <p className="text-sm text-purple-600">@{profile.bsky_handle}</p>}
          <Metrics followers={profile?.followers_count} following={profile?.follows_count} posts={profile?.posts_count} />
          {profile?.description && <RichText text={profile.description} className="text-sm" />}
          {reputationNode}
          {extra}
        </div>
      </div>
    </div>
  );
}