// DEX aggregator integration using Velora (formerly ParaSwap, public API,
// no key required). Handles EVM token swaps across 10+ EVM chains including
// Ethereum, Polygon, and Arbitrum. Velora aggregates 160+ DEX integrations
// with MEV protection. For non-EVM chains, conversions route through the
// platform USDC reserve at Coinbase-fetched market rates.

import { ethers } from 'npm:ethers@6.13.4';
import { assertSafeHost } from './ssrfGuard.ts';

const VELORA_API = 'https://api.velora.xyz';
const PARTNER = 'swappulse';

const ERC20_ABI = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export interface DexQuote {
  srcToken: string;
  destToken: string;
  srcAmount: string;
  destAmount: string;
  priceRoute: any;
  network: number;
}

// Fetch a swap quote from Velora
export async function fetchDexQuote(params: {
  srcToken: string;
  destToken: string;
  amount: string;
  network: number;
}): Promise<DexQuote> {
  const url = new URL(`${VELORA_API}/prices`);
  url.searchParams.set('srcToken', params.srcToken);
  url.searchParams.set('destToken', params.destToken);
  url.searchParams.set('amount', params.amount);
  url.searchParams.set('side', 'SELL');
  url.searchParams.set('network', String(params.network));
  url.searchParams.set('partner', PARTNER);

  await assertSafeHost(url.hostname);
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Velora quote failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const pr = data.priceRoute;
  if (!pr || !pr.destAmount) throw new Error('Velora returned no price route');
  return {
    srcToken: params.srcToken,
    destToken: params.destToken,
    srcAmount: params.amount,
    destAmount: pr.destAmount,
    priceRoute: pr,
    network: params.network,
  };
}

// Build and execute the swap transaction from the given wallet
export async function executeDexSwap(
  userWallet: ethers.Wallet,
  quote: DexQuote,
): Promise<{ txHash: string; destAmount: string }> {
  // Build the swap transaction via Velora
  const txBody = {
    priceRoute: quote.priceRoute,
    srcToken: quote.srcToken,
    destToken: quote.destToken,
    srcAmount: quote.srcAmount,
    destAmount: quote.destAmount,
    userAddress: userWallet.address,
    partner: PARTNER,
    slippage: 5000, // 0.5% in basis points
  };

  const res = await fetch(`${VELORA_API}/transactions/${quote.network}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(txBody),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Velora tx build failed (${res.status}): ${text}`);
  }
  const txData = await res.json();

  // Check and set ERC20 allowance for the spender (txData.to = Augustus router)
  if (quote.srcToken !== ethers.ZeroAddress) {
    const srcContract = new ethers.Contract(quote.srcToken, ERC20_ABI, userWallet);
    const allowance = await srcContract.allowance(userWallet.address, txData.to);
    if (allowance < BigInt(quote.srcAmount)) {
      const approveTx = await srcContract.approve(txData.to, ethers.MaxUint256);
      await approveTx.wait();
    }
  }

  // Send the swap transaction
  const tx = await userWallet.sendTransaction({
    to: txData.to,
    data: txData.data,
    value: txData.value ? BigInt(txData.value) : undefined,
    gasLimit: txData.gas ? BigInt(txData.gas) : undefined,
    gasPrice: txData.gasPrice ? BigInt(txData.gasPrice) : undefined,
  });
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error('DEX swap failed on-chain');

  return { txHash: tx.hash, destAmount: quote.destAmount };
}