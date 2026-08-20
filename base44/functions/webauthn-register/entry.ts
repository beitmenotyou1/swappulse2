// webauthn-register — handles WebAuthn security key registration.
// mode 'start': generates a challenge, stores it on the user record, and
//   returns the PublicKeyCredentialCreationOptions for navigator.credentials.create.
// mode 'finish': verifies the attestation against the stored challenge, extracts
//   the credential ID and public key, and persists a WebAuthnCredential record.
// Both modes require authentication (user must be logged in to register a key).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  generateChallenge,
  parseAttestation,
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
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'start';

    if (mode === 'start') {
      const challenge = generateChallenge();
      const rpId = getRpId(origin);

      // Store challenge on user record for verification in 'finish' step
      await base44.auth.updateMe({ webauthn_challenge: challenge });

      // Get existing credential IDs to exclude (prevent re-registration)
      const existingCreds = await base44.entities.WebAuthnCredential
        .list('-created_date', 20)
        .catch(() => []);

      const excludeCredentials = (existingCreds || [])
        .filter((c: any) => c.credential_id)
        .map((c: any) => ({
          type: 'public-key',
          id: base64urlDecode(c.credential_id),
          transports: c.transports || [],
        }));

      return Response.json({
        challenge,
        rp: { name: 'SwapPulse', id: rpId },
        user: {
          id: new TextEncoder().encode(user.id),
          name: user.username || user.email,
          displayName: user.display_name || user.username || user.email,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        timeout: 60000,
        attestation: 'none',
        excludeCredentials,
        authenticatorSelection: {
          authenticatorAttachment: 'cross-platform',
          userVerification: 'preferred',
          residentKey: 'discouraged',
        },
      });
    }

    if (mode === 'finish') {
      const { attestation_object, client_data_json, label, transports } = body;
      if (!attestation_object || !client_data_json) {
        return Response.json({ error: 'Missing attestation data' }, { status: 400 });
      }

      // Verify the challenge in clientDataJSON matches the stored challenge
      const clientDataBytes = base64urlDecode(client_data_json);
      const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
      if (clientData.type !== 'webauthn.create') {
        return Response.json({ error: 'Invalid client data type' }, { status: 400 });
      }
      if (clientData.challenge !== user.webauthn_challenge) {
        return Response.json({ error: 'Challenge mismatch' }, { status: 400 });
      }
      if (clientData.origin !== origin) {
        return Response.json({ error: 'Origin mismatch' }, { status: 400 });
      }

      // Parse the attestation and extract credential ID + public key
      const parsed = parseAttestation(attestation_object);

      // Check for duplicate credential ID
      const existing = await base44.entities.WebAuthnCredential
        .filter({ credential_id: parsed.credentialId }, '-created_date', 1)
        .catch(() => []);
      if (existing && existing.length > 0) {
        return Response.json({ error: 'This security key is already registered' }, { status: 409 });
      }

      // Store the credential
      await base44.entities.WebAuthnCredential.create({
        credential_id: parsed.credentialId,
        public_key_jwk: JSON.stringify(parsed.publicKeyJwk),
        counter: parsed.counter,
        label: label || 'Security Key',
        transports: transports || [],
        algorithm: parsed.algorithm,
      });

      // Mark webauthn_enabled on the user and clear the challenge
      await base44.auth.updateMe({
        webauthn_enabled: true,
        webauthn_challenge: '',
      });

      return Response.json({ success: true, credential_id: parsed.credentialId });
    }

    return Response.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error: any) {
    console.error('webauthn-register error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}