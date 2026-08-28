// webauthn-auth-options — generates WebAuthn authentication options for a
// user identified by email. Unauthenticated (login flow). Returns a signed
// challenge plus the PublicKeyCredentialRequestOptions JSON with the user's
// allowed credentials. Does NOT reveal whether the email exists — returns
// an empty allowCredentials list for unknown users so the browser prompt
// fails naturally without leaking account existence.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { generateAuthenticationOptions } from 'npm:@simplewebauthn/server@10';
import { issueWebAuthnChallenge, getRpConfig, base64UrlToUint8Array } from '../../shared/webauthn.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const rpConfig = getRpConfig(req);
    if (!rpConfig) return Response.json({ error: 'Could not determine origin' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

    // Look up user by email (service role — no RLS on this lookup)
    const users = await base44.asServiceRole.entities.User.filter({ email }, '-created_date', 1);
    const user = users && users[0];

    // Get the user's registered credentials (empty if user not found or no keys)
    let allowCredentials: { id: string; type: 'public-key' }[] = [];
    if (user) {
      const creds = await base44.asServiceRole.entities.WebAuthnCredential
        .filter({ user_id: user.id }, '-created_date', 20)
        .catch(() => []);
      allowCredentials = (creds || [])
        .filter((c) => c.credential_id)
        .map((c) => ({
          id: c.credential_id,
          type: 'public-key' as const,
        }));
    }

    const { challenge, signature } = await issueWebAuthnChallenge(
      base44.asServiceRole,
      process.env.BACKEND_FUNCTION_SECRET!,
      'authentication',
      email,
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
    console.error('webauthn-auth-options error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}