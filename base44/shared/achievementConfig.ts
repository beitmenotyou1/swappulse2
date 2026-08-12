// §2.4 Versioned achievement configuration — the single source of truth for
// achievement IDs, proof requirements, thresholds, visuals and global
// settings. Bump ACHIEVEMENT_CONFIG_VERSION when rules change; the engine and
// nightly recalc both read from here so constraints live in one auditable place.
// (Base44 function bundles can't import a JSON file from outside the shared
// module, so the config is a typed const here rather than a separate .json.)

export const ACHIEVEMENT_CONFIG_VERSION = '1.0.0';
export const ACHIEVEMENT_CONFIG_LAST_UPDATED = '2026-08-12T00:00:00Z';

export const ACHIEVEMENT_ENTRIES: any[] = [
  {
    id: 'first_trade', name: 'First Step', description: 'Completed your first trade on SwapPulse',
    tier: 'bronze', category: 'trade', proof_type: 'count',
    proof_requirements: { record_type: 'org.swappulse.tradingFeedback', minimum_count: 1, must_have_vouch: false },
    visual: { medallion_color: '#F5B700', glow_color: '#C0C0C0', glow_opacity: 0.2 },
  },
  {
    id: 'set_completer_bronze', name: 'Set Completer (25%)', description: 'Collected 25% of all cards in a single set',
    tier: 'bronze', category: 'collection', proof_type: 'coverage',
    proof_requirements: { record_type: 'org.swappulse.collectionEntry', unique_card_percent: 25, deduplicate_variants: true, require_same_set: true },
    visual: { medallion_color: '#F5B700', glow_color: '#C0C0C0', glow_opacity: 0.2 },
  },
  {
    id: 'set_completer_silver', name: 'Set Completer (50%)', description: 'Collected 50% of all cards in a single set',
    tier: 'silver', category: 'collection', proof_type: 'coverage',
    proof_requirements: { record_type: 'org.swappulse.collectionEntry', unique_card_percent: 50, deduplicate_variants: true, require_same_set: true },
    visual: { medallion_color: '#F5B700', glow_color: '#3B82F6', glow_opacity: 0.25 },
  },
  {
    id: 'set_completer_gold', name: 'Set Completer (75%)', description: 'Collected 75% of all cards in a single set',
    tier: 'gold', category: 'collection', proof_type: 'coverage',
    proof_requirements: { record_type: 'org.swappulse.collectionEntry', unique_card_percent: 75, deduplicate_variants: true, require_same_set: true },
    visual: { medallion_color: '#F5B700', glow_color: '#F5B700', glow_opacity: 0.3 },
  },
  {
    id: 'set_completer_diamond', name: 'Set Completer (100%)', description: 'Collected every card in a single set',
    tier: 'diamond', category: 'collection', proof_type: 'coverage',
    proof_requirements: { record_type: 'org.swappulse.collectionEntry', unique_card_percent: 100, deduplicate_variants: true, require_same_set: true },
    visual: { medallion_color: '#F5B700', glow_color: '#8B5CF6', glow_opacity: 0.35 },
  },
  {
    id: 'trusted_trader', name: 'Trusted Trader', description: 'Received 50+ vouches from distinct traders',
    tier: 'platinum', category: 'reputation', proof_type: 'weighted_vouches',
    proof_requirements: { record_type: 'org.swappulse.vouch', minimum_distinct_vouchers: 50, exclude_revoked_months: 6, min_voucher_trust_score: 20, allow_self_vouch: false },
    visual: { medallion_color: '#F5B700', glow_color: '#8B5CF6', glow_opacity: 0.4 },
  },
  {
    id: 'chain_weaver', name: 'Chain Weaver', description: 'Successfully completed a multi-party circular trade',
    tier: 'silver', category: 'trade', proof_type: 'record_existence',
    proof_requirements: { record_type: 'org.swappulse.tradeChain', minimum_parties: 3, require_completion: true },
    visual: { medallion_color: '#F5B700', glow_color: '#3B82F6', glow_opacity: 0.25 },
  },
  {
    id: 'scanner_sage', name: 'Scanner Sage', description: 'Submitted 100 accurate AI scanner corrections',
    tier: 'gold', category: 'contribution', proof_type: 'accepted_submissions',
    proof_requirements: { record_type: 'org.swappulse.scannerCorrection', minimum_accepted_count: 100, max_reversal_rate: 0.05, verification_method: 'community_or_ai' },
    visual: { medallion_color: '#F5B700', glow_color: '#F5B700', glow_opacity: 0.3 },
  },
  {
    id: 'binder_curator', name: 'Binder Curator', description: 'Published a digital binder with 5+ populated pages',
    tier: 'silver', category: 'contribution', proof_type: 'quality_publication',
    proof_requirements: { record_type: 'org.swappulse.binder', minimum_pages_populated: 5, minimum_engagement: 10 },
    visual: { medallion_color: '#F5B700', glow_color: '#3B82F6', glow_opacity: 0.25 },
  },
  {
    id: 'community_voice', name: 'Community Voice', description: 'Hosted a voice space or meetup with 5+ participants',
    tier: 'bronze', category: 'contribution', proof_type: 'event_hosting',
    proof_requirements: { records: ['org.swappulse.voiceSpace', 'org.swappulse.meetup'], minimum_participants: 5, minimum_duration_minutes: 30 },
    visual: { medallion_color: '#F5B700', glow_color: '#C0C0C0', glow_opacity: 0.2 },
  },
  {
    id: 'shiny_hunter', name: 'Shiny Hunter', description: 'Collected 50+ rare/holo/secret rare cards across sets',
    tier: 'gold', category: 'collection', proof_type: 'filtered_collection',
    proof_requirements: { record_type: 'org.swappulse.collectionEntry', rarity_filters: ['Rare Holo', 'EX', 'V', 'VMAX', 'Secret Rare'], minimum_unique_cards: 50, require_different_sets: true },
    visual: { medallion_color: '#F5B700', glow_color: '#F5B700', glow_opacity: 0.35 },
  },
  {
    id: 'card_reviewer', name: 'Card Critic', description: 'Submitted 25+ structured card reviews',
    tier: 'bronze', category: 'contribution', proof_type: 'content_creation',
    proof_requirements: { record_type: 'org.swappulse.cardReview', minimum_reviews: 25, min_stars_given_average: 1 },
    visual: { medallion_color: '#F5B700', glow_color: '#C0C0C0', glow_opacity: 0.2 },
  },
];

export const TIER_MULTIPLIERS: Record<string, number> = { bronze: 1.0, silver: 1.5, gold: 2.0, diamond: 3.0, platinum: 4.0 };

export const GLOBAL_SETTINGS: any = {
  max_achievements_per_user_display: 12,
  allow_achievement_export: true,
  export_format: 'json-ld',
  revocation_grace_period_hours: 24,
};

// Shape returned to the UI so the frontend renders from the same source of truth.
export const ACHIEVEMENT_CONFIG_RAW = {
  version: ACHIEVEMENT_CONFIG_VERSION,
  last_updated: ACHIEVEMENT_CONFIG_LAST_UPDATED,
  achievements: ACHIEVEMENT_ENTRIES,
  tier_multipliers: TIER_MULTIPLIERS,
  global_settings: GLOBAL_SETTINGS,
};

export const ACHIEVEMENT_CONFIG: Record<string, any> = Object.fromEntries(
  ACHIEVEMENT_ENTRIES.map((a: any) => [a.id, a]),
);

export const ACHIEVEMENT_KEYS: string[] = ACHIEVEMENT_ENTRIES.map((a: any) => a.id);

// Nightly recalc only re-evaluates credentials that can change due to other
// users' actions or the user's own non-collection activity. Set completion +
// shiny hunter depend on the user's collection (+ TCGDex) and are re-evaluated
// on-demand when they visit /achievements, so the nightly job leaves them
// untouched (and never revokes them due to missing TCGDex data).
export const NIGHTLY_KEYS: string[] = ACHIEVEMENT_KEYS.filter(
  (k) => !k.startsWith('set_completer_') && k !== 'shiny_hunter',
);