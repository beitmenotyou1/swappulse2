// Shared hashtag facet builder for AT Protocol posts. Bluesky renders
// #hashtags as clickable, searchable tag links only when the post record
// carries rich-text facets (app.bsky.richtext.facet#tag) annotating each
// hashtag's UTF-8 byte range in the text — the `tags` field alone only
// handles search indexing. Used by atproto-bridge (for all user-authored
// posts: compose, reply, quote) and post-promo (for promo posts).

export interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: { $type: 'app.bsky.richtext.facet#tag'; tag: string }[];
}

/**
 * Scan `text` for #hashtag patterns and return a facets array where each
 * entry annotates the match's UTF-8 byte range with a `tag` feature (the
 * tag value is the hashtag without `#`, lowercased). Byte offsets are
 * computed by accumulating the byte length of each UTF-8 chunk between
 * matches, since Bluesky facets index bytes, not characters. Returns an
 * empty array when the text contains no hashtags.
 */
export function buildHashtagFacets(text: string): Facet[] {
  const facets: Facet[] = [];
  if (!text || typeof text !== 'string') return facets;
  const encoder = new TextEncoder();
  let byteOffset = 0;
  let lastIdx = 0;
  const re = /#([A-Za-z0-9_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    byteOffset += encoder.encode(text.slice(lastIdx, m.index)).length;
    const tagBytes = encoder.encode(m[0]).length;
    facets.push({
      index: { byteStart: byteOffset, byteEnd: byteOffset + tagBytes },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[1].toLowerCase() }],
    });
    byteOffset += tagBytes;
    lastIdx = m.index + m[0].length;
  }
  return facets;
}

/**
 * Attach hashtag facets to an app.bsky.feed.post record in place. When the
 * record already carries facets for some byte ranges (e.g. caller-provided
 * mention/link facets), the computed tag facets are appended — existing
 * facets are preserved untouched. No-op when the text has no hashtags.
 */
export function attachHashtagFacets(record: any): void {
  if (!record || typeof record !== 'object') return;
  const text = record.text;
  if (!text || typeof text !== 'string') return;
  const tagFacets = buildHashtagFacets(text);
  if (tagFacets.length === 0) return;
  record.facets = Array.isArray(record.facets)
    ? [...record.facets, ...tagFacets]
    : tagFacets;
}