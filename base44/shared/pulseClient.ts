// Shared PulseChain (EVM validium) client for SwapPulse backend functions.
// Mirrors the pattern of polygonClient.ts but targets the PulseChain testnet.
//
// Contract addresses are read from secrets (set after deploy-pulse-contracts).
// ABIs are imported from pulseCompiledArtifacts.ts (single source of truth).

import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import {
  PULSE_USERNAME_ABI,
  PULSE_CARD_ABI,
  PULSE_BRIDGE_ABI,
} from './pulseCompiledArtifacts.ts';
import { CARD_METADATA_ANCHOR_ABI } from './cardMetadataAnchorArtifacts.ts';

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

export function getPulseUsernameContractAddress(): string | null {
  return secrets.get('PULSE_SPUN_CONTRACT') || null;
}

export function getPulseCardContractAddress(): string | null {
  return secrets.get('PULSE_SPCD_CONTRACT') || null;
}

export function getPulseBridgeContractAddress(): string | null {
  return secrets.get('PULSE_BRIDGE_CONTRACT') || null;
}

export function getPulseUsernameContract(signerOrProvider: any): ethers.Contract {
  const address = getPulseUsernameContractAddress();
  if (!address) throw new Error('Pulse username contract not deployed. Run deploy-pulse-contracts first and set PULSE_SPUN_CONTRACT secret.');
  return new ethers.Contract(address, PULSE_USERNAME_ABI, signerOrProvider);
}

export function getPulseCardContract(signerOrProvider: any): ethers.Contract {
  const address = getPulseCardContractAddress();
  if (!address) throw new Error('Pulse card contract not deployed. Run deploy-pulse-contracts first and set PULSE_SPCD_CONTRACT secret.');
  return new ethers.Contract(address, PULSE_CARD_ABI, signerOrProvider);
}

export function getPulseBridgeContract(signerOrProvider: any): ethers.Contract {
  const address = getPulseBridgeContractAddress();
  if (!address) throw new Error('Pulse bridge contract not deployed. Run deploy-pulse-contracts first and set PULSE_BRIDGE_CONTRACT secret.');
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