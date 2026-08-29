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

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const mode = String(body.mode || 'verify');

  try {
    // The old unauthenticated "check" mode leaked whether an arbitrary email
    // had TOTP enabled and is no longer used by the login flow.
    if (mode === 'check') {
      return Response.json({ error: 'Unsupported operation' }, { status: 404 });
    }

    if (mode === 'setup') {
      // Adding a new authenticator changes the account's future login policy,
      // so require a recent email step-up capability in addition to the session.
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const secret = String(body.secret || '').trim();
      const code = String(body.code || '').trim();
      const authz = await verifyActionToken(
        String(body.management_token || ''),
        'security_manage',
        user.id,
      );
      if (!authz.valid) {
        return Response.json({ error: 'Fresh security verification required' }, { status: 403 });
      }
      if (!secret || !/^\d{6}$/.test(code)) {
        return Response.json({ error: 'Secret and 6-digit code required' }, { status: 400 });
      }
      const expected = await generateTotp(secret);
      if (!(await timingSafeEqual(code, expected))) {
        return Response.json({ verified: false, error: 'Invalid code' }, { status: 400 });
      }
      await base44.asServiceRole.entities.User.update(user.id, {
        two_factor_enabled: true,
        two_factor_secret: secret,
      });
      return Response.json({ verified: true });
    }

    // Default login verification. The passwordless login path normally calls
    // verify-login-code directly; keep this for compatibility with any older UI.
    const email = String(body.email || '').toLowerCase().trim();
    const code = String(body.code || '').trim();
    if (!email || !code) return Response.json({ error: 'Email and code required' }, { status: 400 });
    const svc = base44.asServiceRole;

    const limit = await getTotpRateLimit(svc, email);
    if (limit) {
      const elapsed = Date.now() - new Date(limit.window_start).getTime();
      if (limit.count >= TOTP_RATE_LIMIT_MAX && elapsed < TOTP_RATE_LIMIT_WINDOW_MS) {
        const retryAfterSec = Math.ceil((TOTP_RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
        return Response.json(
          { error: 'Too many attempts. Try again later.', retry_after: retryAfterSec },
          { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
        );
      }
    }

    const users = await svc.entities.User.filter({ email }, '-created_date', 1).catch(() => []);
    if (!users.length) return Response.json({ verified: false, error: 'Invalid credentials' }, { status: 401 });
    const user = users[0];
    if (!user.two_factor_enabled || !user.two_factor_secret) {
      return Response.json({ verified: true });
    }
    const expected = await generateTotp(user.two_factor_secret);
    if (!(await timingSafeEqual(code, expected))) {
      await recordTotpFailedAttempt(svc, email);
      return Response.json({ verified: false, error: 'Invalid 2FA code' }, { status: 400 });
    }
    await resetTotpRateLimit(svc, email);
    return Response.json({ verified: true });
  } catch (e: any) {
    console.error('verify-2fa error', e?.message || e);
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
