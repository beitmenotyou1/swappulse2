/**
 * Shared API Types
 *
 * Common response types used across all SwapPulse API functions.
 * Adapted for Base44 — uses TCGDex API card shapes and the TcgdexCard
 * cache entity, not raw PostgreSQL row types.
 *
 * @author SwapPulse
 * @version 1.0.0
 */

// ============================================================
// Standard API Response Envelope
// ============================================================

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: ResponseMeta | SingleResponseMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface ResponseMeta {
  page: number;
  itemsPerPage: number;
  total: number;
  totalPages: number;
  language: string;
  fromCache: boolean;
  generatedAt: string;
}

export interface SingleResponseMeta {
  language: string;
  fromCache: boolean;
  generatedAt: string;
}

// ============================================================
// Card Response Types
// ============================================================

export interface CardListItem {
  id: string;
  localId: string;
  name: string;
  image: string | null;
  category: string | null;
  rarity: string | null;
  setId: string | null;
  setName: string | null;
  variants: Record<string, boolean> | null;
  hasPricing: boolean;
}

export interface CardDetail {
  id: string;
  localId: string;
  name: string;
  description: string | null;
  image: string | null;
  category: string;
  illustrator: string | null;
  rarity: string | null;
  setId: string | null;
  setName: string | null;
  serieId: string | null;
  serieName: string | null;
  variants: Record<string, boolean> | null;
  hp: number | null;
  types: string[];
  stage: string | null;
  evolveFrom: string | null;
  attacks: any[];
  weaknesses: any[];
  retreat: number | null;
  regulationMark: string | null;
  legal: { standard: boolean; expanded: boolean };
  pricing: {
    cardmarket: Record<string, any> | null;
    tcgplayer: Record<string, any> | null;
    updatedAt: string | null;
  };
  availableLanguages: string[];
  requestedLanguage: string;
  languageFallback: boolean;
}

// ============================================================
// Set Response Types
// ============================================================

export interface SetListItem {
  id: string;
  name: string;
  logo: string | null;
  symbol: string | null;
  releaseDate: string | null;
  serieId: string | null;
  serieName: string | null;
  cardCount: {
    total: number;
    official: number;
    reverse: number;
    holo: number;
    normal: number;
    firstEd: number;
  } | null;
  legal: { standard: boolean; expanded: boolean };
  tcgOnlineCode: string | null;
}

// ============================================================
// Pricing Response Types
// ============================================================

export interface PricingResponse {
  cardId: string;
  cardName: string;
  current: {
    cardmarket: Record<string, any> | null;
    tcgplayer: Record<string, any> | null;
    updatedAt: string | null;
  };
}

// ============================================================
// NFT Metadata Types (ERC-721 / ERC-1155 compatible)
// ============================================================

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: NFTAttribute[];
}

export interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

// ============================================================
// Query Parameters
// ============================================================

export interface CardQueryParams {
  lang?: string;
  setId?: string;
  serieId?: string;
  rarity?: string;
  category?: string;
  type?: string;
  illustrator?: string;
  page?: number;
  itemsPerPage?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface SearchQueryParams {
  lang?: string;
  q: string;
  page?: number;
  itemsPerPage?: number;
  setId?: string;
  rarity?: string;
  category?: string;
}

export interface PricingQueryParams {
  cardId: string;
  source?: string;
}

export interface MetadataQueryParams {
  cardId: string;
  lang?: string;
  variant?: string;
}