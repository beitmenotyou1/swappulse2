// webauthn-verify — handles WebAuthn security key authentication during login.
// Called by verify-login-code when the user chooses WebAuthn as their second
// factor. Also called by the frontend to get a challenge before calling
// navigator.credentials.get.
//
// mode 'challenge': takes { email }, generates a challenge, stores it on the
//   user record, and returns the challenge + allowed credentials for
//   navigator.credentials.get. Does NOT require auth (login flow).
// mode 'verify': takes { email, credential_id, authenticator_data,
//   client_data_json, signature } and verifies the assertion against the
//   stored credential's public key. Does NOT require auth (login flow).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  generateChallenge,
  verifyAssertion,
  base64urlDecode,
  getAllowedOrigins,
} from '../../shared/webauthn.ts';

function getOrigin(req: Request): string | null {
  const origin = req.headers.get('Origin');
  if (origin && getAllowedOrigins().includes(origin)) return origin;
  const referer = req.headers.get('Referer');
  if (referer) {
    try {
      const r = new URL(referer);
      const o = `${r.protocol}//${r.host}`;
      if (getAllowedOrigins().includes(o)) return o;
    } catch {}
  }
  return null;
}

function getRpId(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return 'localhost';
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    const origin = getOrigin(req);
    if (!origin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'challenge';
    const email = String(body.email || '').toLowerCase().trim();

    if (!email) {
      return Response.json({ error: 'Email required' }, { status: 400 });
    }

    const users = await svc.entities.User.filter({ email }, '-created_date', 1);
    if (!users || users.length === 0) {
      // Don't reveal whether the email exists — return a dummy challenge
      return Response.json({
        challenge: generateChallenge(),
        allow_credentials: [],
      });
    }
    const user = users[0];

    if (mode === 'challenge') {
      if (!user.webauthn_enabled) {
        return Response.json({ error: 'WebAuthn not enabled for this account' }, { status: 400 });
      }

      const challenge = generateChallenge();
      await svc.entities.User.update(user.id, { webauthn_challenge: challenge });

      // Get the user's registered credentials
      const creds = await svc.entities.WebAuthnCredential
        .filter({ created_by_id: user.id }, '-created_date', 20)
        .catch(() => []);

      const allowCredentials = (creds || [])
        .filter((c: any) => c.credential_id)
        .map((c: any) => ({
          type: 'public-key',
          id: base64urlDecode(c.credential_id),
          transports: c.transports || [],
        }));

      return Response.json({
        challenge,
        rp_id: getRpId(origin),
        allow_credentials: allowCredentials,
        timeout: 60000,
        user_verification: 'preferred',
      });
    }

    if (mode === 'verify') {
      const { credential_id, authenticator_data, client_data_json, signature } = body;
      if (!credential_id || !authenticator_data || !client_data_json || !signature) {
        return Response.json({ error: 'Missing assertion data' }, { status: 400 });
      }

      // Find the credential by credential_id
      const creds = await svc.entities.WebAuthnCredential
        .filter({ credential_id }, '-created_date', 5)
        .catch(() => []);
      if (!creds || creds.length === 0) {
        return Response.json({ verified: false, error: 'Credential not found' });
      }
      const cred = creds[0];

      // Verify the credential belongs to this user
      if (cred.created_by_id !== user.id) {
        return Response.json({ verified: false, error: 'Credential mismatch' });
      }

      const publicKeyJwk = JSON.parse(cred.public_key_jwk);
      const rpId = getRpId(origin);

      const result = await verifyAssertion(
        authenticator_data,
        client_data_json,
        signature,
        publicKeyJwk,
        user.webauthn_challenge,
        origin,
        rpId,
        cred.counter || 0,
      );

      if (!result.verified) {
        return Response.json({ verified: false, error: result.error || 'Verification failed' });
      }

      // Update the counter and clear the challenge
      await svc.entities.WebAuthnCredential.update(cred.id, { counter: result.counter }).catch(() => {});
      await svc.entities.User.update(user.id, { webauthn_challenge: '' }).catch(() => {});

      return Response.json({ verified: true });
    }

    return Response.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error: any) {
    console.error('webauthn-verify error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}