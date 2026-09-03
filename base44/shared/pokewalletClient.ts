/**
 * PokéWallet API client for SwapPulse.
 *
 * Free-tier safety:
 * - Provider limit: 100 requests/hour, 1,000 requests/day.
 * - SwapPulse soft budget: 80/hour, 800/day to preserve operational headroom.
 * - Authenticated calls are server-only and read POKEWALLET_API_KEY from Deno env.
 * - Persistent entity cache prevents repeated upstream reads across function invocations.
 * - Only Free-plan endpoints used by SwapPulse are exposed here. Pro and "Coming Soon"
 *   endpoints are deliberately absent.
 *
 * PokéWallet docs: https://www.pokewallet.io/api-docs
 */

const POKEWALLET_BASE_URL = 'https://api.pokewallet.io';
const PROVIDER_HOURLY_LIMIT = 100;
const PROVIDER_DAILY_LIMIT = 1000;
const SOFT_HOURLY_LIMIT = 80;
const SOFT_DAILY_LIMIT = 800;

const CARD_TTL_MS = 6 * 60 * 60 * 1000;
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const SETS_TTL_MS = 24 * 60 * 60 * 1000;
const MAPPING_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const inflight = new Map<string, Promise<any>>();

type ResourceType = 'search' | 'card' | 'sets' | 'set' | 'mapping';

type CachedResult<T = any> = {
  data: T;
  fromCache: boolean;
  stale: boolean;
  fetchedAt: string | null;
};

export class PokeWalletError extends Error {
  code: string;
  status: number;
  recoverable: boolean;

  constructor(code: string, message: string, status = 500, recoverable = true) {
    super(message);
    this.name = 'PokeWalletError';
    this.code = code;
    this.status = status;
    this.recoverable = recoverable;
  }
}

function nowIso(): string {
  return new Date().toISOString();
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
  const first = String(value || '').trim().split('/')[0].replace(/^0+/, '');
  return first || '0';
}

function safeId(value: unknown): string {
  return String(value || '').trim().slice(0, 180);
}

function stableKey(value: string): string {
  // Fast deterministic FNV-1a style hash. This is a cache-key helper, not cryptography.
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function bucketKeys(date = new Date()) {
  const iso = date.toISOString();
  return {
    hour: `hour:${iso.slice(0, 13)}`,
    day: `day:${iso.slice(0, 10)}`,
  };
}

async function loadCache(svc: any, cacheKey: string): Promise<any | null> {
  const rows = await svc.entities.PokeWalletCache
    .filter({ cache_key: cacheKey }, '-updated_date', 1)
    .catch(() => []);
  return rows?.[0] || null;
}

async function putCache(
  svc: any,
  {
    cacheKey,
    resourceType,
    resourceId,
    payload,
    sourceUrl,
    ttlMs,
    staleMs = STALE_TTL_MS,
  }: {
    cacheKey: string;
    resourceType: ResourceType;
    resourceId: string;
    payload: any;
    sourceUrl: string;
    ttlMs: number;
    staleMs?: number;
  },
): Promise<void> {
  const fetchedAt = new Date();
  const record = {
    cache_key: cacheKey,
    resource_type: resourceType,
    resource_id: safeId(resourceId),
    payload,
    source_url: sourceUrl,
    fetched_at: fetchedAt.toISOString(),
    expires_at: new Date(fetchedAt.getTime() + ttlMs).toISOString(),
    stale_until: new Date(fetchedAt.getTime() + staleMs).toISOString(),
    schema_version: 1,
  };

  const existing = await loadCache(svc, cacheKey);
  if (existing?.id) {
    await svc.entities.PokeWalletCache.update(existing.id, record);
  } else {
    await svc.entities.PokeWalletCache.create(record);
  }
}

function asCachedResult(row: any, stale = false): CachedResult {
  return {
    data: row?.payload ?? null,
    fromCache: true,
    stale,
    fetchedAt: row?.fetched_at || null,
  };
}

async function loadUsageBucket(svc: any, bucketKey: string): Promise<any | null> {
  const rows = await svc.entities.PokeWalletUsage
    .filter({ bucket_key: bucketKey }, '-updated_date', 1)
    .catch(() => []);
  return rows?.[0] || null;
}

async function reserveFreeTierRequest(svc: any): Promise<{ hour: any; day: any }> {
  const keys = bucketKeys();
  const [hour, day] = await Promise.all([
    loadUsageBucket(svc, keys.hour),
    loadUsageBucket(svc, keys.day),
  ]);

  const now = Date.now();
  for (const row of [hour, day]) {
    const blocked = row?.blocked_until ? Date.parse(row.blocked_until) : 0;
    if (blocked && blocked > now) {
      throw new PokeWalletError('RATE_LIMITED', 'PokéWallet request budget is temporarily paused.', 429, true);
    }
  }

  if ((hour?.count || 0) >= SOFT_HOURLY_LIMIT || (hour?.provider_remaining != null && hour.provider_remaining <= PROVIDER_HOURLY_LIMIT - SOFT_HOURLY_LIMIT)) {
    throw new PokeWalletError('SOFT_HOURLY_LIMIT', 'PokéWallet hourly safety budget reached.', 429, true);
  }
  if ((day?.count || 0) >= SOFT_DAILY_LIMIT || (day?.provider_remaining != null && day.provider_remaining <= PROVIDER_DAILY_LIMIT - SOFT_DAILY_LIMIT)) {
    throw new PokeWalletError('SOFT_DAILY_LIMIT', 'PokéWallet daily safety budget reached.', 429, true);
  }

  const stamp = nowIso();
  const upsert = async (row: any, bucketKey: string, bucketType: 'hour' | 'day', providerLimit: number, softLimit: number) => {
    if (row?.id) {
      await svc.entities.PokeWalletUsage.update(row.id, {
        count: (row.count || 0) + 1,
        provider_limit: providerLimit,
        soft_limit: softLimit,
        last_request_at: stamp,
      });
      return { ...row, count: (row.count || 0) + 1 };
    }
    const created = await svc.entities.PokeWalletUsage.create({
      bucket_key: bucketKey,
      bucket_type: bucketType,
      count: 1,
      provider_limit: providerLimit,
      soft_limit: softLimit,
      last_request_at: stamp,
    });
    return created;
  };

  const [reservedHour, reservedDay] = await Promise.all([
    upsert(hour, keys.hour, 'hour', PROVIDER_HOURLY_LIMIT, SOFT_HOURLY_LIMIT),
    upsert(day, keys.day, 'day', PROVIDER_DAILY_LIMIT, SOFT_DAILY_LIMIT),
  ]);

  return { hour: reservedHour, day: reservedDay };
}

async function recordProviderLimits(svc: any, res: Response): Promise<void> {
  const keys = bucketKeys();
  const hourRemaining = parsePositiveInt(res.headers.get('X-RateLimit-Remaining-Hour'));
  const dayRemaining = parsePositiveInt(res.headers.get('X-RateLimit-Remaining-Day'));
  const hourLimit = parsePositiveInt(res.headers.get('X-RateLimit-Limit-Hour')) ?? PROVIDER_HOURLY_LIMIT;
  const dayLimit = parsePositiveInt(res.headers.get('X-RateLimit-Limit-Day')) ?? PROVIDER_DAILY_LIMIT;

  const blockedUntil = res.status === 429
    ? new Date(Date.now() + Math.max(60, Number.parseInt(res.headers.get('Retry-After') || '60', 10) || 60) * 1000).toISOString()
    : undefined;

  const update = async (bucketKey: string, remaining: number | null, limit: number) => {
    const row = await loadUsageBucket(svc, bucketKey);
    if (!row?.id) return;
    const patch: any = { provider_limit: limit };
    if (remaining != null) patch.provider_remaining = remaining;
    if (blockedUntil) patch.blocked_until = blockedUntil;
    await svc.entities.PokeWalletUsage.update(row.id, patch).catch(() => {});
  };

  await Promise.all([
    update(keys.hour, hourRemaining, hourLimit),
    update(keys.day, dayRemaining, dayLimit),
  ]);
}

export function isPokeWalletConfigured(): boolean {
  return !!String(Deno.env.get('POKEWALLET_API_KEY') || '').trim();
}

function getApiKey(): string {
  const key = String(Deno.env.get('POKEWALLET_API_KEY') || '').trim();
  if (!key) {
    throw new PokeWalletError('NOT_CONFIGURED', 'PokéWallet API is not configured on the server.', 503, true);
  }
  if (!/^pk_(live|test)_[A-Za-z0-9]+$/.test(key)) {
    throw new PokeWalletError('INVALID_SERVER_CONFIG', 'PokéWallet API key format is invalid.', 503, true);
  }
  return key;
}

async function upstreamJson(svc: any, path: string): Promise<any> {
  const key = getApiKey();
  await reserveFreeTierRequest(svc);

  let response: Response;
  try {
    response = await fetch(`${POKEWALLET_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-API-Key': key,
        'User-Agent': 'SwapPulse/0.7 (+https://swappulse.org)',
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new PokeWalletError('NETWORK_ERROR', 'PokéWallet could not be reached.', 502, true);
  }

  await recordProviderLimits(svc, response).catch(() => {});

  if (response.status === 429) {
    throw new PokeWalletError('RATE_LIMITED', 'PokéWallet rate limit reached.', 429, true);
  }
  if (response.status === 401 || response.status === 403) {
    throw new PokeWalletError('AUTH_ERROR', 'PokéWallet authentication failed on the server.', 503, false);
  }
  if (response.status === 404) {
    throw new PokeWalletError('NOT_FOUND', 'PokéWallet resource not found.', 404, true);
  }
  if (!response.ok) {
    throw new PokeWalletError('UPSTREAM_ERROR', `PokéWallet returned HTTP ${response.status}.`, 502, true);
  }

  try {
    return await response.json();
  } catch {
    throw new PokeWalletError('INVALID_RESPONSE', 'PokéWallet returned an invalid response.', 502, true);
  }
}

async function cachedJson(
  svc: any,
  {
    cacheKey,
    resourceType,
    resourceId,
    path,
    ttlMs,
    staleMs = STALE_TTL_MS,
  }: {
    cacheKey: string;
    resourceType: ResourceType;
    resourceId: string;
    path: string;
    ttlMs: number;
    staleMs?: number;
  },
): Promise<CachedResult> {
  const existing = await loadCache(svc, cacheKey);
  const now = Date.now();
  const expires = existing?.expires_at ? Date.parse(existing.expires_at) : 0;
  if (existing?.payload && expires > now) return asCachedResult(existing, false);

  const requestKey = `${resourceType}:${cacheKey}`;
  const prior = inflight.get(requestKey);
  if (prior) return prior;

  const task = (async () => {
    try {
      const data = await upstreamJson(svc, path);
      await putCache(svc, {
        cacheKey,
        resourceType,
        resourceId,
        payload: data,
        sourceUrl: `${POKEWALLET_BASE_URL}${path.split('?')[0]}`,
        ttlMs,
        staleMs,
      });
      return { data, fromCache: false, stale: false, fetchedAt: nowIso() };
    } catch (error) {
      const staleUntil = existing?.stale_until ? Date.parse(existing.stale_until) : 0;
      if (existing?.payload && staleUntil > now) return asCachedResult(existing, true);
      throw error;
    } finally {
      inflight.delete(requestKey);
    }
  })();

  inflight.set(requestKey, task);
  return task;
}

export async function getPokeWalletSets(svc: any): Promise<CachedResult> {
  return cachedJson(svc, {
    cacheKey: 'sets:index:v1',
    resourceType: 'sets',
    resourceId: 'all',
    path: '/sets',
    ttlMs: SETS_TTL_MS,
  });
}

export async function searchPokeWalletCards(svc: any, query: string, limit = 20): Promise<CachedResult> {
  const q = String(query || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!q) throw new PokeWalletError('INVALID_QUERY', 'PokéWallet search query is empty.', 400, false);
  const safeLimit = Math.min(20, Math.max(1, Number(limit) || 20));
  const cacheKey = `search:${stableKey(`${q.toLowerCase()}|${safeLimit}`)}`;
  const params = new URLSearchParams({ q, page: '1', limit: String(safeLimit) });
  return cachedJson(svc, {
    cacheKey,
    resourceType: 'search',
    resourceId: stableKey(q.toLowerCase()),
    path: `/search?${params.toString()}`,
    ttlMs: SEARCH_TTL_MS,
  });
}

export async function getPokeWalletCard(svc: any, id: string): Promise<CachedResult> {
  const cardId = safeId(id);
  if (!/^(?:pk_[a-f0-9]{16,}|[a-f0-9]{32,})$/i.test(cardId)) {
    throw new PokeWalletError('INVALID_CARD_ID', 'Invalid PokéWallet card id.', 400, false);
  }
  return cachedJson(svc, {
    cacheKey: `card:${cardId}`,
    resourceType: 'card',
    resourceId: cardId,
    path: `/cards/${encodeURIComponent(cardId)}`,
    ttlMs: CARD_TTL_MS,
  });
}

function scoreCandidate(tcgdexCard: any, candidate: any): number {
  const info = candidate?.card_info || {};
  const tcgName = normalizeText(tcgdexCard?.name);
  const pwName = normalizeText(info.clean_name || info.name);
  const tcgSet = normalizeText(tcgdexCard?.set?.name);
  const pwSet = normalizeText(info.set_name);
  const tcgNumber = normalizeCardNumber(tcgdexCard?.localId || tcgdexCard?.local_id);
  const pwNumber = normalizeCardNumber(info.card_number);
  let score = 0;

  if (tcgNumber && tcgNumber === pwNumber) score += 6;
  else return 0;

  if (tcgName && pwName === tcgName) score += 5;
  else if (tcgName && (pwName.startsWith(`${tcgName} `) || pwName.includes(` ${tcgName} `))) score += 4;
  else if (tcgName && pwName.includes(tcgName)) score += 3;

  if (tcgSet && pwSet === tcgSet) score += 5;
  else if (tcgSet && pwSet && (pwSet.includes(tcgSet) || tcgSet.includes(pwSet))) score += 3;

  const tcgRarity = normalizeText(tcgdexCard?.rarity);
  const pwRarity = normalizeText(info.rarity);
  if (tcgRarity && pwRarity && (tcgRarity === pwRarity || pwRarity.includes(tcgRarity) || tcgRarity.includes(pwRarity))) score += 1;

  return score;
}

async function findPokeWalletSetId(svc: any, tcgdexCard: any): Promise<{ setId: string | null; stale: boolean }> {
  const setName = normalizeText(tcgdexCard?.set?.name);
  if (!setName) return { setId: null, stale: false };

  try {
    const sets = await getPokeWalletSets(svc);
    const list = Array.isArray(sets.data?.data) ? sets.data.data : Array.isArray(sets.data) ? sets.data : [];
    const matches = list.filter((s: any) => normalizeText(s?.name) === setName);
    if (matches.length === 1 && matches[0]?.set_id != null) {
      return { setId: String(matches[0].set_id), stale: sets.stale };
    }
  } catch {
    // Set matching is an optimisation. Card search still has a safe fallback.
  }
  return { setId: null, stale: false };
}

async function loadMapping(svc: any, tcgdexCardId: string): Promise<any | null> {
  const row = await loadCache(svc, `mapping:${tcgdexCardId}`);
  if (!row?.payload) return null;
  const expires = row.expires_at ? Date.parse(row.expires_at) : 0;
  if (expires <= Date.now()) return null;
  return row.payload;
}

async function saveMapping(svc: any, tcgdexCardId: string, payload: any): Promise<void> {
  await putCache(svc, {
    cacheKey: `mapping:${tcgdexCardId}`,
    resourceType: 'mapping',
    resourceId: tcgdexCardId,
    payload,
    sourceUrl: `${POKEWALLET_BASE_URL}/search`,
    ttlMs: MAPPING_TTL_MS,
    staleMs: STALE_TTL_MS,
  });
}

function normalizeMarketCard(card: any) {
  if (!card) return null;
  const info = card.card_info || {};
  return {
    id: card.id || null,
    cardInfo: {
      name: info.name || null,
      cleanName: info.clean_name || null,
      setName: info.set_name || null,
      setCode: info.set_code || null,
      setId: info.set_id != null ? String(info.set_id) : null,
      cardNumber: info.card_number || null,
      rarity: info.rarity || null,
    },
    imageLanguages: Array.isArray(card.images?.languages) ? card.images.languages : [],
    tcgplayer: card.tcgplayer ? {
      url: card.tcgplayer.url || null,
      prices: Array.isArray(card.tcgplayer.prices) ? card.tcgplayer.prices.map((p: any) => ({
        variant: p.sub_type_name || null,
        low: p.low_price ?? null,
        mid: p.mid_price ?? null,
        high: p.high_price ?? null,
        market: p.market_price ?? null,
        directLow: p.direct_low_price ?? null,
        updatedAt: p.updated_at || null,
      })) : [],
    } : null,
    cardmarket: card.cardmarket ? {
      productName: card.cardmarket.product_name || null,
      url: card.cardmarket.product_url || null,
      prices: Array.isArray(card.cardmarket.prices) ? card.cardmarket.prices.map((p: any) => ({
        variant: p.variant_type || null,
        avg: p.avg ?? null,
        low: p.low ?? null,
        trend: p.trend ?? null,
        avg1: p.avg1 ?? null,
        avg7: p.avg7 ?? null,
        avg30: p.avg30 ?? null,
        updatedAt: p.updated_at || null,
      })) : [],
    } : null,
  };
}

/**
 * Resolve a canonical TCGDex card to a PokéWallet market record without changing
 * SwapPulse's canonical TCGDex card ID. Ambiguous PokéWallet variants are never
 * auto-selected.
 */
export async function resolvePokeWalletMarket(svc: any, tcgdexCard: any): Promise<any> {
  const tcgdexCardId = safeId(tcgdexCard?.id);
  if (!tcgdexCardId) throw new PokeWalletError('INVALID_TCGDEX_CARD', 'TCGDex card id is required.', 400, false);

  const mapping = await loadMapping(svc, tcgdexCardId);
  if (mapping?.pokewallet_card_id) {
    try {
      const result = await getPokeWalletCard(svc, mapping.pokewallet_card_id);
      return {
        available: true,
        matched: true,
        matchConfidence: mapping.match_confidence || 'high',
        matchReason: mapping.match_reason || 'cached_mapping',
        market: normalizeMarketCard(result.data),
        freshness: { fromCache: result.fromCache, stale: result.stale, fetchedAt: result.fetchedAt },
      };
    } catch (error) {
      if (error instanceof PokeWalletError && error.code === 'NOT_FOUND') {
        // Let the search resolver repair an obsolete mapping below.
      } else if (error instanceof PokeWalletError && error.recoverable) {
        throw error;
      }
    }
  }

  const number = normalizeCardNumber(tcgdexCard?.localId || tcgdexCard?.local_id);
  const setResolution = await findPokeWalletSetId(svc, tcgdexCard);
  const query = setResolution.setId
    ? `${setResolution.setId} ${number}`
    : `${String(tcgdexCard?.name || '').trim()} ${number}`.trim();

  const search = await searchPokeWalletCards(svc, query, 20);
  const results = Array.isArray(search.data?.results) ? search.data.results : [];
  const ranked = results
    .map((candidate: any) => ({ candidate, score: scoreCandidate(tcgdexCard, candidate) }))
    .filter((item: any) => item.score >= 11)
    .sort((a: any, b: any) => b.score - a.score);

  if (ranked.length === 0) {
    return {
      available: true,
      matched: false,
      matchConfidence: 'none',
      matchReason: 'no_confident_match',
      market: null,
      freshness: { fromCache: search.fromCache, stale: search.stale, fetchedAt: search.fetchedAt },
    };
  }

  // PokéWallet documents multiple CardMarket-only variants with identical set/card
  // numbers. Never guess when two candidates tie at the top score.
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    return {
      available: true,
      matched: false,
      matchConfidence: 'ambiguous',
      matchReason: 'multiple_equal_variants',
      candidateCount: ranked.filter((x: any) => x.score === ranked[0].score).length,
      market: null,
      freshness: { fromCache: search.fromCache, stale: search.stale, fetchedAt: search.fetchedAt },
    };
  }

  const selected = ranked[0];
  const pwId = safeId(selected.candidate?.id);
  if (!pwId) {
    return { available: true, matched: false, matchConfidence: 'none', matchReason: 'candidate_missing_id', market: null };
  }

  await saveMapping(svc, tcgdexCardId, {
    pokewallet_card_id: pwId,
    match_confidence: selected.score >= 15 ? 'high' : 'medium',
    match_reason: setResolution.setId ? 'set_id_card_number_name' : 'card_number_name_set',
    score: selected.score,
  }).catch(() => {});

  // The search response already contains market data. Cache the selected result as
  // a card response so the initial page view does not spend a second API request.
  await putCache(svc, {
    cacheKey: `card:${pwId}`,
    resourceType: 'card',
    resourceId: pwId,
    payload: selected.candidate,
    sourceUrl: `${POKEWALLET_BASE_URL}/search`,
    ttlMs: CARD_TTL_MS,
  }).catch(() => {});

  return {
    available: true,
    matched: true,
    matchConfidence: selected.score >= 15 ? 'high' : 'medium',
    matchReason: setResolution.setId ? 'set_id_card_number_name' : 'card_number_name_set',
    market: normalizeMarketCard(selected.candidate),
    freshness: { fromCache: search.fromCache, stale: search.stale || setResolution.stale, fetchedAt: search.fetchedAt },
  };
}

/** Public no-key health probe. Does not consume the authenticated free-tier budget. */
export async function checkPokeWalletHealth(): Promise<{ status: 'up' | 'down'; latencyMs?: number; error?: string }> {
  const started = Date.now();
  try {
    if (!isPokeWalletConfigured()) {
      return { status: 'down', latencyMs: 0, error: 'POKEWALLET_API_KEY not configured' };
    }
    const res = await fetch(`${POKEWALLET_BASE_URL}/health`, {
      headers: { Accept: 'application/json', 'User-Agent': 'SwapPulse/0.7 (+https://swappulse.org)' },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(() => null);
    if (data?.status && !['healthy', 'ok'].includes(String(data.status).toLowerCase())) {
      throw new Error(`health=${String(data.status)}`);
    }
    return { status: 'up', latencyMs: Date.now() - started };
  } catch (error) {
    return { status: 'down', latencyMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
  }
}

export const PokeWalletFreeTier = Object.freeze({
  providerHourlyLimit: PROVIDER_HOURLY_LIMIT,
  providerDailyLimit: PROVIDER_DAILY_LIMIT,
  softHourlyLimit: SOFT_HOURLY_LIMIT,
  softDailyLimit: SOFT_DAILY_LIMIT,
});
