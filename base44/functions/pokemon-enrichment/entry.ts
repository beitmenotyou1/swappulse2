// pokemon-enrichment — PokeAPI species/game enrichment for a TCGDex card.
//
// The bridge is the numeric TCGDex dexId field. We intentionally do not guess a
// species from card names, so Trainer/Energy cards and cards without dexId are
// safe no-op responses rather than incorrect matches.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCard } from '../../shared/tcgdexClient.ts';
import { getPokemonProfile } from '../../shared/pokeapiClient.ts';

const ALLOWED_LANGS = new Set([
  'en', 'fr', 'de', 'it', 'es', 'pt', 'pt-br', 'pt-pt', 'ja', 'jp',
  'ko', 'zh', 'zh-cn', 'nl', 'pl', 'ru', 'id', 'th',
]);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const cardId = String(body?.cardId || '').trim();
    const requestedLang = String(body?.lang || 'en').toLowerCase();
    const lang = ALLOWED_LANGS.has(requestedLang) ? requestedLang : 'en';

    if (!cardId || cardId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(cardId)) {
      return Response.json({ available: false, reason: 'invalid_card_id', profiles: [] }, { status: 400 });
    }

    const card: any = await getCard(cardId, 'en').catch(() => null);
    if (!card) {
      return Response.json({ available: false, reason: 'tcgdex_card_not_found', profiles: [] }, { status: 404 });
    }

    const dexIds = Array.isArray(card.dexId)
      ? card.dexId.filter((id: any) => Number.isInteger(id) && id > 0).slice(0, 3)
      : [];

    if (String(card.category || '').toLowerCase() !== 'pokemon' || dexIds.length === 0) {
      return Response.json({
        available: false,
        reason: 'no_dex_id',
        canonicalCardId: card.id || cardId,
        profiles: [],
      }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
    }

    const settled = await Promise.allSettled(dexIds.map((id: number) => getPokemonProfile(svc, id, lang)));
    const profiles = settled
      .filter((x): x is PromiseFulfilledResult<any> => x.status === 'fulfilled')
      .map((x) => x.value);

    return Response.json({
      available: profiles.length > 0,
      reason: profiles.length > 0 ? null : 'pokeapi_unavailable',
      canonicalCardId: card.id || cardId,
      canonicalSource: 'TCGDex',
      enrichmentSource: 'PokeAPI',
      dexIds,
      profiles,
    }, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  } catch (error) {
    console.error('pokemon-enrichment failed:', error instanceof Error ? error.message : String(error));
    return Response.json({
      available: false,
      reason: 'internal_error',
      profiles: [],
    }, { status: 200 });
  }
}
