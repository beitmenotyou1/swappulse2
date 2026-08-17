// Shared hashtag extraction + canonicalisation used by every text surface
// that stores a Post (compose, reply, quote, top-level comment) so hashtags
// aggregate on /hashtag/:tag pages and followed-tag feeds consistently.
// The regex matches the same pattern as RichText rendering
// (# followed by unicode letters/numbers/underscore).

export function extractHashtags(text) {
  const matches = (text || '').match(/#([\p{L}\p{N}_]+)/gu) || [];
  return matches.map((m) => m.slice(1));
}

export function canonicalise(tags) {
  const seen = new Set();
  const out = [];
  for (const t of tags) {
    const c = t.trim().toLowerCase();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

// Convenience: raw hashtags (capped at 10) + their canonical form for a body.
export function hashtagsFromText(text) {
  const hashtags = extractHashtags(text).slice(0, 10);
  return { hashtags, canonical_tags: canonicalise(hashtags) };
}