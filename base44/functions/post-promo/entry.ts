// post-promo — publishes a varied promotional post to the AT Protocol from the
// designated SwapPulse promo account. The post is created directly on the PDS
// (via the account's stored PdsCredential) and tracked in the PromoPost entity
// so firehose-ingest skips it — the post appears on Bluesky but never on the
// SwapPulse local feed.
//
// Each post features an individual Pokémon TCG card: the card name is woven
// into the message, a direct https://swappulse.org/card/{cardId} link is
// included, and the card's image is uploaded to the PDS as a blob and attached
// as an app.bsky.embed.external rich-link card so Bluesky renders a card
// preview with the image that deep-links to the SwapPulse card page.
//
// Message variation: each call composes a unique message from pools of hooks,
// value propositions, calls to action, and hashtag sets — hundreds of
// combinations, all adhering to SwapPulse's core premise (decentralized social
// network for Pokémon TCG collectors, built on the AT Protocol, free and
// open-source).
//
// Invoked by the "Promo Poster" workflow every 4 hours.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser, pdsRequest } from '../../shared/pdsSession.ts';
import { uploadPromoImage } from '../../shared/promoImageUpload.ts';
import { fetchTcgdex, normalizeSetId } from '../../shared/tcgdexClient.ts';
import { buildRichTextFacets } from '../../shared/hashtagFacets.ts';
import {
  PROMO_LOCALES,
  FEATURE_POOL,
  HASHTAG_SETS,
  pick,
  pickPromoLocale,
  getPoolsForLocale,
  withLangParam,
  parseTags,
  countGraphemes,
  type PromoLocale,
} from '../../shared/promoMessages.ts';

const PROMO_USER_ID = '6a6422a1b8cda8ece8138c87';
const SITE_BASE = 'https://swappulse.org';
const TCGDEX_IMAGE_BASE = 'https://assets.tcgdex.net';
// Branded SwapPulse promo banner used as the embed thumbnail for feature and
// community posts (which have no card image of their own), so Bluesky renders
// a rich image card instead of a bare text link card.
const PROMO_BANNER_URL = 'https://media.base44.com/images/public/6a63d9d64a4d65d370c70892/a22b46eb2_generated_image.png';

// Curated list of popular set codes — recognizable cards collectors know.
const POPULAR_SETS = ['sv3', 'sv3pt5', 'sv4', 'base1', 'sv5', 'sv2', 'swsh1', 'swsh4'];

// Current build status — referenced in Type 3 (community pitch) posts.
// Update this one constant when the status changes (alpha → beta → live).
const BUILD_STATUS = 'alpha';

interface FeaturedCard {
  id: string;
  name: string;
  setName: string;
  rarity: string;
  imageField: string | null;
}

/**
 * Fetch a random card from TCGDex by picking a random popular set, then a
 * random card from that set. Returns null if the fetch fails (caller falls
 * back to a text-only post without a card).
 */
async function fetchRandomCard(tcgdexLang: string): Promise<FeaturedCard | null> {
  // Try up to 4 different sets before giving up (some sets may return empty)
  const tried = new Set<string>();
  for (let setAttempt = 0; setAttempt < 4; setAttempt++) {
    try {
      let setId: string;
      do {
        setId = normalizeSetId(pick(POPULAR_SETS));
      } while (tried.has(setId) && tried.size < POPULAR_SETS.length);
      tried.add(setId);

      const set: any = await fetchTcgdex(`/sets/${encodeURIComponent(setId)}`, tcgdexLang);
      const cards = Array.isArray(set?.cards) ? set.cards : [];
      console.log('post-promo: set fetch', setId, 'lang', tcgdexLang, 'cards?', cards.length);
      if (cards.length === 0) continue;

      // Try a few times to find a card with an image
      for (let cardAttempt = 0; cardAttempt < 5; cardAttempt++) {
        const card = pick(cards);
        if (!card?.id || !card?.name) continue;
        // Card summaries in the set response may include `image`; if not,
        // fetch the full card record to get it.
        let imageField = card.image ?? null;
        let rarity = card.rarity ?? '';
        let name = card.name;
        if (!imageField || !rarity || !name) {
          try {
            const full: any = await fetchTcgdex(`/cards/${encodeURIComponent(card.id)}`, tcgdexLang);
            imageField = imageField || full?.image || null;
            rarity = rarity || full?.rarity || '';
            name = name || full?.name || card.name;
          } catch {
            // keep what we have
          }
        }
        // Fall back to the English card for the image — many non-English
        // TCGDex cards (especially older sets) omit the image field, but the
        // English card always has it. The artwork is language-independent.
        if (!imageField) {
          try {
            const enFull: any = await fetchTcgdex(`/cards/${encodeURIComponent(card.id)}`, 'en');
            imageField = enFull?.image || null;
          } catch {
            // keep null — post will be text-only
          }
        }
        return {
          id: card.id,
          name: name || card.name,
          setName: set?.name || '',
          rarity: rarity || '',
          imageField,
        };
      }
      // Fallback: return the first card with an id even without an image
      const fallback = cards.find((c: any) => c?.id && c?.name);
      if (fallback) {
        let fallbackImage = fallback.image ?? null;
        if (!fallbackImage) {
          try {
            const enFull: any = await fetchTcgdex(`/cards/${encodeURIComponent(fallback.id)}`, 'en');
            fallbackImage = enFull?.image || null;
          } catch { /* text-only fallback */ }
        }
        return {
          id: fallback.id,
          name: fallback.name,
          setName: set?.name || '',
          rarity: fallback.rarity || '',
          imageField: fallbackImage,
        };
      }
    } catch (e) {
      console.error('post-promo: fetchRandomCard set attempt failed', e?.message || e);
    }
  }
  return null;
}

/** Build the small card image URL from TCGDex's CDN.
 * Uses PNG (not WebP) because Bluesky's app.bsky.embed.images lexicon only
 * accepts image/jpeg and image/png. TCGDex's CDN supports format selection via
 * the URL extension: .png (transparent bg), .jpg (black bg), .webp (modern).
 * We use .png for best quality. The Accept header in uploadPromoImage ensures
 * the CDN doesn't serve WebP via content negotiation despite the .png URL. */
function cardImageUrl(imageField: string | null): string | null {
  if (!imageField) return null;
  const suffix = '/low.png';
  if (imageField.startsWith('http')) return `${imageField}${suffix}`;
  return `${TCGDEX_IMAGE_BASE}/${imageField}${suffix}`;
}

type PromoType = 'card' | 'feature' | 'community';

interface PromoResult {
  content: string;
  embedUrl: string;
  embedTitle: string;
  embedDescription: string;
  tags: string[];
}

/** Type 1: Card-focused post — features a specific card with its page link. */
function generateCardMessage(card: FeaturedCard, locale: string): PromoResult {
  const pools = getPoolsForLocale(locale);
  const hook = pick(pools.hooks).replace(/\{cardName\}/g, card.name);
  const hashtagSet = pick(HASHTAG_SETS);
  const tags = parseTags(hashtagSet);
  const hashtags = hashtagSet;
  const cardUrl = withLangParam(`${SITE_BASE}/card/${encodeURIComponent(card.id)}`, locale);
  const cardLine = `${cardUrl}`;
  const infoParts = [card.setName, card.rarity].filter(Boolean);
  const infoLine = infoParts.length > 0 ? infoParts.join(' · ') : null;
  const intro = infoLine ? `${hook}\n\n${infoLine}` : hook;
  const essential = `${intro}\n\n${cardLine}\n\n${hashtags}`;
  if (countGraphemes(essential) > 300) {
    return { content: essential.slice(0, 297) + '...', embedUrl: cardUrl, embedTitle: card.name, embedDescription: infoLine || 'Pokémon TCG card', tags };
  }
  const valueProp = pick(pools.valueProps);
  const full = `${intro}\n\n${valueProp}\n\n${cardLine}\n\n${hashtags}`;
  if (countGraphemes(full) <= 300) {
    return { content: full, embedUrl: cardUrl, embedTitle: card.name, embedDescription: infoLine || 'Pokémon TCG card', tags };
  }
  return { content: essential, embedUrl: cardUrl, embedTitle: card.name, embedDescription: infoLine || 'Pokémon TCG card', tags };
}

/** Type 2: Feature-focused post — highlights a specific SwapPulse feature. */
function generateFeatureMessage(feature: { name: string; path: string; description: string }, locale: string): PromoResult {
  const pools = getPoolsForLocale(locale);
  const hook = pick(pools.featureHooks).replace(/\{featureName\}/g, feature.name);
  const hashtagSet = pick(HASHTAG_SETS);
  const tags = parseTags(hashtagSet);
  const hashtags = hashtagSet;
  const featureUrl = withLangParam(`${SITE_BASE}${feature.path}`, locale);
  const featureLine = `${featureUrl}`;
  const essential = `${hook}\n\n${featureLine}\n\n${hashtags}`;
  if (countGraphemes(essential) > 300) {
    return { content: essential.slice(0, 297) + '...', embedUrl: featureUrl, embedTitle: feature.name, embedDescription: feature.description, tags };
  }
  const valueProp = pick(pools.valueProps);
  const full = `${hook}\n\n${valueProp}\n\n${featureLine}\n\n${hashtags}`;
  if (countGraphemes(full) <= 300) {
    return { content: full, embedUrl: featureUrl, embedTitle: feature.name, embedDescription: feature.description, tags };
  }
  return { content: essential, embedUrl: featureUrl, embedTitle: feature.name, embedDescription: feature.description, tags };
}

/** Type 3: Community pitch with build status — why collectors should join. */
function generateCommunityMessage(locale: string): PromoResult {
  const pools = getPoolsForLocale(locale);
  const hook = pick(pools.communityHooks);
  const statusProp = pick(pools.statusProps).replace(/\{BUILD_STATUS\}/g, BUILD_STATUS);
  const hashtagSet = pick(HASHTAG_SETS);
  const tags = parseTags(hashtagSet);
  const hashtags = hashtagSet;
  const cta = pick(pools.ctas).replace(/\{SITE_BASE\}/g, withLangParam(SITE_BASE, locale));
  let content = `${hook}\n\n${statusProp}\n\n${cta}\n\n${hashtags}`;
  if (countGraphemes(content) > 300) {
    content = `${hook}\n\n${statusProp}\n\n${hashtags}`;
    if (countGraphemes(content) > 300) {
      content = `${hook}\n\n${hashtags}`;
      if (countGraphemes(content) > 300) {
        content = content.slice(0, 297) + '...';
      }
    }
  }
  return { content, embedUrl: withLangParam(SITE_BASE, locale), embedTitle: 'SwapPulse', embedDescription: `A decentralized social network for Pokémon TCG collectors. Free, open-source, and currently in ${BUILD_STATUS}.`, tags };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    // Look up the promo account's consolidated PDS identity
    const promoUsers = await svc.entities.User
      .filter({ id: PROMO_USER_ID }, '-created_date', 1)
      .catch(() => []);
    const promoUser = promoUsers?.[0];
    const { getUserIdentity } = await import('../../shared/userIdentity.ts');
    const identity = promoUser ? await getUserIdentity(svc, promoUser) : null;
    if (!identity) {
      console.error('post-promo: no PDS identity found for promo account', PROMO_USER_ID);
      return Response.json({ error: 'Promo account PDS credential not found' }, { status: 500 });
    }
    const pdsUrl = identity.pdsUrl;
    if (!pdsUrl) {
      console.error('post-promo: PDS_URL not configured');
      return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });
    }

    // Authenticate to the PDS as the promo account
    let session;
    try {
      ({ session } = await getPdsSessionForUser(pdsUrl, identity.did, identity.appPassword));
    } catch (e) {
      console.error('post-promo: PDS session failed', e?.message || e);
      return Response.json({ error: 'PDS authentication failed' }, { status: 502 });
    }

    // Credential object for uploadPromoImage's PDS session-refresh path
    // (used only on a 401 during blob upload).
    const cred = { did: identity.did, app_password: identity.appPassword };

    // Pick a random language for this post — the bot publishes in different
    // languages across runs. Links get a ?lang=LOCALE param so the site loads
    // in the same language when a user clicks through.
    const promoLocale: PromoLocale = pickPromoLocale();

    // Pick a promo type at random: card, feature, or community pitch
    const promoType: PromoType = pick(['card', 'feature', 'community'] as PromoType[]);

    let promo: PromoResult;
    let card: FeaturedCard | null = null;

    if (promoType === 'card') {
      card = await fetchRandomCard(promoLocale.tcgdex);
      if (card) {
        promo = generateCardMessage(card, promoLocale.locale);
      } else {
        // Card fetch failed — fall back to community pitch
        promo = generateCommunityMessage(promoLocale.locale);
      }
    } else if (promoType === 'feature') {
      promo = generateFeatureMessage(pick(FEATURE_POOL), promoLocale.locale);
    } else {
      promo = generateCommunityMessage(promoLocale.locale);
    }

    const { content, embedUrl, embedTitle, embedDescription, tags } = promo;

    // Build the embed as app.bsky.embed.images so the image renders inline in
    // the post (like a photo post) without depending on Bluesky's AppView
    // scraping the external URI. The swappulse.org link stays clickable in the
    // post text via the link facets built by buildRichTextFacets.
    let imageBlob: { $type: 'blob'; ref: { $link: string }; mimeType: string; size: number } | null = null;
    let altText = embedTitle;
    if (card && promoType === 'card') {
      const imageUrl = cardImageUrl(card.imageField);
      if (imageUrl) {
        const uploadResult = await uploadPromoImage(pdsUrl, session.accessJwt, imageUrl, cred);
        imageBlob = uploadResult.blob;
        session.accessJwt = uploadResult.accessJwt;
      }
      altText = card.name + (card.setName ? ` (${card.setName})` : '');
    } else {
      // Feature and community posts: attach the branded SwapPulse banner.
      const uploadResult = await uploadPromoImage(pdsUrl, session.accessJwt, PROMO_BANNER_URL, cred);
      imageBlob = uploadResult.blob;
      session.accessJwt = uploadResult.accessJwt;
    }
    // Guard: never publish a text-only promo post. If the image blob upload
    // failed, abort so the workflow retries on the next scheduled cycle
    // instead of publishing a bare-text promo.
    if (!imageBlob) {
      console.error('post-promo: image blob upload failed — aborting post to prevent plain-text promo');
      return Response.json({ error: 'Image upload failed — promo post aborted to prevent plain-text output' }, { status: 502 });
    }
    const embed: any = {
      $type: 'app.bsky.embed.images',
      images: [{ alt: altText, image: imageBlob }],
    };

    // Create the post directly on the PDS (no local Post record)
    const record: any = {
      $type: 'app.bsky.feed.post',
      text: content,
      createdAt: new Date().toISOString(),
      langs: [promoLocale.bcp47],
    };
    if (tags.length > 0) record.tags = tags;
    const facets = buildRichTextFacets(content);
    if (facets.length > 0) record.facets = facets;
    if (embed) record.embed = embed;

    let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record,
    });

    // Retry once on auth failure (session may have expired)
    if (result?.error && result.status === 401) {
      try {
        ({ session } = await getPdsSessionForUser(pdsUrl, identity.did, identity.appPassword));
        result = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record,
        });
      } catch (e) {
        console.error('post-promo: retry failed', e?.message || e);
      }
    }

    if (result?.error) {
      console.error('post-promo: createRecord failed', result.status, result.body);
      return Response.json({ error: `createRecord failed (${result.status})` }, { status: 502 });
    }

    // Track the promo post so firehose-ingest skips it
    await svc.entities.PromoPost.create({
      at_uri: result.uri,
      content,
      did: session.did,
      posted_at: new Date().toISOString(),
    }).catch((e: any) => console.error('post-promo: failed to track PromoPost', e?.message || e));

    console.log('post-promo: published promo post', result.uri, `(type: ${promoType}, lang: ${promoLocale.locale})`, card ? `(card: ${card.name})` : '(no card)', embed ? '(with image embed)' : '(text only)');
    return Response.json({ ok: true, uri: result.uri, cid: result.cid, content, promoType, locale: promoLocale.locale, card: card ? { id: card.id, name: card.name } : null, hasEmbed: !!embed });
  } catch (error) {
    console.error('post-promo error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});