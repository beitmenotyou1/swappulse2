/**
 * PokemonPriceTracker API client for SwapPulse.
 *
 * Roles:
 * - TCGDex remains the canonical card catalogue/ID source.
 * - PokemonPriceTracker is optional pricing/grading/history enrichment.
 * - Free tier is for personal/non-commercial development/evaluation only.
 * - Public production use is fail-closed unless Business/Enterprise is configured
 *   or the maintainer has explicit written permission and sets the override flag.
 *
 * Secrets/config (server-side only):
 * - POKEMON_PRICE_TRACKER_API_KEY
 * - POKEMON_PRICE_TRACKER_PLAN=free|api|business|enterprise (default: free)
 * - POKEMON_PRICE_TRACKER_PUBLIC_USE_ALLOWED=true (only with explicit permission)
 */

const BASE_URL = 'https://www.pokemonpricetracker.com/api/v2';
const CARD_TTL_MS = 24 * 60 * 60 * 1000; // provider prices update daily
const MAPPING_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STALE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const inflight = new Map<string, Promise<any>>();

type PlanName = 'free' | 'api' | 'business' | 'enterprise';
type ResourceType = 'card' | 'search' | 'mapping' | 'sets' | 'sealed' | 'parse_title';

const PLAN_LIMITS: Record<PlanName, { creditsPerDay: number; callsPerMinute: number; historyDays: number; commercial: boolean }> = {
  free: { creditsPerDay: 100, callsPerMinute: 60, historyDays: 3, commercial: false },
  api: { creditsPerDay: 20_000, callsPerMinute: 60, historyDays: 180, commercial: false },
  business: { creditsPerDay: 200_000, callsPerMinute: 500, historyDays: 365, commercial: true },
  enterprise: { creditsPerDay: 1_000_000, callsPerMinute: 1_000, historyDays: 365, commercial: true },
};

export class PokemonPriceTrackerError extends Error {
  code: string;
  status: number;
  recoverable: boolean;

  constructor(code: string, message: string, status = 500, recoverable = true) {
    super(message);
    this.name = 'PokemonPriceTrackerError';
    this.code = code;
    this.status = status;
    this.recoverable = recoverable;
  }
}

function planName(): PlanName {
  const raw = String(Deno.env.get('POKEMON_PRICE_TRACKER_PLAN') || 'free').trim().toLowerCase();
  return (['free', 'api', 'business', 'enterprise'] as const).includes(raw as PlanName) ? raw as PlanName : 'free';
}

export function getPokemonPriceTrackerPolicy() {
  const plan = planName();
  const limits = PLAN_LIMITS[plan];
  const explicitOverride = String(Deno.env.get('POKEMON_PRICE_TRACKER_PUBLIC_USE_ALLOWED') || '').trim().toLowerCase() === 'true';
  return {
    plan,
    configured: !!String(Deno.env.get('POKEMON_PRICE_TRACKER_API_KEY') || '').trim(),
    publicUseAllowed: limits.commercial || explicitOverride,
    explicitOverride,
    providerCreditsPerDay: limits.creditsPerDay,
    providerCallsPerMinute: limits.callsPerMinute,
    historyDays: limits.historyDays,
    softCreditsPerDay: Math.max(1, Math.floor(limits.creditsPerDay * 0.8)),
    softCallsPerMinute: Math.max(1, Math.floor(limits.callsPerMinute * 0.75)),
  };
}

function apiKey(): string {
  const key = String(Deno.env.get('POKEMON_PRICE_TRACKER_API_KEY') || '').trim();
  if (!key) throw new PokemonPriceTrackerError('NOT_CONFIGURED', 'PokemonPriceTracker API key is not configured.', 503, true);
  return key;
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeCardNumber(value: unknown): string {
  return String(value || '').trim().split('/')[0].replace(/^0+/, '') || '0';
}

function safeId(value: unknown): string {
  return String(value || '').trim().slice(0, 180);
}

function stableHash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function bucketKeys(date = new Date()) {
  const iso = date.toISOString();
  return {
    minute: `minute:${iso.slice(0, 16)}`,
    day: `day:${iso.slice(0, 10)}`,
  };
}

async function loadCache(svc: any, key: string): Promise<any | null> {
  const rows = await svc.entities.PokemonPriceTrackerCache.filter({ cache_key: key }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || null;
}

async function saveCache(svc: any, input: {
  cacheKey: string;
  resourceType: ResourceType;
  resourceId: string;
  payload: any;
  sourcePath: string;
  ttlMs: number;
  staleMs?: number;
  creditsConsumed?: number;
}) {
  const now = new Date();
  const record = {
    cache_key: input.cacheKey,
    resource_type: input.resourceType,
    resource_id: safeId(input.resourceId),
    payload: input.payload,
    source_path: input.sourcePath,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + input.ttlMs).toISOString(),
    stale_until: new Date(now.getTime() + (input.staleMs ?? STALE_TTL_MS)).toISOString(),
    credits_consumed: Math.max(0, Number(input.creditsConsumed) || 0),
    schema_version: 1,
  };
  const existing = await loadCache(svc, input.cacheKey);
  if (existing?.id) await svc.entities.PokemonPriceTrackerCache.update(existing.id, record);
  else await svc.entities.PokemonPriceTrackerCache.create(record);
}

async function loadUsage(svc: any, key: string): Promise<any | null> {
  const rows = await svc.entities.PokemonPriceTrackerUsage.filter({ bucket_key: key }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || null;
}

async function reserveUsage(svc: any, expectedCredits: number) {
  const policy = getPokemonPriceTrackerPolicy();
  const keys = bucketKeys();
  const [minute, day] = await Promise.all([loadUsage(svc, keys.minute), loadUsage(svc, keys.day)]);
  const now = Date.now();

  for (const row of [minute, day]) {
    const blockedUntil = row?.blocked_until ? Date.parse(row.blocked_until) : 0;
    if (blockedUntil > now) throw new PokemonPriceTrackerError('RATE_LIMITED', 'PokemonPriceTracker request budget is temporarily paused.', 429, true);
  }

  if ((minute?.calls_used || 0) + 1 > policy.softCallsPerMinute) {
    throw new PokemonPriceTrackerError('SOFT_MINUTE_LIMIT', 'PokemonPriceTracker minute safety budget reached.', 429, true);
  }
  if ((day?.credits_used || 0) + expectedCredits > policy.softCreditsPerDay) {
    throw new PokemonPriceTrackerError('SOFT_DAILY_CREDIT_LIMIT', 'PokemonPriceTracker daily safety credit budget reached.', 429, true);
  }
  if (day?.provider_credits_remaining != null && day.provider_credits_remaining <= Math.ceil(policy.providerCreditsPerDay * 0.2)) {
    throw new PokemonPriceTrackerError('PROVIDER_HEADROOM_RESERVED', 'PokemonPriceTracker provider credit headroom is reserved.', 429, true);
  }

  const stamp = new Date().toISOString();
  const upsert = async (row: any, key: string, type: 'minute' | 'day') => {
    const patch = {
      calls_used: (row?.calls_used || 0) + 1,
      credits_used: (row?.credits_used || 0) + expectedCredits,
      provider_call_limit: policy.providerCallsPerMinute,
      soft_call_limit: policy.softCallsPerMinute,
      provider_credit_limit: policy.providerCreditsPerDay,
      soft_credit_limit: policy.softCreditsPerDay,
      last_request_at: stamp,
    };
    if (row?.id) {
      await svc.entities.PokemonPriceTrackerUsage.update(row.id, patch);
      return { ...row, ...patch };
    }
    return svc.entities.PokemonPriceTrackerUsage.create({ bucket_key: key, bucket_type: type, ...patch });
  };

  await Promise.all([upsert(minute, keys.minute, 'minute'), upsert(day, keys.day, 'day')]);
  return { keys, expectedCredits };
}

function headerInt(res: Response, name: string): number | null {
  const raw = res.headers.get(name);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function recordActualUsage(svc: any, reservation: any, res: Response, body: any) {
  const actual = headerInt(res, 'X-API-Calls-Consumed')
    ?? Number(body?.metadata?.apiCallsConsumed?.total ?? body?.metadata?.apiCallsConsumed ?? reservation.expectedCredits);
  const remaining = headerInt(res, 'X-RateLimit-Daily-Remaining');
  const retry = Math.max(1, Number.parseInt(res.headers.get('Retry-After') || '60', 10) || 60);
  const blockedUntil = res.status === 429 ? new Date(Date.now() + retry * 1000).toISOString() : null;
  const delta = Number.isFinite(actual) ? actual - reservation.expectedCredits : 0;

  for (const key of [reservation.keys.minute, reservation.keys.day]) {
    const row = await loadUsage(svc, key);
    if (!row?.id) continue;
    const patch: any = {
      provider_calls_consumed: Number.isFinite(actual) ? actual : reservation.expectedCredits,
    };
    if (delta) patch.credits_used = Math.max(0, (row.credits_used || 0) + delta);
    if (remaining != null) patch.provider_credits_remaining = remaining;
    if (blockedUntil) patch.blocked_until = blockedUntil;
    await svc.entities.PokemonPriceTrackerUsage.update(row.id, patch).catch(() => {});
  }

  return Number.isFinite(actual) ? actual : reservation.expectedCredits;
}

async function upstreamJson(svc: any, path: string, expectedCredits: number) {
  const key = apiKey();
  const reservation = await reserveUsage(svc, expectedCredits);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
        'User-Agent': 'SwapPulse/0.8 (+https://swappulse.org)',
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new PokemonPriceTrackerError('NETWORK_ERROR', 'PokemonPriceTracker could not be reached.', 502, true);
  }

  const body = await res.json().catch(() => null);
  const consumed = await recordActualUsage(svc, reservation, res, body).catch(() => expectedCredits);

  if (res.status === 401) throw new PokemonPriceTrackerError('AUTH_ERROR', 'PokemonPriceTracker authentication failed.', 503, false);
  if (res.status === 403) throw new PokemonPriceTrackerError('PLAN_RESTRICTED', 'PokemonPriceTracker plan does not permit this request.', 403, false);
  if (res.status === 429) throw new PokemonPriceTrackerError('RATE_LIMITED', 'PokemonPriceTracker quota or request limit reached.', 429, true);
  if (!res.ok) throw new PokemonPriceTrackerError('UPSTREAM_ERROR', `PokemonPriceTracker returned HTTP ${res.status}.`, 502, true);
  if (!body) throw new PokemonPriceTrackerError('INVALID_RESPONSE', 'PokemonPriceTracker returned an invalid response.', 502, true);
  return { body, consumed };
}

function candidateScore(tcgdexCard: any, candidate: any): number {
  const nameA = normalizeText(tcgdexCard?.name);
  const nameB = normalizeText(candidate?.name);
  const setA = normalizeText(tcgdexCard?.set?.name || tcgdexCard?.set_name);
  const setB = normalizeText(candidate?.setName || candidate?.set?.name);
  const numberA = normalizeCardNumber(tcgdexCard?.localId || tcgdexCard?.local_id);
  const numberB = normalizeCardNumber(candidate?.cardNumber);
  const rarityA = normalizeText(tcgdexCard?.rarity);
  const rarityB = normalizeText(candidate?.rarity);

  // Collector number is required for automatic mapping.
  if (!numberA || !numberB || numberA !== numberB) return 0;
  let score = 7;
  if (nameA && nameB === nameA) score += 6;
  else if (nameA && nameB && (nameB.includes(nameA) || nameA.includes(nameB))) score += 3;
  if (setA && setB === setA) score += 6;
  else if (setA && setB && (setB.includes(setA) || setA.includes(setB))) score += 3;
  if (rarityA && rarityB && (rarityA === rarityB || rarityA.includes(rarityB) || rarityB.includes(rarityA))) score += 1;
  return score;
}

function normalizedPriceTrackerCard(card: any) {
  if (!card) return null;
  const variants = card?.variants && typeof card.variants === 'object'
    ? Object.entries(card.variants).map(([printing, value]: [string, any]) => ({
        printing,
        market: value?.marketPrice ?? value?.market ?? null,
        low: value?.lowPrice ?? value?.low ?? null,
        sellers: value?.sellers ?? null,
        conditionUsed: value?.conditionUsed ?? null,
        conditions: value?.conditions ?? value?.conditionPrices ?? null,
      }))
    : [];

  const salesByGrade = card?.ebay?.salesByGrade && typeof card.ebay.salesByGrade === 'object'
    ? Object.entries(card.ebay.salesByGrade).map(([grade, value]: [string, any]) => ({
        grade,
        count: value?.count ?? value?.salesCount ?? null,
        median: value?.medianPrice ?? value?.median ?? null,
        average: value?.averagePrice ?? value?.avg ?? null,
        min: value?.minPrice ?? null,
        max: value?.maxPrice ?? null,
        smartMarket: value?.smartMarketPrice?.price ?? value?.smartMarketPrice ?? null,
        confidence: value?.smartMarketPrice?.confidence ?? value?.smartMarketConfidence ?? null,
        lastSaleDate: value?.lastSaleDate ?? null,
      }))
    : [];

  return {
    tcgPlayerId: card?.tcgPlayerId != null ? String(card.tcgPlayerId) : null,
    name: card?.name || null,
    setName: card?.setName || card?.set?.name || null,
    setId: card?.setId != null ? String(card.setId) : null,
    cardNumber: card?.cardNumber || null,
    rarity: card?.rarity || null,
    language: card?.language || null,
    prices: {
      market: card?.prices?.market ?? card?.marketPrice ?? null,
      low: card?.prices?.low ?? card?.lowPrice ?? null,
      sellers: card?.prices?.sellers ?? card?.sellers ?? null,
      listings: card?.prices?.listings ?? null,
      primaryPrinting: card?.prices?.primaryPrinting ?? card?.printing ?? null,
      lastUpdated: card?.prices?.lastUpdated ?? card?.lastPriceUpdate ?? null,
      variants,
    },
    recentHistory: card?.priceHistory || null,
    graded: {
      salesByGrade,
      priceHistory: card?.ebay?.priceHistory || null,
    },
  };
}

/**
 * Resolve one canonical TCGDex card with a single limit=1 upstream query.
 * Free-tier cost target: 3 credits (base + 3-day history + graded/eBay data).
 */
export async function resolvePokemonPriceTrackerCard(svc: any, tcgdexCard: any) {
  const tcgdexId = safeId(tcgdexCard?.id || tcgdexCard?.card_id);
  if (!tcgdexId) throw new PokemonPriceTrackerError('INVALID_TCGDEX_CARD', 'TCGDex card id is required.', 400, false);

  const cacheKey = `card:${tcgdexId}:v1`;
  const cached = await loadCache(svc, cacheKey);
  const now = Date.now();
  if (cached?.payload && cached?.expires_at && Date.parse(cached.expires_at) > now) {
    return { ...cached.payload, freshness: { fromCache: true, stale: false, fetchedAt: cached.fetched_at || null } };
  }

  const running = inflight.get(cacheKey);
  if (running) return running;

  const task = (async () => {
    try {
      const policy = getPokemonPriceTrackerPolicy();
      const language = ['ja', 'jp', 'japanese'].includes(String(tcgdexCard?.set_lang || '').toLowerCase()) ? 'japanese' : 'english';
      const q = [tcgdexCard?.name, tcgdexCard?.set?.name || tcgdexCard?.set_name, tcgdexCard?.localId || tcgdexCard?.local_id]
        .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 180);
      if (!q) throw new PokemonPriceTrackerError('INVALID_QUERY', 'Unable to build PokemonPriceTracker card query.', 400, false);

      const params = new URLSearchParams({
        search: q,
        limit: '1',
        language,
        includeHistory: 'true',
        includeEbay: 'true',
        days: String(Math.min(3, policy.historyDays)),
      });
      const path = `/cards?${params.toString()}`;
      const { body, consumed } = await upstreamJson(svc, path, 3);
      const rows = Array.isArray(body?.data) ? body.data : body?.data ? [body.data] : [];
      const candidate = rows[0] || null;
      const score = candidateScore(tcgdexCard, candidate);

      const result = score >= 16 ? {
        available: true,
        matched: true,
        matchConfidence: score >= 19 ? 'high' : 'medium',
        matchScore: score,
        card: normalizedPriceTrackerCard(candidate),
        historyDays: Math.min(3, policy.historyDays),
      } : {
        available: true,
        matched: false,
        matchConfidence: 'none',
        matchScore: score,
        reason: candidate ? 'no_confident_match' : 'not_found',
        card: null,
        historyDays: Math.min(3, policy.historyDays),
      };

      await saveCache(svc, {
        cacheKey,
        resourceType: 'card',
        resourceId: tcgdexId,
        payload: result,
        sourcePath: '/cards',
        ttlMs: CARD_TTL_MS,
        staleMs: STALE_TTL_MS,
        creditsConsumed: consumed,
      });
      return { ...result, freshness: { fromCache: false, stale: false, fetchedAt: new Date().toISOString() } };
    } catch (error) {
      const staleUntil = cached?.stale_until ? Date.parse(cached.stale_until) : 0;
      if (cached?.payload && staleUntil > now) {
        return { ...cached.payload, freshness: { fromCache: true, stale: true, fetchedAt: cached.fetched_at || null } };
      }
      throw error;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, task);
  return task;
}

export async function getPokemonPriceTrackerUsageStatus(svc: any) {
  const policy = getPokemonPriceTrackerPolicy();
  const keys = bucketKeys();
  const [minute, day] = await Promise.all([loadUsage(svc, keys.minute), loadUsage(svc, keys.day)]);
  return {
    policy,
    minute: {
      callsUsed: minute?.calls_used || 0,
      softCallLimit: policy.softCallsPerMinute,
      providerCallLimit: policy.providerCallsPerMinute,
      blockedUntil: minute?.blocked_until || null,
    },
    day: {
      creditsUsed: day?.credits_used || 0,
      softCreditLimit: policy.softCreditsPerDay,
      providerCreditLimit: policy.providerCreditsPerDay,
      providerCreditsRemaining: day?.provider_credits_remaining ?? null,
      blockedUntil: day?.blocked_until || null,
    },
  };
}

export const PokemonPriceTrackerPlans = Object.freeze(PLAN_LIMITS);
