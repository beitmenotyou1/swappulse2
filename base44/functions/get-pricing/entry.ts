// get-pricing — current pricing data for a specific card.
//
// Queries the CardPricing entity for stored pricing snapshots from
// both Cardmarket (EUR) and TCGplayer (USD). Falls back to the TCGDex
// API if no pricing records exist in the database.
//
// Public catalogue data — no auth required.
//
// Parameters (query string or JSON body):
// - cardId:  TCGDex card ID (required, e.g., swsh3-136)
// - source:  Filter by source (cardmarket, tcgplayer). If omitted, returns both.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCard } from '../../shared/tcgdexClient.ts';
import { createLogger } from '../../shared/logger.ts';
import {
  successResponse,
  errorResponse,
  getParams,
} from '../../shared/apiHelpers.ts';
import type { PricingResponse, SingleResponseMeta } from '../../shared/apiTypes.ts';

const logger = createLogger('api:get-pricing');

export default async function (req: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const params = await getParams(req);
    const cardId = params.cardId;
    const sourceFilter = params.source; // 'cardmarket' | 'tcgplayer' | undefined

    if (!cardId) {
      return Response.json(
        errorResponse('MISSING_PARAM', 'cardId parameter is required'),
        { status: 400 },
      );
    }

    // Query CardPricing entity for stored pricing
    const pricingRecords = await svc.entities.CardPricing.filter(
      { card_id: cardId },
      '-created_date',
      10,
    ).catch(() => []);

    // Organize by source
    let cardmarketPricing: Record<string, any> | null = null;
    let tcgplayerPricing: Record<string, any> | null = null;
    let cardName = cardId;

    for (const record of pricingRecords || []) {
      if (record.card_name) cardName = record.card_name;
      const pricingData: Record<string, any> = {
        unit: record.unit,
        avg: record.avg,
        low: record.low,
        trend: record.trend,
        avg1: record.avg1,
        avg7: record.avg7,
        avg30: record.avg30,
      };
      // Add variant-specific pricing
      if (record.normal_market != null) {
        pricingData.normal = {
          market: record.normal_market,
          low: record.normal_low,
          avg: record.normal_avg,
        };
      }
      if (record.holofoil_market != null) {
        pricingData.holofoil = {
          market: record.holofoil_market,
          low: record.holofoil_low,
          avg: record.holofoil_avg,
        };
      }
      if (record.source === 'cardmarket') cardmarketPricing = pricingData;
      if (record.source === 'tcgplayer') tcgplayerPricing = pricingData;
    }

    // If no pricing records found, fall back to TCGDex API
    if (!cardmarketPricing && !tcgplayerPricing) {
      try {
        const apiCard = await getCard(cardId, 'en');
        if (apiCard) {
          cardName = apiCard.name || cardId;
          if (apiCard.pricing?.cardmarket) cardmarketPricing = apiCard.pricing.cardmarket;
          if (apiCard.pricing?.tcgplayer) tcgplayerPricing = apiCard.pricing.tcgplayer;
        }
      } catch (e: any) {
        logger.warn('TCGDex API pricing fallback failed', { cardId, error: e?.message });
      }
    }

    // Apply source filter
    if (sourceFilter === 'cardmarket') tcgplayerPricing = null;
    if (sourceFilter === 'tcgplayer') cardmarketPricing = null;

    // Check if the card exists at all
    if (!cardmarketPricing && !tcgplayerPricing && pricingRecords?.length === 0) {
      // Verify the card exists via API
      const apiCard = await getCard(cardId, 'en').catch(() => null);
      if (!apiCard) {
        return Response.json(
          errorResponse('NOT_FOUND', `Card not found: ${cardId}`),
          { status: 404 },
        );
      }
      cardName = apiCard.name || cardId;
    }

    const result: PricingResponse = {
      cardId,
      cardName,
      current: {
        cardmarket: cardmarketPricing,
        tcgplayer: tcgplayerPricing,
        updatedAt: pricingRecords?.[0]?.updated_date || null,
      },
    };

    const meta: SingleResponseMeta = {
      language: 'en',
      fromCache: pricingRecords?.length > 0,
      generatedAt: new Date().toISOString(),
    };

    const durationMs = Date.now() - startTime;
    logger.debug('get-pricing response', {
      cardId,
      source: sourceFilter || 'both',
      hasCardmarket: !!cardmarketPricing,
      hasTcgplayer: !!tcgplayerPricing,
      durationMs,
    });

    return Response.json(successResponse(result, meta), {
      headers: {
        'Cache-Control': 'public, max-age=1800',
        'X-Response-Time': `${durationMs}ms`,
      },
    });
  } catch (error: any) {
    logger.error('get-pricing failed', error);
    return Response.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch pricing data'),
      { status: 500 },
    );
  }
}