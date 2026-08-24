// create-custodial-wallet — generates a new Polygon keypair for the
// authenticated user, encrypts the private key and 24-word mnemonic with
// the server encryption key, stores a CustodialWallet record + WalletLink,
// and returns the wallet address + mnemonic (plaintext, shown once).
// The user is then prompted to enroll a passkey for wallet unlock.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { encryptWithServerKey } from '../../shared/walletCrypto.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.did;
    if (!did) return Response.json({ error: 'No AT Protocol DID found for your account' }, { status: 400 });

    // Check for an existing active custodial wallet
    const existing = await base44.entities.CustodialWallet.filter({ did, active: true });
    if (existing.length) {
      return Response.json({
        error: 'You already have a custodial wallet',
        wallet: { address: existing[0].wallet_address, id: existing[0].id },
      }, { status: 400 });
    }

    // Generate a new wallet with 256-bit entropy (24-word mnemonic)
    const entropy = crypto.getRandomValues(new Uint8Array(32)); // 256 bits → 24 words
    const mnemonicInstance = ethers.Mnemonic.fromEntropy(entropy);
    const wallet = ethers.Wallet.fromPhrase(mnemonicInstance.phrase);
    const mnemonic = mnemonicInstance.phrase;
    const privateKey = wallet.privateKey;
    const address = wallet.address.toLowerCase();

    // Encrypt the private key and mnemonic with the server encryption key
    const encryptedPrivateKey = await encryptWithServerKey(privateKey);
    const mnemonicCipher = await encryptWithServerKey(mnemonic);

    // Deactivate any existing active wallet links for this user
    const existingLinks = await base44.entities.WalletLink.filter({ did });
    for (const link of existingLinks) {
      if (link.active) {
        await base44.entities.WalletLink.update(link.id, { active: false });
      }
    }

    // Also deactivate any other user's link to this address (shouldn't happen, but clean up)
    const dupCheck = await base44.asServiceRole.entities.WalletLink.filter({
      wallet_address: address,
      active: true,
    });
    for (const dup of dupCheck) {
      if (dup.did !== did) {
        await base44.asServiceRole.entities.WalletLink.update(dup.id, { active: false });
      }
    }

    // Create the custodial wallet record
    const custodialWallet = await base44.entities.CustodialWallet.create({
      wallet_address: address,
      did,
      encrypted_private_key: encryptedPrivateKey,
      encryption_method: 'server',
      mnemonic_cipher: mnemonicCipher,
      passkey_credential_ids: [],
      has_passkey: false,
      has_pin: false,
      active: true,
      created_at: new Date().toISOString(),
    });

    // Create a WalletLink so existing mint flows work
    await base44.entities.WalletLink.create({
      wallet_address: address,
      did,
      handle: user.bsky_handle || user.username || '',
      chain_id: '137',
      nonce: 'custodial',
      signature: 'custodial',
      linked_at: new Date().toISOString(),
      active: true,
    });

    return Response.json({
      wallet: { address, id: custodialWallet.id },
      mnemonic, // plaintext — shown once to the user
    });
  } catch (error: any) {
    console.error('create-custodial-wallet error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}