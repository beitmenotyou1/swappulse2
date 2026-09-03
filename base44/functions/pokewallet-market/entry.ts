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
  resolvePokeWalletMarket,
} from '../../shared/pokewalletClient.ts';

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

    const tcgdexCard = await getCard(cardId, 'en').catch(() => null);
    if (!tcgdexCard) {
      return Response.json({
        available: false,
        matched: false,
        reason: 'tcgdex_card_not_found',
      }, { status: 404 });
    }

    try {
      const result = await resolvePokeWalletMarket(svc, tcgdexCard);
      return Response.json({
        ...result,
        canonicalCardId: tcgdexCard.id || cardId,
        canonicalSource: 'TCGDex',
        marketSource: 'PokéWallet',
        underlyingMarkets: ['TCGPlayer', 'CardMarket'],
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
