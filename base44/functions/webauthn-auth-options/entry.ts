// webauthn-auth-options — generates WebAuthn authentication options for a
// user identified by email. Unauthenticated (login flow). Returns a signed
// challenge plus the PublicKeyCredentialRequestOptions JSON with the user's
// allowed credentials. Does NOT reveal whether the email exists — returns
// an empty allowCredentials list for unknown users so the browser prompt
// fails naturally without leaking account existence.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { generateAuthenticationOptions } from 'npm:@simplewebauthn/server@10';
import { issueWebAuthnChallenge, getRpConfig, base64UrlToUint8Array } from '../../shared/webauthn.ts';
import { consumeAuthAttempt } from '../../shared/authThrottle.ts';

function randomCredentialId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const rpConfig = getRpConfig(req);
    if (!rpConfig) return Response.json({ error: 'Could not determine origin' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const throttle = await consumeAuthAttempt(svc, 'webauthn-options', email, {
      maxAttempts: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!throttle.allowed) {
      return Response.json(
        { error: 'Too many authentication attempts. Try again later.', retry_after: throttle.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds || 900) } },
      );
    }

    // Look up user by email (service role — no RLS on this lookup)
    const users = await svc.entities.User.filter({ email }, '-created_date', 1);
    const user = users && users[0];

    // Return a fixed-size allowCredentials list so the options response does
    // not reveal whether the email exists or how many security keys it has.
    // Authenticators simply ignore the random padding IDs.
    const creds = user
      ? await svc.entities.WebAuthnCredential
          .filter({ user_id: user.id }, '-created_date', 20)
          .catch(() => [])
      : [];
    const realIds = (creds || [])
      .filter((c) => c.credential_id)
      .slice(0, 20)
      .map((c) => String(c.credential_id));
    const paddedIds = [...realIds];
    while (paddedIds.length < 20) paddedIds.push(randomCredentialId());
    const allowCredentials: { id: string; type: 'public-key' }[] = paddedIds.map((id) => ({
      id,
      type: 'public-key' as const,
    }));

    const { challenge, signature } = await issueWebAuthnChallenge(
      svc,
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