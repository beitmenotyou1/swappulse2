import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import QRCode from 'npm:qrcode@1.5.4';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Rate limit for setup-2fa (secret generation spam prevention).
// 5 requests per 15-minute window per user.
const SETUP_RATE_LIMIT_MAX = 5;
const SETUP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const SETUP_RATE_LIMIT_KEY = (userId: string) => `2fa-setup:${userId}`;

async function getSetupRateLimit(svc: any, userId: string) {
  const existing = await svc.entities.AuthRateLimit
    .filter({ email: SETUP_RATE_LIMIT_KEY(userId) }, '-created_date', 1).catch(() => []);
  return existing[0] || null;
}

async function recordSetupAttempt(svc: any, userId: string): Promise<number> {
  const key = SETUP_RATE_LIMIT_KEY(userId);
  const now = new Date().toISOString();
  const existing = await getSetupRateLimit(svc, userId);
  if (!existing) {
    await svc.entities.AuthRateLimit.create({ email: key, count: 1, window_start: now, last_request_at: now });
    return 1;
  }
  const elapsed = Date.now() - new Date(existing.window_start).getTime();
  if (elapsed >= SETUP_RATE_LIMIT_WINDOW_MS) {
    await svc.entities.AuthRateLimit.update(existing.id, { count: 1, window_start: now, last_request_at: now });
    return 1;
  }
  const newCount = (existing.count || 0) + 1;
  await svc.entities.AuthRateLimit.update(existing.id, { count: newCount, last_request_at: now });
  return newCount;
}

function base32Encode(buffer: Uint8Array): string {
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return result;
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const secretBytes = new Uint8Array(20);
  crypto.getRandomValues(secretBytes);
  const secret = base32Encode(secretBytes);

  const issuer = 'SwapPulse';
  const label = encodeURIComponent(`${issuer}:${user.email}`);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  // Generate the QR code locally as a base64 data URI so the TOTP secret never
  // leaves the application boundary (avoids sending it to a third-party QR API).
  const qrDataUri = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 200 });

  return Response.json({
    secret,
    otpauth_url: otpauthUrl,
    qr_data_uri: qrDataUri,
  });
}