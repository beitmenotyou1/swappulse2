// webauthn-verify-reg — verifies the WebAuthn attestation response from
// navigator.credentials.create() and stores the credential. Requires
// authentication. After storing, sets webauthn_enabled=true on the user.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyRegistrationResponse } from 'npm:@simplewebauthn/server@10';
import { consumeWebAuthnChallenge, getRpConfig, uint8ArrayToBase64Url } from '../../shared/webauthn.ts';
import { verifyActionToken } from '../../shared/appPasswordCrypto.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rpConfig = getRpConfig(req);
    if (!rpConfig) return Response.json({ error: 'Could not determine origin' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { attestation, challenge, challenge_signature, label, management_token } = body;
    const authz = await verifyActionToken(String(management_token || ''), 'security-factor-management', user.id);
    if (!authz.valid) return Response.json({ error: 'Fresh email verification is required.' }, { status: 403 });
    if (!attestation || !challenge || !challenge_signature) {
      return Response.json({ error: 'Missing attestation or challenge' }, { status: 400 });
    }

    // Verify challenge authenticity, expiry, origin/RP binding, and consume it.
    const valid = await consumeWebAuthnChallenge(
      base44.asServiceRole,
      process.env.BACKEND_FUNCTION_SECRET!,
      challenge,
      challenge_signature,
      'registration',
      user.id,
      rpConfig,
    );
    if (!valid) return Response.json({ error: 'Invalid or expired challenge' }, { status: 403 });

    const verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge: challenge,
      expectedOrigin: rpConfig.origin,
      expectedRPID: rpConfig.rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return Response.json({ error: 'Registration verification failed' }, { status: 400 });
    }

    const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const credentialIdB64 = credentialID; // already base64url from @simplewebauthn/server
    const pubKeyB64 = uint8ArrayToBase64Url(credentialPublicKey);

    // Check for duplicate credential ID. Account passkeys are intentionally
    // independent from the quarantined legacy custodial-wallet subsystem.
    const dupes = await base44.asServiceRole.entities.WebAuthnCredential
      .filter({ credential_id: credentialIdB64 }, '-created_date', 1)
      .catch(() => []);
    if (dupes && dupes.length) {
      return Response.json({
        verified: true,
        credential_id: credentialIdB64,
        label: label || 'Security Key',
        already_registered: true,
      });
    }

    await base44.asServiceRole.entities.WebAuthnCredential.create({
      credential_id: credentialIdB64,
      public_key: pubKeyB64,
      counter,
      transports: attestation.response?.transports || [],
      label: label || 'Security Key',
      user_id: user.id,
      email: user.email,
      created_at: new Date().toISOString(),
    });

    // Mark user as having WebAuthn enabled
    await base44.asServiceRole.entities.User.update(user.id, { webauthn_enabled: true });

    return Response.json({
      verified: true,
      credential_id: credentialIdB64,
      label: label || 'Security Key',
    });
  } catch (error: any) {
    console.error('webauthn-verify-reg error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}