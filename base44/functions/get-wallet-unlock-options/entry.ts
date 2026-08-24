// get-wallet-unlock-options — returns WebAuthn authentication options for
// unlocking the user's custodial wallet. If the wallet has passkeys enrolled,
// returns the PublicKeyCredentialRequestOptions with allowCredentials set to
// the wallet's passkey credential IDs. Also returns whether a PIN is set,
// so the frontend can show the appropriate unlock UI (passkey prompt or PIN input).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { generateAuthenticationOptions } from 'npm:@simplewebauthn/server@10';
import { generateSignedChallenge, getRpConfig, base64UrlToUint8Array } from '../../shared/webauthn.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    // Find the user's active custodial wallet
    const wallets = await base44.entities.CustodialWallet.filter({ did, active: true });
    if (!wallets.length) {
      return Response.json({ error: 'No custodial wallet found' }, { status: 404 });
    }
    const wallet = wallets[0];

    const rpConfig = getRpConfig(req);
    if (!rpConfig) return Response.json({ error: 'Could not determine origin' }, { status: 400 });

    // Build allowCredentials from the wallet's passkey credential IDs
    const allowCredentials = (wallet.passkey_credential_ids || []).map((id: string) => ({
      id,
      type: 'public-key' as const,
    }));

    const { challenge, signature } = await generateSignedChallenge(process.env.BACKEND_FUNCTION_SECRET!);

    const options = await generateAuthenticationOptions({
      rpID: rpConfig.rpId,
      challenge: base64UrlToUint8Array(challenge),
      allowCredentials,
      userVerification: 'preferred',
    });

    return Response.json({
      options,
      challenge,
      challenge_signature: signature,
      hasPasskey: wallet.has_passkey,
      hasPin: wallet.has_pin,
    });
  } catch (error: any) {
    console.error('get-wallet-unlock-options error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}