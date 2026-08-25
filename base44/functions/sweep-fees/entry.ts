// sweep-fees — batch-sends accumulated unswept fee USDC to the platform
// fee wallet on Polygon. If the platform wallet doesn't have enough USDC,
// swaps POL for USDC via the Velora DEX first (gas paid in POL). Can be
// called by an admin (via the dashboard button) or by a scheduled workflow
// (via the BACKEND_FUNCTION_SECRET header).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { sweepFeesOnChain, getPlatformWallet, getUsdcContract, getProvider } from '../../shared/walletEscrow.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: shared secret (X-Trigger-Secret header or trigger_secret body)
    // or admin caller (platform injects admin JWT for workflow calls).
    const expectedSecret = Deno.env.get('BACKEND_FUNCTION_SECRET');
    const headerSecret = req.headers.get('x-trigger-secret') || '';
    let bodySecret = '';
    try {
      const body = await req.clone().json().catch(() => ({}));
      bodySecret = String(body?.trigger_secret || '');
    } catch {}
    const secretOk = expectedSecret && expectedSecret.length > 0 &&
      (headerSecret === expectedSecret || bodySecret === expectedSecret);

    if (!secretOk) {
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

    // Minimum sweep threshold: don't sweep if total < 0.50 USDC (500000 wei).
    // Wait for more fees to accumulate to avoid wasting gas on tiny swaps.
    // Admin-triggered sweeps bypass this threshold (force=true in args).
    const MIN_SWEEP_WEI = 500000n;
    let forceSweep = false;
    try {
      const body = await req.clone().json().catch(() => ({}));
      forceSweep = !!body?.force;
    } catch {}
    if (totalWei < MIN_SWEEP_WEI && !forceSweep) {
      return Response.json({
        success: true,
        skipped: true,
        reason: 'Below minimum sweep threshold',
        pending_count: unswept.length,
        total_wei: totalWei.toString(),
      });
    }

    // Sweep: swap POL for USDC if needed, then transfer to fee wallet.
    // If this throws, fees stay unswept and will be retried next cycle.
    const { txHash, swapTxHash } = await sweepFeesOnChain(totalWei);

    // Mark all as swept only after on-chain transfer succeeds
    await Promise.all(unswept.map((f: any) =>
      base44.asServiceRole.entities.FeeLedger.update(f.id, {
        swept: true,
        swept_at: new Date().toISOString(),
        fee_tx_hash: f.fee_tx_hash || txHash,
      })
    ));

    // Report platform wallet POL + USDC balances for gasless monitoring.
    // The admin dashboard uses these to alert when the wallet needs a POL top-up.
    let polBalance = null;
    let usdcBalance = null;
    try {
      const provider = getProvider();
      const platformWallet = getPlatformWallet();
      polBalance = (await provider.getBalance(platformWallet.address)).toString();
      const usdcContract = getUsdcContract(platformWallet);
      usdcBalance = (await usdcContract.balanceOf(platformWallet.address)).toString();
    } catch (e) {
      console.error('Balance check failed:', (e as any)?.message);
    }

    return Response.json({
      success: true,
      swept_count: unswept.length,
      total_wei: totalWei.toString(),
      tx_hash: txHash,
      swap_tx_hash: swapTxHash || null,
      platform_pol_wei: polBalance,
      platform_usdc_wei: usdcBalance,
    });
  } catch (error: any) {
    console.error('sweep-fees error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}