// get-sets — browse all card sets with localised names.
//
// Fetches the set list from the TCGDex API. Each set includes
// localised name, logo, symbol, release date, and card counts.
//
// Public catalogue data — no auth required.
//
// Parameters (query string or JSON body):
// - lang:     Language code (default: en)
// - serieId:  Filter by TCGDex serie ID (optional, e.g., swsh)
import { listSets, getSet, getSetAssetUrl } from '../../shared/tcgdexClient.ts';
import { createLogger } from '../../shared/logger.ts';
import {
  negotiateLanguage,
  successResponse,
  errorResponse,
  getParams,
} from '../../shared/apiHelpers.ts';
import type { SetListItem, SingleResponseMeta } from '../../shared/apiTypes.ts';

const logger = createLogger('api:get-sets');

export default async function (req: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    const params = await getParams(req);
    const lang = negotiateLanguage(params.lang);
    const serieId = params.serieId || undefined;

    // Fetch all sets from TCGDex API
    const sets = await listSets(lang);

    // Filter by serie if requested
    const filtered = serieId
      ? (sets || []).filter((s: any) => s.serie?.id === serieId || s.id?.startsWith(serieId))
      : (sets || []);

    // Transform to list items
    const items: SetListItem[] = filtered.map((set: any) => ({
      id: set.id || '',
      name: set.name || '',
      logo: set.logo ? getSetAssetUrl(set.logo) : null,
      symbol: set.symbol ? getSetAssetUrl(set.symbol) : null,
      releaseDate: set.releaseDate || null,
      serieId: set.serie?.id || null,
      serieName: set.serie?.name || null,
      cardCount: set.cardCount || null,
      legal: set.legal || { standard: false, expanded: false },
      tcgOnlineCode: set.tcgOnlineCode || null,
    }));

    const meta: SingleResponseMeta = {
      language: lang,
      fromCache: false,
      generatedAt: new Date().toISOString(),
    };

    const durationMs = Date.now() - startTime;
    logger.debug('get-sets response', {
      lang,
      serieId: serieId || 'all',
      count: items.length,
      durationMs,
    });

    return Response.json(successResponse(items, meta), {
      headers: {
        'Cache-Control': 'public, max-age=86400',
        'X-Response-Time': `${durationMs}ms`,
      },
    });
  } catch (error: any) {
    logger.error('get-sets failed', error);
    return Response.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch sets'),
      { status: 500 },
    );
  }
}