// Display specs for the scarce achievement taxonomy. Keys mirror the
// achievementEngine.ts ACHIEVEMENT_KEYS and the Achievement entity enum.
import {
  Trophy,
  Sparkles,
  Footprints,
  ShieldCheck,
  Link2,
  ScanLine,
  BookOpen,
  Radio,
} from 'lucide-react';

export const GLOW_CLASS = {
  bronze: 'rarity-glow-rare', // blue
  silver: 'rarity-glow-holo', // gold
  gold: 'rarity-glow-holo', // gold
  diamond: 'rarity-glow-ex', // purple
  default: 'rarity-glow-holo', // gold
};

export const ACHIEVEMENT_SPECS = [
  {
    key: 'set_completion_25',
    label: 'Set Completer — Bronze',
    description: 'Reached 25% of a set',
    pillar: 'collection',
    tier: 'bronze',
    glow: 'bronze',
    threshold: '25% of any set (verified vs TCGDex)',
    icon: Trophy,
  },
  {
    key: 'set_completion_50',
    label: 'Set Completer — Silver',
    description: 'Reached 50% of a set',
    pillar: 'collection',
    tier: 'silver',
    glow: 'silver',
    threshold: '50% of any set',
    icon: Trophy,
  },
  {
    key: 'set_completion_75',
    label: 'Set Completer — Gold',
    description: 'Reached 75% of a set',
    pillar: 'collection',
    tier: 'gold',
    glow: 'gold',
    threshold: '75% of any set',
    icon: Trophy,
  },
  {
    key: 'set_completion_100',
    label: 'Set Completer — Diamond',
    description: 'Completed an entire set — the ultimate flex',
    pillar: 'collection',
    tier: 'diamond',
    glow: 'diamond',
    threshold: '100% of any set',
    icon: Trophy,
  },
  {
    key: 'shiny_hunter',
    label: 'Shiny Hunter',
    description: 'Collected 50+ rare, holo or secret rare cards',
    pillar: 'collection',
    glow: 'default',
    threshold: '50 high-tier cards',
    icon: Sparkles,
  },
  {
    key: 'first_trade',
    label: 'First Step',
    description: 'Completed your first trade',
    pillar: 'trust',
    glow: 'default',
    threshold: '1 completed trade with feedback',
    icon: Footprints,
  },
  {
    key: 'trusted_trader',
    label: 'Trusted Trader',
    description: '50 unique vouches from distinct collectors — the crown jewel of social proof',
    pillar: 'trust',
    glow: 'diamond',
    threshold: '50 unique vouches + trust ≥ 40',
    icon: ShieldCheck,
  },
  {
    key: 'chain_weaver',
    label: 'Chain Weaver',
    description: 'Completed a multi-party circular trade (3+ parties)',
    pillar: 'trust',
    glow: 'default',
    threshold: '1 completed trade chain',
    icon: Link2,
  },
  {
    key: 'scanner_sage',
    label: 'Scanner Sage',
    description: '100 accepted scanner corrections — accuracy over volume',
    pillar: 'community',
    glow: 'default',
    threshold: '100 scanner corrections',
    icon: ScanLine,
  },
  {
    key: 'binder_curator',
    label: 'Binder Curator',
    description: 'A 5+ page showcase binder with 10+ likes',
    pillar: 'community',
    glow: 'default',
    threshold: '5 pages + 10 likes',
    icon: BookOpen,
  },
  {
    key: 'community_voice',
    label: 'Community Voice',
    description: 'Hosted a voice space to completion',
    pillar: 'community',
    glow: 'default',
    threshold: '1 completed voice space',
    icon: Radio,
  },
];

export const PILLARS = [
  { id: 'collection', label: 'Collection Mastery', desc: 'The Hunter' },
  { id: 'trust', label: 'Trust & Trade', desc: 'The Merchant' },
  { id: 'community', label: 'Community & Contribution', desc: 'The Builder' },
];