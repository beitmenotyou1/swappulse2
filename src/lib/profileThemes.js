// Preset profile themes (header gradient) and default visibility/section
// configuration for the enhanced profile. Gradient class strings are written
// as literals here so Tailwind's purge detects them.

export const PROFILE_THEMES = [
  { key: 'default', label: 'SwapPulse', gradient: 'from-primary/40 via-rarity-holo/30 to-accent/30' },
  { key: 'vintage', label: 'Vintage', gradient: 'from-amber-500/40 via-orange-400/30 to-yellow-300/30' },
  { key: 'competitive', label: 'Competitive', gradient: 'from-blue-500/40 via-indigo-400/30 to-cyan-300/30' },
  { key: 'shiny', label: 'Shiny', gradient: 'from-fuchsia-500/40 via-pink-400/30 to-rose-300/30' },
  { key: 'investment', label: 'Investment', gradient: 'from-emerald-500/40 via-teal-400/30 to-green-300/30' },
];

export const DEFAULT_THEME = 'default';

export function themeGradient(key) {
  return (PROFILE_THEMES.find((th) => th.key === key) || PROFILE_THEMES[0]).gradient;
}

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
  bio: 'Bio',
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