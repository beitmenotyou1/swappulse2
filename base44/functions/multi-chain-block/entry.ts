// multi-chain-block — returns a block header and its transactions for any
// supported EVM chain. For PulseChain, uses the indexed PulseBlock +
// PulseTransaction entities (fast). For other chains, fetches the block
// with full transactions from live RPC. Public read.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { createEvmRpc, decodeTransferLog } from '../../shared/evmRpc.ts';
import { getChain, getChainRpcUrl, getMainChain } from '../../shared/chainRegistry.ts';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const MAX_TXS = 100;
const MAX_NFT_LOOKUPS = 5;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const chainKey = body.chain || getMainChain().key;
    const num = parseInt(body?.block_number, 10);

    if (!isFinite(num) || num < 0) {
      return Response.json({ error: 'Invalid block number' }, { status: 400 });
    }

    const chain = getChain(chainKey);
    if (!chain) return Response.json({ error: `Unsupported chain: ${chainKey}` }, { status: 400 });

    let block: any;
    let transactions: any[] = [];

    if (chain.isMain) {
      // PulseChain: use indexed data first, fall back to live RPC.
      block = (await svc.entities.PulseBlock.filter({ block_number: num }, '-block_number', 1).catch(() => []))[0];
      if (block) {
        transactions = await svc.entities.PulseTransaction.filter(
          { block_number: num }, '-block_number', 500,
        ).catch(() => []);
      }
    }

    if (!block) {
      // Live RPC for any chain (or PulseChain fallback).
      const rpc = createEvmRpc(getChainRpcUrl(chainKey));
      const blocks = await rpc.getBlocksByNumberBatch([num], true).catch(() => [null]);
      const liveBlock = blocks[0];
      if (!liveBlock || !liveBlock.number) {
        return Response.json({ error: 'Block not found' }, { status: 404 });
      }
      block = {
        block_number: parseInt(liveBlock.number, 16),
        hash: liveBlock.hash,
        parent_hash: liveBlock.parentHash || '',
        timestamp: new Date(parseInt(liveBlock.timestamp, 16) * 1000).toISOString(),
        miner: (liveBlock.miner || '').toLowerCase(),
        tx_count: (liveBlock.transactions || []).length,
        gas_used: liveBlock.gasUsed ? BigInt(liveBlock.gasUsed).toString() : '0',
        size: liveBlock.size ? BigInt(liveBlock.size).toString() : '0',
        extra_data: liveBlock.extraData || '',
      };

      // Build transactions from the full block.
      const txs = (liveBlock.transactions || []).slice(0, MAX_TXS);
      const txHashes = txs.map((t) => t.hash);
      const receipts = await rpc.getTransactionReceiptsBatch(txHashes).catch(() => []);

      let nftLookupCount = 0;
      for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        const receipt = receipts[i];
        const txRecord: any = {
          tx_hash: tx.hash,
          block_number: num,
          from_address: (tx.from || '').toLowerCase(),
          to_address: (tx.to || '').toLowerCase(),
          value_wei: tx.value ? BigInt(tx.value).toString() : '0',
          gas_price: tx.gasPrice ? BigInt(tx.gasPrice).toString()
            : (tx.maxFeePerGas ? BigInt(tx.maxFeePerGas).toString() : '0'),
          gas_limit: tx.gas ? BigInt(tx.gas).toString() : '0',
          gas_used: '0',
          nonce: tx.nonce ? parseInt(tx.nonce, 16) : 0,
          status: 'pending',
          timestamp: block.timestamp,
          input_data: tx.input || '',
          is_contract_creation: !tx.to,
          created_contract: '',
          token_transfers: [],
        };
        if (receipt) {
          txRecord.status = receipt.status === '0x1' ? 'success' : 'failed';
          txRecord.gas_used = receipt.gasUsed ? BigInt(receipt.gasUsed).toString() : '0';
          if (receipt.contractAddress) txRecord.created_contract = receipt.contractAddress.toLowerCase();
          const transferLogs = (receipt.logs || []).filter(
            (l: any) => l.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC,
          );
          for (const log of transferLogs) {
            const decoded = decodeTransferLog(log);
            if (!decoded) continue;
            const transfer: any = {
              token_contract: (log.address || '').toLowerCase(),
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
                const meta = await rpc.getNftMetadata(transfer.token_contract, decoded.token_id!).catch(() => ({ name: '', image: '' }));
                transfer.nft_name = meta.name;
                transfer.nft_image = meta.image;
              }
            }
            txRecord.token_transfers.push(transfer);
          }
        }
        transactions.push(txRecord);
      }
    }

    return Response.json({
      chain: { key: chain.key, name: chain.name, symbol: chain.symbol, chainId: chain.chainId, isMain: chain.isMain || false },
      block,
      transactions,
      explorer_url: chain.explorerUrl ? `${chain.explorerUrl}/block/${num}` : `/blockchain/block/${num}`,
    });
  } catch (error: any) {
    console.error('multi-chain-block error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}