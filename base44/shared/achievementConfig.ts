// §2.4 Versioned achievement threshold configuration.
// Single source of truth for proof requirements and minimum thresholds.
// Adjustments are transparent and auditable — bump ACHIEVEMENT_CONFIG_VERSION
// when rules change. Both the on-demand evaluator and the nightly recalc read
// from this table, so the constraints live in exactly one place.

export const ACHIEVEMENT_CONFIG_VERSION = 'v1';

export type Pillar = 'collection' | 'trust' | 'community';
export type Tier = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface AchievementThresholds {
  // Set Completer
  minPct?: number;
  requireAllUnique?: boolean; // 100% unique card URIs from TCGDex — duplicates don't count
  // Shiny Hunter
  minHighTierCards?: number;
  // First Step
  minCompletedTrades?: number;
  // Trusted Trader
  minDistinctVouches?: number;
  minTrustScore?: number;
  vouchFreshnessMonths?: number; // disqualify if any incoming vouch revoked within this window
  // Chain Weaver
  minCompletedChains?: number;
  minChainParticipants?: number;
  // Scanner Sage
  minCorrections?: number;
  maxReversalRatePct?: number; // ≤ N% reversal rate (pending a reversal field on ScannerCorrection)
  // Binder Curator
  minBinderPages?: number;
  minBinderLikes?: number;
  // Community Voice
  minCompletedSpaces?: number;
}

export interface AchievementRule {
  key: string;
  label: string;
  pillar: Pillar;
  tier?: Tier;
  description: string;
  thresholds: AchievementThresholds;
}

export const ACHIEVEMENT_CONFIG: Record<string, AchievementRule> = {
  set_completion_25: {
    key: 'set_completion_25', label: 'Set Completer — Bronze', pillar: 'collection', tier: 'bronze',
    description: 'Reached 25% of a set', thresholds: { minPct: 25, requireAllUnique: true },
  },
  set_completion_50: {
    key: 'set_completion_50', label: 'Set Completer — Silver', pillar: 'collection', tier: 'silver',
    description: 'Reached 50% of a set', thresholds: { minPct: 50, requireAllUnique: true },
  },
  set_completion_75: {
    key: 'set_completion_75', label: 'Set Completer — Gold', pillar: 'collection', tier: 'gold',
    description: 'Reached 75% of a set', thresholds: { minPct: 75, requireAllUnique: true },
  },
  set_completion_100: {
    key: 'set_completion_100', label: 'Set Completer — Diamond', pillar: 'collection', tier: 'diamond',
    description: 'Completed an entire set', thresholds: { minPct: 100, requireAllUnique: true },
  },
  shiny_hunter: {
    key: 'shiny_hunter', label: 'Shiny Hunter', pillar: 'collection',
    description: 'Collected 50+ rare, holo or secret rare cards', thresholds: { minHighTierCards: 50 },
  },
  first_trade: {
    key: 'first_trade', label: 'First Step', pillar: 'trust',
    description: 'Completed your first trade', thresholds: { minCompletedTrades: 1 },
  },
  trusted_trader: {
    key: 'trusted_trader', label: 'Trusted Trader', pillar: 'trust',
    description: '50 unique vouches from distinct DIDs, trust ≥ 40, none revoked in 6 months',
    thresholds: { minDistinctVouches: 50, minTrustScore: 40, vouchFreshnessMonths: 6 },
  },
  chain_weaver: {
    key: 'chain_weaver', label: 'Chain Weaver', pillar: 'trust',
    description: 'Completed a multi-party circular trade (3+ parties)',
    thresholds: { minCompletedChains: 1, minChainParticipants: 3 },
  },
  scanner_sage: {
    key: 'scanner_sage', label: 'Scanner Sage', pillar: 'community',
    description: '100 accepted scanner corrections with ≤5% reversal rate',
    thresholds: { minCorrections: 100, maxReversalRatePct: 5 },
  },
  binder_curator: {
    key: 'binder_curator', label: 'Binder Curator', pillar: 'community',
    description: 'A 5+ page binder with 10+ likes', thresholds: { minBinderPages: 5, minBinderLikes: 10 },
  },
  community_voice: {
    key: 'community_voice', label: 'Community Voice', pillar: 'community',
    description: 'Hosted a voice space to completion', thresholds: { minCompletedSpaces: 1 },
  },
};

export const ACHIEVEMENT_KEYS = Object.keys(ACHIEVEMENT_CONFIG);

// Nightly recalc only re-evaluates credentials that can change due to OTHER
// users' actions (vouches, feedback, chains) or the user's own non-collection
// activity. Set completion + shiny hunter depend on the user's collection
// (re-evaluated on-demand when they visit /achievements, which fetches TCGDex),
// so the nightly job leaves them untouched.
export const NIGHTLY_KEYS = ACHIEVEMENT_KEYS.filter(
  (k) => !k.startsWith('set_completion_') && k !== 'shiny_hunter',
);