// webauthn-reg-options — generates WebAuthn registration options for the
// authenticated user. Sensitive credential registration requires a recent
// security-management step-up token in addition to the active session.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { generateRegistrationOptions } from 'npm:@simplewebauthn/server@10';
import { issueWebAuthnChallenge, getRpConfig, base64UrlToUint8Array } from '../../shared/webauthn.ts';
import { verifyActionToken } from '../../shared/appPasswordCrypto.ts';

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const authz = await verifyActionToken(
      String(body.management_token || ''),
      'security_manage',
      user.id,
    );
    if (!authz.valid) {
      return Response.json({ error: 'Fresh security verification required' }, { status: 403 });
    }

    const rpConfig = getRpConfig(req);
    if (!rpConfig) return Response.json({ error: 'Could not determine origin' }, { status: 400 });

    const existing = await base44.asServiceRole.entities.WebAuthnCredential
      .filter({ user_id: user.id }, '-created_date', 100)
      .catch(() => []);

    const excludeCredentials = (existing || [])
      .filter((c: any) => c.credential_id)
      .map((c: any) => ({ id: c.credential_id, type: 'public-key' as const }));

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
      supportedAlgorithmIDs: [-7, -257],
    });

    return Response.json({ options, challenge_signature: signature });
  } catch (error: any) {
    console.error('webauthn-reg-options error', error?.message || error);
    return Response.json({ error: 'Could not start security-key registration' }, { status: 500 });
  }
}
