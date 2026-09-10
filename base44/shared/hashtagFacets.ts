// Shared rich-text facet builder for AT Protocol posts.
//
// Bluesky clients require UTF-8 byte ranges for clickable links and hashtags.
// The record-level tags array is also populated for discovery, but facets are
// what make the visible text interactive.

export interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: Array<
    | { $type: 'app.bsky.richtext.facet#tag'; tag: string }
    | { $type: 'app.bsky.richtext.facet#link'; uri: string }
  >;
}

const encoder = new TextEncoder();
const URL_PATTERN = /https?:\/\/[^\s<>"']+/giu;
const HASHTAG_PATTERN = /(^|[\s([{"'.,;:!?])#([\p{L}\p{N}_]{1,64})/gu;

function byteRange(text: string, start: number, end: number) {
  return {
    byteStart: encoder.encode(text.slice(0, start)).length,
    byteEnd: encoder.encode(text.slice(0, end)).length,
  };
}

function trimUrl(raw: string): string {
  let url = raw.replace(/[.,;:!?'"]+$/u, '');
  while (
    (url.endsWith(')') && (url.match(/\(/g)?.length || 0) < (url.match(/\)/g)?.length || 0))
    || (url.endsWith(']') && (url.match(/\[/g)?.length || 0) < (url.match(/\]/g)?.length || 0))
  ) {
    url = url.slice(0, -1);
  }
  return url;
}

function urlCharacterRanges(text: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  URL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    const url = trimUrl(match[0]);
    if (url) ranges.push({ start: match.index, end: match.index + url.length });
  }
  return ranges;
}

function overlaps(
  a: { byteStart: number; byteEnd: number },
  b: { byteStart: number; byteEnd: number },
): boolean {
  return a.byteStart < b.byteEnd && b.byteStart < a.byteEnd;
}

export function buildLinkFacets(text: string): Facet[] {
  if (!text || typeof text !== 'string') return [];
  const facets: Facet[] = [];
  URL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    const url = trimUrl(match[0]);
    if (!url) continue;
    facets.push({
      index: byteRange(text, match.index, match.index + url.length),
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
    });
  }
  return facets;
}

export function buildHashtagFacets(text: string): Facet[] {
  if (!text || typeof text !== 'string') return [];
  const facets: Facet[] = [];
  const urlRanges = urlCharacterRanges(text);
  HASHTAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HASHTAG_PATTERN.exec(text)) !== null) {
    const start = match.index + match[1].length;
    const end = start + 1 + match[2].length;
    if (urlRanges.some((range) => start < range.end && range.start < end)) continue;
    facets.push({
      index: byteRange(text, start, end),
      features: [{
        $type: 'app.bsky.richtext.facet#tag',
        tag: match[2].toLocaleLowerCase('und'),
      }],
    });
  }
  return facets;
}

export function buildRichTextFacets(text: string): Facet[] {
  return [...buildHashtagFacets(text), ...buildLinkFacets(text)]
    .sort((a, b) => a.index.byteStart - b.index.byteStart);
}

export function attachHashtagFacets(record: any): void {
  if (!record || typeof record !== 'object' || typeof record.text !== 'string') return;
  const existing: Facet[] = Array.isArray(record.facets) ? record.facets : [];
  const additions = buildHashtagFacets(record.text)
    .filter((facet) => !existing.some((current) => overlaps(facet.index, current.index)));
  if (additions.length > 0) record.facets = [...existing, ...additions]
    .sort((a, b) => a.index.byteStart - b.index.byteStart);
}

export function attachRichTextFacets(record: any): void {
  if (!record || typeof record !== 'object' || typeof record.text !== 'string') return;
  const existing: Facet[] = Array.isArray(record.facets) ? record.facets : [];
  const additions = buildRichTextFacets(record.text)
    .filter((facet) => !existing.some((current) => overlaps(facet.index, current.index)));
  const facets = [...existing, ...additions]
    .sort((a, b) => a.index.byteStart - b.index.byteStart);
  if (facets.length > 0) record.facets = facets;

  const discoveredTags = facets.flatMap((facet) =>
    facet.features
      .filter((feature: any) => feature?.$type === 'app.bsky.richtext.facet#tag')
      .map((feature: any) => String(feature.tag || '').trim())
      .filter(Boolean)
  );
  if (discoveredTags.length > 0) {
    record.tags = Array.from(new Set([
      ...(Array.isArray(record.tags) ? record.tags : []),
      ...discoveredTags,
    ])).slice(0, 8);
  }
}
