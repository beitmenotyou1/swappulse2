/*
 * TCGplayer API v1.39.0 read-only client for SwapPulse.
 *
 * Provider rules reflected here:
 * - New API access is not currently granted. Existing developer keys only.
 * - PUBLIC_KEY + PRIVATE_KEY mint a Bearer token at /token.
 * - Use is limited to the purpose approved by TCGplayer.
 * - SwapPulse exposes catalog/pricing only. No store/inventory/order/buylist writes.
 * - TCGplayer publishes no fixed numeric request ceiling in current public docs;
 *   its API Terms prohibit excessive/unreasonable volume and reserve a right to limit.
 * - We therefore enforce our own configurable safety ceiling and persistent cache.
 *
 * Server-only configuration:
 * - TCGPLAYER_PUBLIC_KEY
 * - TCGPLAYER_PRIVATE_KEY
 * - TCGPLAYER_APPROVED_USE=true only when the developer-key approval covers SwapPulse
 * - TCGPLAYER_SOFT_CALLS_PER_MINUTE (default 30)
 * - TCGPLAYER_SOFT_CALLS_PER_DAY (default 1000)
 */

const API_ORIGIN = 'https://api.tcgplayer.com';
const API_VERSION = 'v1.39.0';
const POKEMON_CATEGORY_ID = 3;
const PRODUCT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAPPING_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PRICING_TTL_MS = 6 * 60 * 60 * 1000;
const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let tokenCache: { token: string; expiresAt: number } | null = null;
const inflight = new Map<string, Promise<any>>();

type ResourceType = 'token_meta' | 'category' | 'group' | 'product' | 'pricing' | 'mapping';

export class TcgplayerError extends Error {
  code: string;
  status: number;
  recoverable: boolean;
  constructor(code: string, message: string, status = 500, recoverable = true) {
    super(message);
    this.name = 'TcgplayerError';
    this.code = code;
    this.status = status;
    this.recoverable = recoverable;
  }
}

function envInt(name: string, fallback: number, min: number, max: number) {
  const raw = Number.parseInt(String(Deno.env.get(name) || ''), 10);
  return Number.isFinite(raw) ? Math.max(min, Math.min(max, raw)) : fallback;
}

export function getTcgplayerPolicy() {
  const publicKey = String(Deno.env.get('TCGPLAYER_PUBLIC_KEY') || '').trim();
  const privateKey = String(Deno.env.get('TCGPLAYER_PRIVATE_KEY') || '').trim();
  return {
    configured: !!publicKey && !!privateKey,
    approvedUse: String(Deno.env.get('TCGPLAYER_APPROVED_USE') || '').trim().toLowerCase() === 'true',
    providerLimitKnown: false,
    softCallsPerMinute: envInt('TCGPLAYER_SOFT_CALLS_PER_MINUTE', 30, 1, 300),
    softCallsPerDay: envInt('TCGPLAYER_SOFT_CALLS_PER_DAY', 1000, 10, 100000),
    apiVersion: API_VERSION,
    pokemonCategoryId: POKEMON_CATEGORY_ID,
  };
}

function credentials() {
  const publicKey = String(Deno.env.get('TCGPLAYER_PUBLIC_KEY') || '').trim();
  const privateKey = String(Deno.env.get('TCGPLAYER_PRIVATE_KEY') || '').trim();
  if (!publicKey || !privateKey) throw new TcgplayerError('NOT_CONFIGURED', 'TCGplayer developer credentials are not configured.', 503, true);
  return { publicKey, privateKey };
}

function normalizeText(value: unknown) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function normalizeNumber(value: unknown) {
  return String(value || '').trim().split('/')[0].replace(/^0+/, '') || '0';
}

function bucketKeys(date = new Date()) {
  const iso = date.toISOString();
  return { minute: `minute:${iso.slice(0, 16)}`, day: `day:${iso.slice(0, 10)}` };
}

async function loadUsage(svc: any, key: string) {
  const rows = await svc.entities.TcgplayerUsage.filter({ bucket_key: key }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || null;
}

async function reserveUsage(svc: any) {
  const policy = getTcgplayerPolicy();
  const keys = bucketKeys();
  const [minute, day] = await Promise.all([loadUsage(svc, keys.minute), loadUsage(svc, keys.day)]);
  const now = Date.now();
  for (const row of [minute, day]) {
    const blocked = row?.blocked_until ? Date.parse(row.blocked_until) : 0;
    if (blocked > now) throw new TcgplayerError('RATE_LIMITED', 'TCGplayer request budget is temporarily paused.', 429, true);
  }
  if ((minute?.calls_used || 0) + 1 > policy.softCallsPerMinute) throw new TcgplayerError('SOFT_MINUTE_LIMIT', 'SwapPulse TCGplayer minute safety budget reached.', 429, true);
  if ((day?.calls_used || 0) + 1 > policy.softCallsPerDay) throw new TcgplayerError('SOFT_DAILY_LIMIT', 'SwapPulse TCGplayer daily safety budget reached.', 429, true);

  const stamp = new Date().toISOString();
  const upsert = async (row: any, key: string, type: 'minute' | 'day', soft: number) => {
    const patch = { calls_used: (row?.calls_used || 0) + 1, soft_call_limit: soft, provider_limit_known: false, last_request_at: stamp };
    if (row?.id) { await svc.entities.TcgplayerUsage.update(row.id, patch); return { ...row, ...patch }; }
    return svc.entities.TcgplayerUsage.create({ bucket_key: key, bucket_type: type, ...patch });
  };
  await Promise.all([
    upsert(minute, keys.minute, 'minute', policy.softCallsPerMinute),
    upsert(day, keys.day, 'day', policy.softCallsPerDay),
  ]);
  return keys;
}

async function recordStatus(svc: any, keys: any, status: number, retryAfter?: string | null) {
  const seconds = Math.max(1, Number.parseInt(String(retryAfter || '60'), 10) || 60);
  for (const key of [keys.minute, keys.day]) {
    const row = await loadUsage(svc, key);
    if (!row?.id) continue;
    const patch: any = { last_status: status };
    if (status === 429) patch.blocked_until = new Date(Date.now() + seconds * 1000).toISOString();
    await svc.entities.TcgplayerUsage.update(row.id, patch).catch(() => {});
  }
}

async function loadCache(svc: any, key: string) {
  const rows = await svc.entities.TcgplayerCache.filter({ cache_key: key }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || null;
}

async function saveCache(svc: any, input: { cacheKey: string; resourceType: ResourceType; resourceId: string; payload: any; sourcePath: string; ttlMs: number; staleMs?: number }) {
  const now = new Date();
  const record = {
    cache_key: input.cacheKey,
    resource_type: input.resourceType,
    resource_id: String(input.resourceId || '').slice(0, 180),
    payload: input.payload,
    source_path: input.sourcePath,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + input.ttlMs).toISOString(),
    stale_until: new Date(now.getTime() + (input.staleMs ?? STALE_TTL_MS)).toISOString(),
    schema_version: 1,
  };
  const existing = await loadCache(svc, input.cacheKey);
  if (existing?.id) await svc.entities.TcgplayerCache.update(existing.id, record);
  else await svc.entities.TcgplayerCache.create(record);
}

async function getBearerToken(svc: any) {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const { publicKey, privateKey } = credentials();
  const keys = await reserveUsage(svc);
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: publicKey, client_secret: privateKey });
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new TcgplayerError('NETWORK_ERROR', 'TCGplayer token service could not be reached.', 502, true);
  }
  await recordStatus(svc, keys, res.status, res.headers.get('Retry-After'));
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) throw new TcgplayerError('AUTH_ERROR', `TCGplayer authentication failed (HTTP ${res.status}).`, 503, false);
  const seconds = Math.max(300, Number(json.expires_in) || 1209599);
  tokenCache = { token: String(json.access_token), expiresAt: Date.now() + seconds * 1000 };
  return tokenCache.token;
}

async function apiJson(svc: any, path: string, init: RequestInit = {}) {
  const token = await getBearerToken(svc);
  const keys = await reserveUsage(svc);
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/${API_VERSION}${path}`, {
      ...init,
      headers: { Accept: 'application/json', Authorization: `bearer ${token}`, ...(init.headers || {}) },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new TcgplayerError('NETWORK_ERROR', 'TCGplayer API could not be reached.', 502, true);
  }
  await recordStatus(svc, keys, res.status, res.headers.get('Retry-After'));
  const json = await res.json().catch(() => null);
  if (res.status === 401) { tokenCache = null; throw new TcgplayerError('AUTH_ERROR', 'TCGplayer bearer token was rejected.', 503, false); }
  if (res.status === 429) throw new TcgplayerError('RATE_LIMITED', 'TCGplayer rate limit reached.', 429, true);
  if (!res.ok) throw new TcgplayerError('UPSTREAM_ERROR', `TCGplayer returned HTTP ${res.status}.`, 502, true);
  if (!json || json.success === false) throw new TcgplayerError('INVALID_RESPONSE', 'TCGplayer returned an unsuccessful response.', 502, true);
  return json;
}

function extendedField(product: any, names: string[]) {
  const wanted = names.map(normalizeText);
  const rows = Array.isArray(product?.extendedData) ? product.extendedData : [];
  for (const row of rows) {
    const key = normalizeText(row?.name || row?.displayName || row?.key);
    if (wanted.includes(key)) return row?.value ?? row?.displayValue ?? null;
  }
  return null;
}

function candidateScore(tcgdex: any, product: any, groupName: string) {
  const aName = normalizeText(tcgdex?.name);
  const bName = normalizeText(product?.name || product?.cleanName);
  const aSet = normalizeText(tcgdex?.set?.name || tcgdex?.set_name);
  const bSet = normalizeText(groupName);
  const aNum = normalizeNumber(tcgdex?.localId || tcgdex?.local_id);
  const bNum = normalizeNumber(extendedField(product, ['Number', 'Card Number', 'Collector Number']));
  const aRarity = normalizeText(tcgdex?.rarity);
  const bRarity = normalizeText(extendedField(product, ['Rarity']));
  if (aNum !== '0' && bNum !== '0' && aNum !== bNum) return 0;
  let score = 0;
  if (aName && bName === aName) score += 8;
  else if (aName && bName && (aName.includes(bName) || bName.includes(aName))) score += 4;
  if (aSet && bSet === aSet) score += 8;
  else if (aSet && bSet && (aSet.includes(bSet) || bSet.includes(aSet))) score += 4;
  if (aNum !== '0' && bNum === aNum) score += 8;
  if (aRarity && bRarity && (aRarity === bRarity || aRarity.includes(bRarity) || bRarity.includes(aRarity))) score += 1;
  return score;
}

async function groupNames(svc: any, ids: number[]) {
  const unique = [...new Set(ids.filter((x) => Number.isFinite(x) && x > 0))].slice(0, 50);
  if (!unique.length) return new Map<number, string>();
  const cacheKey = `groups:${unique.sort((a,b)=>a-b).join(',')}`;
  const cached = await loadCache(svc, cacheKey);
  if (cached?.payload && Date.parse(cached.expires_at || '') > Date.now()) return new Map((cached.payload || []).map((x: any) => [Number(x.groupId), String(x.name || '')]));
  const json = await apiJson(svc, `/catalog/groups/${unique.join(',')}`);
  const rows = Array.isArray(json.results) ? json.results : [];
  await saveCache(svc, { cacheKey, resourceType: 'group', resourceId: unique.join(','), payload: rows, sourcePath: '/catalog/groups', ttlMs: PRODUCT_TTL_MS });
  return new Map(rows.map((x: any) => [Number(x.groupId), String(x.name || '')]));
}

async function productPrices(svc: any, productId: number) {
  const cacheKey = `pricing:${productId}`;
  const cached = await loadCache(svc, cacheKey);
  if (cached?.payload && Date.parse(cached.expires_at || '') > Date.now()) return { rows: cached.payload, fromCache: true, stale: false, fetchedAt: cached.fetched_at };
  try {
    const json = await apiJson(svc, `/pricing/product/${productId}`);
    const rows = Array.isArray(json.results) ? json.results : [];
    await saveCache(svc, { cacheKey, resourceType: 'pricing', resourceId: String(productId), payload: rows, sourcePath: '/pricing/product', ttlMs: PRICING_TTL_MS });
    return { rows, fromCache: false, stale: false, fetchedAt: new Date().toISOString() };
  } catch (e) {
    if (cached?.payload && Date.parse(cached.stale_until || '') > Date.now()) return { rows: cached.payload, fromCache: true, stale: true, fetchedAt: cached.fetched_at };
    throw e;
  }
}

export async function resolveTcgplayerMarket(svc: any, tcgdexCard: any) {
  const tcgdexId = String(tcgdexCard?.id || tcgdexCard?.card_id || '').trim();
  if (!tcgdexId) throw new TcgplayerError('INVALID_TCGDEX_CARD', 'TCGDex card ID is required.', 400, false);
  const key = `mapping:${tcgdexId}:v1`;
  const cachedMap = await loadCache(svc, key);
  if (cachedMap?.payload?.productId && Date.parse(cachedMap.expires_at || '') > Date.now()) {
    const pricing = await productPrices(svc, Number(cachedMap.payload.productId));
    return { matched: true, matchConfidence: cachedMap.payload.matchConfidence || 'cached', product: cachedMap.payload.product, prices: pricing.rows, freshness: pricing };
  }

  const running = inflight.get(key);
  if (running) return running;
  const task = (async () => {
    try {
      const params = new URLSearchParams({ categoryId: String(POKEMON_CATEGORY_ID), productName: String(tcgdexCard?.name || '').slice(0, 120), getExtendedFields: 'true', productTypes: 'Cards', limit: '50' });
      const json = await apiJson(svc, `/catalog/products?${params.toString()}`);
      const products = Array.isArray(json.results) ? json.results : [];
      const groups = await groupNames(svc, products.map((x: any) => Number(x.groupId)));
      const ranked = products.map((product: any) => ({ product, groupName: groups.get(Number(product.groupId)) || '', score: candidateScore(tcgdexCard, product, groups.get(Number(product.groupId)) || '') })).sort((a: any,b: any)=>b.score-a.score);
      const best = ranked[0];
      const second = ranked[1];
      if (!best || best.score < 16 || (second && second.score === best.score)) return { matched: false, reason: best ? 'no_confident_match' : 'not_found' };
      const product = { productId: Number(best.product.productId), name: best.product.name || best.product.cleanName || null, groupId: Number(best.product.groupId), groupName: best.groupName || null, imageUrl: best.product.imageUrl || null, url: best.product.url || null, number: extendedField(best.product, ['Number','Card Number','Collector Number']), rarity: extendedField(best.product, ['Rarity']) };
      await saveCache(svc, { cacheKey: key, resourceType: 'mapping', resourceId: tcgdexId, payload: { productId: product.productId, product, matchConfidence: best.score >= 24 ? 'high' : 'medium', score: best.score }, sourcePath: '/catalog/products', ttlMs: MAPPING_TTL_MS });
      const pricing = await productPrices(svc, product.productId);
      return { matched: true, matchConfidence: best.score >= 24 ? 'high' : 'medium', matchScore: best.score, product, prices: pricing.rows, freshness: pricing };
    } finally { inflight.delete(key); }
  })();
  inflight.set(key, task);
  return task;
}

export async function getTcgplayerUsageStatus(svc: any) {
  const policy = getTcgplayerPolicy();
  const keys = bucketKeys();
  const [minute, day] = await Promise.all([loadUsage(svc, keys.minute), loadUsage(svc, keys.day)]);
  return {
    policy,
    minute: { callsUsed: minute?.calls_used || 0, softCallLimit: policy.softCallsPerMinute, blockedUntil: minute?.blocked_until || null },
    day: { callsUsed: day?.calls_used || 0, softCallLimit: policy.softCallsPerDay, blockedUntil: day?.blocked_until || null },
  };
}

export const TcgplayerPolicyDefaults = Object.freeze({ apiVersion: API_VERSION, pokemonCategoryId: POKEMON_CATEGORY_ID, softCallsPerMinute: 30, softCallsPerDay: 1000, pricingTtlHours: 6, mappingTtlDays: 30 });
