import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getActiveSuspension } from '../../shared/enforcement.ts';
import { timingSafeEqual } from '../../shared/cryptoCompare.ts';
import { signActionToken } from '../../shared/appPasswordCrypto.ts';
import {
  generateTotp,
  TOTP_RATE_LIMIT_MAX,
  TOTP_RATE_LIMIT_WINDOW_MS,
  getTotpRateLimit,
  recordTotpFailedAttempt,
  resetTotpRateLimit,
} from '../../shared/totp.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    const code = (body.code || '').trim();
    if (!email || !code) return Response.json({ error: 'Email and code are required' }, { status: 400 });

    // Find the active (unused, unexpired) code for this email
    const codes = await svc.entities.LoginCode.filter({ email, used: false }, '-created_date', 5);
    const now = new Date();
    const active = (codes || []).find((c) => new Date(c.expires_at) > now);

    if (!active) {
      return Response.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // Wrong code: increment failed attempts, lock (delete) after 5 failures
    if (!timingSafeEqual(active.code, code)) {
      const attempts = (active.failed_attempts || 0) + 1;
      if (attempts >= 5) {
        await svc.entities.LoginCode.delete(active.id).catch(() => {});
        return Response.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 400 });
      }
      await svc.entities.LoginCode.update(active.id, { failed_attempts: attempts }).catch(() => {});
      return Response.json({ error: 'Invalid code' }, { status: 400 });
    }

    // Find user
    const users = await svc.entities.User.filter({ email }, '-created_date', 1);
    if (!users || users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    const user = users[0];

    // Check suspension BEFORE marking the code used — a suspended user's code
    // shouldn't be consumed so they can retry once reinstated.
    const suspension = await getActiveSuspension(svc, user.id);
    if (suspension) {
      return Response.json({
        suspended: true,
        reason: suspension.suspension_reason || 'Your account has been suspended.',
        suspended_until: suspension.suspended_until || null,
      });
    }

    // 2FA gate: if the user has any second factor enabled (TOTP and/or
    // WebAuthn), the second factor MUST be verified before login_key is
    // released. The methods array tells the frontend which challenge UIs
    // to show. TOTP is verified here; WebAuthn is verified by the separate
    // webauthn-verify-auth function (called by the frontend after the
    // browser produces an assertion).
    const hasTotp = user.two_factor_enabled && user.two_factor_secret;
    const hasWebAuthn = user.webauthn_enabled;
    if (hasTotp || hasWebAuthn) {
      const methods: string[] = [];
      if (hasTotp) methods.push('totp');
      if (hasWebAuthn) methods.push('webauthn');

      const totpCode = (body.two_factor_code || '').trim();
      if (!totpCode) {
        // First factor (email OTP) verified — prompt for the second factor.
        // Don't consume the email code yet so the user can retry.
        return Response.json({ requires_2fa: true, methods });
      }

      // Only verify TOTP here; WebAuthn is handled by webauthn-verify-auth.
      if (!hasTotp) {
        return Response.json({ error: 'Use your security key to authenticate.' }, { status: 400 });
      }

      // Rate limit TOTP brute-force attempts (same window as verify-2fa).
      const limit = await getTotpRateLimit(svc, email);
      if (limit) {
        const elapsed = Date.now() - new Date(limit.window_start).getTime();
        if (limit.count >= TOTP_RATE_LIMIT_MAX && elapsed < TOTP_RATE_LIMIT_WINDOW_MS) {
          const retryAfterSec = Math.ceil((TOTP_RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
          return Response.json({ error: 'Too many attempts. Try again later.', retry_after: retryAfterSec }, { status: 429 });
        }
      }

      const expectedTotp = await generateTotp(user.two_factor_secret);
      if (!timingSafeEqual(totpCode, expectedTotp)) {
        await recordTotpFailedAttempt(svc, email);
        return Response.json({ error: 'Invalid 2FA code' }, { status: 400 });
      }
      await resetTotpRateLimit(svc, email);
    }

    // Mark the first-factor code used before issuing a login or setup result.
    try {
      await svc.entities.LoginCode.update(active.id, { used: true });
    } catch (e) {
      console.error('verify-login-code: failed to mark code as used:', e?.message || e);
      return Response.json({ error: 'Could not consume login code. Please request a new code.' }, { status: 500 });
    }

    // Passwordless bridge recovery is allowed only after all configured factors
    // above have passed. The short-lived capability binds setup to this exact
    // Base44 user + email, so a reset token cannot be used to rewrite another
    // account's persistent login_key.
    if (!user.login_key) {
      const setupToken = await signActionToken({
        userId: user.id,
        action: 'login_key_setup',
        targetId: email,
        ttlMs: 30 * 60 * 1000,
      });
      return Response.json({ needs_setup: true, setup_token: setupToken });
    }

    return Response.json({ login_key: user.login_key });
  } catch (error) {
    console.error('verify-login-code error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}