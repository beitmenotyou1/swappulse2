/**
 * TCGDex API Client Wrapper — Phase 1
 *
 * Wraps the TCGDex v2 REST API with:
 * - Rate limiting (10 requests/second, sliding window)
 * - Exponential backoff retry logic
 * - Multi-language support (17 languages)
 * - Language validation with common-mistake corrections
 * - Asset URL helpers (image quality/format selection)
 * - Enumeration endpoints (rarities, types, etc.)
 * - TCG Pocket integration helpers
 * - Multi-language batch fetching
 * - Health check
 *
 * Also provides lazy access to the @tcgdex/sdk package for callers
 * that prefer the SDK's convenience methods.
 *
 * Backward-compatible exports preserved for existing importers:
 *   TCGDEX_LANGS, RateLimiter, fetchTcgdex, num, normalizeSetId, tcgdexBase
 *
 * Documentation References:
 * - REST API: https://tcgdex.dev/rest
 * - Card Reference: https://tcgdex.dev/reference/card
 * - Set Reference: https://tcgdex.dev/reference/set
 * - Serie Reference: https://tcgdex.dev/reference/serie
 * - Markets & Prices: https://tcgdex.dev/markets-prices
 * - Assets: https://tcgdex.dev/assets
 * - Filtering: https://tcgdex.dev/rest/filtering-sorting-pagination
 * - Language Support: https://tcgdex.dev/errors/language-invalid
 * - TypeScript SDK: https://tcgdex.dev/sdks/typescript
 */

import {
  TCGDEX_BASE_URL,
  TCGDEX_RATE_LIMIT,
  TCGDEX_RATE_WINDOW_MS,
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  COUNTRY_TO_LANGUAGE,
  INTERNAL_TO_API_LANG,
  API_TO_INTERNAL_LANG,
  type TcgdexLanguage,
  type TcgdexCard,
  type TcgdexCardBrief,
  type TcgdexSet,
  type TcgdexSetBrief,
  type TcgdexSerie,
  type TcgdexSerieBrief,
  type LocalizedCardData,
  type LocalizedSetData,
  type EnumEndpoint,
  type ImageQuality,
  type ImageFormat,
} from './tcgdexConstants.ts';

// Re-export constants and types for convenience
export {
  TCGDEX_BASE_URL,
  TCGDEX_RATE_LIMIT,
  TCGDEX_RATE_WINDOW_MS,
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  COUNTRY_TO_LANGUAGE,
  TcgdexLanguage,
  TcgdexCard,
  TcgdexCardBrief,
  TcgdexSet,
  TcgdexSetBrief,
  TcgdexSerie,
  TcgdexSerieBrief,
  LocalizedCardData,
  LocalizedSetData,
  EnumEndpoint,
  ImageQuality,
  ImageFormat,
};

// ============================================================
// Backward-compatible exports (existing importers depend on these)
// ============================================================

/**
 * Internal language labels — uses 'jp' and 'zh' instead of TCGDex's
 * 'ja' and 'zh-tw'. Entity field names (name_norm_jp, name_norm_zh)
 * are built from these, so they must not change.
 */
export const TCGDEX_LANGS = [
  'en', 'fr', 'de', 'it', 'es', 'pt', 'jp', 'zh', 'ko',
  'pt-br', 'pt-pt', 'nl', 'pl', 'ru', 'zh-cn', 'id', 'th',
];

/** Map internal lang code -> TCGDex API lang code (jp→ja, zh→zh-tw). */
function toApiLang(lang: string): string {
  return INTERNAL_TO_API_LANG[lang] || lang;
}

/** Map TCGDex API lang code -> internal lang code (ja→jp, zh-tw→zh). */
export function toInternalLang(apiLang: string): string {
  return API_TO_INTERNAL_LANG[apiLang] || apiLang;
}

export function tcgdexBase(lang = 'en'): string {
  const l = TCGDEX_LANGS.includes(lang) ? lang : 'en';
  return `${TCGDEX_BASE_URL}/${toApiLang(l)}`;
}

/**
 * Minimal token-bucket rate limiter for sequential fetches within a single
 * function invocation. Ensures >= 100ms between upstream calls (10 req/s).
 * Preserved for backward compatibility with syncPricing and sync-tcgdex-catalog.
 */
export class RateLimiter {
  private last = 0;
  private readonly minInterval = 1000 / TCGDEX_RATE_LIMIT;

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const elapsed = Date.now() - this.last;
    if (elapsed < this.minInterval) {
      await new Promise((r) => setTimeout(r, this.minInterval - elapsed));
    }
    this.last = Date.now();
    return fn();
  }
}

/** Fetch a TCGDex v2 endpoint for the given language and return parsed JSON. */
export async function fetchTcgdex(path: string, lang = 'en'): Promise<any> {
  const res = await fetch(`${tcgdexBase(lang)}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`TCGDex ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

/** Coerce a maybe-number into a stored number or null. */
export function num(v: any): number | null {
  return typeof v === 'number' && isFinite(v) ? v : null;
}

/**
 * Normalize a set ID to TCGDex's canonical format.
 * TCGDex uses leading zeros for single-digit SV sets (sv01, sv02, ...) and
 * ".5" for half-sets (sv04.5, sv06.5). Some stored data uses short forms
 * like "sv4a" (a = .5) or "sv1" (no leading zero). This normalizes them:
 *   sv4a  → sv04.5   (a suffix → .5, pad single digit)
 *   sv1   → sv01     (pad single digit)
 *   sv4   → sv04     (pad single digit)
 *   sv04.5 → sv04.5  (already canonical, no change)
 *   sv10  → sv10     (double-digit, no change)
 *   sv10.5b → sv10.5b (variant suffix, no change)
 */
export function normalizeSetId(setId: string): string {
  if (!setId) return setId;
  let s = String(setId).toLowerCase().trim();
  if (s.startsWith('sv')) {
    s = s.replace(/^sv(\d+)a$/, 'sv$1.5');      // sv4a → sv4.5
    s = s.replace(/^sv(\d)(\D|$)/, 'sv0$1$2');  // sv4 → sv04, sv4.5 → sv04.5
  }
  return s;
}

// ============================================================
// Sliding Window Rate Limiter (new)
// ============================================================

/**
 * Sliding window rate limiter — more accurate than the token-bucket above.
 * Ensures we never exceed 10 requests per second to TCGDex.
 */
class SlidingWindowRateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = TCGDEX_RATE_LIMIT, windowMs = TCGDEX_RATE_WINDOW_MS) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((ts) => now - ts < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 10;
      if (waitMs > 0) await new Promise<void>((r) => setTimeout(r, waitMs));
      return this.throttle();
    }
    this.timestamps.push(Date.now());
  }

  getCurrentCount(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((ts) => now - ts < this.windowMs);
    return this.timestamps.length;
  }
}

const slidingLimiter = new SlidingWindowRateLimiter();

// ============================================================
// Retry Logic with Exponential Backoff
// ============================================================

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 10000,
};

function calculateBackoff(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = Math.random() * (cappedDelay * 0.5);
  return Math.round(cappedDelay + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Wraps an async function with rate limiting and retry logic.
 * Does not retry on 404s (resource not found).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      await slidingLimiter.throttle();
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.message.includes('404') || lastError.message.includes('not found')) {
        throw lastError;
      }
      if (attempt >= config.maxRetries) throw lastError;

      const delay = calculateBackoff(attempt, config);
      console.warn(`TCGDex retry ${attempt + 1}/${config.maxRetries} after ${delay}ms: ${lastError.message}`);
      await sleep(delay);
    }
  }
  throw lastError || new Error('Unknown error in retry logic');
}

// ============================================================
// Language Validation
// ============================================================

/**
 * Validates that a language code is supported by TCGDex.
 * Corrects common mistakes (jp→ja, cn→zh-cn, etc.) and falls back to English.
 *
 * Documentation: https://tcgdex.dev/errors/language-invalid
 */
export function validateLanguage(lang: string): TcgdexLanguage {
  if (!lang) return 'en';

  // Check exact match against TCGDex API codes
  if (SUPPORTED_LANGUAGES.includes(lang as TcgdexLanguage)) {
    return lang as TcgdexLanguage;
  }

  // Common mistake corrections
  const corrections: Record<string, TcgdexLanguage> = {
    jp: 'ja',
    cn: 'zh-cn',
    tw: 'zh-tw',
    br: 'pt-br',
    kr: 'ko',
  };
  const lower = lang.toLowerCase();
  if (corrections[lower]) {
    return corrections[lower];
  }

  // Try prefix match (e.g., "fr-FR" -> "fr", "pt-BR" -> "pt-br")
  const prefix = lower.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(prefix as TcgdexLanguage)) {
    return prefix as TcgdexLanguage;
  }

  // Full locale match (e.g., "pt-BR" lowercased -> "pt-br")
  if (SUPPORTED_LANGUAGES.includes(lower as TcgdexLanguage)) {
    return lower as TcgdexLanguage;
  }

  // Country code mapping
  if (COUNTRY_TO_LANGUAGE[lang.toUpperCase()]) {
    return COUNTRY_TO_LANGUAGE[lang.toUpperCase()] as TcgdexLanguage;
  }

  console.warn(`Language "${lang}" not supported by TCGDex, falling back to "en"`);
  return 'en';
}

/**
 * Detects the best TCGDex language from a browser Accept-Language header.
 */
export function detectLanguageFromHeader(acceptLanguage: string): TcgdexLanguage {
  if (!acceptLanguage) return 'en';

  const languages = acceptLanguage
    .split(',')
    .map((part) => {
      const [lang, q] = part.trim().split(';q=');
      return { lang: lang.trim(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of languages) {
    const validated = validateLanguage(lang);
    if (validated !== 'en' || lang.toLowerCase().startsWith('en')) {
      return validated;
    }
  }
  return 'en';
}

// ============================================================
// SDK Lazy Loader
// ============================================================

/**
 * Lazily loads the @tcgdex/sdk package. Returns null if the SDK is not
 * available in the current runtime, so callers can fall back to fetchTcgdex.
 *
 * Usage:
 *   const sdk = await getTcgdexSDK('fr');
 *   if (sdk) {
 *     const card = await sdk.card.get('swsh3-136');
 *   }
 */
let _TCGdexCtor: any = null;
export async function getTcgdexSDK(lang: string = 'en'): Promise<any> {
  if (_TCGdexCtor === false) return null;
  if (_TCGdexCtor === null) {
    try {
      const mod = await import('npm:@tcgdex/sdk@2.9.0');
      _TCGdexCtor = mod.default || mod.TCGdex || mod;
    } catch (e) {
      _TCGdexCtor = false;
      console.warn('[tcgdex] SDK unavailable, using fetch fallback:', (e as Error)?.message || e);
      return null;
    }
  }
  try {
    const instance = new _TCGdexCtor(validateLanguage(lang));
    return instance;
  } catch {
    return null;
  }
}

// ============================================================
// Card Endpoints
// ============================================================

/** Fetches a single card by its TCGDex ID (e.g., 'swsh3-136'). */
export async function getCard(cardId: string, lang: string = 'en'): Promise<TcgdexCard> {
  return withRetry(() => fetchTcgdex(`/cards/${cardId}`, lang));
}

/** Fetches all cards with optional filtering, sorting, and pagination. */
export async function listCards(
  lang: string = 'en',
  filters: Record<string, string> = {},
  sortField: string = 'releaseDate',
  sortOrder: 'ASC' | 'DESC' = 'DESC',
  page?: number,
  itemsPerPage?: number,
): Promise<TcgdexCardBrief[]> {
  const params: string[] = [];
  for (const [key, value] of Object.entries(filters)) {
    params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  params.push(`sort:field=${encodeURIComponent(sortField)}`);
  params.push(`sort:order=${sortOrder}`);
  if (page) {
    params.push(`pagination:page=${page}`);
    params.push(`pagination:itemsPerPage=${itemsPerPage || 100}`);
  }
  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  return withRetry(() => fetchTcgdex(`/cards${qs}`, lang));
}

/** Gets a random card from TCGDex (useful for "Card of the Day"). */
export async function getRandomCard(lang: string = 'en'): Promise<TcgdexCard> {
  return withRetry(() => fetchTcgdex('/cards/random', lang));
}

// ============================================================
// Set Endpoints
// ============================================================

/** Fetches a single set by its ID, including all cards in the set. */
export async function getSet(setId: string, lang: string = 'en'): Promise<TcgdexSet> {
  const normalized = normalizeSetId(setId);
  return withRetry(() => fetchTcgdex(`/sets/${normalized}`, lang));
}

/** Fetches all sets (brief list). */
export async function listSets(lang: string = 'en'): Promise<TcgdexSetBrief[]> {
  return withRetry(() => fetchTcgdex('/sets', lang));
}

/** Gets a random set from TCGDex. */
export async function getRandomSet(lang: string = 'en'): Promise<TcgdexSet> {
  return withRetry(() => fetchTcgdex('/sets/random', lang));
}

// ============================================================
// Serie Endpoints
// ============================================================

/** Fetches a single serie by its ID, including all sets in the serie. */
export async function getSerie(serieId: string, lang: string = 'en'): Promise<TcgdexSerie> {
  return withRetry(() => fetchTcgdex(`/series/${serieId}`, lang));
}

/** Fetches all series (brief list). */
export async function listSeries(lang: string = 'en'): Promise<TcgdexSerieBrief[]> {
  return withRetry(() => fetchTcgdex('/series', lang));
}

/** Gets a random serie from TCGDex. */
export async function getRandomSerie(lang: string = 'en'): Promise<TcgdexSerie> {
  return withRetry(() => fetchTcgdex('/series/random', lang));
}

// ============================================================
// Enumeration Endpoints
// ============================================================

/** Fetches enumeration data from TCGDex (rarities, types, etc.). */
export async function getEnum(endpoint: EnumEndpoint, lang: string = 'en'): Promise<string[]> {
  return withRetry(() => fetchTcgdex(`/${endpoint}`, lang));
}

export const getRarities = (lang = 'en') => getEnum('rarities', lang);
export const getTypes = (lang = 'en') => getEnum('types', lang);
export const getCategories = (lang = 'en') => getEnum('categories', lang);
export const getIllustrators = (lang = 'en') => getEnum('illustrators', lang);
export const getStages = (lang = 'en') => getEnum('stages', lang);
export const getRetreats = (lang = 'en') => getEnum('retreats', lang);
export const getEnergyTypes = (lang = 'en') => getEnum('energy-types', lang);
export const getRegulationMarks = (lang = 'en') => getEnum('regulation-marks', lang);
export const getSuffixes = (lang = 'en') => getEnum('suffixes', lang);
export const getTrainerTypes = (lang = 'en') => getEnum('trainer-types', lang);
export const getVariants = (lang = 'en') => getEnum('variants', lang);
export const getDexIds = (lang = 'en') => getEnum('dex-ids', lang);
export const getHPs = (lang = 'en') => getEnum('hp', lang);

// ============================================================
// Asset URL Helpers
// ============================================================

/**
 * Constructs a card image URL with quality and format specification.
 * Card image URLs from TCGDex come without an extension:
 *   https://assets.tcgdex.net/en/swsh/swsh3/136
 * This appends quality and format:
 *   https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp
 *
 * Documentation: https://tcgdex.dev/assets
 */
export function getCardImageUrl(
  baseUrl: string,
  quality: ImageQuality = 'high',
  format: ImageFormat = 'webp',
): string {
  if (!baseUrl) return '';
  if (/\.(png|webp|jpg|jpeg)$/i.test(baseUrl)) return baseUrl;
  return `${baseUrl}/${quality}.${format}`;
}

/** Constructs a set symbol or logo URL with format specification. */
export function getSetAssetUrl(baseUrl: string, format: ImageFormat = 'webp'): string {
  if (!baseUrl) return '';
  if (/\.(png|webp|jpg|jpeg)$/i.test(baseUrl)) return baseUrl;
  return `${baseUrl}.${format}`;
}

/** Generates srcset values for responsive card images. */
export function getCardImageSrcSet(baseUrl: string, format: ImageFormat = 'webp'): string {
  if (!baseUrl) return '';
  const lowUrl = getCardImageUrl(baseUrl, 'low', format);
  const highUrl = getCardImageUrl(baseUrl, 'high', format);
  return `${lowUrl} 245w, ${highUrl} 600w`;
}

// ============================================================
// TCG Pocket Integration
// ============================================================

/** Fetches the TCG Pocket series (all TCG Pocket sets). */
export async function getTCGPocketSeries(lang: string = 'en'): Promise<TcgdexSerie> {
  return getSerie('tcgp', lang);
}

/** Fetches all cards from a specific TCG Pocket set. */
export async function getTCGPocketSet(setId: string, lang: string = 'en'): Promise<TcgdexSet> {
  return getSet(setId, lang);
}

/** Fetches all TCG Pocket sets (brief list). */
export async function listTCGPocketSets(lang: string = 'en'): Promise<TcgdexSetBrief[]> {
  const series = await getTCGPocketSeries(lang);
  return series.sets || [];
}

// ============================================================
// Multi-Language Helpers
// ============================================================

/**
 * Fetches a single card in all 17 supported languages.
 * Returns a map of TCGDex API language code to localised card data.
 * WARNING: This makes up to 17 API calls. Use sparingly!
 */
export async function getCardInAllLanguages(
  cardId: string,
): Promise<Record<string, LocalizedCardData>> {
  const results: Record<string, LocalizedCardData> = {};

  // English first (guaranteed to exist)
  try {
    const cardEn = await getCard(cardId, 'en');
    results['en'] = {
      name: cardEn.name,
      description: cardEn.description,
      image: cardEn.image,
    };
  } catch (e) {
    console.error(`Failed to fetch card ${cardId} in English:`, e);
    return results;
  }

  // Remaining languages in parallel batches of 5
  const otherLanguages = SUPPORTED_LANGUAGES.filter((l) => l !== 'en');
  const batchSize = 5;

  for (let i = 0; i < otherLanguages.length; i += batchSize) {
    const batch = otherLanguages.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (lang) => {
        const card = await getCard(cardId, lang);
        return { lang, data: { name: card.name, description: card.description, image: card.image } as LocalizedCardData };
      }),
    );
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results[result.value.lang] = result.value.data;
      }
    }
  }
  return results;
}

/** Fetches a set's data in all 17 supported languages. */
export async function getSetInAllLanguages(setId: string): Promise<Record<string, TcgdexSet>> {
  const results: Record<string, TcgdexSet> = {};

  try {
    results['en'] = await getSet(setId, 'en');
  } catch (e) {
    console.error(`Failed to fetch set ${setId} in English:`, e);
    return results;
  }

  const otherLanguages = SUPPORTED_LANGUAGES.filter((l) => l !== 'en');
  const batchSize = 5;

  for (let i = 0; i < otherLanguages.length; i += batchSize) {
    const batch = otherLanguages.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (lang) => {
        const set = await getSet(setId, lang);
        return { lang, set };
      }),
    );
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results[result.value.lang] = result.value.set;
      }
    }
  }
  return results;
}

/** Extracts localised set data (name, logo, symbol) from a full set object. */
export function extractLocalizedSetData(set: TcgdexSet): LocalizedSetData {
  return {
    name: set.name,
    logo: set.logo,
    symbol: set.symbol,
  };
}

// ============================================================
// Health Check
// ============================================================

/** Performs a health check against the TCGDex API. */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  details: string;
}> {
  const startTime = Date.now();
  try {
    const card = await getCard('swsh3-136', 'en');
    const latencyMs = Date.now() - startTime;

    if (!card || !card.name) {
      return { status: 'degraded', latencyMs, details: 'API responded but card data was empty' };
    }
    return {
      status: latencyMs > 3000 ? 'degraded' : 'healthy',
      latencyMs,
      details: `OK: fetched "${card.name}" (${card.id})`,
    };
  } catch (e) {
    return {
      status: 'down',
      latencyMs: Date.now() - startTime,
      details: `Error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/** Returns the current sliding window rate limiter state. */
export function getRateLimiterStatus(): {
  currentRequests: number;
  maxRequests: number;
  windowMs: number;
} {
  return {
    currentRequests: slidingLimiter.getCurrentCount(),
    maxRequests: TCGDEX_RATE_LIMIT,
    windowMs: TCGDEX_RATE_WINDOW_MS,
  };
}