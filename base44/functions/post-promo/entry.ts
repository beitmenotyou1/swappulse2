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
import { fetchTcgdex, normalizeSetId } from '../../shared/tcgdexClient.ts';
import { buildHashtagFacets } from '../../shared/hashtagFacets.ts';

const PROMO_USER_ID = '6a6422a1b8cda8ece8138c87';
const SITE_BASE = 'https://swappulse.org';
const TCGDEX_IMAGE_BASE = 'https://assets.tcgdex.net';

// Curated list of popular set codes — recognizable cards collectors know.
const POPULAR_SETS = ['sv3', 'sv3pt5', 'sv4', 'base1', 'sv5', 'sv2', 'swsh1', 'swsh4'];

// --- Message fragment pools (composed randomly each run) ---
// Written to sound like a real collector talking — conversational, personal,
// relatable — not corporate marketing copy. Links are always full https://
// URLs and hashtags are real, commonly-searched Pokémon TCG community tags.
// {cardName} is replaced with the featured card's localized name.
const HOOKS = [
  "{cardName} is one of those cards that stops you mid-scroll.",
  "The artwork on {cardName} is genuinely something special.",
  "Been admiring {cardName} and the detail is just unreal.",
  "{cardName} is the kind of card that makes you want to build a whole binder around it.",
  "Every time I look at {cardName} I notice something new in the art.",
  "{cardName} has that artwork that just hits different.",
  "{cardName} — a card that earns its spot in any collection.",
  "The detail on {cardName} is a masterclass in TCG art.",
  "{cardName} is a card collectors keep coming back to.",
  "There's something about {cardName} that makes it stand out.",
  "{cardName} is easily one of the most striking cards in its set.",
  "The composition on {cardName} is just perfect.",
];

const VALUE_PROPS = [
  "SwapPulse is a decentralized social network for Pokémon TCG collectors, built on the AT Protocol. It's in alpha — features are still being built and refined.",
  "We're building a place where collectors can actually talk to each other. No ads, no algorithm. It's alpha, so things may change as we go.",
  "Scan cards, build collections, create binders, find trades — all in one place. It's free and open-source, and we're still in alpha so bear with us.",
  "Built on the AT Protocol, so your posts can show up on Bluesky too. Same account, bigger reach. Still in alpha, still improving.",
  "No paywalls. No premium tiers. No selling your data. Just collectors helping collectors — and we're in alpha, so expect rough edges.",
  "Your collection, your posts, your follows. They're yours. It's alpha and we're actively building, but the vision is portable, collector-owned data.",
  "Challenges, meetups, pack parties — the card shop vibe, online. We're in alpha so some of this is still coming together.",
  "SwapPulse is free and open-source, funded by donations. We're in alpha, testing and iterating with the community.",
];

const CTAS = [
  `Come hang out with us: ${SITE_BASE}`,
  `Make a free account and say hi: ${SITE_BASE}`,
  `Start your collection here: ${SITE_BASE}`,
  `See what we're building: ${SITE_BASE}`,
  `Join the community: ${SITE_BASE}`,
  `Bring your binder: ${SITE_BASE}`,
];

// Real, commonly-searched Pokémon TCG community hashtags. These are tags
// collectors actually follow and search for on Bluesky and other platforms \u2014
// not invented brand tags. Capped at 4 per post to stay readable.
const HASHTAG_SETS = [
  "#PokemonTCG #PTCGO #PokemonCards #TCG",
  "#PokemonTCG #PullOfTheWeek #CardCollecting",
  "#PokemonTCG #PokemonCommunity #TCGTrading",
  "#PokemonTCG #ShinyHunting #PokemonCollection",
  "#PokemonTCG #PackOpening #PullOfTheWeek",
  "#PokemonTCG #TCGCommunity #CardCollector",
  "#PokemonTCG #PokemonCards #TradingCards",
  "#PokemonTCG #PTCGO #CardCollecting #PullOfTheWeek",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Parse a hashtag-set string (e.g. "#PokemonTCG #PTCGO #PokemonCards #TCG")
 * into an array of canonical tag strings: strip the leading #, trim, lowercase,
 * dedupe, and cap at the AT Protocol limit of 8 tags per post. These populate
 * the `tags` field on app.bsky.feed.post so Bluesky indexes them for hashtag
 * search — independent of the visible #hashtags in the post body. */
function parseTags(hashtagSet: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of hashtagSet.split(/\s+/)) {
    const tag = raw.replace(/^#/, '').trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 8) break;
  }
  return tags;
}

/** Count grapheme clusters (Bluesky's text limit is 300 graphemes). */
function countGraphemes(str: string): number {
  try {
    const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return [...seg.segment(str)].length;
  } catch {
    return [...str].length;
  }
}

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
async function fetchRandomCard(): Promise<FeaturedCard | null> {
  // Try up to 4 different sets before giving up (some sets may return empty)
  const tried = new Set<string>();
  for (let setAttempt = 0; setAttempt < 4; setAttempt++) {
    try {
      let setId: string;
      do {
        setId = normalizeSetId(pick(POPULAR_SETS));
      } while (tried.has(setId) && tried.size < POPULAR_SETS.length);
      tried.add(setId);

      const set: any = await fetchTcgdex(`/sets/${encodeURIComponent(setId)}`, 'en');
      const cards = Array.isArray(set?.cards) ? set.cards : [];
      console.log('post-promo: set fetch', setId, 'cards?', cards.length);
      if (cards.length === 0) continue;

      // Try a few times to find a card with an image
      for (let cardAttempt = 0; cardAttempt < 5; cardAttempt++) {
        const card = pick(cards);
        if (!card?.id || !card?.name) continue;
        // Card summaries in the set response may include `image`; if not,
        // fetch the full card record to get it.
        let imageField = card.image ?? null;
        let rarity = card.rarity ?? '';
        if (!imageField || !rarity) {
          try {
            const full: any = await fetchTcgdex(`/cards/${encodeURIComponent(card.id)}`, 'en');
            imageField = imageField || full?.image || null;
            rarity = rarity || full?.rarity || '';
          } catch {
            // keep what we have
          }
        }
        return {
          id: card.id,
          name: card.name,
          setName: set?.name || '',
          rarity: rarity || '',
          imageField,
        };
      }
      // Fallback: return the first card with an id even without an image
      const fallback = cards.find((c: any) => c?.id && c?.name);
      if (fallback) {
        return {
          id: fallback.id,
          name: fallback.name,
          setName: set?.name || '',
          rarity: fallback.rarity || '',
          imageField: fallback.image ?? null,
        };
      }
    } catch (e) {
      console.error('post-promo: fetchRandomCard set attempt failed', e?.message || e);
    }
  }
  return null;
}

/** Build the small card image URL from TCGDex's CDN (low quality webp). */
function cardImageUrl(imageField: string | null): string | null {
  if (!imageField) return null;
  const suffix = '/low.webp';
  if (imageField.startsWith('http')) return `${imageField}${suffix}`;
  return `${TCGDEX_IMAGE_BASE}/${imageField}${suffix}`;
}

function generateMessage(card: FeaturedCard | null): { content: string; cardUrl: string | null; tags: string[] } {
  const hook = card
    ? pick(HOOKS).replace(/\{cardName\}/g, card.name)
    : "SwapPulse is a community built by collectors, for collectors.";
  const hashtagSet = pick(HASHTAG_SETS);
  const tags = parseTags(hashtagSet);
  const hashtags = hashtagSet;

  // When featuring a card, the card link serves as the CTA — include hook +
  // value prop + card link + hashtags, trimmed to 300 graphemes.
  if (card) {
    const cardUrl = `${SITE_BASE}/card/${encodeURIComponent(card.id)}`;
    const cardLine = `See this card on SwapPulse: ${cardUrl}`;
    // Card info line with set name and rarity when available
    const infoParts = [card.setName, card.rarity].filter(Boolean);
    const infoLine = infoParts.length > 0 ? infoParts.join(' · ') : null;
    const intro = infoLine ? `${hook}\n\n${infoLine}` : hook;
    // Start with the essential parts: intro + card link + hashtags
    const essential = `${intro}\n\n${cardLine}\n\n${hashtags}`;
    if (countGraphemes(essential) > 300) {
      // Intro alone is too long with the link — trim to fit
      const trimmed = essential.slice(0, 297) + '...';
      return { content: trimmed, cardUrl, tags };
    }
    // Try to fit a value prop between the intro and the card link
    const valueProp = pick(VALUE_PROPS);
    const full = `${intro}\n\n${valueProp}\n\n${cardLine}\n\n${hashtags}`;
    if (countGraphemes(full) <= 300) {
      return { content: full, cardUrl, tags };
    }
    // Value prop doesn't fit — skip it, keep the essential parts
    return { content: essential, cardUrl, tags };
  }

  // No card: original structure — hook + value prop + CTA + hashtags
  const valueProp = pick(VALUE_PROPS);
  const cta = pick(CTAS);
  let content = `${hook}\n\n${valueProp}\n\n${cta}\n\n${hashtags}`;
  // Safety: trim to 300 graphemes if random picks produced a long combo
  if (countGraphemes(content) > 300) {
    // Drop the CTA first, then the value prop, to get under the limit
    content = `${hook}\n\n${valueProp}\n\n${hashtags}`;
    if (countGraphemes(content) > 300) {
      content = `${hook}\n\n${hashtags}`;
      if (countGraphemes(content) > 300) {
        content = content.slice(0, 297) + '...';
      }
    }
  }
  return { content, cardUrl: null, tags };
}

/**
 * Fetch the card image bytes and upload to the PDS as a blob. Returns the blob
 * ref object for use as the embed thumb, or null on failure (non-fatal).
 */
async function uploadCardImage(
  pdsUrl: string,
  accessJwt: string,
  imageUrl: string,
): Promise<{ $type: 'blob'; ref: { $link: string }; mimeType: string; size: number } | null> {
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.error('post-promo: card image fetch failed', imgRes.status);
      return null;
    }
    const mimeType = imgRes.headers.get('content-type') || 'image/webp';
    const bytes = new Uint8Array(await imgRes.arrayBuffer());

    const uploadRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'Authorization': `Bearer ${accessJwt}`,
      },
      body: bytes,
    });
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      console.error('post-promo: uploadBlob failed', uploadRes.status, text.slice(0, 300));
      return null;
    }
    const data = await uploadRes.json();
    const blob = data.blob;
    if (!blob?.ref?.$link) {
      console.error('post-promo: no blob cid in uploadBlob response');
      return null;
    }
    return {
      $type: 'blob',
      ref: { $link: blob.ref.$link },
      mimeType: blob.mimeType || mimeType,
      size: blob.size ?? bytes.length,
    };
  } catch (e) {
    console.error('post-promo: uploadCardImage failed', e?.message || e);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // Look up the PDS credential for the promo account
    const creds = await svc.entities.PdsCredential
      .filter({ user_id: PROMO_USER_ID }, '-created_date', 1)
      .catch(() => []);
    if (!creds || creds.length === 0 || !creds[0].app_password) {
      console.error('post-promo: no PdsCredential found for promo account', PROMO_USER_ID);
      return Response.json({ error: 'Promo account PDS credential not found' }, { status: 500 });
    }
    const cred = creds[0];
    const pdsUrl = cred.pds_url || Deno.env.get('PDS_URL');
    if (!pdsUrl) {
      console.error('post-promo: PDS_URL not configured');
      return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });
    }

    // Authenticate to the PDS as the promo account
    let session;
    try {
      ({ session } = await getPdsSessionForUser(pdsUrl, cred.did, cred.app_password));
    } catch (e) {
      console.error('post-promo: PDS session failed', e?.message || e);
      return Response.json({ error: 'PDS authentication failed' }, { status: 502 });
    }

    // Fetch a featured card from TCGDex (non-fatal — falls back to text-only)
    const card = await fetchRandomCard();

    // Generate the varied promotional message (with card name + link woven in)
    const { content, cardUrl, tags } = generateMessage(card);

    // Build the embed: upload the card image as a PDS blob and attach it as an
    // app.bsky.embed.external rich-link card pointing at the SwapPulse card page.
    let embed: any = null;
    if (card && cardUrl) {
      const imageUrl = cardImageUrl(card.imageField);
      let thumb: any = null;
      if (imageUrl) {
        thumb = await uploadCardImage(pdsUrl, session.accessJwt, imageUrl);
      }
      // Always embed the card link — with image when available, without when not
      embed = {
        $type: 'app.bsky.embed.external',
        external: {
          uri: cardUrl,
          title: card.name,
          description: [card.setName, card.rarity].filter(Boolean).join(' · ') || 'Pokémon TCG card',
        },
      };
      if (thumb) embed.external.thumb = thumb;
    } else if (!card) {
      // No card — embed the home page so the CTA link renders as a rich card
      embed = {
        $type: 'app.bsky.embed.external',
        external: {
          uri: SITE_BASE,
          title: 'SwapPulse',
          description: 'A decentralized social network for Pokémon TCG collectors. Free, open-source, and in alpha.',
        },
      };
    }

    // Create the post directly on the PDS (no local Post record)
    const record: any = {
      $type: 'app.bsky.feed.post',
      text: content,
      createdAt: new Date().toISOString(),
      langs: ['en'],
    };
    if (tags.length > 0) record.tags = tags;
    const facets = buildHashtagFacets(content);
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
        ({ session } = await getPdsSessionForUser(pdsUrl, cred.did, cred.app_password));
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

    console.log('post-promo: published promo post', result.uri, card ? `(card: ${card.name})` : '(no card)', embed ? '(with image embed)' : '(text-only)');
    return Response.json({ ok: true, uri: result.uri, cid: result.cid, content, card: card ? { id: card.id, name: card.name } : null, hasEmbed: !!embed });
  } catch (error) {
    console.error('post-promo error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});