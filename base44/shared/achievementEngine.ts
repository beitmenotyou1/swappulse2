// §2.4 Achievement engine — scarce, proof-based credential evaluation.
// Pure functions over pre-fetched entity rows. Dispatches on each achievement's
// `proof_type` (defined in the versioned config) and emits proofRecords
// ({uri, cid, recordType, verifiedAt}) for the Proof Viewer. No SDK calls.

import { ACHIEVEMENT_ENTRIES } from './achievementConfig.ts';

export interface ProofRecord {
  uri: string;
  cid: string;
  recordType: string;
  verifiedAt: string;
}

export interface EvalResult {
  key: string;
  qualified: boolean;
  metricValue: number;
  proofRecords: ProofRecord[];
  proofSummary: string;
  relatedUri?: string;
}

export interface EngineInput {
  userDid: string;
  collectionEntries: any[];
  vouches: any[];
  feedback: any[];
  tradeChains: any[];
  corrections: any[];
  binders: any[];
  voiceSpaces: any[];
  cardReviews: any[];
  meetups: any[];
  setSizes: Record<string, number>;
  participantsBySpaceId: Record<string, number>;
  rsvpsByMeetupId: Record<string, number>;
}

function prec(rec: any, type: string, lexicon: string): ProofRecord {
  return {
    uri: rec.at_uri || `at://did:web:swappulse.org/${type}/${rec.id}`,
    cid: rec.cid || '',
    recordType: rec.record_type || lexicon,
    verifiedAt: rec.created_date || rec.updated_date || new Date().toISOString(),
  };
}

function monthsAgoIso(months: number): string {
  return new Date(Date.now() - months * 30 * 86400000).toISOString();
}

function durationMin(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms > 0 ? Math.round(ms / 60000) : 0;
}

export function evaluateAchievements(input: EngineInput): Record<string, EvalResult> {
  const out: Record<string, EvalResult> = {};
  for (const entry of ACHIEVEMENT_ENTRIES) {
    out[entry.id] = evaluateOne(entry, input);
  }
  return out;
}

function evaluateOne(cfg: any, input: EngineInput): EvalResult {
  switch (cfg.proof_type) {
    case 'coverage': return evalCoverage(cfg, input);
    case 'filtered_collection': return evalFilteredCollection(cfg, input);
    case 'count': return evalCount(cfg, input);
    case 'content_creation': return evalContentCreation(cfg, input);
    case 'weighted_vouches': return evalWeightedVouches(cfg, input);
    case 'record_existence': return evalRecordExistence(cfg, input);
    case 'accepted_submissions': return evalAcceptedSubmissions(cfg, input);
    case 'quality_publication': return evalQualityPublication(cfg, input);
    case 'event_hosting': return evalEventHosting(cfg, input);
    default:
      return { key: cfg.id, qualified: false, metricValue: 0, proofRecords: [], proofSummary: `Unknown proof_type: ${cfg.proof_type}` };
  }
}

function evalCoverage(cfg: any, input: EngineInput): EvalResult {
  const req = cfg.proof_requirements;
  const bySet = new Map<string, Set<string>>();
  for (const e of input.collectionEntries) {
    if (!e.set_id || !e.card_id) continue;
    if (!bySet.has(e.set_id)) bySet.set(e.set_id, new Set());
    bySet.get(e.set_id)!.add(e.card_id); // dedupe → duplicates don't count
  }
  let maxPct = 0, bestSet = '', bestDistinct = 0, bestTotal = 0;
  for (const [setId, cards] of bySet) {
    const total = input.setSizes[setId];
    if (!total || total === 0) continue;
    const pct = Math.round((cards.size / total) * 100);
    if (pct > maxPct) { maxPct = pct; bestSet = setId; bestDistinct = cards.size; bestTotal = total; }
  }
  const threshold = req.unique_card_percent;
  const qualified = maxPct >= threshold;
  const proofRecords = bestSet
    ? input.collectionEntries.filter((e) => e.set_id === bestSet).slice(0, 8).map((e) => prec(e, 'collectionEntry', 'org.swappulse.collectionEntry'))
    : [];
  return {
    key: cfg.id, qualified, metricValue: maxPct, proofRecords,
    proofSummary: bestSet ? `${bestDistinct}/${bestTotal} unique card URIs in set ${bestSet} (${maxPct}%). Threshold ${threshold}%. Verified against TCGDex.` : `No set with a known TCGDex size (best ${maxPct}%).`,
    relatedUri: bestSet || undefined,
  };
}

function evalFilteredCollection(cfg: any, input: EngineInput): EvalResult {
  const req = cfg.proof_requirements;
  const filters = (req.rarity_filters || []).map((s: string) => s.toLowerCase());
  const matches = (e: any) => {
    const r = String(e.rarity || '').toLowerCase();
    const v = String(e.variant || '').toLowerCase();
    return filters.some((f) => r.includes(f) || v.includes(f));
  };
  const shinies = input.collectionEntries.filter(matches);
  const uniqueCards = new Set(shinies.map((e) => e.card_id)).size;
  const distinctSets = new Set(shinies.map((e) => e.set_id).filter(Boolean)).size;
  const qualified = uniqueCards >= (req.minimum_unique_cards || 0) && (!req.require_different_sets || distinctSets >= 2);
  return {
    key: cfg.id, qualified, metricValue: uniqueCards,
    proofRecords: shinies.slice(0, 8).map((e) => prec(e, 'collectionEntry', 'org.swappulse.collectionEntry')),
    proofSummary: `${uniqueCards} unique high-tier cards across ${distinctSets} sets (threshold ${req.minimum_unique_cards}${req.require_different_sets ? ', multiple sets' : ''}).`,
  };
}

function evalCount(cfg: any, input: EngineInput): EvalResult {
  const req = cfg.proof_requirements;
  const records = input.feedback;
  const qualified = records.length >= (req.minimum_count || 0);
  return {
    key: cfg.id, qualified, metricValue: records.length,
    proofRecords: records.slice(0, 8).map((r) => prec(r, 'tradingFeedback', 'org.swappulse.tradingFeedback')),
    proofSummary: `${records.length} completed trade(s) with feedback (threshold ${req.minimum_count}).`,
  };
}

function evalContentCreation(cfg: any, input: EngineInput): EvalResult {
  const req = cfg.proof_requirements;
  const reviews = input.cardReviews;
  const avg = reviews.length
    ? reviews.reduce((s, r) => s + ((r.artwork + r.playability + r.collectibility + r.investment) / 4), 0) / reviews.length
    : 0;
  const qualified = reviews.length >= (req.minimum_reviews || 0) && avg >= (req.min_stars_given_average || 0);
  return {
    key: cfg.id, qualified, metricValue: reviews.length,
    proofRecords: reviews.slice(0, 8).map((r) => prec(r, 'cardReview', 'org.swappulse.cardReview')),
    proofSummary: `${reviews.length} card reviews (threshold ${req.minimum_reviews}), avg rating ${avg.toFixed(1)}.`,
  };
}

function evalWeightedVouches(cfg: any, input: EngineInput): EvalResult {
  const req = cfg.proof_requirements;
  const active = input.vouches.filter((v) => !v.revoked_at && (req.allow_self_vouch ? true : v.did !== input.userDid));
  const distinct = new Set(active.map((v) => v.did));
  const freshCutoff = monthsAgoIso(req.exclude_revoked_months || 0);
  const recentlyRevoked = input.vouches.filter((v) => v.revoked_at && v.revoked_at >= freshCutoff);
  // min_voucher_trust_score (per-voucher trust ≥ N) is pending a per-voucher
  // trust lookup — would require fetching each voucher's incoming vouches.
  const qualified = distinct.size >= (req.minimum_distinct_vouchers || 0) && recentlyRevoked.length === 0;
  const proofRecords: ProofRecord[] = [...distinct].slice(0, 8).map((d) => ({
    uri: `at://${d}/org.swappulse.vouch`, cid: '', recordType: 'org.swappulse.vouch',
    verifiedAt: new Date().toISOString(),
  }));
  return {
    key: cfg.id, qualified, metricValue: distinct.size, proofRecords,
    proofSummary: `${distinct.size} distinct vouches (min ${req.minimum_distinct_vouchers}). ` +
      (recentlyRevoked.length === 0
        ? `No vouches revoked in the last ${req.exclude_revoked_months} months.`
        : `${recentlyRevoked.length} vouch(es) revoked recently — disqualified.`) +
      ` Per-voucher trust gate (≥${req.min_voucher_trust_score}) pending.`,
  };
}

function evalRecordExistence(cfg: any, input: EngineInput): EvalResult {
  const req = cfg.proof_requirements;
  const completed = input.tradeChains.filter(
    (c) => (!req.require_completion || c.status === 'completed') &&
      (c.participant_dids || []).length >= (req.minimum_parties || 3) &&
      (c.participant_dids || []).includes(input.userDid),
  );
  return {
    key: cfg.id, qualified: completed.length >= 1, metricValue: completed.length,
    proofRecords: completed.slice(0, 4).map((c) => prec(c, 'tradeChain', 'org.swappulse.tradeChain')),
    proofSummary: completed.length >= 1 ? `Completed ${completed.length} multi-party trade chain(s) (≥${req.minimum_parties} parties).` : 'No completed multi-party trade chains.',
  };
}

function evalAcceptedSubmissions(cfg: any, input: EngineInput): EvalResult {
  const req = cfg.proof_requirements;
  const count = input.corrections.length;
  // max_reversal_rate gate pending a reversal/accepted field on ScannerCorrection.
  const qualified = count >= (req.minimum_accepted_count || 0);
  return {
    key: cfg.id, qualified, metricValue: count,
    proofRecords: input.corrections.slice(0, 8).map((c) => prec(c, 'scannerCorrection', 'org.swappulse.scannerCorrection')),
    proofSummary: `${count} scanner corrections (min ${req.minimum_accepted_count}). Reversal-rate gate (≤${req.max_reversal_rate}) pending a reversal field.`,
  };
}

function evalQualityPublication(cfg: any, input: EngineInput): EvalResult {
  const req = cfg.proof_requirements;
  const eligible = input.binders.filter(
    (b) => (b.pages || []).length >= (req.minimum_pages_populated || 0) && (b.like_count || 0) >= (req.minimum_engagement || 0),
  );
  const best = eligible.sort((a, b) => (b.like_count || 0) - (a.like_count || 0))[0];
  return {
    key: cfg.id, qualified: !!best, metricValue: best ? best.like_count : 0,
    proofRecords: best ? [prec(best, 'binder', 'org.swappulse.binder')] : [],
    proofSummary: best ? `Binder "${best.title}" — ${best.pages.length} pages, ${best.like_count} likes.` : `No ${req.minimum_pages_populated}-page binder with ${req.minimum_engagement}+ likes.`,
  };
}

function evalEventHosting(cfg: any, input: EngineInput): EvalResult {
  const req = cfg.proof_requirements;
  const minPart = req.minimum_participants || 0;
  const minDur = req.minimum_duration_minutes || 0;
  const qualifying: Array<{ rec: any; type: string }> = [];
  for (const s of input.voiceSpaces) {
    if (s.did !== input.userDid || s.status !== 'ended') continue;
    const dur = durationMin(s.started_at, s.ended_at || s.auto_end_at);
    const parts = input.participantsBySpaceId[s.id] || 0;
    if (dur >= minDur && parts >= minPart) qualifying.push({ rec: s, type: 'voiceSpace' });
  }
  for (const m of input.meetups) {
    if (m.did !== input.userDid || m.status !== 'completed') continue;
    const dur = m.estimated_duration || 0;
    const parts = input.rsvpsByMeetupId[m.id] || 0;
    if (dur >= minDur && parts >= minPart) qualifying.push({ rec: m, type: 'meetup' });
  }
  return {
    key: cfg.id, qualified: qualifying.length >= 1, metricValue: qualifying.length,
    proofRecords: qualifying.slice(0, 4).map((q) => prec(q.rec, q.type, `org.swappulse.${q.type}`)),
    proofSummary: qualifying.length >= 1 ? `Hosted ${qualifying.length} qualifying event(s) (≥${minPart} participants, ≥${minDur} min).` : `No event with ≥${minPart} participants and ≥${minDur} min duration.`,
  };
}