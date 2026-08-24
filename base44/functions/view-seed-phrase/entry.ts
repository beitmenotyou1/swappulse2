// view-seed-phrase — decrypts and returns the 24-word mnemonic for the
// user's custodial wallet. Requires unlock verification (passkey assertion
// or PIN) before decrypting. The mnemonic is always encrypted with the
// server encryption key, so it can be recovered regardless of whether the
// wallet is passkey-gated or PIN-gated.
//
// Body: { unlockCredential: { type: 'passkey', assertion, challenge, challenge_signature } | { type: 'pin', pin } }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10';
import { verifySignedChallenge, getRpConfig } from '../../shared/webauthn.ts';
import { decryptMnemonic, verifyPin } from '../../shared/walletCrypto.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { unlockCredential } = body;
    if (!unlockCredential) {
      return Response.json({ error: 'Unlock credential required' }, { status: 400 });
    }

    // Find the user's active custodial wallet
    const wallets = await base44.entities.CustodialWallet.filter({ did, active: true });
    if (!wallets.length) {
      return Response.json({ error: 'No custodial wallet found' }, { status: 404 });
    }
    const wallet = wallets[0];

    // Verify the unlock credential
    if (unlockCredential.type === 'passkey') {
      const { assertion, challenge, challenge_signature } = unlockCredential;
      if (!assertion || !challenge || !challenge_signature) {
        return Response.json({ error: 'Missing passkey assertion data' }, { status: 400 });
      }

      const rpConfig = getRpConfig(req);
      if (!rpConfig) return Response.json({ error: 'Could not determine origin' }, { status: 400 });

      const valid = await verifySignedChallenge(
        process.env.BACKEND_FUNCTION_SECRET!,
        challenge,
        challenge_signature,
      );
      if (!valid) return Response.json({ error: 'Invalid or expired challenge' }, { status: 403 });

      // Look up the credential
      const credentialId = assertion.id;
      const creds = await base44.asServiceRole.entities.WebAuthnCredential
        .filter({ user_id: user.id, credential_id: credentialId }, '-created_date', 1)
        .catch(() => []);
      if (!creds || creds.length === 0) {
        return Response.json({ error: 'Credential not found' }, { status: 400 });
      }
      const credential = creds[0];

      const verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge: challenge,
        expectedOrigin: rpConfig.origin,
        expectedRPID: rpConfig.rpId,
        authenticator: {
          credentialID: credential.credential_id,
          credentialPublicKey: credential.public_key,
          counter: credential.counter || 0,
          transports: credential.transports || [],
        },
      });

      if (!verification.verified) {
        return Response.json({ error: 'Passkey verification failed' }, { status: 403 });
      }

      // Update counter
      await base44.asServiceRole.entities.WebAuthnCredential.update(credential.id, {
        counter: verification.authenticationInfo?.newCounter || credential.counter + 1,
      });
    } else if (unlockCredential.type === 'pin') {
      const { pin } = unlockCredential;
      if (!pin) return Response.json({ error: 'PIN required' }, { status: 400 });
      const valid = await verifyPin(wallet, pin);
      if (!valid) return Response.json({ error: 'Incorrect PIN' }, { status: 403 });
    } else {
      return Response.json({ error: 'Invalid unlock credential type' }, { status: 400 });
    }

    // Decrypt and return the mnemonic
    const mnemonic = await decryptMnemonic(wallet);

    return Response.json({ mnemonic });
  } catch (error: any) {
    console.error('view-seed-phrase error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}