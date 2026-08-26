// get-card-detail — full card data for a single card.
//
// Fetches the complete card object from the TCGDex API (which includes
// all game stats: HP, types, attacks, weaknesses, retreat, etc.) and
// enriches it with availableLanguages from the TcgdexCard cache.
//
// If the requested language is missing from the cache, triggers an
// on-demand localization sync (fire-and-forget) via sync-localizations.
//
// Public catalogue data — no auth required.
//
// Parameters (query string or JSON body):
// - cardId:  TCGDex card ID (required, e.g., swsh3-136)
// - lang:    Language code (default: en)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCard, getCardImageUrl } from '../../shared/tcgdexClient.ts';
import { createLogger } from '../../shared/logger.ts';
import {
  negotiateLanguage,
  successResponse,
  errorResponse,
  getParams,
} from '../../shared/apiHelpers.ts';
import type { CardDetail, SingleResponseMeta } from '../../shared/apiTypes.ts';

const logger = createLogger('api:get-card-detail');

export default async function (req: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const params = await getParams(req);
    const cardId = params.cardId;
    const lang = negotiateLanguage(params.lang);

    if (!cardId) {
      return Response.json(
        errorResponse('MISSING_PARAM', 'cardId parameter is required'),
        { status: 400 },
      );
    }

    // Fetch full card from TCGDex API (in the requested language)
    const apiCard = await getCard(cardId, lang).catch(() => null);

    if (!apiCard) {
      return Response.json(
        errorResponse('NOT_FOUND', `Card not found: ${cardId}`),
        { status: 404 },
      );
    }

    // Check the TcgdexCard cache for available languages
    let availableLanguages: string[] = [lang];
    let languageFallback = false;

    try {
      const cached = await svc.entities.TcgdexCard.filter({ card_id: cardId }, '-created_date', 1);
      if (cached && cached.length > 0) {
        const cachedCard = cached[0];
        availableLanguages = cachedCard.names ? Object.keys(cachedCard.names) : [lang];

        // Check if the requested language is in the cache
        const hasLang = availableLanguages.includes(lang);
        if (!hasLang && lang !== 'en') {
          languageFallback = true;
          // Fire-and-forget on-demand localization
          base44.functions
            .invoke('sync-localizations', { cardId })
            .catch((e: any) => logger.warn('On-demand localization failed', { cardId, lang, error: e?.message }));
        }
      }
    } catch (e: any) {
      logger.warn('Cache lookup failed', { cardId, error: e?.message });
    }

    // Build the full card detail from the API response
    const detail: CardDetail = {
      id: apiCard.id || cardId,
      localId: apiCard.localId || '',
      name: apiCard.name || '',
      description: apiCard.description || null,
      image: apiCard.image ? getCardImageUrl(apiCard.image) : null,
      category: apiCard.category || '',
      illustrator: apiCard.illustrator || null,
      rarity: apiCard.rarity || null,
      setId: apiCard.set?.id || null,
      setName: apiCard.set?.name || null,
      serieId: apiCard.set?.serie?.id || null,
      serieName: apiCard.set?.serie?.name || null,
      variants: apiCard.variants || null,
      hp: apiCard.hp ?? null,
      types: apiCard.types || [],
      stage: apiCard.stage || null,
      evolveFrom: apiCard.evolveFrom || null,
      attacks: apiCard.attacks || [],
      weaknesses: apiCard.weaknesses || [],
      retreat: apiCard.retreat ?? null,
      regulationMark: apiCard.regulationMark || null,
      legal: apiCard.legal || { standard: false, expanded: false },
      pricing: {
        cardmarket: apiCard.pricing?.cardmarket || null,
        tcgplayer: apiCard.pricing?.tcgplayer || null,
        updatedAt: null,
      },
      availableLanguages,
      requestedLanguage: lang,
      languageFallback,
    };

    const meta: SingleResponseMeta = {
      language: lang,
      fromCache: false,
      generatedAt: new Date().toISOString(),
    };

    const durationMs = Date.now() - startTime;
    logger.debug('get-card-detail response', {
      cardId,
      lang,
      fallback: languageFallback,
      durationMs,
    });

    return Response.json(successResponse(detail, meta), {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'X-Response-Time': `${durationMs}ms`,
      },
    });
  } catch (error: any) {
    logger.error('get-card-detail failed', error);
    return Response.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch card details'),
      { status: 500 },
    );
  }
}