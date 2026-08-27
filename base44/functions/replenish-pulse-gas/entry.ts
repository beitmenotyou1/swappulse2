import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import { getPulseMintWallet, getPulseTokenContract, getPulseProvider } from '../../shared/pulseClient.ts';

// Auto-replenishes the relayer wallet's native PLS gas by swapping collected
// $PULSE fee balance to PLS through a PulseX pool. Called every 10 minutes by
// the "Pulse Gas Replenish" scheduled workflow. Only spends collected platform
// $PULSE fees held by the treasury — never user principal.
//
// Requires secrets (set after confirming the addresses on your chain):
//   PULSEX_ROUTER_ADDRESS — PulseX V2 router
//   PULSEX_WPLS_ADDRESS   — wrapped PLS (the swap path's other leg)
//
// If the router isn't configured, the pool lacks liquidity, or the swap would
// exceed the slippage tolerance, the job logs and skips — it never halts the
// gasless service. Admins see the status in the PulseChain Treasury section.
const MIN_PLS_THRESHOLD = ethers.parseEther('0.2'); // top up when relayer PLS drops below this
const SWAP_SLIPPAGE_BPS = 300; // 3% max slippage on the PLS received
const SWAP_FRACTION_DIVISOR = 20n; // swap 1/20 (5%) of the PULSE fee balance per run

const PULSEX_ROUTER_ABI = [
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)',
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)',
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Admin-only for direct invocation; the scheduled workflow calls with the
    // BACKEND_FUNCTION_SECRET bearer token.
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      const secret = secrets.get('BACKEND_FUNCTION_SECRET');
      const authHeader = req.headers.get('authorization');
      if (!secret || authHeader !== `Bearer ${secret}`) {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
    }

    const wallet = getPulseMintWallet();
    const provider = getPulseProvider();
    const token = getPulseTokenContract(wallet);

    const nativeBalance = await provider.getBalance(wallet.address).catch(() => 0n);
    if (nativeBalance >= MIN_PLS_THRESHOLD) {
      return Response.json({ skipped: true, reason: 'relayer PLS above threshold', native_balance_wei: nativeBalance.toString() });
    }

    const routerAddress = secrets.get('PULSEX_ROUTER_ADDRESS');
    const wplsAddress = secrets.get('PULSEX_WPLS_ADDRESS');
    const tokenAddress = secrets.get('PULSE_TOKEN_CONTRACT');
    if (!routerAddress || !wplsAddress || !tokenAddress) {
      return Response.json({ skipped: true, reason: 'PulseX router/WPLS/token addresses not configured', native_balance_wei: nativeBalance.toString() });
    }

    // Only swap collected platform fees — a slice of the treasury PULSE
    // balance, not user principal. Swap 5% per run to limit price impact.
    const pulseBalance = await token.balanceOf(wallet.address).catch(() => 0n);
    if (pulseBalance === 0n) {
      return Response.json({ skipped: true, reason: 'no PULSE fees collected to swap', native_balance_wei: nativeBalance.toString() });
    }
    const swapAmount = pulseBalance / SWAP_FRACTION_DIVISOR;
    if (swapAmount === 0n) {
      return Response.json({ skipped: true, reason: 'PULSE balance too small to swap', native_balance_wei: nativeBalance.toString() });
    }

    const router = new ethers.Contract(routerAddress, PULSEX_ROUTER_ABI, wallet);
    const path = [tokenAddress, wplsAddress];

    // Check expected output + liquidity before swapping.
    const amounts = await router.getAmountsOut(swapAmount, path).catch(() => null);
    if (!amounts || amounts.length < 2 || amounts[1] === 0n) {
      return Response.json({ skipped: true, reason: 'PulseX pool has no liquidity for PULSE→PLS', native_balance_wei: nativeBalance.toString() });
    }
    const expectedPls = amounts[1];
    const minOut = (expectedPls * BigInt(10000 - SWAP_SLIPPAGE_BPS)) / 10000n;

    // Approve the router to spend the swap amount (idempotent).
    const allowance = await token.allowance(wallet.address, routerAddress).catch(() => 0n);
    if (allowance < swapAmount) {
      const approveTx = await token.approve(routerAddress, swapAmount);
      await approveTx.wait();
    }

    const deadline = Math.floor(Date.now() / 1000) + 600;
    const swapTx = await router.swapExactTokensForETH(swapAmount, minOut, path, wallet.address, deadline);
    const receipt = await swapTx.wait();

    const newBalance = await provider.getBalance(wallet.address).catch(() => 0n);
    return Response.json({
      swapped: true,
      pulse_in_wei: swapAmount.toString(),
      pls_out_wei: expectedPls.toString(),
      min_out_wei: minOut.toString(),
      tx_hash: receipt.hash,
      new_native_balance_wei: newBalance.toString(),
    });
  } catch (error: any) {
    console.error('replenish-pulse-gas error:', error?.message || error);
    // Never throw — a failed swap must not halt the gasless service.
    return Response.json({ skipped: true, error: error?.message || 'Swap failed' });
  }
}