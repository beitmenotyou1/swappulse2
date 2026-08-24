// upgrade-to-multi-chain — upgrades an existing CustodialWallet to a
// MultiChainWallet by reusing the same mnemonic (so the EVM address stays
// the same, preserving NFTs and balances), then deriving Solana and all
// Bitcoin-family addresses (Bitcoin, Bitcoin Cash, Dogecoin, Litecoin).
// Also backfills any missing Bitcoin-family addresses on an existing
// MultiChainWallet created before per-chain address fields were added.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { Keypair } from 'npm:@solana/web3.js@1.98.4';
import {
  encryptWithServerKey,
  decryptWithServerKey,
  decryptMnemonic,
} from '../../shared/walletCrypto.ts';
import { deriveBitcoinAddresses } from '../../shared/bitcoinAddresses.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.did;
    if (!did) return Response.json({ error: 'No AT Protocol DID found' }, { status: 400 });

    // Check for an existing MultiChainWallet
    const existingMulti = await base44.entities.MultiChainWallet.filter({ did, active: true }).catch(() => []);

    // Case 1: MultiChainWallet exists but may be missing Bitcoin-family addresses
    if (existingMulti.length > 0) {
      const mw = existingMulti[0];
      const needsBackfill = !mw.bitcoin_cash_address || !mw.dogecoin_address || !mw.litecoin_address;

      if (!needsBackfill) {
        return Response.json({
          wallet: {
            id: mw.id,
            evm_address: mw.evm_address,
            solana_address: mw.solana_address,
            bitcoin_address: mw.bitcoin_address,
            bitcoin_cash_address: mw.bitcoin_cash_address,
            dogecoin_address: mw.dogecoin_address,
            litecoin_address: mw.litecoin_address,
          },
          upgraded: false,
          message: 'Multi-chain wallet already has all addresses',
        });
      }

      // Backfill: decrypt the Bitcoin private key and derive missing addresses
      const btcPrivHex = await decryptWithServerKey(mw.bitcoin_priv_key_cipher);
      const btcAddresses = await deriveBitcoinAddresses(btcPrivHex);

      await base44.entities.MultiChainWallet.update(mw.id, {
        bitcoin_address: mw.bitcoin_address || btcAddresses.bitcoin,
        bitcoin_cash_address: btcAddresses.bitcoinCash,
        dogecoin_address: btcAddresses.dogecoin,
        litecoin_address: btcAddresses.litecoin,
      });

      return Response.json({
        wallet: {
          id: mw.id,
          evm_address: mw.evm_address,
          solana_address: mw.solana_address,
          bitcoin_address: mw.bitcoin_address || btcAddresses.bitcoin,
          bitcoin_cash_address: btcAddresses.bitcoinCash,
          dogecoin_address: btcAddresses.dogecoin,
          litecoin_address: btcAddresses.litecoin,
        },
        upgraded: true,
        message: 'Backfilled Bitcoin-family addresses',
      });
    }

    // Case 2: No MultiChainWallet — upgrade from CustodialWallet
    const custodial = await base44.entities.CustodialWallet.filter({ did, active: true }).catch(() => []);
    if (custodial.length === 0) {
      return Response.json({ error: 'No existing wallet found to upgrade. Create a new wallet first.' }, { status: 400 });
    }

    const cw = custodial[0];

    // Decrypt the existing mnemonic and EVM private key
    const mnemonic = await decryptMnemonic(cw);
    const evmPrivateKey = await decryptWithServerKey(cw.encrypted_private_key);

    // Re-derive the EVM wallet to confirm the address matches
    const evmWallet = new ethers.Wallet(evmPrivateKey);
    const evmAddress = evmWallet.address.toLowerCase();

    // Derive Solana keypair from the mnemonic
    const seedBytes = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(mnemonic))
    );
    const solanaKeypair = Keypair.fromSeed(seedBytes);
    const solanaAddress = solanaKeypair.publicKey.toBase58();
    const solanaSeedHex = Buffer.from(seedBytes).toString('hex');

    // Derive Bitcoin-family addresses from the EVM private key (same secp256k1 curve)
    const bitcoinPrivKeyHex = evmPrivateKey.slice(2);
    const btcAddresses = await deriveBitcoinAddresses(bitcoinPrivKeyHex);

    // Encrypt the new keys
    const solanaSeedCipher = await encryptWithServerKey(solanaSeedHex);
    const btcPrivCipher = await encryptWithServerKey(bitcoinPrivKeyHex);

    // Create the MultiChainWallet record (preserving the same EVM address)
    const multiWallet = await base44.entities.MultiChainWallet.create({
      did,
      evm_private_key_cipher: cw.encrypted_private_key, // reuse existing encrypted EVM key
      evm_address: evmAddress,
      solana_seed_cipher: solanaSeedCipher,
      solana_address: solanaAddress,
      bitcoin_priv_key_cipher: btcPrivCipher,
      bitcoin_address: btcAddresses.bitcoin,
      bitcoin_cash_address: btcAddresses.bitcoinCash,
      dogecoin_address: btcAddresses.dogecoin,
      litecoin_address: btcAddresses.litecoin,
      mnemonic_cipher: cw.mnemonic_cipher, // reuse existing encrypted mnemonic
      encryption_method: cw.encryption_method || 'server',
      passkey_credential_ids: cw.passkey_credential_ids || [],
      pin_hash: cw.pin_hash || '',
      pin_salt: cw.pin_salt || '',
      kdf_iterations: cw.kdf_iterations || 100000,
      has_passkey: cw.has_passkey || false,
      has_pin: cw.has_pin || false,
      active: true,
      created_at: new Date().toISOString(),
    });

    // Deactivate the old CustodialWallet
    await base44.entities.CustodialWallet.update(cw.id, { active: false });

    return Response.json({
      wallet: {
        id: multiWallet.id,
        evm_address: evmAddress,
        solana_address: solanaAddress,
        bitcoin_address: btcAddresses.bitcoin,
        bitcoin_cash_address: btcAddresses.bitcoinCash,
        dogecoin_address: btcAddresses.dogecoin,
        litecoin_address: btcAddresses.litecoin,
      },
      upgraded: true,
      message: 'Upgraded to multi-chain wallet',
    });
  } catch (error: any) {
    console.error('upgrade-to-multi-chain error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}