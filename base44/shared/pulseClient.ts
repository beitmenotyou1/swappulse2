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