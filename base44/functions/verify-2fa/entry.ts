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

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const mode = body.mode || 'verify';

  try {
    if (mode === 'check') {
      // Check if 2FA is required for an email (login flow, no auth needed).
      // Rate-limited to prevent email/2FA-status enumeration.
      const email = String(body.email || '').toLowerCase().trim();
      if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

      const rlKey = `2fa-check:${email}`;
      const rlRecords = await base44.asServiceRole.entities.AuthRateLimit
        .filter({ email: rlKey }, '-created_date', 1).catch(() => []);
      const rl = rlRecords?.[0];
      const now = Date.now();
      if (rl) {
        const elapsed = now - new Date(rl.window_start || rl.created_date).getTime();
        if (elapsed < 3_600_000 && (rl.count || 0) >= 20) {
          return Response.json({ error: 'Too many requests' }, { status: 429 });
        }
        await base44.asServiceRole.entities.AuthRateLimit.update(rl.id, {
          last_request_at: new Date(now).toISOString(),
          count: elapsed < 3_600_000 ? (rl.count || 0) + 1 : 1,
          window_start: elapsed < 3_600_000 ? rl.window_start : new Date(now).toISOString(),
        }).catch(() => {});
      } else {
        await base44.asServiceRole.entities.AuthRateLimit.create({
          email: rlKey,
          last_request_at: new Date(now).toISOString(),
          window_start: new Date(now).toISOString(),
          count: 1,
        }).catch(() => {});
      }

      const users = await base44.asServiceRole.entities.User.filter({ email });
      if (users.length === 0) return Response.json({ requires_2fa: false });
      return Response.json({ requires_2fa: !!users[0].two_factor_enabled });
    }

    if (mode === 'setup') {
      // Verify code against provided secret, then save (auth required)
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const { secret, code } = body;
      if (!secret || !code) return Response.json({ error: 'Secret and code required' }, { status: 400 });
      const expected = await generateTotp(secret);
      if (!timingSafeEqual(code, expected)) return Response.json({ verified: false, error: 'Invalid code' });
      await base44.auth.updateMe({ two_factor_enabled: true, two_factor_secret: secret });
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