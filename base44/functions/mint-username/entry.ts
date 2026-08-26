import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { mintUsernameDual } from '../../shared/dualMintEngine.ts';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10';
import { verifySignedChallenge, getRpConfig, base64UrlToUint8Array } from '../../shared/webauthn.ts';
import { verifyPin } from '../../shared/walletCrypto.ts';

// Mints a collector's SwapPulse handle as a soulbound (non-transferable)
// ERC-721 on Polygon. The NFT embeds the handle and a reference to the
// collector's AT Protocol DID, serving as a permanent on-chain identity.
// One per collector; re-minting is blocked.
//
// If the user has a custodial wallet with a passkey or PIN, an unlockCredential
// must be provided to authorize the mint.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No AT Protocol DID found for your account' }, { status: 400 });

    // Check crypto features are enabled
    const settingsList = await base44.entities.SettingsConfig.filter({ did }, '-updated_date', 1);
    if (settingsList.length) {
      const cryptoConfig = settingsList[0].config?.crypto;
      if (cryptoConfig && cryptoConfig.enabled === false) {
        return Response.json({ error: 'Crypto features are disabled. Enable them in Settings → Wallet.' }, { status: 403 });
      }
    }

    // Check for an active wallet link
    const links = await base44.entities.WalletLink.filter({ did, active: true });
    if (!links.length) {
      return Response.json({ error: 'No linked Polygon wallet. Link a wallet in Settings first.' }, { status: 400 });
    }
    const walletAddress = links[0].wallet_address;

    // Check for a custodial wallet and verify unlock if needed
    const body = await req.json().catch(() => ({}));
    const { unlockCredential } = body;
    const custodialWallets = await base44.entities.CustodialWallet.filter({ did, active: true });
    if (custodialWallets.length) {
      const cw = custodialWallets[0];
      if (cw.has_passkey || cw.has_pin) {
        if (!unlockCredential) {
          return Response.json({ error: 'Wallet unlock required', requiresUnlock: true, hasPasskey: cw.has_passkey, hasPin: cw.has_pin }, { status: 200 });
        }
        const unlockError = await verifyUnlock(base44, req, user, cw, unlockCredential);
        if (unlockError) return unlockError;
      }
    }

    // Check if already minted
    const existing = await base44.asServiceRole.entities.OnChainAsset.filter({
      owner_did: did,
      asset_type: 'username',
    });
    if (existing.length) {
      return Response.json({ alreadyMinted: true, asset: existing[0] }, { status: 200 });
    }

    // Mint on-chain via the platform wallet
    const mintWallet = getMintWallet();
    const contract = getUsernameContract(mintWallet);
    const handle = user.bsky_handle || user.username || '';

    // Enforce username immutability: reject if handle is already minted by
    // a different collector. Usernames are permanent on-chain identity.
    const handleLower = handle.toLowerCase();
    if (handleLower) {
      const allUsernameAssets = await base44.asServiceRole.entities.OnChainAsset
        .filter({ asset_type: 'username' }, '-minted_at', 500).catch(() => []);
      const handleMatch = allUsernameAssets.find(
        (a: any) => (a.handle || '').toLowerCase() === handleLower
      );
      if (handleMatch && handleMatch.owner_did !== did) {
        return Response.json({
          error: 'This username is already minted by another collector. Usernames are immutable once minted — choose a different handle in your profile first.',
        }, { status: 409 });
      }
    }

    // Dynamic metadata endpoint — the NFT image (logo + username + details)
    // and attributes update automatically when the collector edits their profile.
    const reqUrl = new URL(req.url);
    const origin = `${reqUrl.protocol}//${reqUrl.host}`;
    const metadataURI = `${origin}/functions/username-nft-metadata?did=${encodeURIComponent(did)}`;

    // Read dual-chain preferences (default: Polygon-only until bridge is enabled)
    const cryptoConfig = settingsList[0]?.config?.crypto;
    const primaryChain = cryptoConfig?.primaryChain || 'polygon';
    const bridgeToSecondary = cryptoConfig?.bridgeToPulse === true;

    // Dual-mint: mints on the primary chain, then bridges to the secondary
    const dualResult = await mintUsernameDual(
      base44.asServiceRole,
      walletAddress,
      handle,
      did,
      metadataURI,
      { primaryChain, bridgeToSecondary },
    );

    const asset = dualResult.polygonAsset || dualResult.pulseAsset;
    return Response.json({
      asset,
      txHash: dualResult.polygonTxHash || dualResult.pulseTxHash,
      explorerUrl: dualResult.polygonScanUrl,
      pulseScanUrl: dualResult.pulseScanUrl,
      bridgeStatus: dualResult.bridgeStatus,
      dualChain: true,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Verifies the unlock credential (passkey or PIN) for a custodial wallet.
// Returns a Response (error) if verification fails, or null if successful.
async function verifyUnlock(base44: any, req: Request, user: any, wallet: any, unlockCredential: any): Promise<Response | null> {
  if (unlockCredential.type === 'passkey') {
    const { assertion, challenge, challenge_signature } = unlockCredential;
    if (!assertion || !challenge || !challenge_signature) {
      return Response.json({ error: 'Missing passkey assertion data' }, { status: 400 });
    }
    const rpConfig = getRpConfig(req);
    if (!rpConfig) return Response.json({ error: 'Could not determine origin' }, { status: 400 });

    const valid = await verifySignedChallenge(process.env.BACKEND_FUNCTION_SECRET!, challenge, challenge_signature);
    if (!valid) return Response.json({ error: 'Invalid or expired challenge' }, { status: 403 });

    const creds = await base44.asServiceRole.entities.WebAuthnCredential
      .filter({ user_id: user.id, credential_id: assertion.id }, '-created_date', 1)
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
        credentialPublicKey: base64UrlToUint8Array(credential.public_key),
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
    return null;
  }

  if (unlockCredential.type === 'pin') {
    const { pin } = unlockCredential;
    if (!pin) return Response.json({ error: 'PIN required' }, { status: 400 });
    const valid = await verifyPin(wallet, pin);
    if (!valid) return Response.json({ error: 'Incorrect PIN' }, { status: 403 });
    return null;
  }

  return Response.json({ error: 'Invalid unlock credential type' }, { status: 400 });
}