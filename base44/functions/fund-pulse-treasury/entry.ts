// fund-pulse-treasury — admin-only endpoint that verifies a MetaMask-signed
// native PLS transfer to the PulseChain treasury wallet. The admin signs the
// transaction in their browser wallet (MetaMask) sending PLS to the treasury;
// this function confirms the transaction landed on-chain, succeeded, and
// actually sent value to the treasury address — preventing fabricated records.
//
// Optionally accepts `auto_proceed` with a backend function name and payload:
// if the treasury is now funded, the named function is invoked so the admin's
// original action (mint, transfer, etc.) proceeds automatically after funding.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { getPulseMintWallet, getPulseProvider } from '../../shared/pulseClient.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { tx_hash, auto_proceed } = body;

    if (!tx_hash || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash)) {
      return Response.json({ error: 'Invalid transaction hash' }, { status: 400 });
    }

    const provider = getPulseProvider();
    const treasuryAddress = getPulseMintWallet().address;

    // Fetch the receipt — confirms the tx was mined and succeeded
    const receipt = await provider.getTransactionReceipt(tx_hash).catch(() => null);
    if (!receipt) {
      return Response.json({ error: 'Transaction not found on PulseChain (it may still be pending)' }, { status: 400 });
    }
    if (receipt.status !== 1) {
      return Response.json({ error: 'Transaction failed on-chain' }, { status: 400 });
    }

    // Fetch the full transaction to verify the value and recipient
    const tx = await provider.getTransaction(tx_hash).catch(() => null);
    if (!tx) {
      return Response.json({ error: 'Transaction data unavailable' }, { status: 400 });
    }

    // Verify the transaction actually sent native PLS to the treasury address
    if (!tx.to || tx.to.toLowerCase() !== treasuryAddress.toLowerCase()) {
      return Response.json({
        error: `Transaction was sent to ${tx.to || 'unknown'}, not the treasury address ${treasuryAddress}`,
      }, { status: 400 });
    }

    if (!tx.value || tx.value === 0n) {
      return Response.json({ error: 'Transaction sent 0 PLS — no gas was funded' }, { status: 400 });
    }

    const fundedWei = tx.value;
    const fundedFrom = tx.from;

    // Verify the treasury now has enough gas
    const newBalance = await provider.getBalance(treasuryAddress).catch(() => 0n);

    // Optionally proceed with a deferred action now that the treasury is funded
    let proceedResult: any = null;
    if (auto_proceed?.function_name) {
      try {
        proceedResult = await base44.functions.invoke(auto_proceed.function_name, auto_proceed.payload || {});
      } catch (e) {
        proceedResult = { error: (e as any)?.message || 'Auto-proceed failed' };
      }
    }

    return Response.json({
      verified: true,
      treasury_address: treasuryAddress,
      funded_from: fundedFrom,
      amount_funded_wei: fundedWei.toString(),
      amount_funded_pls: Number(ethers.formatEther(fundedWei)).toFixed(6),
      treasury_native_balance_wei: newBalance.toString(),
      treasury_native_balance_pls: Number(ethers.formatEther(newBalance)).toFixed(6),
      proceed_result: proceedResult,
    });
  } catch (error: any) {
    console.error('fund-pulse-treasury error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}