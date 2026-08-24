// create-multi-chain-wallet — generates a new multi-chain keypair set for the
// authenticated user from a single 24-word mnemonic: one EVM keypair (shared
// across all EVM chains), one Solana keypair, and one Bitcoin keypair. From
// the Bitcoin keypair, derives separate addresses for Bitcoin, Bitcoin Cash,
// Dogecoin, and Litecoin (each uses a different address format). Encrypts all
// private keys and the mnemonic with the server encryption key. Returns the
// wallet addresses + mnemonic (plaintext, shown once).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { Keypair } from 'npm:@solana/web3.js@1.98.4';
import { encryptWithServerKey } from '../../shared/walletCrypto.ts';
import { deriveBitcoinAddresses } from '../../shared/bitcoinAddresses.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.did;
    if (!did) return Response.json({ error: 'No AT Protocol DID found' }, { status: 400 });

    // Check for an existing active multi-chain wallet
    const existing = await base44.entities.MultiChainWallet.filter({ did, active: true }).catch(() => []);
    if (existing.length) {
      return Response.json({
        error: 'You already have a multi-chain wallet',
        wallet: {
          evm_address: existing[0].evm_address,
          id: existing[0].id,
        },
      }, { status: 400 });
    }

    // Generate a 24-word mnemonic
    const entropy = crypto.getRandomValues(new Uint8Array(32));
    const mnemonicInstance = ethers.Mnemonic.fromEntropy(entropy);
    const mnemonic = mnemonicInstance.phrase;

    // EVM keypair (secp256k1 — shared across all EVM chains)
    const evmWallet = ethers.Wallet.fromPhrase(mnemonic);
    const evmPrivateKey = evmWallet.privateKey;
    const evmAddress = evmWallet.address.toLowerCase();

    // Solana keypair — derive a 32-byte seed from the mnemonic
    const seedBytes = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(mnemonic))
    );
    const solanaKeypair = Keypair.fromSeed(seedBytes);
    const solanaAddress = solanaKeypair.publicKey.toBase58();
    const solanaSeedHex = Buffer.from(seedBytes).toString('hex');

    // Bitcoin keypair — reuse the EVM private key (same secp256k1 curve)
    const evmPrivKeyBytes = new Uint8Array(evmWallet.privateKey.slice(2).match(/.{2}/g).map((b: string) => parseInt(b, 16)));
    const bitcoinPrivKeyHex = Buffer.from(evmPrivKeyBytes).toString('hex');
    const btcAddresses = await deriveBitcoinAddresses(bitcoinPrivKeyHex);

    // Encrypt all private keys and the mnemonic
    const evmPrivCipher = await encryptWithServerKey(evmPrivateKey);
    const solanaSeedCipher = await encryptWithServerKey(solanaSeedHex);
    const btcPrivCipher = await encryptWithServerKey(bitcoinPrivKeyHex);
    const mnemonicCipher = await encryptWithServerKey(mnemonic);

    // Deactivate any existing custodial wallet (multi-chain replaces it)
    const existingCustodial = await base44.entities.CustodialWallet.filter({ did, active: true }).catch(() => []);
    for (const cw of existingCustodial) {
      await base44.entities.CustodialWallet.update(cw.id, { active: false });
    }

    // Create the multi-chain wallet record
    const wallet = await base44.entities.MultiChainWallet.create({
      did,
      evm_private_key_cipher: evmPrivCipher,
      evm_address: evmAddress,
      solana_seed_cipher: solanaSeedCipher,
      solana_address: solanaAddress,
      bitcoin_priv_key_cipher: btcPrivCipher,
      bitcoin_address: btcAddresses.bitcoin,
      bitcoin_cash_address: btcAddresses.bitcoinCash,
      dogecoin_address: btcAddresses.dogecoin,
      litecoin_address: btcAddresses.litecoin,
      mnemonic_cipher: mnemonicCipher,
      encryption_method: 'server',
      passkey_credential_ids: [],
      has_passkey: false,
      has_pin: false,
      active: true,
      created_at: new Date().toISOString(),
    });

    // Create / update WalletLink so existing mint flows work
    const existingLinks = await base44.entities.WalletLink.filter({ did });
    for (const link of existingLinks) {
      if (link.active) await base44.entities.WalletLink.update(link.id, { active: false });
    }
    await base44.entities.WalletLink.create({
      wallet_address: evmAddress,
      did,
      handle: user.bsky_handle || user.username || '',
      chain_id: '137',
      nonce: 'multichain',
      signature: 'multichain',
      linked_at: new Date().toISOString(),
      active: true,
    });

    return Response.json({
      wallet: {
        id: wallet.id,
        evm_address: evmAddress,
        solana_address: solanaAddress,
        bitcoin_address: btcAddresses.bitcoin,
        bitcoin_cash_address: btcAddresses.bitcoinCash,
        dogecoin_address: btcAddresses.dogecoin,
        litecoin_address: btcAddresses.litecoin,
      },
      mnemonic,
    });
  } catch (error: any) {
    console.error('create-multi-chain-wallet error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}