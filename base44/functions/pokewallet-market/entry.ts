// pokewallet-market — optional market enrichment for one canonical TCGDex card.
//
// Security / quota boundary:
// - Public callers provide only the TCGDex card ID.
// - The backend fetches canonical TCGDex metadata before resolving PokéWallet.
// - POKEWALLET_API_KEY is read only server-side by pokewalletClient.ts.
// - No arbitrary PokéWallet proxying is exposed to the browser.
// - Free-tier quota/cache/fallback policy is enforced centrally in the shared client.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCard } from '../../shared/tcgdexClient.ts';
import {
  PokeWalletError,
  PokeWalletFreeTier,
  isPokeWalletConfigured,
  resolvePokeWalletMarket,
} from '../../shared/pokewalletClient.ts';
import { decorateTcgplayerAffiliateUrl, TCGPLAYER_AFFILIATE_DISCLOSURE } from '../../shared/tcgplayerAffiliate.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const cardId = String(body?.cardId || '').trim();

    if (!cardId || cardId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(cardId)) {
      return Response.json({
        available: false,
        matched: false,
        reason: 'invalid_card_id',
      }, { status: 400 });
    }

    if (!isPokeWalletConfigured()) {
      return Response.json({
        available: false,
        matched: false,
        temporary: true,
        reason: 'not_configured',
        canonicalCardId: cardId,
        canonicalSource: 'TCGDex',
        marketSource: 'PokéWallet',
      }, {
        headers: { 'Cache-Control': 'private, max-age=300' },
      });
    }

    // Prefer SwapPulse's existing persistent TCGDex catalogue cache. This avoids
    // spending another TCGDex request for normal card-detail views. Fall back to
    // the live canonical API only when that cache has not yet seen the card.
    const cachedRows = await svc.entities.TcgdexCard
      .filter({ card_id: cardId }, '-updated_date', 1)
      .catch(() => []);
    const cachedCard = cachedRows?.[0];
    const tcgdexCard = cachedCard ? {
      id: cachedCard.card_id,
      name: cachedCard.name,
      localId: cachedCard.local_id,
      rarity: cachedCard.rarity,
      set: { id: cachedCard.set_id, name: cachedCard.set_name },
    } : await getCard(cardId, 'en').catch(() => null);
    if (!tcgdexCard) {
      return Response.json({
        available: false,
        matched: false,
        reason: 'tcgdex_card_not_found',
      }, { status: 404 });
    }

    try {
      const result = await resolvePokeWalletMarket(svc, tcgdexCard);
      const tcgLink = await decorateTcgplayerAffiliateUrl(svc, result?.market?.tcgplayer?.url);
      const decorated = result?.market?.tcgplayer ? {
        ...result,
        market: {
          ...result.market,
          tcgplayer: {
            ...result.market.tcgplayer,
            url: tcgLink.url,
            affiliate: tcgLink.affiliate,
          },
        },
      } : result;
      return Response.json({
        ...decorated,
        canonicalCardId: tcgdexCard.id || cardId,
        canonicalSource: 'TCGDex',
        marketSource: 'PokéWallet',
        underlyingMarkets: ['TCGPlayer', 'CardMarket'],
        tcgplayerAffiliate: tcgLink.affiliate ? { active: true, disclosure: TCGPLAYER_AFFILIATE_DISCLOSURE } : { active: false },
        freeTierPolicy: {
          upstreamHourlyLimit: PokeWalletFreeTier.providerHourlyLimit,
          upstreamDailyLimit: PokeWalletFreeTier.providerDailyLimit,
          swapPulseHourlySoftLimit: PokeWalletFreeTier.softHourlyLimit,
          swapPulseDailySoftLimit: PokeWalletFreeTier.softDailyLimit,
        },
      }, {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
        },
      });
    } catch (error) {
      if (error instanceof PokeWalletError) {
        // Market enrichment must never make the canonical card page unavailable.
        // Return an explicit soft failure that the UI can hide/fallback from.
        return Response.json({
          available: false,
          matched: false,
          temporary: error.recoverable,
          reason: error.code.toLowerCase(),
          canonicalCardId: tcgdexCard.id || cardId,
          canonicalSource: 'TCGDex',
          marketSource: 'PokéWallet',
        }, {
          status: 200,
          headers: { 'Cache-Control': 'private, max-age=60' },
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('pokewallet-market failed:', error instanceof Error ? error.message : String(error));
    return Response.json({
      available: false,
      matched: false,
      temporary: true,
      reason: 'internal_error',
    }, { status: 200 });
  }
}
