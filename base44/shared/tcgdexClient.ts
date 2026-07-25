// Shared TCGDex client + rate limiter - §7.1 / §7.5
// Community-funded free API: throttle to 10 requests/second.
export const TCGDEX_BASE = 'https://api.tcgdex.net/v2/en';

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

/** Fetch a TCGDex v2 (English) endpoint and return parsed JSON. */
export async function fetchTcgdex(path: string): Promise<any> {
  const res = await fetch(`${TCGDEX_BASE}${path}`, {
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