/**
 * SwapPulse Analytics Helper
 *
 * Wraps the Base44 built-in analytics tracker (base44.analytics.track)
 * with consistent event names and property shapes across the app.
 *
 * Usage:
 *   import { trackEvent, EVENTS } from '@/lib/analytics';
 *   trackEvent(EVENTS.CARD_CLICKED, { cardId: 'sv4-001' });
 *
 * Base44 analytics.track signature:
 *   base44.analytics.track({ eventName: string, properties?: Record<string, string|number|boolean|null> })
 */

import { base44 } from '@/api/base44Client';

// Pre-defined event names for consistency (snake_case per platform convention)
export const EVENTS = {
  PAGE_VIEWED: 'page_viewed',
  CARD_CLICKED: 'card_clicked',
  TRADE_LISTED: 'trade_listed',
  PACK_OPENED: 'pack_opened',
  SEARCH_PERFORMED: 'search_performed',
  BRIDGE_INITIATED: 'bridge_initiated',
  LOGIN_SUCCEEDED: 'login_succeeded',
  SIGNUP_COMPLETED: 'signup_completed',
  COLLECTION_UPDATED: 'collection_updated',
  PROFILE_VIEWED: 'profile_viewed',
  CHALLENGE_COMPLETED: 'challenge_completed',
  WALLET_TOPUP: 'wallet_topup',
  ESCROW_CREATED: 'escrow_created',
  ESCROW_RELEASED: 'escrow_released',
  NFT_MINTED: 'nft_minted',
  CROSS_CHAIN_TRANSFER: 'cross_chain_transfer',
} as const;

/**
 * Track an analytics event. Silently catches errors so analytics
 * never breaks the user-facing app flow.
 */
export function trackEvent(eventName: string, properties: Record<string, string | number | boolean | null> = {}): void {
  try {
    base44.analytics.track({ eventName, properties });
  } catch {
    // Analytics should never break the app — swallow errors
  }
}

/**
 * Track a page view. Call from page components on mount.
 */
export function trackPageView(pageName: string, extra?: Record<string, string | number | boolean>): void {
  trackEvent(EVENTS.PAGE_VIEWED, { page: pageName, ...extra });
}

/**
 * Track a card click with card context.
 */
export function trackCardClick(cardId: string, source?: string): void {
  trackEvent(EVENTS.CARD_CLICKED, { cardId, source });
}

/**
 * Track a trade listing creation.
 */
export function trackTradeListed(cardId: string, setId: string, priceCents?: number): void {
  trackEvent(EVENTS.TRADE_LISTED, { cardId, setId, priceCents });
}

/**
 * Track a pack opening.
 */
export function trackPackOpened(setId: string, pullCount: number, rarePulls: number): void {
  trackEvent(EVENTS.PACK_OPENED, { setId, pullCount, rarePulls });
}

/**
 * Track a search query.
 */
export function trackSearch(query: string, resultsCount: number): void {
  // Truncate query for privacy
  trackEvent(EVENTS.SEARCH_PERFORMED, {
    query: query.slice(0, 50),
    resultsCount,
  });
}

/**
 * Track a bridge initiation.
 */
export function trackBridgeInitiated(assetType: string, sourceChain: string, targetChain: string): void {
  trackEvent(EVENTS.BRIDGE_INITIATED, { assetType, sourceChain, targetChain });
}

/**
 * Track a wallet top-up.
 */
export function trackWalletTopup(amountCents: number, currency: string): void {
  trackEvent(EVENTS.WALLET_TOPUP, { amountCents, currency });
}

/**
 * Track an NFT mint.
 */
export function trackNftMinted(assetType: string, chain: string, dualChain: boolean): void {
  trackEvent(EVENTS.NFT_MINTED, { assetType, chain, dualChain });
}