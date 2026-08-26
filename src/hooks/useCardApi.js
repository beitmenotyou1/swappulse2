// useCardApi — TanStack Query hooks wrapping the Phase 4 API functions
// (get-cards, get-card-detail, get-sets, get-pricing, card-metadata-localized)
// and the existing search-cards function. These hooks provide cached,
// reactive access to the TCGDex catalogue data from any frontend component.

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// ============================================================
// Card Browsing (get-cards)
// ============================================================

/**
 * Paginated card list with filters. Returns a single page.
 */
export function useCards(params = {}) {
  return useQuery({
    queryKey: ['api-cards', params],
    queryFn: async () => {
      const res = await base44.functions.invoke('get-cards', params);
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/**
 * Infinite scroll card list. Fetches pages as the user scrolls.
 * Returns { data, fetchNextPage, hasNextPage, isFetchingNextPage, ... }.
 */
export function useInfiniteCards(params = {}) {
  return useInfiniteQuery({
    queryKey: ['api-cards-infinite', params],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await base44.functions.invoke('get-cards', {
        ...params,
        page: pageParam,
      });
      return res.data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.meta?.page < lastPage.meta?.totalPages) {
        return lastPage.meta.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// Card Detail (get-card-detail)
// ============================================================

/**
 * Full card data for a single card, including game stats and pricing.
 */
export function useCardDetail(cardId, lang = 'en') {
  return useQuery({
    queryKey: ['api-card-detail', cardId, lang],
    queryFn: async () => {
      const res = await base44.functions.invoke('get-card-detail', { cardId, lang });
      return res.data;
    },
    enabled: !!cardId,
    staleTime: 30 * 60 * 1000, // 30 min
  });
}

// ============================================================
// Sets (get-sets)
// ============================================================

/**
 * All card sets, optionally filtered by serie.
 */
export function useSets(lang = 'en', serieId = undefined) {
  return useQuery({
    queryKey: ['api-sets', lang, serieId],
    queryFn: async () => {
      const res = await base44.functions.invoke('get-sets', { lang, serieId });
      return res.data;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

// ============================================================
// Pricing (get-pricing)
// ============================================================

/**
 * Current pricing data for a card from Cardmarket and TCGplayer.
 */
export function usePricing(cardId, source = undefined) {
  return useQuery({
    queryKey: ['api-pricing', cardId, source],
    queryFn: async () => {
      const res = await base44.functions.invoke('get-pricing', { cardId, source });
      return res.data;
    },
    enabled: !!cardId,
    staleTime: 15 * 60 * 1000, // 15 min
  });
}

// ============================================================
// Search (search-cards — existing function)
// ============================================================

/**
 * Multi-identifier card search. Uses the existing search-cards function
 * which searches the TcgdexCard cache and falls back to the TCGDex API.
 */
export function useCardSearch(query, lang = 'en', perPage = 20, enabled = true) {
  return useQuery({
    queryKey: ['api-card-search', query, lang, perPage],
    queryFn: async () => {
      const res = await base44.functions.invoke('search-cards', { query, lang, perPage });
      return res.data;
    },
    enabled: enabled && query.trim().length >= 2,
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

// ============================================================
// NFT Metadata (card-metadata-localized)
// ============================================================

/**
 * ERC-721 NFT metadata for a card. Used by NFT display components.
 */
export function useNftMetadata(cardId, lang = 'en', variant = 'normal') {
  return useQuery({
    queryKey: ['api-nft-metadata', cardId, lang, variant],
    queryFn: async () => {
      const res = await base44.functions.invoke('card-metadata-localized', { cardId, lang, variant });
      return res.data;
    },
    enabled: !!cardId,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}