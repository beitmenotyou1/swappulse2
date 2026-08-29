// webauthn-verify-reg — verifies a WebAuthn attestation response and stores the
// credential. Requires both authentication and a recent security-management
// step-up capability, preventing a stolen session from silently adding a key.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyRegistrationResponse } from 'npm:@simplewebauthn/server@10';
import { consumeWebAuthnChallenge, getRpConfig, uint8ArrayToBase64Url } from '../../shared/webauthn.ts';
import { verifyActionToken } from '../../shared/appPasswordCrypto.ts';

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rpConfig = getRpConfig(req);
    if (!rpConfig) return Response.json({ error: 'Could not determine origin' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { attestation, challenge, challenge_signature } = body;
    const label = String(body.label || 'Security Key').trim().slice(0, 60) || 'Security Key';
    const authz = await verifyActionToken(
      String(body.management_token || ''),
      'security_manage',
      user.id,
    );
    if (!authz.valid) {
      return Response.json({ error: 'Fresh security verification required' }, { status: 403 });
    }
    if (!attestation || !challenge || !challenge_signature) {
      return Response.json({ error: 'Missing attestation or challenge' }, { status: 400 });
    }

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

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    const credentialIdB64 = credentialID;
    const pubKeyB64 = uint8ArrayToBase64Url(credentialPublicKey);

    const dupes = await base44.asServiceRole.entities.WebAuthnCredential
      .filter({ credential_id: credentialIdB64 }, '-created_date', 1)
      .catch(() => []);
    if (dupes?.length) {
      const sameOwner = dupes[0].user_id === user.id;
      if (!sameOwner) return Response.json({ error: 'Security key is already registered' }, { status: 409 });
      return Response.json({
        verified: true,
        credential_id: credentialIdB64,
        label: dupes[0].label || label,
        already_registered: true,
      });
    }

    await base44.asServiceRole.entities.WebAuthnCredential.create({
      credential_id: credentialIdB64,
      public_key: pubKeyB64,
      counter,
      transports: attestation.response?.transports || [],
      label,
      user_id: user.id,
      email: user.email,
      created_at: new Date().toISOString(),
    });
    await base44.asServiceRole.entities.User.update(user.id, { webauthn_enabled: true });

    return Response.json({ verified: true, credential_id: credentialIdB64, label });
  } catch (error: any) {
    console.error('webauthn-verify-reg error', error?.message || error);
    return Response.json({ error: 'Security-key registration failed' }, { status: 500 });
  }
}
