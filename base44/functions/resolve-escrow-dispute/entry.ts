// resolve-escrow-dispute — an admin/moderator resolves a disputed escrow.
// Can release funds to the seller, refund the buyer, or cancel the escrow.
// For usdc_purchase: 'release' sends USDC to seller, 'refund' returns USDC
// to buyer, 'cancel' cancels with no transfer. For card_swap: 'release'
// marks complete, 'cancel' cancels.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  getOrCreateWalletBalance, updateBalance, getPlatformWallet, getUsdcContract,
  PLATFORM_FEE_WALLET,
} from '../../shared/walletEscrow.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'moderator') {
      return Response.json({ error: 'Admin or moderator only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { escrow_id, resolution, notes } = body;
    if (!escrow_id) return Response.json({ error: 'Missing escrow id' }, { status: 400 });
    if (!['release', 'refund', 'cancel'].includes(resolution)) {
      return Response.json({ error: 'Invalid resolution' }, { status: 400 });
    }

    const escrow = await base44.entities.EscrowTrade.get(escrow_id).catch(() => null);
    if (!escrow) return Response.json({ error: 'Escrow not found' }, { status: 404 });
    if (escrow.status !== 'disputed') {
      return Response.json({ error: 'Escrow is not in dispute' }, { status: 400 });
    }

    const amountWei = BigInt(escrow.usdc_amount_wei || '0');
    const feeWei = BigInt(escrow.fee_wei || '0');
    let txHash = '';

    if (escrow.trade_type === 'usdc_purchase' && amountWei > 0n) {
      const platformWallet = getPlatformWallet();
      const usdcContract = getUsdcContract(platformWallet);

      if (resolution === 'release') {
        // Release to seller (minus fee)
        const sellerNet = amountWei - feeWei;
        let sellerWalletAddress = escrow.seller_wallet;
        if (!sellerWalletAddress) {
          const sellerWallets = await base44.asServiceRole.entities.CustodialWallet
            .filter({ did: escrow.seller_did, active: true }, '-created_date', 1).catch(() => []);
          if (sellerWallets.length) sellerWalletAddress = sellerWallets[0].wallet_address;
        }
        if (sellerWalletAddress) {
          const tx = await usdcContract.transfer(sellerWalletAddress, sellerNet);
          await tx.wait();
          txHash = tx.hash;
          const sellerBalance = await getOrCreateWalletBalance(base44, escrow.seller_did, sellerWalletAddress);
          await updateBalance(base44, sellerBalance.id, {
            usdc_wei: (BigInt(sellerBalance.usdc_wei || '0') + sellerNet).toString(),
          });
        }
        // Sweep fee
        try {
          const feeTx = await usdcContract.transfer(PLATFORM_FEE_WALLET, feeWei);
          await feeTx.wait();
        } catch (e) { console.error('Fee sweep failed:', (e as any)?.message); }
      } else if (resolution === 'refund') {
        // Refund to buyer (full amount, no fee)
        let buyerWalletAddress = escrow.buyer_wallet;
        if (!buyerWalletAddress) {
          const buyerWallets = await base44.asServiceRole.entities.CustodialWallet
            .filter({ did: escrow.buyer_did, active: true }, '-created_date', 1).catch(() => []);
          if (buyerWallets.length) buyerWalletAddress = buyerWallets[0].wallet_address;
        }
        if (buyerWalletAddress) {
          const tx = await usdcContract.transfer(buyerWalletAddress, amountWei);
          await tx.wait();
          txHash = tx.hash;
          const buyerBalance = await getOrCreateWalletBalance(base44, escrow.buyer_did, buyerWalletAddress);
          await updateBalance(base44, buyerBalance.id, {
            usdc_wei: (BigInt(buyerBalance.usdc_wei || '0') + amountWei).toString(),
          });
        }
      }
    }

    const finalStatus = resolution === 'cancel' ? 'cancelled' : resolution === 'refund' ? 'refunded' : 'released';
    const updated = await base44.entities.EscrowTrade.update(escrow_id, {
      status: finalStatus,
      release_tx_hash: txHash || escrow.release_tx_hash,
      resolution_notes: notes || '',
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      status: finalStatus,
      tx_hash: txHash,
    });
  } catch (error: any) {
    console.error('resolve-escrow-dispute error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}