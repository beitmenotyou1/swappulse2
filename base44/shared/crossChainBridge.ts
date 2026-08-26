// Cross-Chain Bridge Client for LayerZero OFT $PULSE transfers.
// Provides a unified interface for sending $PULSE between PulseChain and Polygon.
// Uses the OFTPulseToken contract (OFT v2 pattern) under the hood.
//
// LayerZero OFT: https://layerzero.gitbook.io/docs/layerzero-v2-developer-docs/guides/basic/oft-overview

import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import { OFT_PULSE_TOKEN_ABI } from './oftPulseTokenArtifacts.ts';

// Re-export for convenience so backend functions can import from one place
export { OFT_PULSE_TOKEN_ABI } from './oftPulseTokenArtifacts.ts';

// LayerZero V2 Chain IDs (testnet — verify against https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts)
export const LAYERZERO_CHAIN_IDS = {
  pulseChain: 30104,
  polygonAmoy: 1026,
  ethereumSepolia: 4027,
} as const;

// SwapPulse fee constants (matching the on-chain contract)
const BASE_FEE_WEI = 1_000_000_000_000_000n; // 0.001 PULSE
const VAR_FEE_BPS = 10n; // 0.1%

export type ChainKey = 'pulse' | 'polygon';

function getRpcUrl(chain: ChainKey): string {
  if (chain === 'pulse') return secrets.get('PULSE_RPC_URL') || '';
  return secrets.get('POLYGON_RPC_URL') || '';
}

function getOftAddress(chain: ChainKey): string | null {
  if (chain === 'pulse') return secrets.get('OFT_PULSE_TOKEN_CONTRACT') || null;
  return secrets.get('OFT_POLYGON_TOKEN_CONTRACT') || null;
}

function getExplorerUrl(chain: ChainKey): string {
  if (chain === 'pulse') return secrets.get('PULSE_EXPLORER_URL') || '';
  return secrets.get('POLYGON_EXPLORER_URL') || '';
}

export function getOftContract(signerOrProvider: any, chain: ChainKey): ethers.Contract {
  const address = getOftAddress(chain);
  if (!address) throw new Error(`OFT_${chain.toUpperCase()}_TOKEN_CONTRACT secret not set. Deploy the OFT contract on ${chain} first.`);
  return new ethers.Contract(address, OFT_PULSE_TOKEN_ABI, signerOrProvider);
}

export function getLzChainId(chain: ChainKey): number {
  return chain === 'pulse' ? LAYERZERO_CHAIN_IDS.pulseChain : LAYERZERO_CHAIN_IDS.polygonAmoy;
}

/**
 * Quote the estimated gas cost and SwapPulse fees for a cross-chain transfer.
 */
export async function quoteCrossChainGas(
  fromChain: ChainKey,
  toChain: ChainKey,
  amountWei: bigint,
): Promise<{ lzGasCost: bigint; swapPulseFee: bigint; totalCost: bigint }> {
  const provider = new ethers.JsonRpcProvider(getRpcUrl(fromChain));
  const contract = getOftContract(provider, fromChain);
  const dstChainId = getLzChainId(toChain);

  const lzGas = await contract.quoteDestinationGas(dstChainId);

  const variableFee = (amountWei * VAR_FEE_BPS) / 10000n;
  const swapPulseFee = BASE_FEE_WEI + variableFee;

  return {
    lzGasCost: BigInt(lzGas),
    swapPulseFee,
    totalCost: BigInt(lzGas) + swapPulseFee,
  };
}

/**
 * Send $PULSE from one chain to another using a server-side signer (custodial wallet).
 * The caller must provide an unlocked ethers.Wallet connected to the source chain.
 */
export async function sendCrossChain(
  fromChain: ChainKey,
  toChain: ChainKey,
  toAddress: string,
  amountWei: bigint,
  wallet: ethers.Wallet,
): Promise<{ txHash: string; explorerUrl: string; etaSeconds: number }> {
  const contract = getOftContract(wallet, fromChain);
  const dstChainId = getLzChainId(toChain);

  // Check peer is configured
  const peer = await contract.peers(dstChainId);
  if (peer === ethers.ZeroAddress) {
    throw new Error(`Peer not configured for destination chain ${toChain}. Run configure-lz-peers first.`);
  }

  // Quote gas
  const { lzGasCost, swapPulseFee } = await quoteCrossChainGas(fromChain, toChain, amountWei);

  // Approve the OFT contract to spend tokens (including fee)
  const oftAddress = await contract.getAddress();
  const tokenContract = new ethers.Contract(
    secrets.get(fromChain === 'pulse' ? 'PULSE_TOKEN_CONTRACT' : 'POLYGON_USDC_CONTRACT') || oftAddress,
    ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'],
    wallet,
  );

  // Check current allowance
  const currentAllowance = await contract.allowance(wallet.address, oftAddress);
  const totalNeeded = amountWei + swapPulseFee;
  if (currentAllowance < totalNeeded) {
    const approveTx = await contract.approve(oftAddress, totalNeeded);
    await approveTx.wait();
  }

  // Send via LayerZero
  const tx = await contract.send(
    dstChainId,
    toAddress,
    amountWei,
    '0x', // default adapter params
    { value: lzGasCost },
  );
  const receipt = await tx.wait();

  return {
    txHash: tx.hash,
    explorerUrl: `${getExplorerUrl(fromChain)}/tx/${tx.hash}`,
    etaSeconds: 180, // ~3 minutes average on testnet
  };
}

/**
 * Build the raw transaction data for a cross-chain send (for client-side signing via MetaMask).
 */
export function buildSendTransactionData(
  fromChain: ChainKey,
  toChain: ChainKey,
  toAddress: string,
  amountWei: bigint,
): { to: string; data: string; value: string } {
  const oftAddress = getOftAddress(fromChain);
  if (!oftAddress) throw new Error(`OFT contract not deployed on ${fromChain}`);

  const dstChainId = getLzChainId(toChain);
  const iface = new ethers.Interface(OFT_PULSE_TOKEN_ABI);
  const data = iface.encodeFunctionData('send', [dstChainId, toAddress, amountWei, '0x']);

  // Estimate gas cost (hardcoded match to contract's quoteDestinationGas)
  const lzGasCost = 80000n * 20_000_000_000n;

  return {
    to: oftAddress,
    data,
    value: lzGasCost.toString(),
  };
}