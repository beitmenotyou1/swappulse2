import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { timingSafeEqual } from '../../shared/cryptoCompare.ts';
import { verifyActionToken } from '../../shared/appPasswordCrypto.ts';
import {
  generateTotp,
  TOTP_RATE_LIMIT_MAX,
  TOTP_RATE_LIMIT_WINDOW_MS,
  getTotpRateLimit,
  recordTotpFailedAttempt,
  resetTotpRateLimit,
} from '../../shared/totp.ts';

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const mode = body.mode || 'verify';

  try {
    if (mode === 'check') {
      // This unauthenticated status-probe used to reveal whether an arbitrary
      // email had TOTP enabled. The login flow no longer uses it, so fail closed.
      return Response.json({ error: 'Unsupported mode' }, { status: 400 });
    }

    if (mode === 'setup') {
      // Enabling a new second factor is a persistence-sensitive security change:
      // require a fresh email step-up token, not merely an existing session.
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const { secret, code, management_token } = body;
      if (!secret || !code || !management_token) return Response.json({ error: 'Fresh security verification is required' }, { status: 400 });
      const authz = await verifyActionToken(String(management_token), 'security-factor-management', user.id);
      if (!authz.valid) return Response.json({ error: 'Fresh security verification is required' }, { status: 403 });
      const expected = await generateTotp(secret);
      if (!timingSafeEqual(code, expected)) return Response.json({ verified: false, error: 'Invalid code' });
      await base44.asServiceRole.entities.User.update(user.id, { two_factor_enabled: true, two_factor_secret: secret });
      return Response.json({ verified: true });
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