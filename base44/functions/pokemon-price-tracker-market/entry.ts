// pokemon-price-tracker-market — optional PokemonPriceTracker enrichment for one
// canonical TCGDex card.
//
// Licensing boundary:
// - Free/API plans are development/personal/non-commercial under current provider terms.
// - Public production display is disabled unless Business/Enterprise is configured
//   or the maintainer explicitly sets POKEMON_PRICE_TRACKER_PUBLIC_USE_ALLOWED=true
//   after obtaining permission that covers the deployment.
//
// Security/quota boundary:
// - Browser submits only the canonical TCGDex card ID.
// - API key remains server-side in POKEMON_PRICE_TRACKER_API_KEY.
// - No generic provider proxy is exposed.
// - One strict limit=1 query requests basic + 3-day history + graded data.
// - Persistent cache/soft-budget logic lives in pokemonPriceTrackerClient.ts.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCard } from '../../shared/tcgdexClient.ts';
import {
  getPokemonPriceTrackerPolicy,
  PokemonPriceTrackerError,
  resolvePokemonPriceTrackerCard,
} from '../../shared/pokemonPriceTrackerClient.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const caller = await base44.auth.me().catch(() => null);
    const policy = getPokemonPriceTrackerPolicy();
    const body = await req.json().catch(() => ({}));
    const cardId = String(body?.cardId || '').trim();

    if (!cardId || cardId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(cardId)) {
      return Response.json({ available: false, matched: false, reason: 'invalid_card_id' }, { status: 400 });
    }

    // Fail closed before reading the secret or spending credits. Admins may use
    // Free/API tiers for development/evaluation; ordinary live users may not.
    if (!policy.publicUseAllowed && caller?.role !== 'admin') {
      return Response.json({
        available: false,
        matched: false,
        reason: 'license_plan_required',
        provider: 'PokemonPriceTracker',
        plan: policy.plan,
        publicUseAllowed: false,
      }, {
        headers: { 'Cache-Control': 'private, max-age=300' },
      });
    }

    if (!policy.configured) {
      return Response.json({
        available: false,
        matched: false,
        reason: 'not_configured',
        provider: 'PokemonPriceTracker',
        plan: policy.plan,
        publicUseAllowed: policy.publicUseAllowed,
      }, {
        headers: { 'Cache-Control': 'private, max-age=300' },
      });
    }

    const cachedRows = await svc.entities.TcgdexCard
      .filter({ card_id: cardId }, '-updated_date', 1)
      .catch(() => []);
    const local = cachedRows?.[0];
    const canonical = local ? {
      id: local.card_id,
      name: local.name,
      localId: local.local_id,
      rarity: local.rarity,
      set_lang: local.set_lang,
      set: { id: local.set_id, name: local.set_name },
    } : await getCard(cardId, 'en').catch(() => null);

    if (!canonical) {
      return Response.json({ available: false, matched: false, reason: 'tcgdex_card_not_found' }, { status: 404 });
    }

    try {
      const result = await resolvePokemonPriceTrackerCard(svc, canonical);
      return Response.json({
        ...result,
        canonicalCardId: canonical.id || cardId,
        canonicalSource: 'TCGDex',
        enrichmentSource: 'PokemonPriceTracker',
        plan: policy.plan,
        publicUseAllowed: policy.publicUseAllowed,
        developmentPreview: !policy.publicUseAllowed,
        creditPolicy: {
          providerDailyCredits: policy.providerCreditsPerDay,
          swapPulseDailySoftCredits: policy.softCreditsPerDay,
          providerCallsPerMinute: policy.providerCallsPerMinute,
          swapPulseCallsPerMinute: policy.softCallsPerMinute,
        },
      }, {
        headers: {
          'Cache-Control': policy.publicUseAllowed
            ? 'public, max-age=900, stale-while-revalidate=86400'
            : 'private, max-age=300',
        },
      });
    } catch (error) {
      if (error instanceof PokemonPriceTrackerError) {
        return Response.json({
          available: false,
          matched: false,
          temporary: error.recoverable,
          reason: error.code.toLowerCase(),
          canonicalCardId: canonical.id || cardId,
          canonicalSource: 'TCGDex',
          enrichmentSource: 'PokemonPriceTracker',
          plan: policy.plan,
          publicUseAllowed: policy.publicUseAllowed,
          developmentPreview: !policy.publicUseAllowed,
        }, {
          status: 200,
          headers: { 'Cache-Control': 'private, max-age=60' },
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('pokemon-price-tracker-market failed:', error instanceof Error ? error.message : String(error));
    return Response.json({
      available: false,
      matched: false,
      temporary: true,
      reason: 'internal_error',
    }, { status: 200 });
  }
}
