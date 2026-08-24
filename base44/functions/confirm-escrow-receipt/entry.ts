// confirm-escrow-receipt — the buyer confirms receipt of a card purchase by
// uploading a photo (with tracking code visible) and confirming. On
// confirmation, the escrow releases USDC to the seller's wallet (minus the
// 2% fee to the platform fee wallet) and transitions to 'released'.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import {
  getOrCreateWalletBalance, updateBalance, getPlatformWallet, getUsdcContract,
  getProvider, PLATFORM_FEE_WALLET,
} from '../../shared/walletEscrow.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { escrow_id, confirmation_photo_url } = body;
    if (!escrow_id) return Response.json({ error: 'Missing escrow id' }, { status: 400 });
    if (!confirmation_photo_url) return Response.json({ error: 'Confirmation photo is required' }, { status: 400 });

    const escrow = await base44.entities.EscrowTrade.get(escrow_id).catch(() => null);
    if (!escrow) return Response.json({ error: 'Escrow not found' }, { status: 404 });

    // Only the buyer can confirm receipt for usdc_purchase
    if (escrow.buyer_did !== did) {
      return Response.json({ error: 'Only the buyer can confirm receipt' }, { status: 403 });
    }
    if (!['funded', 'shipped'].includes(escrow.status)) {
      return Response.json({ error: `Cannot confirm in status: ${escrow.status}` }, { status: 400 });
    }

    // Update the escrow with the buyer's confirmation
    const updated = await base44.entities.EscrowTrade.update(escrow_id, {
      buyer_confirmation_photo: confirmation_photo_url,
      buyer_confirmed_at: new Date().toISOString(),
      status: 'delivered',
      updated_at: new Date().toISOString(),
    });

    // Release USDC to the seller
    const amountWei = BigInt(escrow.usdc_amount_wei || '0');
    const feeWei = BigInt(escrow.fee_wei || '0');
    const sellerNetWei = amountWei - feeWei;

    let releaseTxHash = '';
    let feeTxHash = '';

    if (escrow.trade_type === 'usdc_purchase' && sellerNetWei > 0n) {
      // Get the seller's wallet address
      let sellerWalletAddress = escrow.seller_wallet;
      if (!sellerWalletAddress) {
        const sellerWallets = await base44.asServiceRole.entities.CustodialWallet
          .filter({ did: escrow.seller_did, active: true }, '-created_date', 1).catch(() => []);
        if (sellerWallets.length) sellerWalletAddress = sellerWallets[0].wallet_address;
      }

      if (sellerWalletAddress) {
        // Transfer USDC from the platform escrow wallet to the seller
        const platformWallet = getPlatformWallet();
        const usdcContract = getUsdcContract(platformWallet);

        try {
          const releaseTx = await usdcContract.transfer(sellerWalletAddress, sellerNetWei);
          await releaseTx.wait();
          releaseTxHash = releaseTx.hash;
        } catch (e) {
          console.error('Release transfer failed:', (e as any)?.message);
          return Response.json({ error: 'USDC release failed on-chain' }, { status: 500 });
        }

        // Transfer fee to the platform fee wallet
        try {
          const feeTx = await usdcContract.transfer(PLATFORM_FEE_WALLET, feeWei);
          await feeTx.wait();
          feeTxHash = feeTx.hash;
        } catch (e) {
          console.error('Fee transfer failed:', (e as any)?.message);
        }

        // Credit the seller's balance
        const sellerBalance = await getOrCreateWalletBalance(base44, escrow.seller_did, sellerWalletAddress);
        await updateBalance(base44, sellerBalance.id, {
          usdc_wei: (BigInt(sellerBalance.usdc_wei || '0') + sellerNetWei).toString(),
        });

        // Record the release transfer
        await base44.asServiceRole.entities.CryptoTransfer.create({
          did: escrow.seller_did,
          transfer_type: 'escrow_release',
          from_address: platformWallet.address,
          to_address: sellerWalletAddress,
          amount_wei: sellerNetWei.toString(),
          fee_wei: feeWei.toString(),
          tx_hash: releaseTxHash,
          status: 'confirmed',
          description: `Escrow release for card sale`,
          escrow_trade_id: escrow_id,
        });

        // Record fee in ledger
        await base44.asServiceRole.entities.FeeLedger.create({
          fee_source: 'escrow_purchase',
          source_did: escrow.buyer_did,
          original_amount_wei: amountWei.toString(),
          fee_usdc_wei: feeWei.toString(),
          fee_tx_hash: feeTxHash,
          swept: !!feeTxHash,
          swept_at: feeTxHash ? new Date().toISOString() : undefined,
          reference_id: escrow_id,
        });
      }
    }

    // Mark escrow as released
    const finalEscrow = await base44.entities.EscrowTrade.update(escrow_id, {
      status: 'released',
      release_tx_hash: releaseTxHash,
      updated_at: new Date().toISOString(),
    });

    // Send escrow-released notifications to both parties (in-app + push)
    try {
      const { dispatchNotification } = await import('../../shared/notificationDispatcher.ts');
      const cardSummary = (escrow.card_names || []).slice(0, 2).join(', ') || 'cards';
      const amountUsdc = Number(BigInt(escrow.usdc_amount_wei || '0')) / 1_000_000;
      const sellerNet = Number(sellerNetWei) / 1_000_000;

      // Buyer: purchase complete, payment released
      await base44.asServiceRole.entities.Notification.create({
        did: escrow.buyer_did,
        action_type: 'escrow_released',
        actor_name: 'SwapPulse',
        actor_handle: 'swappulse',
        target_type: 'trade',
        target_path: `/trade/${escrow.trade_listing_id}`,
        target_label: cardSummary,
        is_read: false,
        metadata: { escrowId: escrow_id, tradeType: 'usdc_purchase', amountUsdc, cardNames: escrow.card_names },
      });
      await dispatchNotification(base44.asServiceRole, {
        recipientDid: escrow.buyer_did,
        type: 'escrow_released',
        title: '✅ Escrow Released',
        body: `Your card purchase (${cardSummary}) is complete. Payment has been released to the seller.`,
        params: { tradeId: escrow.trade_listing_id },
        priority: 'high',
      });

      // Seller: payment received
      if (escrow.seller_did && escrow.seller_did !== escrow.buyer_did) {
        await base44.asServiceRole.entities.Notification.create({
          did: escrow.seller_did,
          action_type: 'escrow_released',
          actor_name: 'SwapPulse',
          actor_handle: 'swappulse',
          target_type: 'wallet',
          target_path: '/wallet',
          target_label: `${sellerNet.toFixed(2)} USDC received`,
          is_read: false,
          metadata: { escrowId: escrow_id, tradeType: 'usdc_purchase', amountUsdc: sellerNet, cardNames: escrow.card_names },
        });
        await dispatchNotification(base44.asServiceRole, {
          recipientDid: escrow.seller_did,
          type: 'escrow_released',
          title: '💰 Payment Received',
          body: `${sellerNet.toFixed(2)} USDC from the sale of "${cardSummary}" has been released to your wallet.`,
          params: {},
          priority: 'high',
        });
      }
    } catch (e) {
      console.error('Escrow release notification failed:', (e as any)?.message);
    }

    return Response.json({
      success: true,
      status: 'released',
      release_tx_hash: releaseTxHash,
      fee_tx_hash: feeTxHash,
      seller_net_wei: sellerNetWei.toString(),
    });
  } catch (error: any) {
    console.error('confirm-escrow-receipt error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}