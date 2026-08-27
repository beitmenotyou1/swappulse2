// multi-chain-explorer — fetches live blockchain data (blocks, transactions
// with statuses, token transfers) for any supported EVM chain. Also supports
// an "overview" mode that returns chain heads for the top chains.
// Public read (no auth required).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { createEvmRpc, decodeTransferLog } from '../../shared/evmRpc.ts';
import { SUPPORTED_CHAINS, OVERVIEW_CHAINS, getChain, getChainRpcUrl, getMainChain } from '../../shared/chainRegistry.ts';

const BLOCKS_TO_FETCH = 15;
const MAX_TXS_TO_RETURN = 25;
const MAX_TXS_FOR_RECEIPTS = 50;
const MAX_NFT_LOOKUPS = 5;

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const chainKey = body.chain || getMainChain().key;
    const overview = body.overview === true;
    const statsOnly = body.stats_only === true;

    // --- Overview mode: return chain heads for top chains ---
    if (overview) {
      const results = await Promise.allSettled(
        OVERVIEW_CHAINS.map(async (chain) => {
          const rpcUrl = getChainRpcUrl(chain.key);
          const rpc = createEvmRpc(rpcUrl);
          const head = await rpc.getBlockNumber();
          return {
            key: chain.key,
            name: chain.name,
            chainId: chain.chainId,
            symbol: chain.symbol,
            isMain: chain.isMain || false,
            head,
          };
        }),
      );
      const chains = results.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        const chain = OVERVIEW_CHAINS[i];
        return { key: chain.key, name: chain.name, chainId: chain.chainId, symbol: chain.symbol, isMain: chain.isMain || false, head: null, error: 'unreachable' };
      });
      return Response.json({ chains });
    }

    // --- Single-chain mode ---
    const chain = getChain(chainKey);
    if (!chain) {
      return Response.json({ error: `Unsupported chain: ${chainKey}` }, { status: 400 });
    }
    const rpcUrl = getChainRpcUrl(chainKey);
    const rpc = createEvmRpc(rpcUrl);

    // 1. Get chain head.
    const chainHead = await rpc.getBlockNumber();

    // --- Stats-only mode: return just chain head + cursor (for layout strip) ---
    if (statsOnly) {
      let cursor = null;
      if (chain.isMain) {
        const base44 = createClientFromRequest(req);
        const svc = base44.asServiceRole;
        cursor = (await svc.entities.PulseIndexerCursor.filter({}, '-created_date', 1).catch(() => []))[0] || null;
      }
      return Response.json({
        chain: { key: chain.key, name: chain.name, chainId: chain.chainId, symbol: chain.symbol, isMain: chain.isMain || false, explorerUrl: chain.explorerUrl },
        chain_head: chainHead,
        cursor,
      });
    }

    // 2. Fetch latest blocks with full tx objects.
    const blockNums: number[] = [];
    for (let i = 0; i < BLOCKS_TO_FETCH; i++) blockNums.push(chainHead - i);
    const liveBlocks = await rpc.getBlocksByNumberBatch(blockNums, true);

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

    // 3. Batch-fetch receipts for transactions (status + token transfers).
    const txSlice = allTxs.slice(0, MAX_TXS_FOR_RECEIPTS);
    const txHashes = txSlice.map((t) => t.tx_hash);
    const receipts = await rpc.getTransactionReceiptsBatch(txHashes);

    // 4. Enrich transactions with status and token transfers.
    let nftLookupCount = 0;
    for (let i = 0; i < txSlice.length; i++) {
      const receipt = receipts[i];
      if (!receipt) continue;
      txSlice[i].status = receipt.status === '0x1' ? 'success' : 'failed';
      txSlice[i].gas_used = receipt.gasUsed ? BigInt(receipt.gasUsed).toString() : '0';
      if (receipt.contractAddress) {
        txSlice[i].created_contract = receipt.contractAddress.toLowerCase();
      }
      const transferLogs = (receipt.logs || []).filter(
        (l: any) => l.topics?.[0]?.toLowerCase() === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
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
          if (nftLookupCount < MAX_NFT_LOOKUPS) {
            nftLookupCount++;
            const nftMeta = await rpc.getNftMetadata(transfer.token_contract, decoded.token_id);
            transfer.nft_name = nftMeta.name;
            transfer.nft_image = nftMeta.image;
          }
        }
        txSlice[i].token_transfers.push(transfer);
      }
    }

    const latestTxs = txSlice.slice(0, MAX_TXS_TO_RETURN);

    // 5. For PulseChain, also return the indexer cursor for stats.
    let cursor = null;
    if (chain.isMain) {
      const base44 = createClientFromRequest(req);
      const svc = base44.asServiceRole;
      cursor = (await svc.entities.PulseIndexerCursor.filter({}, '-created_date', 1).catch(() => []))[0] || null;
    }

    return Response.json({
      chain: {
        key: chain.key,
        name: chain.name,
        chainId: chain.chainId,
        symbol: chain.symbol,
        isMain: chain.isMain || false,
        explorerUrl: chain.explorerUrl,
      },
      latest_blocks: blocks,
      latest_transactions: latestTxs,
      cursor,
      chain_head: chainHead,
    });
  } catch (error: any) {
    console.error('multi-chain-explorer error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}