// execute-conversion — unified conversion endpoint supporting:
// 1. fiat_to_crypto: debits fiat, credits target crypto (USDC directly or
//    EVM token via Velora DEX from the platform wallet).
// 2. crypto_to_crypto: DEX swap from the user's unlocked wallet (EVM pairs
//    on Polygon). 2% fee collected in USDC to the platform fee wallet.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import {
  resolveActiveWallet, getOrCreateWalletBalance, updateBalance,
  creditUsdcFromReserve, calculateFee,
  fiatCentsToUsdcWei, getProvider, getUsdcContract, getPlatformWallet,
  USDC_CONTRACT_ADDRESS, PLATFORM_FEE_WALLET,
} from '../../shared/walletEscrow.ts';
import { decryptPrivateKey, verifyPin } from '../../shared/walletCrypto.ts';
import { verifySignedChallenge } from '../../shared/webauthn.ts';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10';
import { fetchDexQuote, executeDexSwap } from '../../shared/dexAggregator.ts';
import { getPulseMintWallet } from '../../shared/pulseClient.ts';

const POLYGON_CHAIN_ID = 137;
const PULSE_SENTINEL = 'PULSE';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { mode, unlockCredential, pin } = body;

    const activeWallet = await resolveActiveWallet(base44, did);
    if (!activeWallet) return Response.json({ error: 'No active wallet found' }, { status: 400 });
    const walletAddress = activeWallet.wallet_address;

    // --- Mode 1: Fiat → Crypto ---
    if (mode === 'fiat_to_crypto') {
      const { fiat_cents, target_token, currency } = body;
      if (!fiat_cents || fiat_cents < 100) {
        return Response.json({ error: 'Minimum conversion is 1.00' }, { status: 400 });
      }

      const balance = await getOrCreateWalletBalance(base44, did, walletAddress);
      if (balance.fiat_cents < fiat_cents) {
        return Response.json({ error: 'Insufficient fiat balance' }, { status: 400 });
      }

      const usdcWei = fiatCentsToUsdcWei(fiat_cents);
      const feeWei = calculateFee(usdcWei);
      const netWei = usdcWei - feeWei;

      // If target is native PULSE, the platform sells PULSE from its PulseChain
      // treasury. Fiat is debited and converted to USDC (platform revenue);
      // PULSE is sent from the platform PulseChain wallet to the user's address.
      if (target_token === PULSE_SENTINEL) {
        const pulsePriceUsd = body.pulse_price_usd || 0;
        if (pulsePriceUsd <= 0) {
          return Response.json({ error: 'PULSE price unavailable. Try again in a moment.' }, { status: 400 });
        }

        // Convert fiat to USDC value (net of 2% fee)
        const usdcWei = fiatCentsToUsdcWei(fiat_cents);
        const feeWei = calculateFee(usdcWei);
        const netUsdcWei = usdcWei - feeWei;
        const netUsdc = Number(netUsdcWei) / 1_000_000;

        // Calculate how much PULSE the user receives
        const pulseAmount = netUsdc / pulsePriceUsd;
        const pulseWei = BigInt(Math.floor(pulseAmount * 1e18));

        if (pulseWei <= 0n) {
          return Response.json({ error: 'Amount too small to purchase PULSE' }, { status: 400 });
        }

        // Debit fiat from user's balance
        await updateBalance(base44, balance.id, {
          fiat_cents: balance.fiat_cents - fiat_cents,
          total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
        });

        // Send PULSE from platform treasury to user's PulseChain address
        let pulseTxHash = '';
        try {
          const pulseWallet = getPulseMintWallet();
          const tx = await pulseWallet.sendTransaction({
            to: walletAddress,
            value: pulseWei,
          });
          const receipt = await tx.wait();
          pulseTxHash = receipt?.hash || tx.hash;
        } catch (e) {
          // Refund the fiat debit if the PULSE send fails
          await updateBalance(base44, balance.id, {
            fiat_cents: balance.fiat_cents,
            total_fees_paid_wei: balance.total_fees_paid_wei,
          });
          return Response.json({ error: 'PULSE transfer failed: ' + (e as any)?.message }, { status: 500 });
        }

        await base44.entities.CryptoTransfer.create({
          did, transfer_type: 'fiat_to_usdc',
          from_address: 'platform_treasury', to_address: walletAddress,
          amount_wei: pulseWei.toString(), fee_wei: feeWei.toString(),
          tx_hash: pulseTxHash, status: 'confirmed',
          description: `Converted ${(fiat_cents / 100).toFixed(2)} ${currency || 'GBP'} to ${pulseAmount.toFixed(6)} PULSE`,
        });

        await base44.asServiceRole.entities.FeeLedger.create({
          fee_source: 'fiat_to_usdc', source_did: did,
          original_amount_cents: fiat_cents, original_amount_wei: usdcWei.toString(),
          fee_usdc_wei: feeWei.toString(),
          swept: true, swept_at: new Date().toISOString(),
        });

        return Response.json({
          success: true,
          pulse_amount: pulseAmount.toFixed(6),
          pulse_wei: pulseWei.toString(),
          fee_wei: feeWei.toString(),
          tx_hash: pulseTxHash,
        });
      }

      // If target is USDC (or not specified), credit USDC directly from reserve
      if (!target_token || target_token.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase()) {
        await updateBalance(base44, balance.id, {
          fiat_cents: balance.fiat_cents - fiat_cents,
          usdc_wei: (BigInt(balance.usdc_wei || '0') + netWei).toString(),
          total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
        });

        let creditTxHash = '';
        try {
          const result = await creditUsdcFromReserve(walletAddress, netWei);
          creditTxHash = result.txHash;
        } catch (e) {
          await updateBalance(base44, balance.id, {
            fiat_cents: balance.fiat_cents,
            usdc_wei: balance.usdc_wei,
            total_fees_paid_wei: balance.total_fees_paid_wei,
          });
          return Response.json({ error: 'On-chain USDC transfer failed: ' + (e as any)?.message }, { status: 500 });
        }

        await base44.entities.CryptoTransfer.create({
          did, transfer_type: 'fiat_to_usdc',
          from_address: 'platform_reserve', to_address: walletAddress,
          amount_wei: netWei.toString(), fee_wei: feeWei.toString(),
          tx_hash: creditTxHash, status: 'confirmed',
          description: `Converted ${(fiat_cents / 100).toFixed(2)} ${currency || 'GBP'} to USDC`,
        });

        // Fee stays in platform wallet; sweep-fees workflow batches it.
        await base44.asServiceRole.entities.FeeLedger.create({
          fee_source: 'fiat_to_usdc', source_did: did,
          original_amount_cents: fiat_cents, original_amount_wei: usdcWei.toString(),
          fee_usdc_wei: feeWei.toString(),
          swept: false,
        });

        return Response.json({ success: true, usdc_credited_wei: netWei.toString(), fee_wei: feeWei.toString(), tx_hash: creditTxHash });
      }

      // Target is an EVM token — DEX swap USDC → target from platform wallet,
      // then send the target tokens to the user's wallet.
      try {
        const quote = await fetchDexQuote({
          srcToken: USDC_CONTRACT_ADDRESS,
          destToken: target_token,
          amount: netWei.toString(),
          network: POLYGON_CHAIN_ID,
        });

        const platformWallet = getPlatformWallet();
        const swapResult = await executeDexSwap(platformWallet, quote);

        // Send the target tokens from platform wallet to user's wallet
        const targetContract = new ethers.Contract(
          target_token,
          ['function transfer(address,uint256) returns (bool)', 'function balanceOf(address) view returns (uint256)'],
          platformWallet,
        );
        const targetBalance = await targetContract.balanceOf(platformWallet.address);
        if (targetBalance > 0n) {
          const sendTx = await targetContract.transfer(walletAddress, targetBalance);
          await sendTx.wait();
        }

        // Debit fiat from user's balance
        await updateBalance(base44, balance.id, {
          fiat_cents: balance.fiat_cents - fiat_cents,
          total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
        });

        await base44.entities.CryptoTransfer.create({
          did, transfer_type: 'fiat_to_usdc',
          from_address: 'platform_reserve', to_address: walletAddress,
          amount_wei: netWei.toString(), fee_wei: feeWei.toString(),
          tx_hash: swapResult.txHash, status: 'confirmed',
          description: `Converted ${(fiat_cents / 100).toFixed(2)} ${currency || 'GBP'} to crypto via DEX`,
        });

        // Fee stays in platform wallet; sweep-fees workflow batches it.
        await base44.asServiceRole.entities.FeeLedger.create({
          fee_source: 'fiat_to_usdc', source_did: did,
          original_amount_cents: fiat_cents, original_amount_wei: usdcWei.toString(),
          fee_usdc_wei: feeWei.toString(),
          swept: false,
        });

        return Response.json({ success: true, dest_amount: swapResult.destAmount, fee_wei: feeWei.toString(), tx_hash: swapResult.txHash });
      } catch (e) {
        return Response.json({ error: 'DEX swap failed: ' + (e as any)?.message }, { status: 500 });
      }
    }

    // --- Mode 2: Crypto → Crypto ---
    if (mode === 'crypto_to_crypto') {
      const { source_token, target_token, amount } = body;
      if (!source_token || !target_token || !amount) {
        return Response.json({ error: 'source_token, target_token, and amount are required' }, { status: 400 });
      }
      if (source_token.toLowerCase() === target_token.toLowerCase()) {
        return Response.json({ error: 'Source and target must be different' }, { status: 400 });
      }

      // --- Special case: target is native PULSE ---
      // Swap source token to USDC on Polygon (from user's wallet), then the
      // platform sends PULSE from its PulseChain treasury to the user.
      if (target_token === PULSE_SENTINEL) {
        // Unlock the wallet
        let privateKey: string;
        const walletRecord = activeWallet.wallet_record;

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
          privateKey = await decryptPrivateKey(walletRecord);
        } else if (pin) {
          const pinValid = await verifyPin(walletRecord, pin);
          if (!pinValid) return Response.json({ error: 'Invalid PIN' }, { status: 403 });
          privateKey = await decryptPrivateKey(walletRecord, pin);
        } else {
          return Response.json({
            requiresUnlock: true,
            hasPasskey: walletRecord.has_passkey,
            hasPin: walletRecord.has_pin,
          });
        }

        const userWallet = new ethers.Wallet(privateKey, getProvider());

        // Step 1: Swap source token to USDC on Polygon via DEX
        const quote = await fetchDexQuote({
          srcToken: source_token,
          destToken: USDC_CONTRACT_ADDRESS,
          amount: amount,
          network: POLYGON_CHAIN_ID,
        });
        const swapResult = await executeDexSwap(userWallet, quote);

        const usdcReceived = BigInt(quote.destAmount);
        const feeWei = calculateFee(usdcReceived);
        const netUsdcWei = usdcReceived - feeWei;
        const netUsdc = Number(netUsdcWei) / 1_000_000;

        // Step 2: Calculate PULSE amount from market price
        const pulsePriceUsd = body.pulse_price_usd || 0;
        if (pulsePriceUsd <= 0) {
          return Response.json({ error: 'PULSE price unavailable. Try again in a moment.' }, { status: 400 });
        }

        const pulseAmount = netUsdc / pulsePriceUsd;
        const pulseWei = BigInt(Math.floor(pulseAmount * 1e18));

        if (pulseWei <= 0n) {
          return Response.json({ error: 'Swap amount too small to purchase PULSE' }, { status: 400 });
        }

        // Step 3: Send 2% fee in USDC to platform fee wallet
        let feeTxHash = '';
        try {
          const usdcContract = getUsdcContract(userWallet);
          const feeTx = await usdcContract.transfer(PLATFORM_FEE_WALLET, feeWei);
          await feeTx.wait();
          feeTxHash = feeTx.hash;
        } catch (e) {
          console.error('Fee transfer failed:', (e as any)?.message);
        }

        // Step 4: Send PULSE from platform treasury to user's PulseChain address
        let pulseTxHash = '';
        try {
          const pulseWallet = getPulseMintWallet();
          const tx = await pulseWallet.sendTransaction({
            to: walletAddress,
            value: pulseWei,
          });
          const receipt = await tx.wait();
          pulseTxHash = receipt?.hash || tx.hash;
        } catch (e) {
          return Response.json({ error: 'PULSE transfer failed: ' + (e as any)?.message }, { status: 500 });
        }

        // Update balance if source was USDC
        const balance = await getOrCreateWalletBalance(base44, did, walletAddress);
        if (source_token.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase()) {
          await updateBalance(base44, balance.id, {
            usdc_wei: (BigInt(balance.usdc_wei || '0') - BigInt(amount)).toString(),
            total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
          });
        } else {
          await updateBalance(base44, balance.id, {
            total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
          });
        }

        await base44.entities.CryptoTransfer.create({
          did, transfer_type: 'token_convert',
          from_address: walletAddress, to_address: walletAddress,
          amount_wei: pulseWei.toString(), fee_wei: feeWei.toString(),
          tx_hash: pulseTxHash, status: 'confirmed',
          description: `Swapped to ${pulseAmount.toFixed(6)} PULSE via DEX + treasury`,
        });

        await base44.asServiceRole.entities.FeeLedger.create({
          fee_source: 'token_convert', source_did: did,
          original_amount_wei: amount,
          fee_usdc_wei: feeWei.toString(),
          fee_tx_hash: feeTxHash,
          swept: !!feeTxHash, swept_at: feeTxHash ? new Date().toISOString() : undefined,
        });

        return Response.json({
          success: true,
          pulse_amount: pulseAmount.toFixed(6),
          pulse_wei: pulseWei.toString(),
          fee_wei: feeWei.toString(),
          tx_hash: pulseTxHash,
        });
      }

      // Unlock the wallet
      let privateKey: string;
      const walletRecord = activeWallet.wallet_record;

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
        privateKey = await decryptPrivateKey(walletRecord);
      } else if (pin) {
        const pinValid = await verifyPin(walletRecord, pin);
        if (!pinValid) return Response.json({ error: 'Invalid PIN' }, { status: 403 });
        privateKey = await decryptPrivateKey(walletRecord, pin);
      } else {
        return Response.json({
          requiresUnlock: true,
          hasPasskey: walletRecord.has_passkey,
          hasPin: walletRecord.has_pin,
        });
      }

      const userWallet = new ethers.Wallet(privateKey, getProvider());

      // Fetch DEX quote
      const quote = await fetchDexQuote({
        srcToken: source_token,
        destToken: target_token,
        amount: amount,
        network: POLYGON_CHAIN_ID,
      });

      // Execute the swap from user's wallet
      const swapResult = await executeDexSwap(userWallet, quote);

      // Collect 2% fee in USDC from the destination amount
      const destAmount = BigInt(quote.destAmount);
      const feeWei = calculateFee(destAmount);
      const netDestWei = destAmount - feeWei;

      let feeTxHash = '';
      let feeUsdcWei = 0n;
      // If target is USDC, send fee directly to the fee wallet from user's wallet
      if (target_token.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase()) {
        feeUsdcWei = feeWei;
        try {
          const usdcContract = getUsdcContract(userWallet);
          const feeTx = await usdcContract.transfer(PLATFORM_FEE_WALLET, feeWei);
          await feeTx.wait();
          feeTxHash = feeTx.hash;
        } catch (e) {
          console.error('Fee transfer failed:', (e as any)?.message);
        }
      } else {
        // Non-USDC target: swap the fee portion to USDC and send to fee wallet.
        // The collector pays gas for this second swap + USDC transfer.
        try {
          const feeQuote = await fetchDexQuote({
            srcToken: target_token,
            destToken: USDC_CONTRACT_ADDRESS,
            amount: feeWei.toString(),
            network: POLYGON_CHAIN_ID,
          });
          await executeDexSwap(userWallet, feeQuote);
          const usdcContract = getUsdcContract(userWallet);
          const feeUsdcBalance = await usdcContract.balanceOf(userWallet.address);
          if (feeUsdcBalance > 0n) {
            const feeTx = await usdcContract.transfer(PLATFORM_FEE_WALLET, feeUsdcBalance);
            await feeTx.wait();
            feeTxHash = feeTx.hash;
            feeUsdcWei = feeUsdcBalance;
          }
        } catch (e) {
          console.error('Fee conversion to USDC failed:', (e as any)?.message);
        }
      }

      // Update balance if either source or target is USDC
      const balance = await getOrCreateWalletBalance(base44, did, walletAddress);
      if (source_token.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase()) {
        await updateBalance(base44, balance.id, {
          usdc_wei: (BigInt(balance.usdc_wei || '0') - BigInt(amount)).toString(),
          total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
        });
      } else if (target_token.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase()) {
        await updateBalance(base44, balance.id, {
          usdc_wei: (BigInt(balance.usdc_wei || '0') + netDestWei).toString(),
          total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
        });
      } else {
        await updateBalance(base44, balance.id, {
          total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
        });
      }

      await base44.entities.CryptoTransfer.create({
        did, transfer_type: 'token_convert',
        from_address: walletAddress, to_address: walletAddress,
        amount_wei: netDestWei.toString(), fee_wei: feeWei.toString(),
        tx_hash: swapResult.txHash, status: 'confirmed',
        description: `Converted crypto via DEX swap`,
      });

      await base44.asServiceRole.entities.FeeLedger.create({
        fee_source: 'token_convert', source_did: did,
        original_amount_wei: amount,
        fee_usdc_wei: feeUsdcWei.toString(),
        fee_tx_hash: feeTxHash,
        swept: !!feeTxHash, swept_at: feeTxHash ? new Date().toISOString() : undefined,
      });

      return Response.json({ success: true, dest_amount: netDestWei.toString(), fee_wei: feeWei.toString(), tx_hash: swapResult.txHash });
    }

    return Response.json({ error: 'Invalid mode. Use fiat_to_crypto or crypto_to_crypto.' }, { status: 400 });
  } catch (error: any) {
    console.error('execute-conversion error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}