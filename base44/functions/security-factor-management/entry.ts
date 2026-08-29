// security-factor-management — backend-only mutations for TOTP/WebAuthn
// security factors. Direct browser writes to WebAuthnCredential and protected
// User security fields are blocked by schema RLS.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10';
import { verifyActionToken } from '../../shared/appPasswordCrypto.ts';
import { consumeWebAuthnChallenge, getRpConfig, base64UrlToUint8Array } from '../../shared/webauthn.ts';
import { timingSafeEqual } from '../../shared/cryptoCompare.ts';
import {
  generateTotp,
  TOTP_RATE_LIMIT_MAX,
  TOTP_RATE_LIMIT_WINDOW_MS,
  getTotpRateLimit,
  recordTotpFailedAttempt,
  resetTotpRateLimit,
} from '../../shared/totp.ts';

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim().toLowerCase();

    if (action === 'disable_totp') {
      const freshRows = await svc.entities.User.filter({ id: user.id }, '-created_date', 1).catch(() => []);
      const fresh = freshRows?.[0] || user;
      if (!fresh.two_factor_enabled || !fresh.two_factor_secret) {
        return Response.json({ disabled: true, already_disabled: true });
      }
      const code = String(body.code || '').trim();
      if (!/^\d{6}$/.test(code)) return Response.json({ error: 'Enter your current 6-digit authenticator code.' }, { status: 400 });
      const emailKey = String(fresh.email || user.email || user.id).toLowerCase();
      const limit = await getTotpRateLimit(svc, emailKey);
      if (limit) {
        const elapsed = Date.now() - new Date(limit.window_start).getTime();
        if (limit.count >= TOTP_RATE_LIMIT_MAX && elapsed < TOTP_RATE_LIMIT_WINDOW_MS) {
          const retryAfterSec = Math.ceil((TOTP_RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
          return Response.json({ error: 'Too many attempts. Try again later.', retry_after: retryAfterSec }, { status: 429 });
        }
      }
      const expected = await generateTotp(fresh.two_factor_secret);
      if (!timingSafeEqual(code, expected)) {
        await recordTotpFailedAttempt(svc, emailKey);
        return Response.json({ error: 'Invalid authenticator code.' }, { status: 400 });
      }
      await resetTotpRateLimit(svc, emailKey);
      await svc.entities.User.update(user.id, { two_factor_enabled: false, two_factor_secret: '' });
      return Response.json({ disabled: true });
    }

    if (action === 'rename_webauthn') {
      const credentialId = String(body.credential_id || '').trim();
      const label = String(body.label || '').trim().slice(0, 60);
      if (!credentialId || !label) return Response.json({ error: 'Credential and label are required.' }, { status: 400 });
      const rows = await svc.entities.WebAuthnCredential.filter({ id: credentialId, user_id: user.id }, '-created_date', 1).catch(() => []);
      const cred = rows?.[0];
      if (!cred) return Response.json({ error: 'Security key not found.' }, { status: 404 });
      await svc.entities.WebAuthnCredential.update(cred.id, { label });
      return Response.json({ renamed: true, label });
    }

    if (action === 'remove_webauthn') {
      const targetCredentialId = String(body.credential_id || '').trim();
      const assertion = body.assertion;
      const challenge = String(body.challenge || '');
      const challengeSignature = String(body.challenge_signature || '');
      if (!targetCredentialId || !assertion || !challenge || !challengeSignature) {
        return Response.json({ error: 'Fresh security-key verification is required.' }, { status: 400 });
      }
      const rpConfig = getRpConfig(req);
      if (!rpConfig) return Response.json({ error: 'Could not determine origin.' }, { status: 400 });
      const secret = process.env.BACKEND_FUNCTION_SECRET;
      if (!secret) return Response.json({ error: 'Security service is not configured.' }, { status: 500 });

      const challengeOk = await consumeWebAuthnChallenge(
        svc,
        secret,
        challenge,
        challengeSignature,
        'management',
        user.id,
        rpConfig,
      );
      if (!challengeOk) return Response.json({ error: 'Security verification expired. Try again.' }, { status: 403 });

      const assertedId = String(assertion.id || '');
      const assertingRows = await svc.entities.WebAuthnCredential
        .filter({ user_id: user.id, credential_id: assertedId }, '-created_date', 1)
        .catch(() => []);
      const asserting = assertingRows?.[0];
      if (!asserting) return Response.json({ error: 'Security key verification failed.' }, { status: 400 });

      const verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge: challenge,
        expectedOrigin: rpConfig.origin,
        expectedRPID: rpConfig.rpId,
        authenticator: {
          credentialID: asserting.credential_id,
          credentialPublicKey: base64UrlToUint8Array(asserting.public_key),
          counter: asserting.counter || 0,
          transports: asserting.transports || [],
        },
      });
      if (!verification.verified) return Response.json({ error: 'Security key verification failed.' }, { status: 400 });
      const newCounter = verification.authenticationInfo?.newCounter;
      await svc.entities.WebAuthnCredential.update(asserting.id, {
        counter: typeof newCounter === 'number' ? newCounter : (asserting.counter || 0),
      });

      const targets = await svc.entities.WebAuthnCredential
        .filter({ id: targetCredentialId, user_id: user.id }, '-created_date', 1)
        .catch(() => []);
      const target = targets?.[0];
      if (!target) return Response.json({ error: 'Security key not found.' }, { status: 404 });
      await svc.entities.WebAuthnCredential.delete(target.id);
      const remaining = await svc.entities.WebAuthnCredential.filter({ user_id: user.id }, '-created_date', 2).catch(() => []);
      if (!remaining?.length) await svc.entities.User.update(user.id, { webauthn_enabled: false });
      return Response.json({ removed: true, remaining: remaining?.length || 0 });
    }

    if (action === 'authorize_enrollment') {
      const token = String(body.management_token || '').trim();
      const verdict = await verifyActionToken(token, 'security-factor-management', user.id);
      if (!verdict.valid) return Response.json({ error: 'Fresh email verification is required.' }, { status: 403 });
      return Response.json({ authorized: true });
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('security-factor-management error:', error?.message || error);
    return Response.json({ error: 'Security-factor change failed.' }, { status: 500 });
  }
}
