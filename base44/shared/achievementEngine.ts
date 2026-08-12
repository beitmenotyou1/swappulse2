// §2.4 Achievement engine — scarce, proof-based credential evaluation.
// Pure functions over pre-fetched entity rows. The backend function fetches
// proof data (and TCGDex set sizes) and passes it in; this module returns
// grant/revoke decisions per achievement key. No SDK calls inside.

export interface EvalResult {
  key: string;
  qualified: boolean;
  metricValue: number;
  proofUris: string[];
  proofSummary: string;
  relatedUri?: string;
}

export interface EngineInput {
  userDid: string;
  collectionEntries: any[];
  vouches: any[]; // incoming to user (vouched_did = userDid)
  feedback: any[]; // where rated_user_did = userDid
  tradeChains: any[]; // where user is a participant
  corrections: any[]; // user's scanner corrections
  binders: any[]; // user's binders
  voiceSpaces: any[]; // user's voice spaces
  setSizes: Record<string, number>; // setId -> total card count (from TCGDex)
}

export const ACHIEVEMENT_KEYS = [
  'set_completion_25',
  'set_completion_50',
  'set_completion_75',
  'set_completion_100',
  'shiny_hunter',
  'first_trade',
  'trusted_trader',
  'chain_weaver',
  'scanner_sage',
  'binder_curator',
  'community_voice',
] as const;

const RELATIONSHIP_WEIGHT: Record<string, number> = {
  repeat_trader: 3,
  trade_partner: 2,
  personal_acquaintance: 2,
  community_member: 1,
};

const HIGH_RARITY_TOKENS = [
  'holo',
  'reverse_holo',
  'secret',
  'rainbow',
  'hyper',
  'ultra',
  'illustration',
  'special illustration',
  'tg',
  'sr',
  'ur',
  'sar',
];

function isHighTier(entry: any): boolean {
  const r = String(entry.rarity || '').toLowerCase();
  const v = String(entry.variant || '').toLowerCase();
  if (v === 'holo' || v === 'reverse_holo') return true;
  return HIGH_RARITY_TOKENS.some((t) => r.includes(t));
}

function uri(rec: any, type: string): string {
  return rec.at_uri || `at://swappulse/${type}/${rec.id}`;
}

export function evaluateAchievements(input: EngineInput): Record<string, EvalResult> {
  const out: Record<string, EvalResult> = {};
  const {
    userDid,
    collectionEntries,
    vouches,
    feedback,
    tradeChains,
    corrections,
    binders,
    voiceSpaces,
    setSizes,
  } = input;

  // --- Collection Mastery: Set Completer (highest tier only) ---
  const bySet = new Map<string, Set<string>>();
  for (const e of collectionEntries) {
    if (!e.set_id || !e.card_id) continue;
    if (!bySet.has(e.set_id)) bySet.set(e.set_id, new Set());
    bySet.get(e.set_id)!.add(e.card_id);
  }
  let maxPct = 0;
  let bestSet = '';
  let bestDistinct = 0;
  let bestTotal = 0;
  for (const [setId, cards] of bySet) {
    const total = setSizes[setId];
    if (!total || total === 0) continue;
    const pct = Math.round((cards.size / total) * 100);
    if (pct > maxPct) {
      maxPct = pct;
      bestSet = setId;
      bestDistinct = cards.size;
      bestTotal = total;
    }
  }
  const tiers: Array<[string, number]> = [
    ['set_completion_100', 100],
    ['set_completion_75', 75],
    ['set_completion_50', 50],
    ['set_completion_25', 25],
  ];
  let grantedTier: string | null = null;
  for (const [k, t] of tiers) {
    if (maxPct >= t) {
      out[k] = {
        key: k,
        qualified: true,
        metricValue: maxPct,
        proofUris: bestSet
          ? collectionEntries.filter((e) => e.set_id === bestSet).slice(0, 8).map((e) => uri(e, 'collectionEntry'))
          : [],
        proofSummary: `${bestDistinct}/${bestTotal} cards in set ${bestSet} (${maxPct}%). Verified against TCGDex.`,
        relatedUri: bestSet,
      };
      grantedTier = k;
      break;
    }
  }
  for (const [k] of tiers) {
    if (k !== grantedTier && !(k in out)) {
      out[k] = {
        key: k,
        qualified: false,
        metricValue: maxPct,
        proofUris: [],
        proofSummary: `Best set completion: ${maxPct}%.`,
      };
    }
  }

  // --- Collection Mastery: Shiny Hunter ---
  const shinies = collectionEntries.filter(isHighTier);
  out['shiny_hunter'] = {
    key: 'shiny_hunter',
    qualified: shinies.length >= 50,
    metricValue: shinies.length,
    proofUris: shinies.slice(0, 8).map((e) => uri(e, 'collectionEntry')),
    proofSummary: `${shinies.length} high-tier cards (holo / reverse holo / secret rare) across all sets.`,
  };

  // --- Trust & Trade: First Step ---
  const firstTrade = feedback[0];
  out['first_trade'] = {
    key: 'first_trade',
    qualified: !!firstTrade,
    metricValue: feedback.length,
    proofUris: firstTrade ? [uri(firstTrade, 'tradingFeedback')] : [],
    proofSummary: firstTrade
      ? `First trade feedback received (rating ${firstTrade.rating}/5).`
      : 'No completed trades yet.',
  };

  // --- Trust & Trade: Trusted Trader (scarce + revocable) ---
  const activeVouches = vouches.filter((v) => !v.revoked_at && v.did !== userDid);
  const distinctVouchers = new Set(activeVouches.map((v) => v.did));
  const raw = activeVouches.reduce((s, v) => s + (RELATIONSHIP_WEIGHT[v.relationship] || 1), 0);
  const trustScore = Math.min(100, Math.round(raw * 8));
  const ttQualified = distinctVouchers.size >= 50 && trustScore >= 40;
  out['trusted_trader'] = {
    key: 'trusted_trader',
    qualified: ttQualified,
    metricValue: distinctVouchers.size,
    proofUris: [...distinctVouchers].slice(0, 8).map((d) => `at://${d}/org.swappulse.vouch`),
    proofSummary: `${distinctVouchers.size} unique vouches from distinct DIDs (weighted by voucher trust). Current trust score ${trustScore}/100. Revoked if vouches drop below 50 or trust below 40.`,
  };

  // --- Trust & Trade: Chain Weaver ---
  const completedChains = tradeChains.filter(
    (c) => c.status === 'completed' && (c.participant_dids || []).includes(userDid),
  );
  out['chain_weaver'] = {
    key: 'chain_weaver',
    qualified: completedChains.length >= 1,
    metricValue: completedChains.length,
    proofUris: completedChains.slice(0, 4).map((c) => uri(c, 'tradeChain')),
    proofSummary:
      completedChains.length >= 1
        ? `Completed ${completedChains.length} multi-party circular trade chain(s) (3+ participants).`
        : 'No completed trade chains.',
  };

  // --- Community: Scanner Sage ---
  out['scanner_sage'] = {
    key: 'scanner_sage',
    qualified: corrections.length >= 100,
    metricValue: corrections.length,
    proofUris: corrections.slice(0, 8).map((c) => uri(c, 'scannerCorrection')),
    proofSummary: `${corrections.length} scanner corrections submitted.`,
  };

  // --- Community: Binder Curator ---
  const eligibleBinders = binders.filter((b) => (b.pages || []).length >= 5 && (b.like_count || 0) >= 10);
  const bestBinder = eligibleBinders.sort((a, b) => (b.like_count || 0) - (a.like_count || 0))[0];
  out['binder_curator'] = {
    key: 'binder_curator',
    qualified: !!bestBinder,
    metricValue: bestBinder ? bestBinder.like_count : 0,
    proofUris: bestBinder ? [uri(bestBinder, 'binder')] : [],
    proofSummary: bestBinder
      ? `Binder "${bestBinder.title}" — ${bestBinder.pages.length} pages, ${bestBinder.like_count} likes.`
      : 'No 5-page binder with 10+ likes.',
  };

  // --- Community: Community Voice ---
  const completedSpaces = voiceSpaces.filter((s) => s.status === 'ended' && s.did === userDid);
  out['community_voice'] = {
    key: 'community_voice',
    qualified: completedSpaces.length >= 1,
    metricValue: completedSpaces.length,
    proofUris: completedSpaces.slice(0, 4).map((s) => uri(s, 'voiceSpace')),
    proofSummary:
      completedSpaces.length >= 1
        ? `Hosted ${completedSpaces.length} voice space(s) to completion.`
        : 'No completed voice spaces hosted.',
  };

  return out;
}