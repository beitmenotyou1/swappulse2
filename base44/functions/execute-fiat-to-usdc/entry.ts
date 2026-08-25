// execute-fiat-to-usdc — converts fiat balance to USDC on Polygon.
// Debits fiat_cents from WalletBalance, sends USDC from the platform
// reserve to the user's custodial wallet, and collects a 2% fee in USDC
// to the platform fee wallet. Requires crypto features to be enabled.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  getOrCreateWalletBalance, updateBalance, creditUsdcFromReserve,
  sweepFeeToPlatformWallet, calculateFee, fiatCentsToUsdcWei,
} from '../../shared/walletEscrow.ts';
import { decryptWithServerKey } from '../../shared/walletCrypto.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { fiat_cents } = body;
    if (!fiat_cents || fiat_cents < 100) {
      return Response.json({ error: 'Minimum conversion is 1.00' }, { status: 400 });
    }

    // Resolve active wallet (MultiChainWallet preferred, CustodialWallet fallback)
    const { resolveActiveWallet } = await import('../../shared/walletEscrow.ts');
    const activeWallet = await resolveActiveWallet(base44, did);
    if (!activeWallet) return Response.json({ error: 'No active wallet found' }, { status: 400 });
    const walletAddress = activeWallet.wallet_address;

    // Get or create the wallet balance
    const balance = await getOrCreateWalletBalance(base44, did, walletAddress);
    if (balance.fiat_cents < fiat_cents) {
      return Response.json({ error: 'Insufficient fiat balance' }, { status: 400 });
    }

    // Calculate amounts
    const usdcWei = fiatCentsToUsdcWei(fiat_cents);
    const feeWei = calculateFee(usdcWei);
    const netWei = usdcWei - feeWei;

    // Debit fiat from balance
    await updateBalance(base44, balance.id, {
      fiat_cents: balance.fiat_cents - fiat_cents,
      usdc_wei: (BigInt(balance.usdc_wei || '0') + netWei).toString(),
      total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
    });

    // Send USDC from platform reserve to user's wallet (net amount)
    let creditTxHash = '';
    let feeTxHash = '';
    try {
      const creditResult = await creditUsdcFromReserve(walletAddress, netWei);
      creditTxHash = creditResult.txHash;
    } catch (e) {
      // Revert balance on failure
      await updateBalance(base44, balance.id, {
        fiat_cents: balance.fiat_cents,
        usdc_wei: balance.usdc_wei,
        total_fees_paid_wei: balance.total_fees_paid_wei,
      });
      return Response.json({ error: 'On-chain USDC transfer failed: ' + (e as any)?.message }, { status: 500 });
    }

    // Sweep fee to platform fee wallet
    try {
      const feeResult = await sweepFeeToPlatformWallet(feeWei);
      feeTxHash = feeResult.txHash;
    } catch (e) {
      console.error('Fee sweep failed:', (e as any)?.message);
    }

    // Record the transfer
    await base44.entities.CryptoTransfer.create({
      did,
      transfer_type: 'fiat_to_usdc',
      from_address: 'platform_reserve',
      to_address: walletAddress,
      amount_wei: netWei.toString(),
      fee_wei: feeWei.toString(),
      tx_hash: creditTxHash,
      status: 'confirmed',
      description: `Converted ${(fiat_cents / 100).toFixed(2)} ${body.currency || 'GBP'} to USDC`,
    });

    // Record fee in ledger
    await base44.asServiceRole.entities.FeeLedger.create({
      fee_source: 'fiat_to_usdc',
      source_did: did,
      original_amount_cents: fiat_cents,
      original_amount_wei: usdcWei.toString(),
      fee_usdc_wei: feeWei.toString(),
      fee_tx_hash: feeTxHash,
      swept: !!feeTxHash,
      swept_at: feeTxHash ? new Date().toISOString() : undefined,
    });

    return Response.json({
      success: true,
      usdc_credited_wei: netWei.toString(),
      fee_wei: feeWei.toString(),
      tx_hash: creditTxHash,
      fee_tx_hash: feeTxHash,
    });
  } catch (error: any) {
    console.error('execute-fiat-to-usdc error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}