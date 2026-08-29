// webauthn-reg-options — generates WebAuthn registration options for the
// authenticated user. Returns a signed challenge (stateless) plus the
// PublicKeyCredentialCreationOptions JSON that the browser passes to
// navigator.credentials.create().

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { generateRegistrationOptions } from 'npm:@simplewebauthn/server@10';
import { issueWebAuthnChallenge, getRpConfig, base64UrlToUint8Array } from '../../shared/webauthn.ts';
import { verifyActionToken } from '../../shared/appPasswordCrypto.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const managementToken = String(body.management_token || '');
    const authz = await verifyActionToken(managementToken, 'security-factor-management', user.id);
    if (!authz.valid) return Response.json({ error: 'Fresh email verification is required.' }, { status: 403 });

    const rpConfig = getRpConfig(req);
    if (!rpConfig) return Response.json({ error: 'Could not determine origin' }, { status: 400 });

    // Get existing credentials to exclude (prevents re-registering the same key)
    const existing = await base44.asServiceRole.entities.WebAuthnCredential
      .filter({ user_id: user.id }, '-created_date', 100)
      .catch(() => []);

    const excludeCredentials = (existing || [])
      .filter((c) => c.credential_id)
      .map((c) => ({
        id: c.credential_id,
        type: 'public-key' as const,
      }));

    const { challenge, signature } = await issueWebAuthnChallenge(
      base44.asServiceRole,
      process.env.BACKEND_FUNCTION_SECRET!,
      'registration',
      user.id,
      rpConfig,
    );

    const options = await generateRegistrationOptions({
      rpName: 'SwapPulse',
      rpID: rpConfig.rpId,
      userID: new TextEncoder().encode(user.id),
      userName: user.email || user.id,
      challenge: base64UrlToUint8Array(challenge),
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    });

    return Response.json({ options, challenge_signature: signature });
  } catch (error: any) {
    console.error('webauthn-reg-options error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}