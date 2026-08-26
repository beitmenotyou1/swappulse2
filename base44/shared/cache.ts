/**
 * Cache Layer — Base44 Platform Adapter
 *
 * On Base44, Redis is not available as a standalone service.
 * This module provides a transparent in-process Map-based cache for
 * within-function-invocation reuse, with the same interface as the
 * full Redis implementation (see Phase 2 docs for self-hosted deployments).
 *
 * TTLs are respected via expiry timestamps. The cache is per-invocation —
 * for cross-invocation caching on Base44, use the TcgdexCard entity as
 * the persistent cache layer (already handled by sync-tcgdex-catalog).
 *
 * Cache Key Patterns:
 *   card:{cardId}:{lang}             Localised card data   (TTL: 24h)
 *   card:brief:{cardId}:{lang}       Card brief data       (TTL: 24h)
 *   set:{setId}:{lang}               Localised set data    (TTL: 24h)
 *   pricing:{cardId}                 Card pricing data     (TTL: 30min)
 *   metadata:{cardId}:{lang}:{variant} NFT metadata        (TTL: 1h)
 *   search:{lang}:{queryHash}        Search results        (TTL: 15min)
 *
 * @author SwapPulse
 * @version 1.0.0
 */

// ============================================================
// Cache Key Builders
// ============================================================

export const CacheKeys = {
  card: (cardId: string, lang: string) => `sp:card:${cardId}:${lang}`,
  cardBrief: (cardId: string, lang: string) => `sp:card:brief:${cardId}:${lang}`,
  set: (setId: string, lang: string) => `sp:set:${setId}:${lang}`,
  setBrief: (setId: string, lang: string) => `sp:set:brief:${setId}:${lang}`,
  serie: (serieId: string, lang: string) => `sp:serie:${serieId}:${lang}`,
  pricing: (cardId: string) => `sp:pricing:${cardId}`,
  enumData: (endpoint: string, lang: string) => `sp:enum:${endpoint}:${lang}`,
  metadata: (cardId: string, lang: string, variant: string) =>
    `sp:metadata:${cardId}:${lang}:${variant}`,
  search: (lang: string, queryHash: string) => `sp:search:${lang}:${queryHash}`,
  syncStatus: (jobName: string) => `sp:sync:${jobName}`,
} as const;

// ============================================================
// Cache TTLs (in seconds)
// ============================================================

export const CacheTTL = {
  CARD: 86400,       // 24 hours
  CARD_BRIEF: 86400, // 24 hours
  SET: 86400,        // 24 hours
  SET_BRIEF: 86400,  // 24 hours
  SERIE: 86400,      // 24 hours
  PRICING: 1800,     // 30 minutes
  ENUM: 86400,       // 24 hours
  METADATA: 3600,    // 1 hour
  SEARCH: 900,       // 15 minutes
  SYNC_STATUS: 300,  // 5 minutes
} as const;

// ============================================================
// In-Process Cache (Base44 adapter — replaces Redis client)
// ============================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const _store = new Map<string, CacheEntry<unknown>>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  const entry = _store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _store.delete(key);
    return null;
  }
  return entry.value;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  _store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDelete(key: string): Promise<void> {
  _store.delete(key);
}

export async function cacheDeletePattern(pattern: string): Promise<number> {
  // Convert glob pattern (sp:card:swsh3-136:*) to prefix match
  const prefix = pattern.replace(/\*.*$/, '');
  let deleted = 0;
  for (const key of _store.keys()) {
    if (key.startsWith(prefix)) {
      _store.delete(key);
      deleted++;
    }
  }
  return deleted;
}

export async function cacheIncr(key: string, ttlSeconds?: number): Promise<number> {
  const current = await cacheGet<number>(key) ?? 0;
  const next = current + 1;
  await cacheSet(key, next, ttlSeconds ?? 60);
  return next;
}

/**
 * Gets or sets a value in cache (read-through pattern).
 * Primary pattern for caching TCGDex API responses within a function invocation.
 *
 * @example
 * const card = await cacheGetOrSet(
 *   CacheKeys.card('swsh3-136', 'fr'),
 *   CacheTTL.CARD,
 *   () => getCard('swsh3-136', 'fr'),
 * );
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const value = await fetcher();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

export async function closeRedis(): Promise<void> {
  // No-op on Base44 (no persistent Redis connection to close)
}

export async function testRedisConnection(): Promise<{
  status: 'healthy' | 'down';
  latencyMs: number;
  details: string;
}> {
  const start = Date.now();
  await cacheSet('sp:ping', 1, 1);
  const val = await cacheGet<number>('sp:ping');
  return {
    status: val === 1 ? 'healthy' : 'down',
    latencyMs: Date.now() - start,
    details: val === 1 ? 'In-process cache OK (Base44 adapter)' : 'Cache read failed',
  };
}

export default {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  cacheIncr,
  cacheGetOrSet,
  closeRedis,
  testRedisConnection,
  CacheKeys,
  CacheTTL,
};