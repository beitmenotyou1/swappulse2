// Preset profile themes — a single merged list of five gradient themes and
// five platform-emulating layout themes. Gradient themes restyle the header
// only; platform themes restructure the About/landing view into that
// platform's native layout. Gradient class strings are written as literals
// so Tailwind's purge detects them.

export const PROFILE_THEMES = [
  { key: 'default', label: 'SwapPulse', gradient: 'from-primary/40 via-rarity-holo/30 to-accent/30' },
  { key: 'vintage', label: 'Vintage', gradient: 'from-amber-500/40 via-orange-400/30 to-yellow-300/30' },
  { key: 'competitive', label: 'Competitive', gradient: 'from-blue-500/40 via-indigo-400/30 to-cyan-300/30' },
  { key: 'shiny', label: 'Shiny', gradient: 'from-fuchsia-500/40 via-pink-400/30 to-rose-300/30' },
  { key: 'investment', label: 'Investment', gradient: 'from-emerald-500/40 via-teal-400/30 to-green-300/30' },
  { key: 'bluesky', label: 'Feed', gradient: 'from-sky-400/40 via-blue-400/30 to-indigo-300/30', platform: true },
  { key: 'facebook', label: 'Social Hub', gradient: 'from-blue-600/40 via-blue-500/30 to-blue-400/30', platform: true },
  { key: 'mastodon', label: 'Federated', gradient: 'from-purple-500/40 via-violet-400/30 to-fuchsia-300/30', platform: true },
  { key: 'x', label: 'Microblog', gradient: 'from-slate-700/40 via-slate-600/30 to-slate-400/30', platform: true },
  { key: 'youtube', label: 'Podcast', gradient: 'from-red-600/40 via-red-500/30 to-rose-400/30', platform: true },
];

export const DEFAULT_THEME = 'default';

export function themeGradient(key) {
  return (PROFILE_THEMES.find((th) => th.key === key) || PROFILE_THEMES[0]).gradient;
}

export function isPlatformTheme(key) {
  return !!(PROFILE_THEMES.find((th) => th.key === key)?.platform);
}

// Per-theme immersive configuration: tab set + order, header variant, accent
// colour, and optional container class. Each theme fully reshapes the profile
// — header style, tab set, and content layout — via ImmersiveProfile +
// ThemeHeader + ThemeTabContent. Owner customisation (section_order,
// hidden_sections) applies within each theme's tab set; tabs not in the
// theme's set are ignored.
export const THEME_CONFIGS = {
  default: {
    label: 'SwapPulse',
    accentHex: '#6d4aff',
    headerVariant: 'default',
    containerClass: '',
    tabs: [
      { key: 'About', label: 'About' },
      { key: 'Posts', label: 'Posts' },
      { key: 'Journey', label: 'Journey' },
      { key: 'Hub', label: 'Hub' },
      { key: 'Activity', label: 'Activity' },
      { key: 'Binder', label: 'Binder' },
      { key: 'Collection', label: 'Collection' },
      { key: 'Trades', label: 'Trades' },
      { key: 'Achievements', label: 'Achievements' },
      { key: 'Reputation', label: 'Reputation' },
      { key: 'Following', label: 'Following' },
      { key: 'Journals', label: 'Journals' },
      { key: 'Podcasts', label: 'Podcasts' },
    ],
  },
  vintage: {
    label: 'Vintage',
    accentHex: '#92400e',
    headerVariant: 'vintage',
    containerClass: '',
    tabs: [
      { key: 'About', label: 'About' },
      { key: 'Posts', label: 'Posts' },
      { key: 'Binder', label: 'Binder' },
      { key: 'Trades', label: 'Trades' },
    ],
  },
  competitive: {
    label: 'Competitive',
    accentHex: '#3b82f6',
    headerVariant: 'competitive',
    containerClass: 'dark bg-slate-900',
    tabs: [
      { key: 'About', label: 'Stats' },
      { key: 'Achievements', label: 'Achievements' },
      { key: 'Leaderboard', label: 'Leaderboard' },
      { key: 'TradeStats', label: 'Trade Stats' },
      { key: 'Reputation', label: 'Reputation' },
      { key: 'Posts', label: 'Posts' },
      { key: 'Trades', label: 'Trades' },
    ],
  },
  shiny: {
    label: 'Shiny',
    accentHex: '#fbbf24',
    headerVariant: 'shiny',
    containerClass: '',
    tabs: [
      { key: 'About', label: 'Showcase' },
      { key: 'Achievements', label: 'Achievements' },
      { key: 'Rewards', label: 'Rewards' },
      { key: 'Milestones', label: 'Milestones' },
      { key: 'Binder', label: 'Binder' },
      { key: 'Posts', label: 'Posts' },
    ],
  },
  investment: {
    label: 'Investment',
    accentHex: '#059669',
    headerVariant: 'investment',
    containerClass: '',
    tabs: [
      { key: 'About', label: 'Overview' },
      { key: 'Collection', label: 'Collection' },
      { key: 'Binder', label: 'Binder' },
      { key: 'Portfolio', label: 'Portfolio' },
      { key: 'MarketWatch', label: 'Market' },
      { key: 'Trades', label: 'Trades' },
    ],
  },
  youtube: {
    label: 'Podcast',
    accentHex: '#FF0000',
    headerVariant: 'youtube',
    containerClass: '',
    tabs: [
      { key: 'Home', label: 'Home' },
      { key: 'Episodes', label: 'Episodes' },
      { key: 'Live Now', label: 'Live Now' },
      { key: 'Shows', label: 'Shows' },
      { key: 'About', label: 'About' },
    ],
  },
  x: {
    label: 'Microblog',
    accentHex: '#0f172a',
    headerVariant: 'x',
    containerClass: '',
    tabs: [
      { key: 'Posts', label: 'Posts' },
      { key: 'Replies', label: 'Replies' },
      { key: 'Media', label: 'Media' },
      { key: 'Likes', label: 'Likes' },
      { key: 'About', label: 'About' },
    ],
  },
  facebook: {
    label: 'Social Hub',
    accentHex: '#1877F2',
    headerVariant: 'facebook',
    containerClass: '',
    tabs: [
      { key: 'Posts', label: 'Posts' },
      { key: 'About', label: 'About' },
      { key: 'Friends', label: 'Friends' },
      { key: 'Photos', label: 'Photos' },
    ],
  },
  bluesky: {
    label: 'Feed',
    accentHex: '#0085ff',
    headerVariant: 'bluesky',
    containerClass: '',
    tabs: [
      { key: 'Posts', label: 'Posts' },
      { key: 'Replies', label: 'Replies' },
      { key: 'About', label: 'About' },
    ],
  },
  mastodon: {
    label: 'Federated',
    accentHex: '#6364ff',
    headerVariant: 'mastodon',
    containerClass: '',
    tabs: [
      { key: 'Posts', label: 'Posts' },
      { key: 'Replies', label: 'Replies' },
      { key: 'Media', label: 'Media' },
      { key: 'About', label: 'About' },
    ],
  },
};

export function getThemeConfig(key) {
  return THEME_CONFIGS[key] || THEME_CONFIGS.default;
}

// Comprehensive tab labels merged from all 11 themes — used by the profile
// editor to label tabs that may belong to any theme's tab set.
export const ALL_TAB_LABELS = Object.fromEntries(
  Object.values(THEME_CONFIGS).flatMap((cfg) => cfg.tabs.map((t) => [t.key, t.label]))
);

// Default per-field visibility for personal-info and trade-detail fields.
export const DEFAULT_FIELD_VISIBILITY = {
  bio: 'public',
  pronouns: 'public',
  interests: 'public',
  favourite_pokemon: 'public',
  favourite_sets: 'public',
  location: 'followers',
  website: 'public',
  social_links: 'public',
  contact_email: 'followers',
  milestones: 'public',
  trade_values: 'followers',
  trade_partners: 'followers',
  trade_dates: 'public',
};

export const VISIBILITY_FIELDS = Object.keys(DEFAULT_FIELD_VISIBILITY);

// Content blocks for the About section — drag-to-reorder keys + labels.
export const BLOCK_LABELS = {
  interests: 'Interests & hobbies',
  favourite_pokemon: 'Favourite Pokémon',
  favourite_sets: 'Favourite sets',
  milestones: 'Journey milestones',
  contact: 'Contact & links',
  binder: 'Binder preview',
  trades: 'Recent trades',
  collections: 'Collections',
  hub: 'Engagement hub',
};

export const DEFAULT_BLOCK_ORDER = Object.keys(BLOCK_LABELS);

// Default ordered sections for the owner's own profile.
export const DEFAULT_OWNER_SECTIONS = [
  'About', 'Posts', 'Journey', 'Hub', 'Activity', 'Binder', 'Collection', 'Trades',
  'Trade Activity', 'Reputation', 'Following', 'Journals', 'Podcasts', 'Cross-Posting', 'Privacy',
];

// Default ordered sections for a visitor viewing another collector's profile.
export const DEFAULT_VISITOR_SECTIONS = ['About', 'Posts', 'Journey', 'Hub', 'Trades', 'Collections', 'Activity'];

export function emptyConfig(did = '') {
  return {
    did,
    bio: '',
    pronouns: '',
    interests: [],
    favourite_pokemon: [],
    favourite_sets: [],
    location: '',
    website: '',
    social_links: [],
    contact_email: '',
    milestones: [],
    theme: DEFAULT_THEME,
    section_order: [...DEFAULT_OWNER_SECTIONS],
    block_order: [...DEFAULT_BLOCK_ORDER],
    hidden_sections: [],
    field_visibility: { ...DEFAULT_FIELD_VISIBILITY },
  };
}