// check-pulse-treasury-gas — admin-only endpoint that checks the PulseChain
// treasury wallet's native PLS (gas) and ERC-20 PULSE token balances. Returns
// whether the treasury needs funding and the recommended top-up amount so the
// admin can fund it from their MetaMask wallet via the fund-pulse-treasury flow.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import {
  getPulseMintWallet,
  getPulseTokenContract,
  getPulseProvider,
} from '../../shared/pulseClient.ts';

// Recommended funding: enough native PLS for ~200 gas-paying transfers at
// ~0.001 PLS each. Keeps the treasury operational between manual top-ups.
const GAS_PER_TX_PLS = 0.001;
const RECOMMENDED_TX_COUNT = 200;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const wallet = getPulseMintWallet();
    const provider = getPulseProvider();
    const token = getPulseTokenContract(provider);

    const [nativeBalance, tokenBalance, chainId] = await Promise.all([
      provider.getBalance(wallet.address).catch(() => 0n),
      token.balanceOf(wallet.address).catch(() => 0n),
      provider.getNetwork().then((n: any) => Number(n.chainId)).catch(() => 0),
    ]);

    // Threshold below which the treasury needs a gas top-up. Matches the
    // recommended amount so one top-up covers ~200 transactions.
    const recommendedFundWei = BigInt(Math.ceil(GAS_PER_TX_PLS * RECOMMENDED_TX_COUNT * 1e18));
    const needsFunding = nativeBalance < recommendedFundWei;

    const rpcUrl = secrets.get('PULSE_RPC_URL') || '';
    const explorerUrl = secrets.get('PULSE_EXPLORER_URL') || '';

    // PulseChain native currency metadata for MetaMask network addition (EIP-3085).
    // Mainnet (369) uses PLS; V4 testnet (943) uses tPLS — mismatch causes MetaMask warnings.
    const isTestnet = chainId === 943;
    const network_params = {
      chainId: `0x${chainId.toString(16)}`,
      chainName: isTestnet ? 'PulseChain V4 Testnet' : 'PulseChain',
      nativeCurrency: { name: isTestnet ? 'Test Pulse' : 'Pulse', symbol: isTestnet ? 'tPLS' : 'PLS', decimals: 18 },
      rpcUrls: [rpcUrl],
      blockExplorerUrls: explorerUrl ? [explorerUrl] : [],
    };

    return Response.json({
      treasury_address: wallet.address,
      chain_id: chainId,
      native_balance_wei: nativeBalance.toString(),
      native_balance_pls: Number(ethers.formatEther(nativeBalance)).toFixed(6),
      pulse_token_balance_wei: tokenBalance.toString(),
      pulse_token_balance: Number(ethers.formatEther(tokenBalance)).toFixed(2),
      needs_funding: needsFunding,
      recommended_fund_wei: recommendedFundWei.toString(),
      recommended_fund_pls: Number(ethers.formatEther(recommendedFundWei)).toFixed(4),
      rpc_url_configured: !!rpcUrl,
      network_params,
    });
  } catch (error: any) {
    console.error('check-pulse-treasury-gas error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}