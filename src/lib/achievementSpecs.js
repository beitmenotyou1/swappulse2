// Display helpers for the achievement taxonomy. The versioned JSON config
// (served by evaluateAchievements) is the source of truth for names, tiers,
// categories, visuals and proof requirements; this module only maps ids to
// lucide icons and categories to display pillars (icons can't come from JSON).
import {
  Trophy, Sparkles, Footprints, ShieldCheck, Link2, ScanLine, BookOpen, Radio, Star,
} from 'lucide-react';

export const ACHIEVEMENT_ICONS = {
  set_completer_bronze: Trophy,
  set_completer_silver: Trophy,
  set_completer_gold: Trophy,
  set_completer_diamond: Trophy,
  shiny_hunter: Sparkles,
  first_trade: Footprints,
  trusted_trader: ShieldCheck,
  chain_weaver: Link2,
  scanner_sage: ScanLine,
  binder_curator: BookOpen,
  community_voice: Radio,
  card_reviewer: Star,
};

const CATEGORY_TO_PILLAR = {
  collection: 'collection',
  trade: 'trust',
  reputation: 'trust',
  contribution: 'community',
};

export const categoryToPillar = (category) => CATEGORY_TO_PILLAR[category] || 'community';

export const PILLARS = [
  { id: 'collection', label: 'Collection Mastery', desc: 'The Hunter' },
  { id: 'trust', label: 'Trust & Trade', desc: 'The Merchant' },
  { id: 'community', label: 'Community & Contribution', desc: 'The Builder' },
];

export function hexToRgba(hex, opacity = 0.3) {
  const h = (hex || '#F5B700').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}