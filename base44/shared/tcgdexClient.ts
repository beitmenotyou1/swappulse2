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