// webauthn-verify-auth — verifies the WebAuthn assertion response from
// navigator.credentials.get() and returns the user's login_key. Unauthenticated
// (login flow). Checks suspension and 2FA gating consistent with verify-login-code.
//
// Rate limiting: reuses the TOTP rate limit (AuthRateLimit with 2fa-verify: prefix)
// since both are second-factor brute-force vectors on the same endpoint surface.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10';
import { consumeWebAuthnChallenge, getRpConfig, base64UrlToUint8Array } from '../../shared/webauthn.ts';
import { getActiveSuspension } from '../../shared/enforcement.ts';
import {
  TOTP_RATE_LIMIT_MAX,
  TOTP_RATE_LIMIT_WINDOW_MS,
  getTotpRateLimit,
  recordTotpFailedAttempt,
  resetTotpRateLimit,
} from '../../shared/totp.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const { assertion, challenge, challenge_signature } = body;
    if (!email || !assertion || !challenge || !challenge_signature) {
      return Response.json({ error: 'Missing email, assertion, or challenge' }, { status: 400 });
    }

    const rpConfig = getRpConfig(req);
    if (!rpConfig) return Response.json({ error: 'Could not determine origin' }, { status: 400 });

    // Verify challenge authenticity, expiry, origin/RP binding, and consume it
    // so the assertion cannot be replayed.
    const valid = await consumeWebAuthnChallenge(
      svc,
      process.env.BACKEND_FUNCTION_SECRET!,
      challenge,
      challenge_signature,
      'authentication',
      email,
      rpConfig,
    );
    if (!valid) return Response.json({ error: 'Invalid or expired challenge' }, { status: 403 });

    // Find the account and the asserted credential, but do not reveal account
    // existence or account state until after cryptographic verification.
    const users = await svc.entities.User.filter({ email }, '-created_date', 1).catch(() => []);
    const user = users?.[0] || null;
    const credentialId = String(assertion.id || ''); // base64url
    const creds = user
      ? await svc.entities.WebAuthnCredential
          .filter({ user_id: user.id, credential_id: credentialId }, '-created_date', 1)
          .catch(() => [])
      : [];
    const credential = creds?.[0] || null;

    // Rate limit
    const limit = await getTotpRateLimit(svc, email);
    if (limit) {
      const elapsed = Date.now() - new Date(limit.window_start).getTime();
      if (limit.count >= TOTP_RATE_LIMIT_MAX && elapsed < TOTP_RATE_LIMIT_WINDOW_MS) {
        const retryAfterSec = Math.ceil((TOTP_RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
        return Response.json({ error: 'Too many attempts. Try again later.', retry_after: retryAfterSec }, { status: 429 });
      }
    }

    if (!user || !credential) {
      await recordTotpFailedAttempt(svc, email);
      return Response.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge: challenge,
        expectedOrigin: rpConfig.origin,
        expectedRPID: rpConfig.rpId,
        authenticator: {
          credentialID: credential.credential_id,
          credentialPublicKey: base64UrlToUint8Array(credential.public_key),
          counter: credential.counter || 0,
          transports: credential.transports || [],
        },
      });
    } catch {
      verification = { verified: false };
    }

    if (!verification.verified) {
      await recordTotpFailedAttempt(svc, email);
      return Response.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Update the counter (replay detection)
    const newCounter = verification.authenticationInfo?.newCounter;
    await svc.entities.WebAuthnCredential.update(credential.id, {
      counter: typeof newCounter === 'number' ? newCounter : (credential.counter || 0),
    });

    await resetTotpRateLimit(svc, email);

    // Only a proven credential may reveal post-authentication account state.
    const suspension = await getActiveSuspension(svc, user.id);
    if (suspension) {
      return Response.json({
        suspended: true,
        reason: suspension.suspension_reason || 'Your account has been suspended.',
        suspended_until: suspension.suspended_until || null,
      });
    }
    if (!user.login_key) return Response.json({ needs_setup: true });

    return Response.json({ login_key: user.login_key });
  } catch (error: any) {
    console.error('webauthn-verify-auth error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}