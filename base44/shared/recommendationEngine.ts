// §2.2 Who to Follow — trust-based recommendation engine.
// Pure in-memory pipeline over pre-fetched entity rows (Vouch, Follow,
// CollectionEntry, User). No SDK calls inside: callers fetch data and pass it
// in, so this module is unit-testable and shared across backend functions.
//
// Adapted from the standalone feed-generator spec: the firehose materialised
// views are replaced by the app's own entities (already the source of truth),
// Redis by the RecommendationCache entity, and the Express routes by backend
// functions. Persona/region fields are nullable until profile fields land.

export interface UserProfile {
  did: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  personaLabel: string | null;
  region: string | null;
  vouchCount: number;
  trustScore: number;
  collectionSize: number;
  accountCreatedAt: string | null;
}

export interface CollectionSummary {
  setIds: string[];
  rarities: string[];
  categories: string[];
  totalCards: number;
}

export interface RecommendationPreferences {
  dismissedUsers: string[];
  targetPersonas: string[];
  excludeRegions: string[];
  maxSimilarityScore: number;
  serendipityEnabled: boolean;
  newUserBoost: boolean;
  maxSuggestionsPerBatch: number;
  showWhyRecommended: boolean;
}

export interface RecommendationReason {
  type: string;
  label: string;
  detail: string;
}

export interface ScoredCandidate {
  did: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  persona: string | null;
  region: string | null;
  trustScore: number;
  similarityScore: number;
  diversityScore: number;
  totalScore: number;
  sourceMethod: string;
  reasons: RecommendationReason[];
  isSerendipity: boolean;
  mutualVouchCount: number;
  isNewUser: boolean;
}

export interface EngineInput {
  userDid: string;
  users: any[];
  vouches: any[];
  follows: any[];
  collectionEntries: any[];
  prefs: RecommendationPreferences;
}

const RELATIONSHIP_WEIGHT: Record<string, number> = {
  repeat_trader: 3,
  trade_partner: 2,
  personal_acquaintance: 2,
  community_member: 1,
};

const NEW_USER_BOOST_MONTHS = 6;
const SERENDIPITY_PERCENTAGE = 0.15;
const MAX_PER_PERSONA = 3;

export function toDid(userId: string, didField?: string): string {
  if (didField) return didField;
  return 'did:plc:' + String(userId).replace(/-/g, '').slice(0, 24);
}

export function defaultPreferences(): RecommendationPreferences {
  return {
    dismissedUsers: [],
    targetPersonas: [],
    excludeRegions: [],
    maxSimilarityScore: 85,
    serendipityEnabled: true,
    newUserBoost: true,
    maxSuggestionsPerBatch: 10,
    showWhyRecommended: true,
  };
}

// =====================================================
// MATERIALIZED VIEWS (built in-memory from entity rows)
// =====================================================

export function buildProfiles(
  users: any[],
  vouches: any[],
  collectionEntries: any[],
): Map<string, UserProfile> {
  const profiles = new Map<string, UserProfile>();
  const vouchCounts = new Map<string, number>();
  const trustRaw = new Map<string, number>();
  for (const v of vouches) {
    if (v.revoked_at) continue;
    const target = v.vouched_did;
    if (!target) continue;
    vouchCounts.set(target, (vouchCounts.get(target) || 0) + 1);
    const w = RELATIONSHIP_WEIGHT[v.relationship] || 1;
    trustRaw.set(target, (trustRaw.get(target) || 0) + w);
  }
  const collSizes = new Map<string, number>();
  for (const c of collectionEntries) {
    if (!c.did) continue;
    collSizes.set(c.did, (collSizes.get(c.did) || 0) + 1);
  }
  for (const u of users) {
    const did = toDid(u.id, u.did);
    const raw = trustRaw.get(did) || 0;
    const normalised = Math.min(100, Math.round(raw * 8));
    profiles.set(did, {
      did,
      handle: (u.email || '').split('@')[0] || null,
      displayName: u.full_name || null,
      avatarUrl: u.avatar_url || null,
      personaLabel: null,
      region: null,
      vouchCount: vouchCounts.get(did) || 0,
      trustScore: normalised,
      collectionSize: collSizes.get(did) || 0,
      accountCreatedAt: u.created_date || null,
    });
  }
  return profiles;
}

export function buildCollectionSummaries(entries: any[]): Map<string, CollectionSummary> {
  const map = new Map<string, CollectionSummary>();
  for (const e of entries) {
    if (!e.did) continue;
    let s = map.get(e.did);
    if (!s) {
      s = { setIds: [], rarities: [], categories: [], totalCards: 0 };
      map.set(e.did, s);
    }
    if (e.set_id) s.setIds.push(e.set_id);
    if (e.rarity) s.rarities.push(e.rarity);
    if (e.category) s.categories.push(e.category);
    s.totalCards++;
  }
  for (const s of map.values()) {
    s.setIds = [...new Set(s.setIds)];
    s.rarities = [...new Set(s.rarities)];
    s.categories = [...new Set(s.categories)];
  }
  return map;
}

// Undirected trust graph from active vouches (bidirectional for discovery).
export function buildTrustGraph(vouches: any[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const v of vouches) {
    if (v.revoked_at) continue;
    if (!v.did || !v.vouched_did) continue;
    add(v.did, v.vouched_did);
    add(v.vouched_did, v.did);
  }
  return adj;
}

// 2nd-degree connections: reachable in 2 hops, not direct, not self.
export function getSecondDegreeConnections(
  userDid: string,
  graph: Map<string, Set<string>>,
): Array<{ candidateDid: string; mutualConnectionCount: number }> {
  const direct = graph.get(userDid) || new Set<string>();
  const candidates = new Map<string, number>();
  for (const d1 of direct) {
    const d2Set = graph.get(d1) || new Set<string>();
    for (const d2 of d2Set) {
      if (d2 === userDid) continue;
      if (direct.has(d2)) continue;
      candidates.set(d2, (candidates.get(d2) || 0) + 1);
    }
  }
  return [...candidates.entries()].map(([candidateDid, mutualConnectionCount]) => ({
    candidateDid,
    mutualConnectionCount,
  }));
}

// =====================================================
// SCORING
// =====================================================

export function calculateTrustProximity(
  mutualVouchCount: number,
  candidateTrustScore: number,
): number {
  const connectionScore = Math.min(100, Math.log2(mutualVouchCount + 1) * 20);
  const trustContribution = Math.min(30, candidateTrustScore * 0.3);
  return Math.round(Math.min(100, connectionScore * 0.7 + trustContribution));
}

export function calculateCollectionOverlap(
  a: CollectionSummary | null,
  b: CollectionSummary | null,
): number {
  if (!a || !b || a.totalCards === 0 || b.totalCards === 0) return 0;
  const setO = jaccard(new Set(a.setIds), new Set(b.setIds));
  const rarO = jaccard(new Set(a.rarities), new Set(b.rarities));
  const catO = jaccard(new Set(a.categories), new Set(b.categories));
  return Math.round((setO * 0.5 + rarO * 0.3 + catO * 0.2) * 100);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = new Set([...a, ...b]).size;
  return inter / union;
}

export function calculateDiversityScore(
  candidate: UserProfile,
  userRegion: string | null,
  _targetPersonas: string[],
): number {
  let score = 50;
  if (candidate.region && userRegion && candidate.region !== userRegion) score += 10;
  if (candidate.accountCreatedAt) {
    const months =
      (Date.now() - new Date(candidate.accountCreatedAt).getTime()) /
      (1000 * 60 * 60 * 24 * 30);
    if (months < NEW_USER_BOOST_MONTHS) score += 25;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateTotalScore(
  trust: number,
  sim: number,
  div: number,
  maxSim: number,
): { total: number; sourceMethod: string } {
  const adjustedSim = sim > maxSim ? sim * 0.3 : sim;
  const total = 0.5 * trust + 0.2 * adjustedSim + 0.3 * div;
  const scores: Record<string, number> = {
    trust_proximity: trust,
    collection_overlap: sim,
    diversity_boost: div,
  };
  let sourceMethod = 'trust_proximity';
  let best = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > best) {
      best = v;
      sourceMethod = k;
    }
  }
  return { total: Math.round(total * 10) / 10, sourceMethod };
}

export function generateReasons(
  user: UserProfile,
  candidate: UserProfile,
  mutual: number,
  overlap: number,
  isNew: boolean,
  isSerendipity: boolean,
): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];
  if (mutual > 0) {
    const t = mutual === 1 ? '1 mutual vouch' : `${mutual} mutual vouches`;
    reasons.push({
      type: 'mutual_vouches',
      label: t,
      detail: `You and ${candidate.displayName || candidate.handle || 'this collector'} share ${t}.`,
    });
  }
  if (overlap >= 30) {
    reasons.push({
      type: 'shared_sets',
      label: `Collection overlap: ${overlap}%`,
      detail: 'You both collect similar sets and card types.',
    });
  }
  if (candidate.trustScore >= 70) {
    reasons.push({
      type: 'trust_score',
      label: `Trust score: ${Math.round(candidate.trustScore)}/100`,
      detail: 'This collector is highly trusted in the SwapPulse community.',
    });
  }
  if (isNew) {
    reasons.push({
      type: 'new_user',
      label: 'New to SwapPulse',
      detail: 'Help grow the community by connecting with newer collectors.',
    });
  }
  if (isSerendipity) {
    reasons.push({
      type: 'serendipity',
      label: 'Serendipity pick',
      detail: 'This recommendation comes from outside your immediate trust graph.',
    });
  }
  return reasons.slice(0, 4);
}

// =====================================================
// DIVERSITY + SERENDIPITY + FILTERS
// =====================================================

export function enforcePersonaCaps(candidates: ScoredCandidate[]): ScoredCandidate[] {
  const counts: Record<string, number> = {};
  const result: ScoredCandidate[] = [];
  for (const c of candidates) {
    const persona = c.persona || 'unknown';
    const current = counts[persona] || 0;
    if (current < MAX_PER_PERSONA) {
      result.push(c);
      counts[persona] = current + 1;
    }
  }
  return result;
}

export function interleavePersonas(candidates: ScoredCandidate[]): ScoredCandidate[] {
  const byPersona = new Map<string, ScoredCandidate[]>();
  for (const c of candidates) {
    const key = c.persona || 'unknown';
    if (!byPersona.has(key)) byPersona.set(key, []);
    byPersona.get(key)!.push(c);
  }
  const result: ScoredCandidate[] = [];
  const queues = Array.from(byPersona.values());
  let remaining = queues.reduce((sum, q) => sum + q.length, 0);
  while (remaining > 0) {
    for (const q of queues) {
      if (q.length > 0) {
        result.push(q.shift()!);
        remaining--;
      }
    }
  }
  return result;
}

function shuffle<T>(arr: T[]): T[] {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function injectSerendipity(
  ranked: ScoredCandidate[],
  pool: UserProfile[],
  percentage: number = SERENDIPITY_PERCENTAGE,
): ScoredCandidate[] {
  if (pool.length === 0) return ranked;
  const count = Math.max(1, Math.floor(ranked.length * percentage));
  const existing = new Set(ranked.map((c) => c.did));
  const picks: ScoredCandidate[] = [];
  for (const u of shuffle(pool)) {
    if (picks.length >= count) break;
    if (existing.has(u.did)) continue;
    const monthsOld = u.accountCreatedAt
      ? (Date.now() - new Date(u.accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
      : 99;
    const isNew = monthsOld < NEW_USER_BOOST_MONTHS;
    picks.push({
      did: u.did,
      handle: u.handle,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      persona: u.personaLabel,
      region: u.region,
      trustScore: Math.round(u.trustScore),
      similarityScore: 0,
      diversityScore: 60,
      totalScore: 30,
      sourceMethod: 'serendipity_injection',
      reasons: [
        {
          type: 'serendipity',
          label: 'Serendipity pick',
          detail: 'This collector is outside your immediate trust graph. A chance to discover someone new.',
        },
      ],
      isSerendipity: true,
      mutualVouchCount: 0,
      isNewUser: isNew,
    });
  }
  const result = [...ranked];
  for (const pick of picks) {
    const pos = 1 + Math.floor(Math.random() * (result.length + 1));
    result.splice(pos, 0, pick);
  }
  return result;
}

// =====================================================
// PIPELINE
// =====================================================

export function runRecommendationPipeline(input: EngineInput): ScoredCandidate[] {
  const { userDid, users, vouches, follows, collectionEntries, prefs } = input;
  const profiles = buildProfiles(users, vouches, collectionEntries);
  const collections = buildCollectionSummaries(collectionEntries);
  const graph = buildTrustGraph(vouches);
  const user = profiles.get(userDid);
  if (!user) return [];

  const existingFollows = new Set<string>();
  for (const f of follows) {
    if (f.did === userDid && f.subject_did) existingFollows.add(f.subject_did);
  }
  const dismissed = new Set(prefs.dismissedUsers);
  const userCollection = collections.get(userDid) || null;
  const connections = getSecondDegreeConnections(userDid, graph);

  const scored: ScoredCandidate[] = [];
  for (const conn of connections) {
    const candidate = profiles.get(conn.candidateDid);
    if (!candidate) continue;
    const trust = calculateTrustProximity(conn.mutualConnectionCount, candidate.trustScore);
    const sim = calculateCollectionOverlap(userCollection, collections.get(conn.candidateDid) || null);
    const div = calculateDiversityScore(candidate, user.region, prefs.targetPersonas);
    const { total, sourceMethod } = calculateTotalScore(trust, sim, div, prefs.maxSimilarityScore);
    const isNew = candidate.accountCreatedAt
      ? (Date.now() - new Date(candidate.accountCreatedAt).getTime()) /
          (1000 * 60 * 60 * 24 * 30) <
        NEW_USER_BOOST_MONTHS
      : false;
    scored.push({
      did: candidate.did,
      handle: candidate.handle,
      displayName: candidate.displayName,
      avatarUrl: candidate.avatarUrl,
      persona: candidate.personaLabel,
      region: candidate.region,
      trustScore: trust,
      similarityScore: sim,
      diversityScore: div,
      totalScore: total,
      sourceMethod,
      reasons: generateReasons(user, candidate, conn.mutualConnectionCount, sim, isNew, false),
      isSerendipity: false,
      mutualVouchCount: conn.mutualConnectionCount,
      isNewUser: isNew,
    });
  }

  scored.sort((a, b) => b.totalScore - a.totalScore);

  let final = scored;
  if (prefs.serendipityEnabled) {
    const exclude = new Set<string>([
      userDid,
      ...existingFollows,
      ...dismissed,
      ...scored.map((s) => s.did),
    ]);
    const pool: UserProfile[] = [];
    for (const p of profiles.values()) {
      if (exclude.has(p.did)) continue;
      if (p.vouchCount > 0 && p.trustScore > 20) pool.push(p);
    }
    final = injectSerendipity(scored, pool, SERENDIPITY_PERCENTAGE);
  }

  final = final.filter((c) => {
    if (c.did === userDid) return false;
    if (existingFollows.has(c.did)) return false;
    if (dismissed.has(c.did)) return false;
    if (!c.isSerendipity && c.region && prefs.excludeRegions.includes(c.region)) return false;
    if (!c.isSerendipity && c.similarityScore > prefs.maxSimilarityScore && c.diversityScore < 40)
      return false;
    return true;
  });

  final = enforcePersonaCaps(final);
  final = interleavePersonas(final);

  return final.slice(0, prefs.maxSuggestionsPerBatch);
}