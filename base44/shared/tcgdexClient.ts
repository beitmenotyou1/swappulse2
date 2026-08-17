// Shared TCGDex client + rate limiter - §7.1 / §7.5
// Community-funded free API: throttle to 10 requests/second.
// Multi-language: TCGDex serves per-language catalogs at /v2/{lang}/...
// Supported langs: en, fr, de, it, es, pt, jp, zh, ko (unknown -> en).
export const TCGDEX_LANGS = ['en', 'fr', 'de', 'it', 'es', 'pt', 'jp', 'zh', 'ko'];

export function tcgdexBase(lang = 'en') {
  const l = TCGDEX_LANGS.includes(lang) ? lang : 'en';
  return `https://api.tcgdex.net/v2/${l}`;
}

/**
 * Minimal token-bucket rate limiter for sequential fetches within a single
 * function invocation. Ensures >= 100ms between upstream calls (10 req/s).
 */
export class RateLimiter {
  private last = 0;
  private readonly minInterval = 1000 / 10; // 10 requests/second

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const elapsed = Date.now() - this.last;
    if (elapsed < this.minInterval) {
      await new Promise((r) => setTimeout(r, this.minInterval - elapsed));
    }
    this.last = Date.now();
    return fn();
  }
}

/** Fetch a TCGDex v2 endpoint for the given language and return parsed JSON. */
export async function fetchTcgdex(path: string, lang = 'en'): Promise<any> {
  const res = await fetch(`${tcgdexBase(lang)}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`TCGDex ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

/** Coerce a maybe-number into a stored number or null. */
export function num(v: any): number | null {
  return typeof v === 'number' && isFinite(v) ? v : null;
}

/**
 * Normalize a set ID to TCGDex's canonical format.
 * TCGDex uses leading zeros for single-digit SV sets (sv01, sv02, ...) and
 * ".5" for half-sets (sv04.5, sv06.5). Some stored data uses short forms
 * like "sv4a" (a = .5) or "sv1" (no leading zero). This normalizes them:
 *   sv4a  → sv04.5   (a suffix → .5, pad single digit)
 *   sv1   → sv01     (pad single digit)
 *   sv4   → sv04     (pad single digit)
 *   sv04.5 → sv04.5  (already canonical, no change)
 *   sv10  → sv10     (double-digit, no change)
 *   sv10.5b → sv10.5b (variant suffix, no change)
 */
export function normalizeSetId(setId: string): string {
  if (!setId) return setId;
  let s = String(setId).toLowerCase().trim();
  // Only Scarlet & Violet sets use leading zeros and the "a" → ".5" suffix.
  // SWSH (swsh1), SM (sm1), XY (xy1), BW (bw1) etc. do NOT pad — applying it
  // turns "swsh1" into "swsh01" which 404s on TCGDex.
  if (s.startsWith('sv')) {
    s = s.replace(/^sv(\d+)a$/, 'sv$1.5');      // sv4a → sv4.5
    s = s.replace(/^sv(\d)(\D|$)/, 'sv0$1$2');  // sv4 → sv04, sv4.5 → sv04.5
  }
  return s;
}