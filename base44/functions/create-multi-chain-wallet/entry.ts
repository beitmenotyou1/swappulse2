// create-multi-chain-wallet — generates a custodial multi-chain wallet for the
// authenticated user: one EVM keypair (Polygon, Ethereum, Arbitrum, Optimism,
// Base), one Solana keypair, and one Bitcoin keypair, all derived from the same
// 24-word mnemonic. All private keys are AES-256-GCM encrypted server-side.
// Also creates a CustodialWallet + WalletLink for backward compat with existing
// mint flows. Returns the mnemonic (plaintext, shown once).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { encryptWithServerKey } from '../../shared/walletCrypto.ts';
import { generateMultiChainKeys } from '../../shared/multiChain.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No AT Protocol DID found' }, { status: 400 });

    // Check for existing active multi-chain wallet
    const existing = await base44.entities.MultiChainWallet
      .filter({ did, active: true }).catch(() => []);
    if (existing.length) {
      return Response.json({
        error: 'You already have a multi-chain wallet',
        wallet: { evm_address: existing[0].evm_address, id: existing[0].id },
      }, { status: 400 });
    }

    // Generate all chain keys from one mnemonic
    const keys = await generateMultiChainKeys();

    // Encrypt each private key + mnemonic with the server encryption key
    const evmCipher = await encryptWithServerKey(keys.evm.privateKey);
    const solanaCipher = await encryptWithServerKey(keys.solana.seedHex);
    const btcCipher = await encryptWithServerKey(keys.bitcoin.privKeyHex);
    const mnemonicCipher = await encryptWithServerKey(keys.mnemonic);

    // Create the MultiChainWallet record
    const wallet = await base44.entities.MultiChainWallet.create({
      did,
      evm_private_key_cipher: evmCipher,
      evm_address: keys.evm.address,
      solana_seed_cipher: solanaCipher,
      solana_address: keys.solana.address,
      bitcoin_priv_key_cipher: btcCipher,
      bitcoin_address: keys.bitcoin.address,
      mnemonic_cipher: mnemonicCipher,
      encryption_method: 'server',
      passkey_credential_ids: [],
      has_passkey: false,
      has_pin: false,
      active: true,
      created_at: new Date().toISOString(),
    });

    // Deactivate old wallet links, create a new one for backward compat
    const existingLinks = await base44.entities.WalletLink.filter({ did }).catch(() => []);
    for (const link of existingLinks) {
      if (link.active) await base44.entities.WalletLink.update(link.id, { active: false });
    }
    await base44.entities.WalletLink.create({
      wallet_address: keys.evm.address,
      did,
      handle: user.bsky_handle || user.username || '',
      chain_id: '137',
      nonce: 'custodial',
      signature: 'custodial',
      linked_at: new Date().toISOString(),
      active: true,
    });

    // Also create a CustodialWallet record for backward compat with existing mint flows
    await base44.entities.CustodialWallet.create({
      wallet_address: keys.evm.address,
      did,
      encrypted_private_key: evmCipher,
      encryption_method: 'server',
      mnemonic_cipher: mnemonicCipher,
      passkey_credential_ids: [],
      has_passkey: false,
      has_pin: false,
      active: true,
      created_at: new Date().toISOString(),
    });

    return Response.json({
      wallet: {
        id: wallet.id,
        evm_address: keys.evm.address,
        solana_address: keys.solana.address,
        bitcoin_address: keys.bitcoin.address,
      },
      mnemonic: keys.mnemonic, // plaintext — shown once to the user
    });
  } catch (error: any) {
    console.error('create-multi-chain-wallet error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}