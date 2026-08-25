// execute-usdc-to-fiat — converts USDC balance to fiat.
// Sends USDC from the user's custodial wallet to the platform reserve,
// credits fiat_cents in the WalletBalance, and collects a 2% fee in USDC
// to the platform fee wallet. Requires passkey/PIN unlock of the custodial wallet.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  getOrCreateWalletBalance, updateBalance, debitUsdcToReserve,
  sweepFeeToPlatformWallet, calculateFee, usdcWeiToFiatCents,
} from '../../shared/walletEscrow.ts';
import { decryptPrivateKey, verifyPin } from '../../shared/walletCrypto.ts';
import { verifySignedChallenge } from '../../shared/webauthn.ts';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { usdc_wei, unlockCredential, pin } = body;
    if (!usdc_wei || BigInt(usdc_wei) <= 0n) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Resolve active wallet (MultiChainWallet preferred, CustodialWallet fallback)
    const { resolveActiveWallet } = await import('../../shared/walletEscrow.ts');
    const activeWallet = await resolveActiveWallet(base44, did);
    if (!activeWallet) return Response.json({ error: 'No active wallet found' }, { status: 400 });
    const wallet = activeWallet.wallet_record;
    const walletAddress = activeWallet.wallet_address;

    // Check balance
    const balance = await getOrCreateWalletBalance(base44, did, walletAddress);
    if (BigInt(balance.usdc_wei || '0') < BigInt(usdc_wei)) {
      return Response.json({ error: 'Insufficient USDC balance' }, { status: 400 });
    }

    // Unlock the wallet
    let privateKey: string;
    if (unlockCredential) {
      // WebAuthn passkey unlock
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

      // Verify the assertion against any of the user's credentials
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
      // PIN unlock
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

    // Calculate amounts
    const amountWei = BigInt(usdc_wei);
    const feeWei = calculateFee(amountWei);
    const totalDebitWei = amountWei + feeWei;

    // Check the user has enough for amount + fee
    if (BigInt(balance.usdc_wei || '0') < totalDebitWei) {
      return Response.json({ error: 'Insufficient USDC for amount + fee' }, { status: 400 });
    }

    const fiatCents = usdcWeiToFiatCents(amountWei);

    // Send USDC from user's wallet to platform reserve
    let debitTxHash = '';
    let feeTxHash = '';
    try {
      const debitResult = await debitUsdcToReserve(privateKey, amountWei);
      debitTxHash = debitResult.txHash;
    } catch (e) {
      return Response.json({ error: 'On-chain USDC transfer failed: ' + (e as any)?.message }, { status: 500 });
    }

    // Sweep fee from user's wallet to platform fee wallet
    try {
      const { getProvider, getUsdcContract, PLATFORM_FEE_WALLET } = await import('../../shared/walletEscrow.ts');
      const userWallet = new (await import('npm:ethers@6.13.4')).Wallet(privateKey, getProvider());
      const contract = getUsdcContract(userWallet);
      const feeTx = await contract.transfer(PLATFORM_FEE_WALLET, feeWei);
      await feeTx.wait();
      feeTxHash = feeTx.hash;
    } catch (e) {
      console.error('Fee sweep failed:', (e as any)?.message);
    }

    // Credit fiat to balance
    await updateBalance(base44, balance.id, {
      fiat_cents: balance.fiat_cents + fiatCents,
      usdc_wei: (BigInt(balance.usdc_wei || '0') - totalDebitWei).toString(),
      total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
    });

    // Record the transfer
    await base44.entities.CryptoTransfer.create({
      did,
      transfer_type: 'usdc_to_fiat',
      from_address: walletAddress,
      to_address: 'platform_reserve',
      amount_wei: amountWei.toString(),
      fee_wei: feeWei.toString(),
      tx_hash: debitTxHash,
      status: 'confirmed',
      description: `Converted USDC to ${(fiatCents / 100).toFixed(2)} ${body.currency || 'GBP'}`,
    });

    // Record fee in ledger
    await base44.asServiceRole.entities.FeeLedger.create({
      fee_source: 'usdc_to_fiat',
      source_did: did,
      original_amount_wei: amountWei.toString(),
      fee_usdc_wei: feeWei.toString(),
      fee_tx_hash: feeTxHash,
      swept: !!feeTxHash,
      swept_at: feeTxHash ? new Date().toISOString() : undefined,
    });

    return Response.json({
      success: true,
      fiat_credited_cents: fiatCents,
      fee_wei: feeWei.toString(),
      tx_hash: debitTxHash,
      fee_tx_hash: feeTxHash,
    });
  } catch (error: any) {
    console.error('execute-usdc-to-fiat error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}