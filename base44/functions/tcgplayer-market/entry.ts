// tcgplayer-market — read-only TCGplayer catalog/pricing enrichment for one
// canonical TCGDex Pokémon card.
//
// Security/legal boundary:
// - Browser sends only a TCGDex card ID.
// - PUBLIC/PRIVATE developer keys remain server-side.
// - TCGPLAYER_APPROVED_USE must be true before any provider request is made.
// - No store/inventory/order/buylist endpoints are exposed.
// - TCGDex remains the canonical card identity source.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCard } from '../../shared/tcgdexClient.ts';
import { getTcgplayerPolicy, resolveTcgplayerMarket, TcgplayerError } from '../../shared/tcgplayerClient.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const policy = getTcgplayerPolicy();
    const body = await req.json().catch(() => ({}));
    const cardId = String(body?.cardId || '').trim();

    if (!cardId || cardId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(cardId)) {
      return Response.json({ available: false, matched: false, reason: 'invalid_card_id' }, { status: 400 });
    }

    // Fail closed before reading keys/minting a token if approved-purpose use has
    // not been explicitly confirmed by the maintainer.
    if (!policy.approvedUse) {
      return Response.json({
        available: false,
        matched: false,
        reason: policy.configured ? 'approved_use_not_confirmed' : 'not_configured',
        provider: 'TCGplayer',
        configured: policy.configured,
        approvedUse: false,
      }, { headers: { 'Cache-Control': 'private, max-age=300' } });
    }

    if (!policy.configured) {
      return Response.json({ available: false, matched: false, reason: 'not_configured', provider: 'TCGplayer' }, { headers: { 'Cache-Control': 'private, max-age=300' } });
    }

    const rows = await svc.entities.TcgdexCard.filter({ card_id: cardId }, '-updated_date', 1).catch(() => []);
    const local = rows?.[0];
    const canonical = local ? {
      id: local.card_id,
      name: local.name,
      localId: local.local_id,
      rarity: local.rarity,
      set: { id: local.set_id, name: local.set_name },
    } : await getCard(cardId, 'en').catch(() => null);

    if (!canonical) return Response.json({ available: false, matched: false, reason: 'tcgdex_card_not_found' }, { status: 404 });

    try {
      const result = await resolveTcgplayerMarket(svc, canonical);
      return Response.json({
        available: true,
        ...result,
        canonicalCardId: canonical.id || cardId,
        canonicalSource: 'TCGDex',
        enrichmentSource: 'TCGplayer',
        attribution: 'This product uses TCGplayer data but is not endorsed or certified by TCGplayer.',
        usagePolicy: {
          providerNumericLimitPublished: false,
          swapPulseSoftCallsPerMinute: policy.softCallsPerMinute,
          swapPulseSoftCallsPerDay: policy.softCallsPerDay,
        },
      }, { headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=21600' } });
    } catch (error) {
      if (error instanceof TcgplayerError) {
        return Response.json({
          available: false,
          matched: false,
          temporary: error.recoverable,
          reason: error.code.toLowerCase(),
          provider: 'TCGplayer',
        }, { status: 200, headers: { 'Cache-Control': 'private, max-age=60' } });
      }
      throw error;
    }
  } catch (error) {
    console.error('tcgplayer-market failed:', error instanceof Error ? error.message : String(error));
    return Response.json({ available: false, matched: false, temporary: true, reason: 'internal_error' }, { status: 200 });
  }
}
