// card-metadata-localized — dynamic NFT metadata endpoint.
//
// Returns ERC-721 / ERC-1155 compatible metadata with localised names
// and images. This is what gets called when someone views an NFT on
// OpenSea or any marketplace.
//
// CORS-enabled (Access-Control-Allow-Origin: *) for marketplace compatibility.
// Public catalogue data — no auth required.
//
// Parameters (query string or JSON body):
// - cardId:  TCGDex card ID (required, e.g., swsh3-136)
// - lang:    Language code (default: en)
// - variant: Print variant (normal, holo, reverse, firstEdition, wPromo)
//            Default: normal
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCard, getCardImageUrl, validateLanguage } from '../../shared/tcgdexClient.ts';
import { createLogger } from '../../shared/logger.ts';
import { errorResponse, getParams } from '../../shared/apiHelpers.ts';
import type { NFTMetadata, NFTAttribute } from '../../shared/apiTypes.ts';

const logger = createLogger('api:card-metadata');

const VALID_VARIANTS = ['normal', 'holo', 'reverse', 'firstEdition', 'wPromo'];
const SITE_URL = 'https://swap-pulse-hub.base44.app';

const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  'pt-br': 'Portuguese (Brazil)',
  'pt-pt': 'Portuguese (Portugal)',
  de: 'German',
  nl: 'Dutch',
  pl: 'Polish',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  'zh-tw': 'Chinese (Traditional)',
  'zh-cn': 'Chinese (Simplified)',
  id: 'Indonesian',
  th: 'Thai',
};

export default async function (req: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const params = await getParams(req);
    const cardId = params.cardId;

    if (!cardId) {
      return Response.json(
        errorResponse('MISSING_PARAM', 'cardId parameter is required'),
        { status: 400 },
      );
    }

    const lang = params.lang ? validateLanguage(params.lang) : 'en';
    const variant = params.variant && VALID_VARIANTS.includes(params.variant)
      ? params.variant
      : 'normal';

    // Fetch full card from TCGDex API in the requested language
    const apiCard = await getCard(cardId, lang).catch(() => null);

    if (!apiCard) {
      return Response.json(
        errorResponse('NOT_FOUND', `Card not found: ${cardId}`),
        { status: 404 },
      );
    }

    // Trigger on-demand localization if the language is missing from cache
    if (lang !== 'en') {
      try {
        const cached = await svc.entities.TcgdexCard.filter({ card_id: cardId }, '-created_date', 1);
        const hasLang = cached?.[0]?.names && cached[0].names[lang];
        if (!hasLang) {
          base44.functions
            .invoke('sync-localizations', { cardId })
            .catch((e: any) => logger.warn('On-demand localization failed', { cardId, lang, error: e?.message }));
        }
      } catch { /* cache lookup is best-effort */ }
    }

    // Build the image URL
    const imageUrl = apiCard.image
      ? getCardImageUrl(apiCard.image, 'high', 'png')
      : '';

    // Build attributes
    const attributes: NFTAttribute[] = [];

    if (apiCard.set?.name) {
      attributes.push({ trait_type: 'Set', value: apiCard.set.name });
    }
    if (apiCard.rarity) {
      attributes.push({ trait_type: 'Rarity', value: apiCard.rarity });
    }
    attributes.push({ trait_type: 'Category', value: apiCard.category || 'Unknown' });
    attributes.push({
      trait_type: 'Variant',
      value: variant.charAt(0).toUpperCase() + variant.slice(1),
    });

    if (apiCard.category === 'Pokemon') {
      if (apiCard.hp != null) {
        attributes.push({ trait_type: 'HP', value: apiCard.hp });
      }
      if (apiCard.types && apiCard.types.length > 0) {
        attributes.push({ trait_type: 'Types', value: apiCard.types.join(', ') });
      }
      if (apiCard.stage) {
        attributes.push({ trait_type: 'Stage', value: apiCard.stage });
      }
      if (apiCard.evolveFrom) {
        attributes.push({ trait_type: 'Evolves From', value: apiCard.evolveFrom });
      }
      if (apiCard.retreat != null) {
        attributes.push({ trait_type: 'Retreat Cost', value: apiCard.retreat });
      }
    }

    if (apiCard.illustrator) {
      attributes.push({ trait_type: 'Illustrator', value: apiCard.illustrator });
    }
    if (apiCard.regulationMark) {
      attributes.push({ trait_type: 'Regulation Mark', value: apiCard.regulationMark });
    }
    if (apiCard.legal) {
      attributes.push({ trait_type: 'Standard Legal', value: apiCard.legal.standard ? 'Yes' : 'No' });
      attributes.push({ trait_type: 'Expanded Legal', value: apiCard.legal.expanded ? 'Yes' : 'No' });
    }

    attributes.push({
      trait_type: 'Language',
      value: LANGUAGE_DISPLAY_NAMES[lang] || lang,
    });

    if (apiCard.set?.serie?.name) {
      attributes.push({ trait_type: 'Series', value: apiCard.set.serie.name });
    }

    // Build description
    let description: string;
    if (apiCard.description) {
      description = apiCard.description;
    } else if (apiCard.category === 'Pokemon') {
      const parts: string[] = [`${apiCard.stage || 'Basic'} Pokemon`];
      if (apiCard.hp) parts.push(`HP: ${apiCard.hp}`);
      if (apiCard.types?.length) parts.push(apiCard.types.join('/'));
      description = parts.join('. ') + '.';
    } else {
      description = `${apiCard.category || 'Pokemon'} card from the ${apiCard.set?.name || 'Pokemon'} TCG.`;
    }

    const metadata: NFTMetadata = {
      name: apiCard.name || cardId,
      description,
      image: imageUrl,
      external_url: `${SITE_URL}/card/${cardId}`,
      attributes,
    };

    const durationMs = Date.now() - startTime;
    logger.debug('card-metadata response', { cardId, lang, variant, durationMs });

    return Response.json(metadata, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'X-Response-Time': `${durationMs}ms`,
      },
    });
  } catch (error: any) {
    logger.error('card-metadata failed', error);
    return Response.json(
      errorResponse('INTERNAL_ERROR', 'Failed to generate metadata'),
      { status: 500 },
    );
  }
}