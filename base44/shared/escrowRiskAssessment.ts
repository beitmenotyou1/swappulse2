// escrowRiskAssessment — shared module that computes a composite risk score
// for an escrow dispute or content moderation case. The score combines four
// escalation triggers: trade USDC value, agent confidence in the evidence,
// evidence conflict between the parties, and party risk (account age, trade
// count, prior disputes). Any single trigger firing routes the case to manual
// review; only when all triggers are clear can the agent auto-resolve.
//
// Used by the assess-escrow-risk and autonomous-moderation backend functions
// so the scoring logic stays in one place and the thresholds can be tuned
// by the learning loop over time.

// ── Thresholds (tunable by the learning loop via AgentInsight overrides) ──
export const DEFAULT_VALUE_THRESHOLD_WEI = 100_000_000n; // 100 USDC (6 decimals)
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.75; // below this = escalate
export const DEFAULT_NEW_ACCOUNT_TRADE_COUNT = 3; // fewer completed trades = new party
export const DEFAULT_NEW_ACCOUNT_AGE_DAYS = 30; // account younger than this = new party
export const DEFAULT_PRIOR_DISPUTE_LIMIT = 2; // 2+ prior disputes = repeat risk

export interface RiskTrigger {
  key: 'high_value' | 'low_confidence' | 'evidence_conflict' | 'new_party' | 'repeat_offender' | 'novel_pattern';
  fired: boolean;
  detail: string;
}

export interface RiskAssessment {
  risk_score: number; // 0-1, higher = riskier
  triggers_fired: string[];
  trigger_details: RiskTrigger[];
  can_auto_resolve: boolean;
  recommendation: 'release' | 'refund' | 'cancel' | 'escalate';
  reasoning: string;
}

// ── Value trigger ──
function assessValue(usdcAmountWei: string, threshold: bigint = DEFAULT_VALUE_THRESHOLD_WEI): RiskTrigger {
  try {
    const amount = BigInt(usdcAmountWei || '0');
    const fired = amount >= threshold;
    return {
      key: 'high_value',
      fired,
      detail: fired ? `Trade value ${amount.toString()} wei >= ${threshold.toString()} wei threshold` : `Trade value below threshold`,
    };
  } catch {
    return { key: 'high_value', fired: false, detail: 'Unable to parse trade value' };
  }
}

// ── Confidence trigger ──
function assessConfidence(confidence: number, threshold: number = DEFAULT_CONFIDENCE_THRESHOLD): RiskTrigger {
  const fired = confidence < threshold;
  return {
    key: 'low_confidence',
    fired,
    detail: fired ? `Agent confidence ${confidence.toFixed(2)} < ${threshold} threshold` : `Confidence ${confidence.toFixed(2)} adequate`,
  };
}

// ── Evidence conflict trigger ──
// Fires when buyer and seller evidence contradicts each other — e.g. buyer
// claims "never received" but carrier tracking shows "delivered", or buyer
// uploaded a confirmation photo but then filed a not-received dispute.
export function assessEvidenceConflict(evidence: {
  buyer_confirmed_receipt?: boolean;
  seller_confirmed_receipt?: boolean;
  buyer_tracking_code?: string;
  seller_tracking_code?: string;
  carrier_delivered?: boolean | null;
  dispute_reason?: string;
}): RiskTrigger {
  let conflict = false;
  const reasons: string[] = [];

  // Buyer confirmed receipt (photo uploaded) but then filed "not_received"
  if (evidence.buyer_confirmed_receipt && evidence.dispute_reason === 'not_received') {
    conflict = true;
    reasons.push('buyer confirmed receipt but disputes as not-received');
  }
  // Carrier says delivered but buyer claims not received
  if (evidence.carrier_delivered === true && evidence.dispute_reason === 'not_received') {
    conflict = true;
    reasons.push('carrier confirms delivery but buyer claims not received');
  }
  // Neither party has tracking codes for a physical trade
  if (!evidence.buyer_tracking_code && !evidence.seller_tracking_code && evidence.dispute_reason !== 'other') {
    reasons.push('no tracking codes from either party');
  }

  return {
    key: 'evidence_conflict',
    fired: conflict,
    detail: reasons.join('; ') || 'no evidence conflict detected',
  };
}

// ── Party risk trigger (new account) ──
export function assessPartyRisk(partyContext: {
  buyer_account_age_days?: number;
  buyer_completed_trades?: number;
  seller_account_age_days?: number;
  seller_completed_trades?: number;
}, opts?: { newTradeCount?: number; newAgeDays?: number }): RiskTrigger {
  const newTradeCount = opts?.newTradeCount ?? DEFAULT_NEW_ACCOUNT_TRADE_COUNT;
  const newAgeDays = opts?.newAgeDays ?? DEFAULT_NEW_ACCOUNT_AGE_DAYS;

  const buyerIsNew = (partyContext.buyer_account_age_days ?? 9999) < newAgeDays ||
    (partyContext.buyer_completed_trades ?? 9999) < newTradeCount;
  const sellerIsNew = (partyContext.seller_account_age_days ?? 9999) < newAgeDays ||
    (partyContext.seller_completed_trades ?? 9999) < newTradeCount;

  const fired = buyerIsNew || sellerIsNew;
  const who = [buyerIsNew ? 'buyer' : '', sellerIsNew ? 'seller' : ''].filter(Boolean).join(' + ');

  return {
    key: 'new_party',
    fired,
    detail: fired ? `${who} is a new party (low trade count or young account)` : 'both parties are established',
  };
}

// ── Repeat offender trigger ──
export function assessRepeatOffender(priorDisputes: {
  buyer_prior_disputes?: number;
  seller_prior_disputes?: number;
}, limit: number = DEFAULT_PRIOR_DISPUTE_LIMIT): RiskTrigger {
  const buyerPrior = priorDisputes.buyer_prior_disputes ?? 0;
  const sellerPrior = priorDisputes.seller_prior_disputes ?? 0;
  const fired = buyerPrior >= limit || sellerPrior >= limit;
  return {
    key: 'repeat_offender',
    fired,
    detail: fired ? `repeat dispute history (buyer: ${buyerPrior}, seller: ${sellerPrior})` : 'no repeat dispute pattern',
  };
}

// ── Composite assessment ──
export function computeRiskScore(triggers: RiskTrigger[]): { score: number; fired: string[] } {
  const fired = triggers.filter((t) => t.fired);
  // Weight: high_value 0.25, low_confidence 0.25, evidence_conflict 0.25, new_party 0.15, repeat_offender 0.10
  const weights: Record<string, number> = {
    high_value: 0.25,
    low_confidence: 0.25,
    evidence_conflict: 0.25,
    new_party: 0.15,
    repeat_offender: 0.10,
    novel_pattern: 0.10,
  };
  const score = fired.reduce((sum, t) => sum + (weights[t.key] ?? 0), 0);
  return { score: Math.min(1, score), fired: fired.map((t) => t.key) };
}

// ── Full escrow dispute assessment ──
export function assessEscrowDispute(params: {
  usdc_amount_wei: string;
  agent_confidence: number;
  evidence: {
    buyer_confirmed_receipt?: boolean;
    seller_confirmed_receipt?: boolean;
    buyer_tracking_code?: string;
    seller_tracking_code?: string;
    carrier_delivered?: boolean | null;
    dispute_reason?: string;
  };
  party_context: {
    buyer_account_age_days?: number;
    buyer_completed_trades?: number;
    seller_account_age_days?: number;
    seller_completed_trades?: number;
  };
  prior_disputes: {
    buyer_prior_disputes?: number;
    seller_prior_disputes?: number;
  };
}): RiskAssessment {
  const triggers: RiskTrigger[] = [
    assessValue(params.usdc_amount_wei),
    assessConfidence(params.agent_confidence),
    assessEvidenceConflict(params.evidence),
    assessPartyRisk(params.party_context),
    assessRepeatOffender(params.prior_disputes),
  ];

  const { score, fired } = computeRiskScore(triggers);
  const canAutoResolve = fired.length === 0;

  // Recommendation logic when auto-resolving:
  // - If buyer confirmed receipt but disputes not_received → release to seller (bad-faith claim)
  // - If carrier confirmed delivery → release to seller
  // - If seller never shipped (no tracking) → refund to buyer
  // - Otherwise escalate (shouldn't reach here if canAutoResolve)
  let recommendation: RiskAssessment['recommendation'] = 'escalate';
  if (canAutoResolve) {
    if (params.evidence.buyer_confirmed_receipt || params.evidence.carrier_delivered === true) {
      recommendation = 'release';
    } else if (!params.evidence.seller_tracking_code) {
      recommendation = 'refund';
    } else {
      // All clear but ambiguous → still escalate to be safe
      recommendation = 'escalate';
      triggers.push({ key: 'novel_pattern', fired: true, detail: 'all triggers clear but outcome ambiguous' });
    }
  }

  const reasoning = triggers.map((t) => `${t.key}: ${t.detail}`).join('. ');

  return {
    risk_score: score,
    triggers_fired: fired,
    trigger_details: triggers,
    can_auto_resolve: canAutoResolve && recommendation !== 'escalate',
    recommendation,
    reasoning,
  };
}

// ── Content moderation risk assessment (posts, listings, messages) ──
// For content moderation, the triggers are: severity (high = escalate),
// confidence (low = escalate), repeat offender (prior labels = escalate),
// and novel pattern (unrecognized by the agent = escalate).
export function assessContentRisk(params: {
  severity: 'hide' | 'warn' | 'inform' | 'none';
  confidence: number;
  author_prior_labels: number;
  author_strikes: number;
  is_severe_label: boolean;
}): RiskAssessment {
  const triggers: RiskTrigger[] = [];

  // Severe violations always escalate unless confidence is very high
  if (params.is_severe_label && params.confidence < 0.9) {
    triggers.push({ key: 'low_confidence', fired: true, detail: `severe label at ${params.confidence.toFixed(2)} confidence < 0.90` });
  }

  // Low confidence on any label
  if (params.confidence < DEFAULT_CONFIDENCE_THRESHOLD) {
    triggers.push({ key: 'low_confidence', fired: true, detail: `confidence ${params.confidence.toFixed(2)} < ${DEFAULT_CONFIDENCE_THRESHOLD}` });
  }

  // Repeat offender
  if (params.author_prior_labels >= 3 || params.author_strikes >= 2) {
    triggers.push({ key: 'repeat_offender', fired: true, detail: `author has ${params.author_prior_labels} prior labels, ${params.author_strikes} strikes` });
  }

  // Novel pattern: severity is hide but confidence is middling
  if (params.severity === 'hide' && params.confidence < 0.85) {
    triggers.push({ key: 'novel_pattern', fired: true, detail: 'hide-severity with non-high confidence — novel or ambiguous pattern' });
  }

  const { score, fired } = computeRiskScore(triggers);
  const canAutoResolve = fired.length === 0;

  let recommendation: RiskAssessment['recommendation'] = 'escalate';
  if (canAutoResolve) {
    if (params.severity === 'hide' && params.is_severe_label) {
      recommendation = 'hide';
    } else if (params.severity === 'warn') {
      recommendation = 'warn';
    } else if (params.severity === 'none' || params.confidence > 0.9) {
      recommendation = 'allow';
    } else {
      recommendation = 'dismiss';
    }
  }

  return {
    risk_score: score,
    triggers_fired: fired,
    trigger_details: triggers,
    can_auto_resolve: canAutoResolve,
    recommendation,
    reasoning: triggers.map((t) => `${t.key}: ${t.detail}`).join('. ') || 'all clear — no triggers fired',
  };
}