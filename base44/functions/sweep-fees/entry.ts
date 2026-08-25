// sweep-fees — batch-sends accumulated unswept fee USDC to the platform
// fee wallet on Polygon. If the platform wallet doesn't have enough USDC,
// swaps POL for USDC via the Velora DEX first (gas paid in POL). Can be
// called by an admin (via the dashboard button) or by a scheduled workflow
// (via the BACKEND_FUNCTION_SECRET header).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sweepFeesOnChain, getPlatformWallet, getUsdcContract } from '../../shared/walletEscrow.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: admin user OR workflow with secret
    const secretHeader = req.headers.get('x-backend-secret') || '';
    const backendSecret = Deno.env.get('BACKEND_FUNCTION_SECRET');
    const isWorkflow = backendSecret && secretHeader === backendSecret;

    if (!isWorkflow) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    }

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
        base44.asServiceRole.entities.FeeLedger.update(f.id, {
          swept: true, swept_at: new Date().toISOString(),
        })
      ));
      return Response.json({ success: true, swept_count: unswept.length, total_wei: '0' });
    }

    // Sweep: swap POL for USDC if needed, then transfer to fee wallet
    const { txHash, swapTxHash } = await sweepFeesOnChain(totalWei);

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
      swap_tx_hash: swapTxHash || null,
    });
  } catch (error: any) {
    console.error('sweep-fees error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}