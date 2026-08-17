// Resolves the canonical application origin for payment/checkout callback URLs.
// The X-Base44-App-Url header is caller-controlled and must NOT be trusted
// blindly for sensitive redirects (Wix thank-you / post-flow URLs). We only
// accept it when its origin matches an explicit allowlist of authorised
// SwapPulse domains; otherwise we fall back to the WIX_CHECKOUT_APP_URL env
// var, and finally to the hardcoded production origin. Paths and query
// strings are always stripped — only the origin is ever returned.

const ALLOWED_ORIGINS = new Set([
  'https://swappulse.org',
  'https://www.swappulse.org',
  // Local / preview origins used during development.
  'http://localhost:3000',
  'http://localhost:5173',
]);

const FALLBACK_ORIGIN = 'https://swappulse.org';

function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export function resolveAppUrl(req: Request): string {
  const headerVal = req.headers.get('X-Base44-App-Url');
  if (headerVal) {
    const origin = originOf(headerVal);
    if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
  }
  const envVal = Deno.env.get('WIX_CHECKOUT_APP_URL');
  if (envVal) {
    const origin = originOf(envVal);
    if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
  }
  return FALLBACK_ORIGIN;
}