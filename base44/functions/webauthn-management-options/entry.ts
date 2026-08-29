// webauthn-management-options — issues a short-lived WebAuthn challenge for
// destructive security-factor management (for example removing a passkey).
// Requires an authenticated session, but the session alone is not sufficient:
// the caller must complete a fresh authenticator assertion against this challenge.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { generateAuthenticationOptions } from 'npm:@simplewebauthn/server@10';
import { issueWebAuthnChallenge, getRpConfig, base64UrlToUint8Array } from '../../shared/webauthn.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rpConfig = getRpConfig(req);
    if (!rpConfig) return Response.json({ error: 'Could not determine origin' }, { status: 400 });

    const creds = await base44.asServiceRole.entities.WebAuthnCredential
      .filter({ user_id: user.id }, '-created_date', 100)
      .catch(() => []);
    const allowCredentials = (creds || [])
      .filter((c: any) => c.credential_id)
      .map((c: any) => ({ id: c.credential_id, type: 'public-key' as const }));

    if (!allowCredentials.length) {
      return Response.json({ error: 'No security key is registered on this account.' }, { status: 400 });
    }

    const secret = process.env.BACKEND_FUNCTION_SECRET;
    if (!secret) return Response.json({ error: 'Security service is not configured.' }, { status: 500 });

    const { challenge, signature } = await issueWebAuthnChallenge(
      base44.asServiceRole,
      secret,
      'management',
      user.id,
      rpConfig,
    );

    const options = await generateAuthenticationOptions({
      rpID: rpConfig.rpId,
      challenge: base64UrlToUint8Array(challenge),
      allowCredentials,
      userVerification: 'required',
    });

    return Response.json({ options, challenge_signature: signature });
  } catch (error: any) {
    console.error('webauthn-management-options error:', error?.message || error);
    return Response.json({ error: 'Could not start security verification.' }, { status: 500 });
  }
}
