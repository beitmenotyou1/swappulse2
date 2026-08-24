// send-crypto — sends USDC from the user's custodial wallet to an external
// Polygon address. Requires passkey/PIN unlock of the custodial wallet.
// A 2% fee is collected in USDC to the platform fee wallet.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  getOrCreateWalletBalance, updateBalance, getUsdcContract, getProvider,
  calculateFee, PLATFORM_FEE_WALLET,
} from '../../shared/walletEscrow.ts';
import { decryptPrivateKey, verifyPin } from '../../shared/walletCrypto.ts';
import { verifySignedChallenge } from '../../shared/webauthn.ts';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10';
import { ethers } from 'npm:ethers@6.13.4';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { to_address, usdc_wei, unlockCredential, pin } = body;
    if (!to_address || !ethers.isAddress(to_address)) {
      return Response.json({ error: 'Invalid recipient address' }, { status: 400 });
    }
    if (!usdc_wei || BigInt(usdc_wei) <= 0n) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Get the user's custodial wallet
    const wallets = await base44.asServiceRole.entities.CustodialWallet
      .filter({ did, active: true }, '-created_date', 1).catch(() => []);
    if (!wallets.length) return Response.json({ error: 'No active wallet found' }, { status: 400 });
    const wallet = wallets[0];

    // Check balance
    const balance = await getOrCreateWalletBalance(base44, did, wallet.wallet_address);
    const amountWei = BigInt(usdc_wei);
    const feeWei = calculateFee(amountWei);
    const totalDebit = amountWei + feeWei;

    if (BigInt(balance.usdc_wei || '0') < totalDebit) {
      return Response.json({ error: 'Insufficient USDC for amount + fee' }, { status: 400 });
    }

    // Unlock the wallet
    let privateKey: string;
    if (unlockCredential) {
      const creds = await base44.asServiceRole.entities.WebAuthnCredential
        .filter({ user_id: user.id }, '-created_date', 50).catch(() => []);
      const validCreds = creds.filter((c: any) => c.credential_id);
      if (!validCreds.length) return Response.json({ error: 'No passkey enrolled' }, { status: 400 });

      const { assertion, challenge, challenge_signature } = unlockCredential;
      if (!assertion || !challenge || !challenge_signature) {
        return Response.json({ error: 'Missing unlock credentials' }, { status: 400 });
      }

      const sigValid = await verifySignedChallenge(
        Deno.env.get('BACKEND_FUNCTION_SECRET')!, challenge, challenge_signature,
      );
      if (!sigValid) return Response.json({ error: 'Invalid challenge' }, { status: 403 });

      let verified = false;
      for (const cred of validCreds) {
        try {
          const result = await verifyAuthenticationResponse({
            response: assertion,
            expectedChallenge: challenge,
            expectedOrigin: new URL(req.url).origin,
            expectedRPID: new URL(req.url).hostname,
            authenticator: {
              credentialID: cred.credential_id,
              credentialPublicKey: cred.public_key,
              counter: cred.counter || 0,
            },
          });
          if (result.verified) {
            verified = true;
            await base44.asServiceRole.entities.WebAuthnCredential.update(cred.id, {
              counter: result.authenticationInfo?.newCounter || cred.counter + 1,
            });
            break;
          }
        } catch {}
      }
      if (!verified) return Response.json({ error: 'Passkey verification failed' }, { status: 403 });
      privateKey = await decryptPrivateKey(wallet);
    } else if (pin) {
      const pinValid = await verifyPin(wallet, pin);
      if (!pinValid) return Response.json({ error: 'Invalid PIN' }, { status: 403 });
      privateKey = await decryptPrivateKey(wallet, pin);
    } else {
      return Response.json({
        requiresUnlock: true,
        hasPasskey: wallet.has_passkey,
        hasPin: wallet.has_pin,
      });
    }

    // Execute the on-chain transfers
    const userWallet = new ethers.Wallet(privateKey, getProvider());
    const contract = getUsdcContract(userWallet);

    // Send USDC to recipient
    const sendTx = await contract.transfer(to_address, amountWei);
    await sendTx.wait();

    // Send fee to platform fee wallet
    let feeTxHash = '';
    try {
      const feeTx = await contract.transfer(PLATFORM_FEE_WALLET, feeWei);
      await feeTx.wait();
      feeTxHash = feeTx.hash;
    } catch (e) {
      console.error('Fee transfer failed:', (e as any)?.message);
    }

    // Debit balance
    await updateBalance(base44, balance.id, {
      usdc_wei: (BigInt(balance.usdc_wei || '0') - totalDebit).toString(),
      total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
    });

    // Record the transfer
    await base44.entities.CryptoTransfer.create({
      did,
      transfer_type: 'send',
      from_address: wallet.wallet_address,
      to_address,
      amount_wei: amountWei.toString(),
      fee_wei: feeWei.toString(),
      tx_hash: sendTx.hash,
      status: 'confirmed',
      description: `Sent USDC to ${to_address.slice(0, 8)}…${to_address.slice(-6)}`,
    });

    // Record fee in ledger
    await base44.asServiceRole.entities.FeeLedger.create({
      fee_source: 'send',
      source_did: did,
      original_amount_wei: amountWei.toString(),
      fee_usdc_wei: feeWei.toString(),
      fee_tx_hash: feeTxHash,
      swept: !!feeTxHash,
      swept_at: feeTxHash ? new Date().toISOString() : undefined,
    });

    return Response.json({
      success: true,
      tx_hash: sendTx.hash,
      fee_tx_hash: feeTxHash,
      fee_wei: feeWei.toString(),
    });
  } catch (error: any) {
    console.error('send-crypto error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}