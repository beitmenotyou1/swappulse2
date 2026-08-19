// Shared TOTP (RFC 6238) utilities — used by verify-2fa and verify-login-code
// so TOTP generation/verification is defined once and reused.

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(str: string): Uint8Array {
  const cleaned = str.replace(/=+$/, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of cleaned) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

export async function generateTotp(secret: string, period = 30, digits = 6): Promise<string> {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / period);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter & 0xffffffff);
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const hmac = await crypto.subtle.sign('HMAC', cryptoKey, buffer);
  const hmacBytes = new Uint8Array(hmac);
  const offset = hmacBytes[hmacBytes.length - 1] & 0xf;
  const code = ((hmacBytes[offset] & 0x7f) << 24) | (hmacBytes[offset + 1] << 16) | (hmacBytes[offset + 2] << 8) | hmacBytes[offset + 3];
  return (code % 10 ** digits).toString().padStart(digits, '0');
}

// Rate limiting for unauthenticated TOTP verification — blocks brute-force
// of 6-digit codes. Uses AuthRateLimit with a prefixed email key so it doesn't
// collide with the login-code rate limits. 5 attempts per 15-minute window.
export const TOTP_RATE_LIMIT_MAX = 5;
export const TOTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const TOTP_RATE_LIMIT_KEY = (email: string) => `2fa-verify:${email}`;

export async function getTotpRateLimit(svc: any, email: string) {
  const existing = await svc.entities.AuthRateLimit
    .filter({ email: TOTP_RATE_LIMIT_KEY(email) }, '-created_date', 1).catch(() => []);
  return existing[0] || null;
}

export async function recordTotpFailedAttempt(svc: any, email: string): Promise<number> {
  const key = TOTP_RATE_LIMIT_KEY(email);
  const now = new Date().toISOString();
  const existing = await getTotpRateLimit(svc, email);
  if (!existing) {
    await svc.entities.AuthRateLimit.create({ email: key, count: 1, window_start: now, last_request_at: now });
    return 1;
  }
  const elapsed = Date.now() - new Date(existing.window_start).getTime();
  if (elapsed >= TOTP_RATE_LIMIT_WINDOW_MS) {
    await svc.entities.AuthRateLimit.update(existing.id, { count: 1, window_start: now, last_request_at: now });
    return 1;
  }
  const newCount = (existing.count || 0) + 1;
  await svc.entities.AuthRateLimit.update(existing.id, { count: newCount, last_request_at: now });
  return newCount;
}

export async function resetTotpRateLimit(svc: any, email: string): Promise<void> {
  const existing = await getTotpRateLimit(svc, email);
  if (existing) {
    await svc.entities.AuthRateLimit.update(existing.id, { count: 0, window_start: new Date().toISOString() });
  }
}