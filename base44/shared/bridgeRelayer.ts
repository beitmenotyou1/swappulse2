// Bridge Relayer — relays NFT mints from Polygon to PulseChain.
//
// Called by the dual-mint engine after a Polygon mint confirms. Calls
// PulseChainBridge.bridgeFromPolygon() which:
//   1. Checks the source tx hash hasn't already been bridged (idempotency).
//   2. Mints a mirrored NFT on PulseChain via the v2 contracts (sourceChain=1).
//   3. Emits a BridgeMint event with the PulseChain token ID.
//
// The source tx hash is converted to bytes32 via ethers.id() (keccak256) to
// produce a deterministic 32-byte idempotency key.

import { ethers } from 'npm:ethers@6.13.4';
import { getPulseMintWallet, getPulseBridgeContract } from './pulseClient.ts';

export interface BridgeMintRequest {
  assetType: 'username' | 'card';
  to: string;
  handleOrCardId: string;
  nameOrCardName: string;
  didOrCardImage: string;
  metadataURI: string;
  verificationLevel: number;
  sourceTxHash: string;
}

export interface BridgeMintResult {
  pulseTokenId: number;
  pulseTxHash: string;
  pulseBlockNumber: number;
}

export async function relayBridgeMint(request: BridgeMintRequest, svc?: any): Promise<BridgeMintResult> {
  const pulseWallet = getPulseMintWallet();
  const bridge = await getPulseBridgeContract(pulseWallet, svc);

  const assetTypeNum = request.assetType === 'username' ? 0 : 1;

  // Deterministic 32-byte idempotency key from the source tx hash.
  const sourceTxHashBytes32 = ethers.id(request.sourceTxHash);

  const tx = await bridge.bridgeFromPolygon(
    request.to,
    assetTypeNum,
    request.handleOrCardId,
    request.nameOrCardName,
    request.didOrCardImage,
    request.metadataURI,
    request.verificationLevel,
    sourceTxHashBytes32,
  );

  const receipt = await tx.wait();

  // Parse the BridgeMint event from the receipt
  const bridgeMintTopic = bridge.interface.getEvent('BridgeMint')?.topicHash;
  const log = receipt.logs?.find((l: any) => l.topics?.[0] === bridgeMintTopic);
  if (!log) {
    throw new Error('BridgeMint event not found in PulseChain transaction receipt');
  }

  const decoded = bridge.interface.parseLog(log);
  const pulseTokenId = Number(decoded.args.tokenId);

  return {
    pulseTokenId,
    pulseTxHash: tx.hash,
    pulseBlockNumber: receipt.blockNumber,
  };
}