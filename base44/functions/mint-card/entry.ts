import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getMintWallet, getCardContract, getExplorerUrl, parseMintEvent } from '../../shared/polygonClient.ts';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10';
import { verifySignedChallenge, getRpConfig, base64UrlToUint8Array } from '../../shared/webauthn.ts';
import { verifyPin } from '../../shared/walletCrypto.ts';

// Mints a card from the collector's CollectionEntry as a transferable
// ERC-721 on Polygon for proof of ownership. One NFT per collection entry.
//
// If the user has a custodial wallet with a passkey or PIN, an unlockCredential
// must be provided to authorize the mint.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { collectionEntryId, unlockCredential, verificationSessionId } = body;
    if (!collectionEntryId) return Response.json({ error: 'Missing collectionEntryId' }, { status: 400 });

    const did = user.did;
    if (!did) return Response.json({ error: 'No AT Protocol DID found' }, { status: 400 });

    // If a verification session is provided, validate it and determine the
    // verification level to embed in the NFT metadata.
    let verificationLevel = 0;
    if (verificationSessionId) {
      const sessions = await base44.entities.CardVerificationSession.filter({ id: verificationSessionId });
      if (!sessions.length) {
        return Response.json({ error: 'Verification session not found' }, { status: 404 });
      }
      const session = sessions[0];
      if (session.did !== did) {
        return Response.json({ error: 'Verification session does not belong to you' }, { status: 403 });
      }
      if (session.collection_entry_id !== collectionEntryId) {
        return Response.json({ error: 'Verification session does not match this card' }, { status: 400 });
      }
      if (session.status !== 'verified') {
        return Response.json({ error: 'Verification session is not verified' }, { status: 400 });
      }
      if (new Date(session.expires_at) < new Date()) {
        return Response.json({ error: 'Verification session has expired' }, { status: 400 });
      }
      verificationLevel = session.verification_level || 0;
    }

    // Fetch the collection entry (user-scoped so RLS enforces ownership)
    const entries = await base44.entities.CollectionEntry.filter({ id: collectionEntryId });
    if (!entries.length) return Response.json({ error: 'Collection entry not found' }, { status: 404 });
    const entry = entries[0];

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

    // Check if this collection entry is already minted
    const existing = await base44.asServiceRole.entities.OnChainAsset.filter({
      linked_collection_entry_id: collectionEntryId,
    });
    if (existing.length) {
      return Response.json({ error: 'Card already minted as NFT', asset: existing[0] }, { status: 400 });
    }

    // Mint on-chain via the platform wallet
    const mintWallet = getMintWallet();
    const contract = getCardContract(mintWallet);
    const cardId = entry.card_id || '';
    const cardName = entry.card_name || '';
    const cardImage = entry.card_image || '';
    const metadataURI = `https://swappulse.org/card/${cardId}`;

    const tx = await contract.mint(walletAddress, cardId, cardName, cardImage, metadataURI);
    const receipt = await tx.wait();
    const { tokenId } = parseMintEvent(contract, receipt);

    // Record the asset
    const asset = await base44.asServiceRole.entities.OnChainAsset.create({
      asset_type: 'card',
      token_id: tokenId,
      contract_address: await contract.getAddress(),
      owner_did: did,
      owner_wallet: walletAddress,
      linked_card_id: cardId,
      linked_card_name: cardName,
      linked_card_image: cardImage,
      linked_collection_entry_id: collectionEntryId,
      mint_tx_hash: tx.hash,
      mint_block_number: receipt.blockNumber,
      minted_at: new Date().toISOString(),
      transferable: true,
      metadata_uri: metadataURI,
      chain_id: '137',
      verification_level: verificationLevel,
      verification_session_id: verificationSessionId || '',
    });

    return Response.json({
      asset,
      txHash: tx.hash,
      explorerUrl: `${getExplorerUrl()}/tx/${tx.hash}`,
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