// Shared PulseChain (EVM validium) client for SwapPulse backend functions.
// Mirrors the pattern of polygonClient.ts but targets the PulseChain testnet.
//
// Contract addresses are resolved from the ContractRegistry (populated by
// deploy-pulse-contracts / deploy-card-metadata-anchor) so no per-contract
// secrets are required. ABIs are imported from pulseCompiledArtifacts.ts.

import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import {
  PULSE_USERNAME_ABI,
  PULSE_CARD_ABI,
  PULSE_BRIDGE_ABI,
} from './pulseCompiledArtifacts.ts';
import { PULSE_TOKEN_ABI } from './pulseTokenArtifacts.ts';
import { CARD_METADATA_ANCHOR_ABI } from './cardMetadataAnchorArtifacts.ts';
import { resolveDeployedAddress } from './contractRegistry.ts';

export function getPulseProvider(): ethers.JsonRpcProvider {
  const rpcUrl = secrets.get('PULSE_RPC_URL');
  if (!rpcUrl) throw new Error('PULSE_RPC_URL secret not set');
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getPulseMintWallet(): ethers.Wallet {
  const privateKey = secrets.get('PULSE_PRIVATE_KEY');
  if (!privateKey) throw new Error('PULSE_PRIVATE_KEY secret not set');
  return new ethers.Wallet(privateKey, getPulseProvider());
}

// The $PULSE ERC-20 token contract (PulseToken) deployed on PulseChain. The
// treasury holds the token supply here — NOT as native gas coin. Conversions
// disburse PULSE by calling transfer() on this contract, not by sending native
// value. Address is the PULSE_TOKEN_CONTRACT secret.
export function getPulseTokenContract(signer?: any): ethers.Contract {
  const address = secrets.get('PULSE_TOKEN_CONTRACT');
  if (!address) throw new Error('PULSE_TOKEN_CONTRACT secret not set');
  return new ethers.Contract(address, PULSE_TOKEN_ABI, signer ?? getPulseProvider());
}

// Returns the treasury's ERC-20 PULSE balance (wei). This is the token the
// conversion disburses — the native gas coin (PLS) is only for gas, not the
// $PULSE token itself. Pre-flight check uses this to abort cleanly if the
// treasury can't cover the disbursement.
export async function getPulseTreasuryBalanceWei(): Promise<bigint> {
  const wallet = getPulseMintWallet();
  const token = getPulseTokenContract(wallet);
  return token.balanceOf(wallet.address);
}

// Pre-flight: verify the treasury can both cover the ERC-20 PULSE disbursement
// AND pay for the gas of the transfer transaction. Returns null if OK, or a
// human-readable error string if the treasury is unfunded (ERC-20) or out of
// native gas. Used by execute-conversion so it aborts BEFORE collecting USDC.
export async function assertPulseTreasuryCanDisburse(pulseWei: bigint): Promise<string | null> {
  const wallet = getPulseMintWallet();
  const token = getPulseTokenContract(wallet);
  const [tokenBalance, nativeBalance] = await Promise.all([
    token.balanceOf(wallet.address).catch(() => 0n),
    wallet.provider.getBalance(wallet.address).catch(() => 0n),
  ]);
  if (tokenBalance < pulseWei) {
    return 'PULSE treasury temporarily unfunded. Please try again later or contact support.';
  }
  if (nativeBalance === 0n) {
    return 'PULSE treasury has no native gas for the transfer. Please fund the treasury wallet with native PLS for gas and try again.';
  }
  return null;
}

export function getPulseChainId(): string {
  return secrets.get('PULSE_CHAIN_ID') || '9999';
}

export function getPulseExplorerUrl(): string {
  return secrets.get('PULSE_EXPLORER_URL') || 'https://explorer-testnet.swappulse.org';
}

// --- Address resolution (async, from ContractRegistry) ---

export async function getPulseUsernameContractAddress(svc?: any): Promise<string | null> {
  return resolveDeployedAddress(svc, 'pulse_username');
}

export async function getPulseCardContractAddress(svc?: any): Promise<string | null> {
  return resolveDeployedAddress(svc, 'pulse_card');
}

export async function getPulseBridgeContractAddress(svc?: any): Promise<string | null> {
  return resolveDeployedAddress(svc, 'pulse_bridge');
}

export async function getPulseAnchorContractAddress(svc?: any): Promise<string | null> {
  return resolveDeployedAddress(svc, 'card_metadata_anchor');
}

export async function getPulseUsernameContract(signerOrProvider: any, svc?: any): Promise<ethers.Contract> {
  const address = await getPulseUsernameContractAddress(svc);
  if (!address) throw new Error('Pulse username contract not deployed. Run deploy-pulse-contracts first.');
  return new ethers.Contract(address, PULSE_USERNAME_ABI, signerOrProvider);
}

export async function getPulseCardContract(signerOrProvider: any, svc?: any): Promise<ethers.Contract> {
  const address = await getPulseCardContractAddress(svc);
  if (!address) throw new Error('Pulse card contract not deployed. Run deploy-pulse-contracts first.');
  return new ethers.Contract(address, PULSE_CARD_ABI, signerOrProvider);
}

export async function getPulseBridgeContract(signerOrProvider: any, svc?: any): Promise<ethers.Contract> {
  const address = await getPulseBridgeContractAddress(svc);
  if (!address) throw new Error('Pulse bridge contract not deployed. Run deploy-pulse-contracts first.');
  return new ethers.Contract(address, PULSE_BRIDGE_ABI, signerOrProvider);
}

// Parse a Mint event from a PulseChain transaction receipt to extract the
// token ID and recipient. The v2 Mint event includes a sourceChain parameter.
export function parsePulseMintEvent(contract: ethers.Contract, receipt: any): { tokenId: number; to: string } {
  const mintTopic = contract.interface.getEvent('Mint')?.topicHash;
  const log = receipt.logs?.find((l: any) => l.topics?.[0] === mintTopic);
  if (!log) throw new Error('Mint event not found in PulseChain transaction receipt');
  const decoded = contract.interface.parseLog(log);
  return {
    tokenId: Number(decoded.args.tokenId),
    to: decoded.args.to,
  };
}

export async function getPulseAnchorContract(signerOrProvider: any, svc?: any): Promise<ethers.Contract> {
  const address = await getPulseAnchorContractAddress(svc);
  if (!address) throw new Error('Card metadata anchor contract not deployed. Run deploy-card-metadata-anchor first.');
  return new ethers.Contract(address, CARD_METADATA_ANCHOR_ABI, signerOrProvider);
}

// --- Gas funding for custodial wallets on PulseChain ---

// Minimum native PLS a user's custodial wallet needs for gas on PulseChain.
// If below this, the platform treasury sends a small stipend so ERC-20 PULSE
// transfers don't fail with "insufficient funds for intrinsic transaction".
// Mirrors the Polygon ensureGasFunds helper in walletEscrow.ts.
const MIN_GAS_PLS = 10_000_000_000_000_000_000n; // 0.01 PLS threshold (1 PLS = 1e18 wei)
const PLS_GAS_STIPEND = 50_000_000_000_000_000_000n; // 0.05 PLS stipend (covers a transfer)

// Ensure a user's custodial wallet has enough native PLS for gas on PulseChain.
// If the balance is below the threshold, send a small stipend from the
// treasury wallet. Idempotent — only tops up when needed. Returns whether gas
// was funded and the funding tx hash.
export async function ensurePulseGasFunds(
  userAddress: string,
): Promise<{ funded: boolean; txHash?: string }> {
  const provider = getPulseProvider();
  const balance = await provider.getBalance(userAddress).catch(() => 0n);
  if (balance >= MIN_GAS_PLS) return { funded: false };
  const treasury = getPulseMintWallet();
  const tx = await treasury.sendTransaction({ to: userAddress, value: PLS_GAS_STIPEND });
  await tx.wait();
  return { funded: true, txHash: tx.hash };
}