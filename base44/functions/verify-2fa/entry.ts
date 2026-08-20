import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { timingSafeEqual } from '../../shared/cryptoCompare.ts';
import {
  generateTotp,
  TOTP_RATE_LIMIT_MAX,
  TOTP_RATE_LIMIT_WINDOW_MS,
  getTotpRateLimit,
  recordTotpFailedAttempt,
  resetTotpRateLimit,
} from '../../shared/totp.ts';
import { generateBackupCodes, persistBackupCodes } from '../../shared/backupCodes.ts';

// Rate limit for the 'check' mode (2FA status enumeration prevention).
// 10 checks per 15-minute window per email.
const CHECK_RATE_LIMIT_MAX = 10;
const CHECK_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const CHECK_RATE_LIMIT_KEY = (email: string) => `2fa-check:${email}`;

async function getCheckRateLimit(svc: any, email: string) {
  const existing = await svc.entities.AuthRateLimit
    .filter({ email: CHECK_RATE_LIMIT_KEY(email) }, '-created_date', 1).catch(() => []);
  return existing[0] || null;
}

async function recordCheckAttempt(svc: any, email: string): Promise<number> {
  const key = CHECK_RATE_LIMIT_KEY(email);
  const now = new Date().toISOString();
  const existing = await getCheckRateLimit(svc, email);
  if (!existing) {
    await svc.entities.AuthRateLimit.create({ email: key, count: 1, window_start: now, last_request_at: now });
    return 1;
  }
  const elapsed = Date.now() - new Date(existing.window_start).getTime();
  if (elapsed >= CHECK_RATE_LIMIT_WINDOW_MS) {
    await svc.entities.AuthRateLimit.update(existing.id, { count: 1, window_start: now, last_request_at: now });
    return 1;
  }
  const newCount = (existing.count || 0) + 1;
  await svc.entities.AuthRateLimit.update(existing.id, { count: newCount, last_request_at: now });
  return newCount;
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const mode = body.mode || 'verify';

  try {
    if (mode === 'check') {
      // Check if 2FA is required for an email (login flow, no auth needed).
      // Rate-limited to prevent 2FA-status enumeration.
      const email = String(body.email || '').toLowerCase().trim();
      if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

      const limit = await getCheckRateLimit(base44.asServiceRole, email);
      if (limit) {
        const elapsed = Date.now() - new Date(limit.window_start).getTime();
        if (limit.count >= CHECK_RATE_LIMIT_MAX && elapsed < CHECK_RATE_LIMIT_WINDOW_MS) {
          const retryAfterSec = Math.ceil((CHECK_RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
          return Response.json({ error: 'Too many requests. Try again later.', retry_after: retryAfterSec }, { status: 429 });
        }
      }
      await recordCheckAttempt(base44.asServiceRole, email);

      const users = await base44.asServiceRole.entities.User.filter({ email });
      if (users.length === 0) return Response.json({ requires_2fa: false });
      const u = users[0];
      return Response.json({
        requires_2fa: !!(u.two_factor_enabled || u.webauthn_enabled),
        available_methods: [
          ...(u.two_factor_enabled ? ['totp'] : []),
          ...(u.webauthn_enabled ? ['webauthn'] : []),
          'backup_code',
        ],
      });
    }

    if (mode === 'setup') {
      // Verify code against provided secret, then save (auth required).
      // Also generates one-time backup recovery codes on first enable.
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const { secret, code } = body;
      if (!secret || !code) return Response.json({ error: 'Secret and code required' }, { status: 400 });
      const expected = await generateTotp(secret);
      if (!timingSafeEqual(code, expected)) return Response.json({ verified: false, error: 'Invalid code' });
      await base44.auth.updateMe({ two_factor_enabled: true, two_factor_secret: secret });

      // Generate backup codes if the user doesn't already have any
      const existingCodes = await base44.asServiceRole.entities.BackupCode
        .filter({ used: false }, '-created_date', 100)
        .catch(() => []);
      const hasOwnCodes = (existingCodes || []).some((c: any) => c.created_by_id === user.id);
      let backup_codes: string[] = [];
      if (!hasOwnCodes) {
        backup_codes = generateBackupCodes();
        await persistBackupCodes(base44.asServiceRole, user.id, backup_codes);
      }

      return Response.json({ verified: true, backup_codes });
    }

    // Default: verify TOTP for login (no auth, lookup by email)
    const { email, code } = body;
    if (!email || !code) return Response.json({ error: 'Email and code required' }, { status: 400 });
    const svc = base44.asServiceRole;
    const normalizedEmail = String(email).toLowerCase().trim();

    // Rate limit: block brute-force of 6-digit TOTP codes.
    const limit = await getTotpRateLimit(svc, normalizedEmail);
    if (limit) {
      const elapsed = Date.now() - new Date(limit.window_start).getTime();
      if (limit.count >= TOTP_RATE_LIMIT_MAX && elapsed < TOTP_RATE_LIMIT_WINDOW_MS) {
        const retryAfterSec = Math.ceil((TOTP_RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
        return Response.json({ error: 'Too many attempts. Try again later.', retry_after: retryAfterSec }, { status: 429 });
      }
    }

    const users = await svc.entities.User.filter({ email: normalizedEmail });
    if (users.length === 0) return Response.json({ verified: false, error: 'User not found' });
    const user = users[0];
    if (!user.two_factor_enabled || !user.two_factor_secret) {
      return Response.json({ verified: true });
    }
    const expected = await generateTotp(user.two_factor_secret);
    if (!timingSafeEqual(code, expected)) {
      await recordTotpFailedAttempt(svc, normalizedEmail);
      return Response.json({ verified: false, error: 'Invalid 2FA code' });
    }
    await resetTotpRateLimit(svc, normalizedEmail);
    return Response.json({ verified: true });
  } catch (e) {
    console.error('verify-2fa error', e?.message || e);
    return Response.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}