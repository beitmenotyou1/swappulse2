// get-cards — paginated card browsing with filters.
//
// Uses the TCGDex API as the primary data source (supports proper
// pagination, sorting, and all filter fields). The TcgdexCard cache
// is queried for availableLanguages enrichment when a card is found.
//
// Public catalogue data — no auth required.
//
// Parameters (query string or JSON body):
// - lang:         Language code (default: en)
// - setId:        Filter by TCGDex set ID (e.g., swsh3)
// - rarity:       Filter by rarity
// - category:     Filter by category (Pokemon, Trainer, Energy)
// - type:         Filter by Pokemon type (Fire, Water, etc.)
// - illustrator:  Filter by illustrator name
// - page:         Page number (default: 1)
// - itemsPerPage:  Items per page (default: 50, max: 100)
// - sortBy:       Sort field (default: releaseDate)
// - sortOrder:    ASC or DESC (default: DESC)
import { listCards, getCardImageUrl } from '../../shared/tcgdexClient.ts';
import { createLogger } from '../../shared/logger.ts';
import {
  negotiateLanguage,
  parseIntParam,
  successResponse,
  errorResponse,
  getParams,
} from '../../shared/apiHelpers.ts';
import type { CardListItem, ResponseMeta } from '../../shared/apiTypes.ts';

const logger = createLogger('api:get-cards');

const DEFAULT_ITEMS_PER_PAGE = 50;
const MAX_ITEMS_PER_PAGE = 100;

export default async function (req: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    const params = await getParams(req);
    const lang = negotiateLanguage(params.lang);
    const page = parseIntParam(params.page, 1, 10000);
    const itemsPerPage = parseIntParam(params.itemsPerPage, DEFAULT_ITEMS_PER_PAGE, MAX_ITEMS_PER_PAGE);
    const sortBy = params.sortBy || 'releaseDate';
    const sortOrder = (params.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC';

    // Build TCGDex API filters
    const filters: Record<string, string> = {};
    if (params.setId) filters['set.id'] = params.setId;
    if (params.serieId) filters['set.serie.id'] = params.serieId;
    if (params.rarity) filters['rarity'] = params.rarity;
    if (params.category) filters['category'] = params.category;
    if (params.type) filters['type'] = params.type;
    if (params.illustrator) filters['illustrator'] = params.illustrator;

    // Fetch from TCGDex API
    const cards = await listCards(lang, filters, sortBy, sortOrder, page, itemsPerPage);

    // Transform to list items
    const items: CardListItem[] = (cards || []).map((card: any) => ({
      id: card.id || card.cardId,
      localId: card.localId || card.local_id || '',
      name: card.name || '',
      image: card.image ? getCardImageUrl(card.image) : null,
      category: card.category || null,
      rarity: card.rarity || null,
      setId: card.set?.id || card.set_id || null,
      setName: card.set?.name || card.set_name || null,
      variants: card.variants || null,
      hasPricing: !!card.pricing,
    }));

    // Estimate total pages (TCGDex API doesn't return total count)
    const total = items.length;
    const totalPages = items.length < itemsPerPage ? page : page + 1;

    const meta: ResponseMeta = {
      page,
      itemsPerPage,
      total,
      totalPages,
      language: lang,
      fromCache: false,
      generatedAt: new Date().toISOString(),
    };

    const durationMs = Date.now() - startTime;
    logger.debug('get-cards response', { lang, page, returned: items.length, durationMs });

    return Response.json(successResponse(items, meta), {
      headers: {
        'Cache-Control': 'public, max-age=900',
        'X-Response-Time': `${durationMs}ms`,
      },
    });
  } catch (error: any) {
    logger.error('get-cards failed', error);
    return Response.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch cards'),
      { status: 500 },
    );
  }
}