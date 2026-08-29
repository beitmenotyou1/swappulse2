// Shared presentation guard for SwapPulse promotional AT Protocol posts.
// Promotional posts must never degrade to plain text. Every outgoing record
// is required to contain a clickable external card with a PDS-hosted thumbnail,
// a link facet for the destination URL, and facets for every expected hashtag.

import type { BlobRef } from './promoImageUpload.ts';

export function buildPromoExternalEmbed(
  uri: string,
  title: string,
  description: string,
  thumb: BlobRef,
) {
  const parsed = new URL(uri);
  if (parsed.protocol !== 'https:') throw new Error('PROMO_DESTINATION_MUST_USE_HTTPS');
  if (!thumb?.ref?.$link || !thumb.mimeType || !Number.isFinite(Number(thumb.size))) {
    throw new Error('PROMO_THUMBNAIL_INVALID');
  }
  const cleanTitle = String(title || '').trim().slice(0, 300);
  const cleanDescription = String(description || '').trim().slice(0, 1000);
  if (!cleanTitle) throw new Error('PROMO_TITLE_REQUIRED');
  if (!cleanDescription) throw new Error('PROMO_DESCRIPTION_REQUIRED');

  return {
    $type: 'app.bsky.embed.external',
    external: {
      uri: parsed.toString(),
      title: cleanTitle,
      description: cleanDescription,
      thumb,
    },
  };
}

function facetFeatures(record: any): any[] {
  if (!Array.isArray(record?.facets)) return [];
  return record.facets.flatMap((facet: any) => Array.isArray(facet?.features) ? facet.features : []);
}

export function assertPromoPresentation(record: any, destinationUrl: string, expectedTags: string[]) {
  if (!record || record.$type !== 'app.bsky.feed.post') throw new Error('PROMO_RECORD_INVALID');
  if (!String(record.text || '').trim()) throw new Error('PROMO_TEXT_REQUIRED');

  const destination = new URL(destinationUrl).toString();
  const features = facetFeatures(record);
  const linkOk = features.some((feature: any) => {
    if (feature?.$type !== 'app.bsky.richtext.facet#link') return false;
    try {
      return new URL(String(feature?.uri || '')).toString() === destination;
    } catch {
      return false;
    }
  });
  if (!linkOk) throw new Error('PROMO_LINK_FACET_MISSING');

  const facetTags = new Set(
    features
      .filter((feature: any) => feature?.$type === 'app.bsky.richtext.facet#tag')
      .map((feature: any) => String(feature?.tag || '').toLowerCase()),
  );
  for (const tag of expectedTags || []) {
    const normalized = String(tag || '').replace(/^#/, '').toLowerCase();
    if (normalized && !facetTags.has(normalized)) {
      throw new Error(`PROMO_TAG_FACET_MISSING:${normalized}`);
    }
  }

  const external = record?.embed?.$type === 'app.bsky.embed.external'
    ? record.embed.external
    : null;
  if (!external) throw new Error('PROMO_EXTERNAL_EMBED_MISSING');
  if (String(external.uri || '') !== destination) throw new Error('PROMO_EMBED_DESTINATION_MISMATCH');
  if (!String(external.title || '').trim()) throw new Error('PROMO_EMBED_TITLE_MISSING');
  if (!String(external.description || '').trim()) throw new Error('PROMO_EMBED_DESCRIPTION_MISSING');
  if (!external?.thumb?.ref?.$link || !external?.thumb?.mimeType) throw new Error('PROMO_EMBED_THUMBNAIL_MISSING');
}
