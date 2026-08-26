/**
 * TCGDex Constants and Type Definitions
 *
 * All supported languages, type definitions, and configuration constants
 * for the TCGDex v2 API integration.
 *
 * Documentation References:
 * - Language Support: https://tcgdex.dev/errors/language-invalid
 * - Card Reference: https://tcgdex.dev/reference/card
 * - Set Reference: https://tcgdex.dev/reference/set
 * - Serie Reference: https://tcgdex.dev/reference/serie
 * - Markets & Prices: https://tcgdex.dev/markets-prices
 * - Assets: https://tcgdex.dev/assets
 * - TypeScript SDK: https://tcgdex.dev/sdks/typescript
 * - REST API: https://tcgdex.dev/rest
 */

// ============================================================
// API Configuration
// ============================================================

export const TCGDEX_BASE_URL = 'https://api.tcgdex.net/v2';
export const TCGDEX_RATE_LIMIT = 10; // requests per second
export const TCGDEX_RATE_WINDOW_MS = 1000; // 1 second window
export const TCGDEX_CACHE_TTL_SECONDS = 86400; // 24 hours
export const TCGDEX_PRICING_CACHE_TTL_SECONDS = 1800; // 30 minutes

// ============================================================
// Supported Languages (17 total)
//
// Source: https://tcgdex.dev/errors/language-invalid
// The TCGDex API follows the official languages set out by Pokemon.
// Fanmade translations are not included.
//
// NOTE: TCGDex uses 'ja' for Japanese and 'zh-tw' for Traditional Chinese.
// Our internal labels (and entity field names like name_norm_jp) use 'jp'
// and 'zh'. The mapping happens at the API boundary in tcgdexClient.ts.
// ============================================================

export const SUPPORTED_LANGUAGES = [
  'en',    // English
  'fr',    // French
  'es',    // Spanish
  'it',    // Italian
  'pt',    // Portuguese (generic)
  'pt-br', // Portuguese (Brazil)
  'pt-pt', // Portuguese (Portugal)
  'de',    // German
  'nl',    // Dutch
  'pl',    // Polish
  'ru',    // Russian
  'ja',    // Japanese
  'ko',    // Korean
  'zh-tw', // Chinese Traditional (Taiwan)
  'zh-cn', // Chinese Simplified (China)
  'id',    // Indonesian
  'th',    // Thai
] as const;

export type TcgdexLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Internal language labels (used in entity field names like name_norm_jp).
 * Maps our short internal codes to TCGDex API codes.
 */
export const INTERNAL_TO_API_LANG: Record<string, string> = {
  jp: 'ja',
  zh: 'zh-tw',
};

export const API_TO_INTERNAL_LANG: Record<string, string> = {
  ja: 'jp',
  'zh-tw': 'zh',
};

/**
 * Human-readable labels for each language code.
 * Used in the frontend LanguageSwitcher dropdown.
 */
export const LANGUAGE_LABELS: Record<string, string> = {
  'en': 'English',
  'fr': 'Français',
  'es': 'Español',
  'it': 'Italiano',
  'pt': 'Português',
  'pt-br': 'Português (Brasil)',
  'pt-pt': 'Português (Portugal)',
  'de': 'Deutsch',
  'nl': 'Nederlands',
  'pl': 'Polski',
  'ru': 'Русский',
  'ja': '日本語',
  'ko': '한국어',
  'zh-tw': '繁體中文',
  'zh-cn': '简体中文',
  'id': 'Bahasa Indonesia',
  'th': 'ภาษาไทย',
};

/**
 * Maps ISO 3166 country codes to the most likely TCGDex language.
 * Used for initial language detection from browser locale.
 */
export const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  'US': 'en', 'GB': 'en', 'AU': 'en', 'CA': 'en', 'NZ': 'en', 'IE': 'en',
  'FR': 'fr', 'BE': 'fr', 'LU': 'fr',
  'ES': 'es', 'MX': 'es', 'AR': 'es', 'CL': 'es', 'CO': 'es', 'PE': 'es',
  'IT': 'it', 'VA': 'it',
  'BR': 'pt-br', 'PT': 'pt-pt',
  'DE': 'de', 'AT': 'de', 'CH': 'de',
  'NL': 'nl',
  'PL': 'pl',
  'RU': 'ru', 'BY': 'ru', 'KZ': 'ru',
  'JP': 'ja',
  'KR': 'ko',
  'TW': 'zh-tw', 'HK': 'zh-tw', 'CN': 'zh-cn', 'SG': 'zh-cn',
  'ID': 'id',
  'TH': 'th',
};

// ============================================================
// Type Definitions
// ============================================================

/** Card object: https://tcgdex.dev/reference/card */
export interface TcgdexCard {
  id: string;
  localId: string | number;
  name: string;
  image?: string;
  category: 'Pokemon' | 'Energy' | 'Trainer';
  illustrator?: string;
  rarity?: string;
  set: TcgdexSetBrief;
  variants: {
    firstEdition: boolean;
    holo: boolean;
    normal: boolean;
    reverse: boolean;
    wPromo: boolean;
  };
  hp?: number;
  types?: string[];
  evolveFrom?: string;
  description?: string;
  stage?: string;
  attacks?: Array<{
    cost?: string[];
    name: string;
    effect?: string;
    damage?: string | number;
  }>;
  weaknesses?: Array<{ type: string; value: string }>;
  retreat?: number;
  regulationMark?: string;
  legal?: { standard: boolean; expanded: boolean };
  updated?: string;
  pricing?: {
    cardmarket?: TcgdexCardmarketPricing;
    tcgplayer?: TcgdexTCGplayerPricing;
  };
}

/** Card brief (returned in list/set responses) */
export interface TcgdexCardBrief {
  id: string;
  localId: string | number;
  name: string;
  image?: string;
}

/** Set object: https://tcgdex.dev/reference/set */
export interface TcgdexSet {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount: {
    total: number;
    official: number;
    reverse?: number;
    holo?: number;
    normal?: number;
    firstEd?: number;
  };
  serie: TcgdexSerieBrief;
  tcgOnline?: string;
  releaseDate: string;
  legal: { standard: boolean; expanded: boolean };
  cards: TcgdexCardBrief[];
}

/** Set brief (returned in series/list responses) */
export interface TcgdexSetBrief {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount: { total: number; official: number };
}

/** Serie object: https://tcgdex.dev/reference/serie */
export interface TcgdexSerie {
  id: string;
  name: string;
  logo?: string;
  sets: TcgdexSetBrief[];
}

/** Serie brief (returned in list responses) */
export interface TcgdexSerieBrief {
  id: string;
  name: string;
}

/** Cardmarket pricing (EUR): https://tcgdex.dev/markets-prices */
export interface TcgdexCardmarketPricing {
  updated: string;
  unit: 'EUR';
  avg?: number;
  low?: number;
  trend?: number;
  avg1?: number;
  avg7?: number;
  avg30?: number;
  'avg-holo'?: number;
  'low-holo'?: number;
  'trend-holo'?: number;
  'avg1-holo'?: number;
  'avg7-holo'?: number;
  'avg30-holo'?: number;
}

/** TCGplayer pricing (USD): https://tcgdex.dev/markets-prices */
export interface TcgdexTCGplayerPricing {
  updated: string;
  unit: 'USD';
  normal?: {
    lowPrice?: number;
    midPrice?: number;
    highPrice?: number;
    marketPrice?: number;
    directLowPrice?: number;
  };
  reverse?: {
    lowPrice?: number;
    midPrice?: number;
    highPrice?: number;
    marketPrice?: number;
    directLowPrice?: number;
  };
}

/** Localised card data (stored in JSONB) */
export interface LocalizedCardData {
  name: string;
  description?: string;
  image?: string;
}

/** Localised set data (stored in JSONB) */
export interface LocalizedSetData {
  name: string;
  logo?: string;
  symbol?: string;
}

// ============================================================
// Filter prefixes for TCGDex queries.
// Documentation: https://tcgdex.dev/rest/filtering-sorting-pagination
// ============================================================

export const FILTER_PREFIXES = {
  LIKE: '',
  NOT: 'not:',
  NOT_LIKE: 'notlike:',
  EQ: 'eq:',
  NEQ: 'neq:',
  GTE: 'gte:',
  LTE: 'lte:',
  GT: 'gt:',
  LT: 'lt:',
  NULL: 'null:',
  NOT_NULL: 'notnull:',
} as const;

/**
 * Enumeration endpoints available in TCGDex.
 * Documentation: https://tcgdex.dev/rest/other-fields
 */
export const ENUM_ENDPOINTS = [
  'categories',
  'hp',
  'illustrators',
  'rarities',
  'retreats',
  'types',
  'dex-ids',
  'energy-types',
  'regulation-marks',
  'stages',
  'suffixes',
  'trainer-types',
  'variants',
] as const;

export type EnumEndpoint = (typeof ENUM_ENDPOINTS)[number];

/**
 * Image quality options.
 * Documentation: https://tcgdex.dev/assets
 *
 * high: 600x825 pixels
 * low: 245x337 pixels
 */
export const IMAGE_QUALITIES = ['high', 'low'] as const;
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];

/**
 * Image format options.
 * Documentation: https://tcgdex.dev/assets
 *
 * png: Transparent background (largest file size)
 * webp: Modern format, transparent background, recommended
 * jpg: Black background (not recommended)
 */
export const IMAGE_FORMATS = ['png', 'webp', 'jpg'] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];