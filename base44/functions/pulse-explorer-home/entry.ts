// pulse-explorer-home — returns the latest blocks and transactions from the
// live PulseChain RPC (not the stale index), enriched with receipt statuses
// (success/failed) and NFT transfer images. Also returns the indexer cursor
// for stats. Public read (no auth required).
// v2 — live RPC data with receipt statuses + NFT images.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getBlockNumber, getBlocksByNumberBatch, getTransactionReceiptsBatch,
  decodeTransferLog, getNftMetadata,
} from '../../shared/pulseRpc.ts';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BLOCKS_TO_FETCH = 15;
const MAX_TXS_TO_RETURN = 25;
const MAX_NFT_LOOKUPS = 5; // limit external NFT metadata fetches per homepage load

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // 1. Get chain head and fetch latest blocks with full tx objects from live RPC.
    const chainHead = await getBlockNumber();
    const blockNums: number[] = [];
    for (let i = 0; i < BLOCKS_TO_FETCH; i++) blockNums.push(chainHead - i);
    const liveBlocks = await getBlocksByNumberBatch(blockNums, true);

    // 2. Build block records and flatten all transactions.
    const blocks: any[] = [];
    const allTxs: any[] = [];
    for (const block of liveBlocks) {
      if (!block || !block.number) continue;
      const blockNumber = parseInt(block.number, 16);
      const timestamp = new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
      blocks.push({
        block_number: blockNumber,
        hash: block.hash,
        parent_hash: block.parentHash || '',
        timestamp,
        miner: (block.miner || '').toLowerCase(),
        tx_count: (block.transactions || []).length,
        gas_used: block.gasUsed ? BigInt(block.gasUsed).toString() : '0',
        size: block.size ? BigInt(block.size).toString() : '0',
        extra_data: block.extraData || '',
      });
      for (const tx of (block.transactions || [])) {
        allTxs.push({
          tx_hash: tx.hash,
          block_number: blockNumber,
          from_address: (tx.from || '').toLowerCase(),
          to_address: (tx.to || '').toLowerCase(),
          value_wei: tx.value ? BigInt(tx.value).toString() : '0',
          gas_price: tx.gasPrice ? BigInt(tx.gasPrice).toString()
            : (tx.maxFeePerGas ? BigInt(tx.maxFeePerGas).toString() : '0'),
          gas_limit: tx.gas ? BigInt(tx.gas).toString() : '0',
          gas_used: '0',
          nonce: tx.nonce ? parseInt(tx.nonce, 16) : 0,
          status: 'pending',
          timestamp,
          input_data: tx.input || '',
          is_contract_creation: !tx.to,
          created_contract: '',
          token_transfers: [],
        });
      }
    }

    // 3. Batch-fetch receipts for all transactions (status + token transfers).
    // Limit to avoid huge batches on busy blocks.
    const txSlice = allTxs.slice(0, 50);
    const txHashes = txSlice.map((t) => t.tx_hash);
    const receipts = await getTransactionReceiptsBatch(txHashes);

    // 4. Enrich transactions with status and token transfers.
    let nftLookupCount = 0;
    for (let i = 0; i < txSlice.length; i++) {
      const receipt = receipts[i];
      if (!receipt) {
        // No receipt = still pending in mempool
        continue; // status already 'pending'
      }
      txSlice[i].status = receipt.status === '0x1' ? 'success' : 'failed';
      txSlice[i].gas_used = receipt.gasUsed ? BigInt(receipt.gasUsed).toString() : '0';
      if (receipt.contractAddress) {
        txSlice[i].created_contract = receipt.contractAddress.toLowerCase();
      }

      // Parse Transfer-event logs for token / NFT transfers.
      const transferLogs = (receipt.logs || []).filter(
        (l: any) => l.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC,
      );
      for (const log of transferLogs) {
        const decoded = decodeTransferLog(log);
        if (!decoded) continue;
        const transfer: any = {
          token_contract: log.address.toLowerCase(),
          from_address: decoded.from,
          to_address: decoded.to,
          value: decoded.value,
          is_nft: decoded.is_nft,
          token_id: decoded.token_id,
          token_symbol: '',
          nft_name: '',
          nft_image: '',
        };

        if (decoded.is_nft) {
          transfer.token_symbol = 'NFT';
          // Fetch NFT metadata (limited to avoid too many external calls)
          if (nftLookupCount < MAX_NFT_LOOKUPS) {
            nftLookupCount++;
            const nftMeta = await getNftMetadata(transfer.token_contract, decoded.token_id);
            transfer.nft_name = nftMeta.name;
            transfer.nft_image = nftMeta.image;
          }
        }

        txSlice[i].token_transfers.push(transfer);
      }
    }

    // Sort by block number descending (already in order) and limit.
    const latestTxs = txSlice.slice(0, MAX_TXS_TO_RETURN);

    // 5. Get indexer cursor for stats display.
    const cursor = (await svc.entities.PulseIndexerCursor.filter({}, '-created_date', 1).catch(() => []))[0] || null;

    return Response.json({
      latest_blocks: blocks,
      latest_transactions: latestTxs,
      cursor,
      chain_head: chainHead,
    });
  } catch (error: any) {
    console.error('pulse-explorer-home error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}