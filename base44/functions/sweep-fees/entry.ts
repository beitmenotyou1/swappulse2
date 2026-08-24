// sweep-fees — batch-sends accumulated unswept fee USDC to the platform
// fee wallet. Can be called by an admin or a scheduled workflow. Finds
// FeeLedger records where swept=false, transfers the total to the platform
// fee wallet, and marks them swept.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sweepFeeToPlatformWallet, getPlatformWallet, getUsdcContract } from '../../shared/walletEscrow.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Find unswept fees
    const unswept = await base44.asServiceRole.entities.FeeLedger
      .filter({ swept: false }, '-created_date', 500).catch(() => []);
    if (!unswept.length) {
      return Response.json({ success: true, swept_count: 0, total_wei: '0' });
    }

    // Sum the total unswept fees
    const totalWei = unswept.reduce((sum: bigint, f: any) => sum + BigInt(f.fee_usdc_wei || '0'), 0n);
    if (totalWei === 0n) {
      // Mark zero-fee records as swept
      await Promise.all(unswept.map((f: any) =>
        base44.asServiceRole.entities.FeeLedger.update(f.id, { swept: true, swept_at: new Date().toISOString() })
      ));
      return Response.json({ success: true, swept_count: unswept.length, total_wei: '0' });
    }

    // Check the platform wallet has enough USDC to sweep
    const platformWallet = getPlatformWallet();
    const usdcContract = getUsdcContract(platformWallet);
    const platformBalance = await usdcContract.balanceOf(platformWallet.address);
    if (platformBalance < totalWei) {
      return Response.json({
        error: `Insufficient USDC in platform wallet to sweep. Need ${totalWei}, have ${platformBalance}`,
      }, { status: 400 });
    }

    // Sweep the total to the fee wallet
    const { txHash } = await sweepFeeToPlatformWallet(totalWei);

    // Mark all as swept
    await Promise.all(unswept.map((f: any) =>
      base44.asServiceRole.entities.FeeLedger.update(f.id, {
        swept: true,
        swept_at: new Date().toISOString(),
        fee_tx_hash: f.fee_tx_hash || txHash,
      })
    ));

    return Response.json({
      success: true,
      swept_count: unswept.length,
      total_wei: totalWei.toString(),
      tx_hash: txHash,
    });
  } catch (error: any) {
    console.error('sweep-fees error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}