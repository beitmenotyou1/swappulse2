// Dual-Mint Engine — the core module that replaces direct contract.mint() calls
// in mint-username, mint-card, bulk-mint-cards, and autoMint.
//
// Mints on the primary chain (Polygon or PulseChain) and optionally bridges to
// the secondary chain. If the bridge fails, it queues the relay for retry via
// the BridgeQueue entity (processed by the process-bridge-queue scheduled fn).
//
// Additive/reversible: when options.bridgeToSecondary is false, behaviour is
// EXACTLY the existing Polygon-only mint (no bridge attempt, no queue entry).

import { ethers } from 'npm:ethers@6.13.4';
import {
  getMintWallet,
  getUsernameContract,
  getCardContract,
  getExplorerUrl,
  parseMintEvent,
} from './polygonClient.ts';
import {
  getPulseMintWallet,
  getPulseUsernameContract,
  getPulseCardContract,
  getPulseChainId,
  getPulseExplorerUrl,
  parsePulseMintEvent,
} from './pulseClient.ts';
import { relayBridgeMint } from './bridgeRelayer.ts';

export interface DualMintOptions {
  primaryChain: 'polygon' | 'pulse';
  bridgeToSecondary: boolean;
  collectionEntryId?: string;
  verificationLevel?: number;
  verificationSessionId?: string;
}

export interface DualMintResult {
  polygonAsset?: any;
  pulseAsset?: any;
  polygonTxHash?: string;
  pulseTxHash?: string;
  polygonScanUrl?: string;
  pulseScanUrl?: string;
  bridgeStatus: 'pending' | 'confirmed' | 'failed' | 'skipped' | 'none';
}

// ---------------------------------------------------------------------------
// Username dual-mint
// ---------------------------------------------------------------------------

export async function mintUsernameDual(
  svc: any,
  walletAddress: string,
  handle: string,
  did: string,
  metadataURI: string,
  options: DualMintOptions,
): Promise<DualMintResult> {
  const result: DualMintResult = { bridgeStatus: 'pending' };

  if (options.primaryChain === 'polygon') {
    // --- Polygon primary mint (existing logic) ---
    const mintWallet = getMintWallet();
    const contract = getUsernameContract(mintWallet);

    const tx = await contract.mint(walletAddress, handle, did, metadataURI);
    const receipt = await tx.wait();
    const { tokenId } = parseMintEvent(contract, receipt);

    result.polygonTxHash = tx.hash;
    result.polygonScanUrl = `${getExplorerUrl()}/tx/${tx.hash}`;

    result.polygonAsset = await svc.entities.OnChainAsset.create({
      asset_type: 'username',
      token_id: tokenId,
      contract_address: await contract.getAddress(),
      owner_did: did,
      owner_wallet: walletAddress,
      handle,
      did_ref: did,
      mint_tx_hash: tx.hash,
      mint_block_number: receipt.blockNumber,
      minted_at: new Date().toISOString(),
      transferable: false,
      metadata_uri: metadataURI,
      chain_id: '137',
      source_chain: 'polygon',
      bridge_status: options.bridgeToSecondary ? 'pending' : 'none',
      polygon_token_id: tokenId,
      polygon_tx_hash: tx.hash,
      dual_chain: options.bridgeToSecondary,
    });

    // --- Bridge to PulseChain ---
    if (options.bridgeToSecondary) {
      try {
        const pulseResult = await relayBridgeMint({
          assetType: 'username',
          to: walletAddress,
          handleOrCardId: handle,
          nameOrCardName: '',
          didOrCardImage: did,
          metadataURI,
          verificationLevel: 0,
          sourceTxHash: tx.hash,
        }, svc);

        await svc.entities.OnChainAsset.update(result.polygonAsset.id, {
          bridge_status: 'confirmed',
          pulsechain_token_id: pulseResult.pulseTokenId,
          pulsechain_tx_hash: pulseResult.pulseTxHash,
        });

        result.pulseTxHash = pulseResult.pulseTxHash;
        result.pulseScanUrl = `${getPulseExplorerUrl()}/tx/${pulseResult.pulseTxHash}`;
        result.bridgeStatus = 'confirmed';
      } catch (bridgeError: any) {
        console.error('dualMint: username bridge failed (non-blocking):', bridgeError?.message);
        result.bridgeStatus = 'failed';

        await svc.entities.BridgeQueue.create({
          asset_type: 'username',
          source_chain: 'polygon',
          target_chain: 'pulse',
          source_tx_hash: tx.hash,
          payload: { to: walletAddress, handle, did, metadataURI, verificationLevel: 0 },
          status: 'queued',
          retry_count: 0,
          max_retries: 5,
        });
      }
    } else {
      result.bridgeStatus = 'skipped';
    }
  } else {
    // --- PulseChain primary mint ---
    const pulseWallet = getPulseMintWallet();
    const pulseContract = await getPulseUsernameContract(pulseWallet, svc);

    // sourceChain = 0 (native PulseChain mint, admin only)
    const tx = await pulseContract.mint(walletAddress, handle, did, metadataURI, 0);
    const receipt = await tx.wait();
    const { tokenId } = parsePulseMintEvent(pulseContract, receipt);

    result.pulseTxHash = tx.hash;
    result.pulseScanUrl = `${getPulseExplorerUrl()}/tx/${tx.hash}`;

    result.pulseAsset = await svc.entities.OnChainAsset.create({
      asset_type: 'username',
      token_id: tokenId,
      contract_address: await pulseContract.getAddress(),
      owner_did: did,
      owner_wallet: walletAddress,
      handle,
      did_ref: did,
      mint_tx_hash: tx.hash,
      mint_block_number: receipt.blockNumber,
      minted_at: new Date().toISOString(),
      transferable: false,
      metadata_uri: metadataURI,
      chain_id: getPulseChainId(),
      source_chain: 'pulse',
      bridge_status: options.bridgeToSecondary ? 'pending' : 'none',
      dual_chain: options.bridgeToSecondary,
    });

    // Reverse bridge (PulseChain → Polygon) is deferred to a future phase.
    if (options.bridgeToSecondary) {
      result.bridgeStatus = 'pending';
    } else {
      result.bridgeStatus = 'none';
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Card dual-mint
// ---------------------------------------------------------------------------

export async function mintCardDual(
  svc: any,
  walletAddress: string,
  cardId: string,
  cardName: string,
  cardImage: string,
  metadataURI: string,
  minterHandle: string,
  verificationLevel: number,
  ownerDid: string,
  options: DualMintOptions,
): Promise<DualMintResult> {
  const result: DualMintResult = { bridgeStatus: 'pending' };
  const collectionEntryId = options.collectionEntryId || '';
  const verificationSessionId = options.verificationSessionId || '';

  if (options.primaryChain === 'polygon') {
    // --- Polygon primary mint (existing logic) ---
    const mintWallet = getMintWallet();
    const contract = getCardContract(mintWallet);

    const tx = await contract.mint(walletAddress, cardId, cardName, cardImage, metadataURI);
    const receipt = await tx.wait();
    const { tokenId } = parseMintEvent(contract, receipt);

    result.polygonTxHash = tx.hash;
    result.polygonScanUrl = `${getExplorerUrl()}/tx/${tx.hash}`;

    result.polygonAsset = await svc.entities.OnChainAsset.create({
      asset_type: 'card',
      token_id: tokenId,
      contract_address: await contract.getAddress(),
      owner_did: ownerDid,
      owner_wallet: walletAddress,
      linked_card_id: cardId,
      linked_card_name: cardName,
      linked_card_image: cardImage,
      linked_collection_entry_id: collectionEntryId,
      minter_username: minterHandle,
      minter_did: ownerDid,
      mint_tx_hash: tx.hash,
      mint_block_number: receipt.blockNumber,
      minted_at: new Date().toISOString(),
      transferable: true,
      metadata_uri: metadataURI,
      chain_id: '137',
      verification_level: verificationLevel,
      verification_session_id: verificationSessionId,
      source_chain: 'polygon',
      bridge_status: options.bridgeToSecondary ? 'pending' : 'none',
      polygon_token_id: tokenId,
      polygon_tx_hash: tx.hash,
      dual_chain: options.bridgeToSecondary,
    });

    // --- Bridge to PulseChain ---
    if (options.bridgeToSecondary) {
      try {
        const pulseResult = await relayBridgeMint({
          assetType: 'card',
          to: walletAddress,
          handleOrCardId: cardId,
          nameOrCardName: cardName,
          didOrCardImage: cardImage,
          metadataURI,
          verificationLevel,
          sourceTxHash: tx.hash,
        }, svc);

        await svc.entities.OnChainAsset.update(result.polygonAsset.id, {
          bridge_status: 'confirmed',
          pulsechain_token_id: pulseResult.pulseTokenId,
          pulsechain_tx_hash: pulseResult.pulseTxHash,
        });

        result.pulseTxHash = pulseResult.pulseTxHash;
        result.pulseScanUrl = `${getPulseExplorerUrl()}/tx/${pulseResult.pulseTxHash}`;
        result.bridgeStatus = 'confirmed';
      } catch (bridgeError: any) {
        console.error('dualMint: card bridge failed (non-blocking):', bridgeError?.message);
        result.bridgeStatus = 'failed';

        await svc.entities.BridgeQueue.create({
          asset_type: 'card',
          source_chain: 'polygon',
          target_chain: 'pulse',
          source_tx_hash: tx.hash,
          payload: { to: walletAddress, cardId, cardName, cardImage, metadataURI, verificationLevel },
          status: 'queued',
          retry_count: 0,
          max_retries: 5,
        });
      }
    } else {
      result.bridgeStatus = 'skipped';
    }
  } else {
    // --- PulseChain primary mint ---
    const pulseWallet = getPulseMintWallet();
    const pulseContract = await getPulseCardContract(pulseWallet, svc);

    // sourceChain = 0 (native PulseChain mint)
    const tx = await pulseContract.mint(
      walletAddress,
      cardId,
      cardName,
      cardImage,
      metadataURI,
      verificationLevel,
      0,
    );
    const receipt = await tx.wait();
    const { tokenId } = parsePulseMintEvent(pulseContract, receipt);

    result.pulseTxHash = tx.hash;
    result.pulseScanUrl = `${getPulseExplorerUrl()}/tx/${tx.hash}`;

    result.pulseAsset = await svc.entities.OnChainAsset.create({
      asset_type: 'card',
      token_id: tokenId,
      contract_address: await pulseContract.getAddress(),
      owner_did: ownerDid,
      owner_wallet: walletAddress,
      linked_card_id: cardId,
      linked_card_name: cardName,
      linked_card_image: cardImage,
      linked_collection_entry_id: collectionEntryId,
      minter_username: minterHandle,
      minter_did: ownerDid,
      mint_tx_hash: tx.hash,
      mint_block_number: receipt.blockNumber,
      minted_at: new Date().toISOString(),
      transferable: true,
      metadata_uri: metadataURI,
      chain_id: getPulseChainId(),
      verification_level: verificationLevel,
      verification_session_id: verificationSessionId,
      source_chain: 'pulse',
      bridge_status: options.bridgeToSecondary ? 'pending' : 'none',
      dual_chain: options.bridgeToSecondary,
    });

    if (options.bridgeToSecondary) {
      result.bridgeStatus = 'pending';
    } else {
      result.bridgeStatus = 'none';
    }
  }

  return result;
}