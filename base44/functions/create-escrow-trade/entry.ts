// create-escrow-trade — creates an escrow for a card purchase or card swap.
// For usdc_purchase: locks USDC from the buyer's wallet into the platform
// escrow wallet (the platform mint wallet acts as escrow holder). The buyer's
// WalletBalance is debited immediately and the USDC is transferred on-chain.
// For card_swap: no funds are held; just creates the escrow record.
// Both types require shipping details to be entered before shipping.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import {
  getOrCreateWalletBalance, updateBalance, getProvider, getUsdcContract,
  calculateFee, getPlatformWallet,
} from '../../shared/walletEscrow.ts';
import { decryptPrivateKey, verifyPin } from '../../shared/walletCrypto.ts';
import { verifySignedChallenge } from '../../shared/webauthn.ts';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const {
      trade_type, trade_listing_id,
      counterparty_did, counterparty_name, counterparty_handle, counterparty_wallet,
      usdc_amount_wei, card_ids, card_names,
      unlockCredential, pin,
    } = body;

    if (!trade_type || !['usdc_purchase', 'card_swap'].includes(trade_type)) {
      return Response.json({ error: 'Invalid trade type' }, { status: 400 });
    }
    if (!trade_listing_id || !counterparty_did) {
      return Response.json({ error: 'Missing trade listing or counterparty' }, { status: 400 });
    }

    // Determine buyer and seller
    // The caller is the buyer for usdc_purchase, or one party for card_swap
    const buyerDid = did;
    const sellerDid = counterparty_did;

    // Get the user's custodial wallet (for USDC purchases)
    let buyerWallet: any = null;
    let escrowTxHash = '';

    if (trade_type === 'usdc_purchase') {
      if (!usdc_amount_wei || BigInt(usdc_amount_wei) <= 0n) {
        return Response.json({ error: 'Invalid USDC amount' }, { status: 400 });
      }

      const wallets = await base44.asServiceRole.entities.CustodialWallet
        .filter({ did, active: true }, '-created_date', 1).catch(() => []);
      if (!wallets.length) return Response.json({ error: 'No active wallet found' }, { status: 400 });
      buyerWallet = wallets[0];

      // Check balance
      const balance = await getOrCreateWalletBalance(base44, did, buyerWallet.wallet_address);
      const amountWei = BigInt(usdc_amount_wei);
      const feeWei = calculateFee(amountWei);
      const totalDebit = amountWei + feeWei;

      if (BigInt(balance.usdc_wei || '0') < totalDebit) {
        return Response.json({ error: 'Insufficient USDC for purchase + fee' }, { status: 400 });
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
        privateKey = await decryptPrivateKey(buyerWallet);
      } else if (pin) {
        const pinValid = await verifyPin(buyerWallet, pin);
        if (!pinValid) return Response.json({ error: 'Invalid PIN' }, { status: 403 });
        privateKey = await decryptPrivateKey(buyerWallet, pin);
      } else {
        return Response.json({
          requiresUnlock: true,
          hasPasskey: buyerWallet.has_passkey,
          hasPin: buyerWallet.has_pin,
        });
      }

      // Transfer USDC from buyer's wallet to the platform escrow wallet
      const provider = getProvider();
      const userWallet = new ethers.Wallet(privateKey, provider);
      const usdcContract = getUsdcContract(userWallet);
      const platformAddress = getPlatformWallet().address;

      const escrowTx = await usdcContract.transfer(platformAddress, amountWei);
      await escrowTx.wait();
      escrowTxHash = escrowTx.hash;

      // Debit the buyer's balance
      await updateBalance(base44, balance.id, {
        usdc_wei: (BigInt(balance.usdc_wei || '0') - totalDebit).toString(),
        total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
      });

      // Record the escrow lock transfer
      await base44.entities.CryptoTransfer.create({
        did,
        transfer_type: 'escrow_lock',
        from_address: buyerWallet.wallet_address,
        to_address: platformAddress,
        amount_wei: amountWei.toString(),
        fee_wei: feeWei.toString(),
        tx_hash: escrowTxHash,
        status: 'confirmed',
        description: `Escrow lock for card purchase`,
        escrow_trade_id: undefined, // will be updated after escrow creation
      });
    }

    // Create the escrow record
    const escrow = await base44.entities.EscrowTrade.create({
      trade_type,
      trade_listing_id,
      buyer_did: buyerDid,
      buyer_name: user.full_name || '',
      buyer_handle: user.bsky_handle || user.username || '',
      buyer_wallet: buyerWallet?.wallet_address || '',
      seller_did: sellerDid,
      seller_name: counterparty_name || '',
      seller_handle: counterparty_handle || '',
      seller_wallet: counterparty_wallet || '',
      usdc_amount_wei: trade_type === 'usdc_purchase' ? usdc_amount_wei : '0',
      fee_wei: trade_type === 'usdc_purchase' ? calculateFee(BigInt(usdc_amount_wei)).toString() : '0',
      status: trade_type === 'usdc_purchase' ? 'funded' : 'created',
      escrow_tx_hash: escrowTxHash,
      card_ids: card_ids || [],
      card_names: card_names || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Update the CryptoTransfer with the escrow trade id
    if (trade_type === 'usdc_purchase' && escrowTxHash) {
      const transfers = await base44.entities.CryptoTransfer
        .filter({ did, tx_hash: escrowTxHash }, '-created_date', 1).catch(() => []);
      if (transfers.length) {
        await base44.entities.CryptoTransfer.update(transfers[0].id, { escrow_trade_id: escrow.id });
      }
    }

    return Response.json({
      success: true,
      escrow_id: escrow.id,
      status: escrow.status,
      escrow_tx_hash: escrowTxHash,
    });
  } catch (error: any) {
    console.error('create-escrow-trade error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}