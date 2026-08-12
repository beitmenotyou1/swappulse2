// §2.4 Achievement engine — scarce, proof-based credential evaluation.
// Pure functions over pre-fetched entity rows. Thresholds are read from the
// versioned achievementConfig so the constraints are transparent and auditable.
// The backend runner fetches proof data (and TCGDex set sizes) and passes it
// in; this module returns grant/revoke decisions per achievement key.

import { ACHIEVEMENT_CONFIG } from './achievementConfig.ts';

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

const RELATIONSHIP_WEIGHT: Record<string, number> = {
  repeat_trader: 3,
  trade_partner: 2,
  personal_acquaintance: 2,
  community_member: 1,
};

const HIGH_RARITY_TOKENS = [
  'holo', 'reverse_holo', 'secret', 'rainbow', 'hyper', 'ultra',
  'illustration', 'special illustration', 'tg', 'sr', 'ur', 'sar',
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

function monthsAgoIso(months: number): string {
  return new Date(Date.now() - months * 30 * 86400000).toISOString();
}

export function evaluateAchievements(input: EngineInput): Record<string, EvalResult> {
  const out: Record<string, EvalResult> = {};
  const { userDid, collectionEntries, vouches, feedback, tradeChains, corrections, binders, voiceSpaces, setSizes } = input;

  // --- Collection Mastery: Set Completer (highest tier only; unique card URIs) ---
  const bySet = new Map<string, Set<string>>();
  for (const e of collectionEntries) {
    if (!e.set_id || !e.card_id) continue;
    if (!bySet.has(e.set_id)) bySet.set(e.set_id, new Set());
    bySet.get(e.set_id)!.add(e.card_id); // Set dedupes → duplicates don't count
  }
  let maxPct = 0, bestSet = '', bestDistinct = 0, bestTotal = 0;
  for (const [setId, cards] of bySet) {
    const total = setSizes[setId];
    if (!total || total === 0) continue;
    const pct = Math.round((cards.size / total) * 100);
    if (pct > maxPct) { maxPct = pct; bestSet = setId; bestDistinct = cards.size; bestTotal = total; }
  }
  const tierKeys: Array<[string, number]> = [
    ['set_completion_100', ACHIEVEMENT_CONFIG['set_completion_100'].thresholds.minPct!],
    ['set_completion_75', ACHIEVEMENT_CONFIG['set_completion_75'].thresholds.minPct!],
    ['set_completion_50', ACHIEVEMENT_CONFIG['set_completion_50'].thresholds.minPct!],
    ['set_completion_25', ACHIEVEMENT_CONFIG['set_completion_25'].thresholds.minPct!],
  ];
  let grantedTier: string | null = null;
  for (const [k, t] of tierKeys) {
    if (maxPct >= t) {
      out[k] = {
        key: k, qualified: true, metricValue: maxPct,
        proofUris: bestSet ? collectionEntries.filter((e) => e.set_id === bestSet).slice(0, 8).map((e) => uri(e, 'collectionEntry')) : [],
        proofSummary: `${bestDistinct}/${bestTotal} unique card URIs in set ${bestSet} (${maxPct}%). Verified against TCGDex — duplicates excluded.`,
        relatedUri: bestSet,
      };
      grantedTier = k;
      break;
    }
  }
  for (const [k] of tierKeys) {
    if (k !== grantedTier && !(k in out)) {
      out[k] = { key: k, qualified: false, metricValue: maxPct, proofUris: [], proofSummary: `Best set completion: ${maxPct}%.` };
    }
  }

  // --- Collection Mastery: Shiny Hunter ---
  const minShiny = ACHIEVEMENT_CONFIG['shiny_hunter'].thresholds.minHighTierCards!;
  const shinies = collectionEntries.filter(isHighTier);
  out['shiny_hunter'] = {
    key: 'shiny_hunter', qualified: shinies.length >= minShiny, metricValue: shinies.length,
    proofUris: shinies.slice(0, 8).map((e) => uri(e, 'collectionEntry')),
    proofSummary: `${shinies.length} high-tier cards (holo / reverse holo / secret rare) — threshold ${minShiny}.`,
  };

  // --- Trust & Trade: First Step ---
  const minTrades = ACHIEVEMENT_CONFIG['first_trade'].thresholds.minCompletedTrades!;
  const firstTrade = feedback[0];
  out['first_trade'] = {
    key: 'first_trade', qualified: feedback.length >= minTrades, metricValue: feedback.length,
    proofUris: firstTrade ? [uri(firstTrade, 'tradingFeedback')] : [],
    proofSummary: firstTrade ? `First trade feedback received (rating ${firstTrade.rating}/5).` : 'No completed trades yet.',
  };

  // --- Trust & Trade: Trusted Trader (scarce + freshness-gated + revocable) ---
  const tt = ACHIEVEMENT_CONFIG['trusted_trader'].thresholds;
  const activeVouches = vouches.filter((v) => !v.revoked_at && v.did !== userDid);
  const distinctVouchers = new Set(activeVouches.map((v) => v.did));
  const raw = activeVouches.reduce((s, v) => s + (RELATIONSHIP_WEIGHT[v.relationship] || 1), 0);
  const trustScore = Math.min(100, Math.round(raw * 8));
  const freshCutoff = monthsAgoIso(tt.vouchFreshnessMonths || 0);
  const recentlyRevoked = vouches.filter((v) => v.revoked_at && v.revoked_at >= freshCutoff);
  const ttQualified =
    distinctVouchers.size >= (tt.minDistinctVouches || 0) &&
    trustScore >= (tt.minTrustScore || 0) &&
    recentlyRevoked.length === 0;
  out['trusted_trader'] = {
    key: 'trusted_trader', qualified: ttQualified, metricValue: distinctVouchers.size,
    proofUris: [...distinctVouchers].slice(0, 8).map((d) => `at://${d}/org.swappulse.vouch`),
    proofSummary:
      `${distinctVouchers.size} unique vouches from distinct DIDs (min ${tt.minDistinctVouches}). Trust ${trustScore}/100 (min ${tt.minTrustScore}). ` +
      (recentlyRevoked.length > 0
        ? `${recentlyRevoked.length} vouch(es) revoked in the last ${tt.vouchFreshnessMonths} months — disqualified.`
        : `No vouches revoked in the last ${tt.vouchFreshnessMonths} months.`),
  };

  // --- Trust & Trade: Chain Weaver ---
  const cw = ACHIEVEMENT_CONFIG['chain_weaver'].thresholds;
  const completedChains = tradeChains.filter(
    (c) => c.status === 'completed' && (c.participant_dids || []).length >= (cw.minChainParticipants || 3) && (c.participant_dids || []).includes(userDid),
  );
  out['chain_weaver'] = {
    key: 'chain_weaver', qualified: completedChains.length >= (cw.minCompletedChains || 1), metricValue: completedChains.length,
    proofUris: completedChains.slice(0, 4).map((c) => uri(c, 'tradeChain')),
    proofSummary: completedChains.length >= 1 ? `Completed ${completedChains.length} multi-party trade chain(s) (≥${cw.minChainParticipants} participants).` : 'No completed trade chains.',
  };

  // --- Community: Scanner Sage ---
  const ss = ACHIEVEMENT_CONFIG['scanner_sage'].thresholds;
  // NOTE: reversal-rate gate (maxReversalRatePct) is pending a reversal/accepted
  // field on ScannerCorrection; until then only the count threshold is enforced.
  out['scanner_sage'] = {
    key: 'scanner_sage', qualified: corrections.length >= (ss.minCorrections || 0), metricValue: corrections.length,
    proofUris: corrections.slice(0, 8).map((c) => uri(c, 'scannerCorrection')),
    proofSummary: `${corrections.length} scanner corrections (min ${ss.minCorrections}). Reversal-rate gate (≤${ss.maxReversalRatePct}%) pending a reversal field.`,
  };

  // --- Community: Binder Curator ---
  const bc = ACHIEVEMENT_CONFIG['binder_curator'].thresholds;
  const eligibleBinders = binders.filter((b) => (b.pages || []).length >= (bc.minBinderPages || 5) && (b.like_count || 0) >= (bc.minBinderLikes || 10));
  const bestBinder = eligibleBinders.sort((a, b) => (b.like_count || 0) - (a.like_count || 0))[0];
  out['binder_curator'] = {
    key: 'binder_curator', qualified: !!bestBinder, metricValue: bestBinder ? bestBinder.like_count : 0,
    proofUris: bestBinder ? [uri(bestBinder, 'binder')] : [],
    proofSummary: bestBinder ? `Binder "${bestBinder.title}" — ${bestBinder.pages.length} pages, ${bestBinder.like_count} likes.` : `No ${bc.minBinderPages}-page binder with ${bc.minBinderLikes}+ likes.`,
  };

  // --- Community: Community Voice ---
  const cv = ACHIEVEMENT_CONFIG['community_voice'].thresholds;
  const completedSpaces = voiceSpaces.filter((s) => s.status === 'ended' && s.did === userDid);
  out['community_voice'] = {
    key: 'community_voice', qualified: completedSpaces.length >= (cv.minCompletedSpaces || 1), metricValue: completedSpaces.length,
    proofUris: completedSpaces.slice(0, 4).map((s) => uri(s, 'voiceSpace')),
    proofSummary: completedSpaces.length >= 1 ? `Hosted ${completedSpaces.length} voice space(s) to completion.` : 'No completed voice spaces hosted.',
  };

  return out;
}