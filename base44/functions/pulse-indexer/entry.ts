// pulse-indexer — scheduled PulseChain block + transaction ingestion.
// Reads the PulseIndexerCursor, fetches new blocks from PULSE_RPC_URL via
// batched JSON-RPC (eth_getBlockByNumber with full tx objects), stores a
// PulseBlock record per block and a PulseTransaction record per transaction,
// then advances the cursor. Idempotent (deletes the block range before
// re-inserting). On first run (no cursor), starts from chain head minus
// PULSE_INDEXER_LOOKBACK (default 200) so the explorer shows recent activity
// immediately. Invoked every 5 minutes by the Pulse Chain Indexer workflow,
// or manually by an admin.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { getBlockNumber, getBlocksByNumberBatch } from '../../shared/pulseRpc.ts';

const DEFAULT_BATCH = 50;
const DEFAULT_LOOKBACK = 200;
const FETCH_CHUNK = 10; // blocks per batched JSON-RPC HTTP request

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: shared secret (workflow) or admin caller.
    const expectedSecret = secrets.get('BACKEND_FUNCTION_SECRET') || '';
    const headerSecret = req.headers.get('x-trigger-secret') || '';
    let bodySecret = '';
    try {
      const body = await req.clone().json().catch(() => ({}));
      bodySecret = String(body?.trigger_secret || '');
    } catch { /* ignore */ }
    const secretOk = expectedSecret.length > 0 &&
      (headerSecret === expectedSecret || bodySecret === expectedSecret);
    if (!secretOk) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const batchSize = DEFAULT_BATCH;
    const lookback = DEFAULT_LOOKBACK;

    const chainHead = await getBlockNumber();

    // Get or create the cursor.
    const existing = await base44.asServiceRole.entities.PulseIndexerCursor
      .filter({}, '-created_date', 1).catch(() => []);
    let cursor = existing[0];
    let startBlock: number;

    if (!cursor) {
      startBlock = Math.max(0, chainHead - lookback);
      cursor = await base44.asServiceRole.entities.PulseIndexerCursor.create({
        last_indexed_block: startBlock,
        last_run_at: new Date().toISOString(),
        chain_head_at_last_run: chainHead,
        blocks_indexed_total: 0,
        txs_indexed_total: 0,
      });
    } else {
      startBlock = cursor.last_indexed_block + 1;
    }

    const endBlock = Math.min(startBlock + batchSize - 1, chainHead);

    // Already up to date — just refresh the run timestamp.
    if (startBlock > endBlock) {
      await base44.asServiceRole.entities.PulseIndexerCursor.update(cursor.id, {
        last_run_at: new Date().toISOString(),
        chain_head_at_last_run: chainHead,
      });
      return Response.json({
        status: 'up_to_date',
        last_indexed_block: cursor.last_indexed_block,
        chain_head: chainHead,
      });
    }

    // Fetch blocks in batched chunks (full tx objects).
    const blockNums: number[] = [];
    for (let n = startBlock; n <= endBlock; n++) blockNums.push(n);

    const allBlocks: any[] = [];
    for (let i = 0; i < blockNums.length; i += FETCH_CHUNK) {
      const chunk = blockNums.slice(i, i + FETCH_CHUNK);
      const blocks = await getBlocksByNumberBatch(chunk, true);
      for (const b of blocks) if (b) allBlocks.push(b);
    }

    // Build block + transaction records.
    const blockRecords: any[] = [];
    const txRecords: any[] = [];
    for (const block of allBlocks) {
      const blockNumber = parseInt(block.number, 16);
      const timestamp = new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
      blockRecords.push({
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
        txRecords.push({
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
          status: 'unknown',
          timestamp,
          input_data: tx.input || '',
          is_contract_creation: !tx.to,
          created_contract: '',
        });
      }
    }

    // Idempotent store: delete the block range first, then bulk-insert.
    if (blockRecords.length) {
      await base44.asServiceRole.entities.PulseBlock.deleteMany({
        block_number: { $gte: startBlock, $lte: endBlock },
      });
      await base44.asServiceRole.entities.PulseBlock.bulkCreate(blockRecords);
    }
    if (txRecords.length) {
      await base44.asServiceRole.entities.PulseTransaction.deleteMany({
        block_number: { $gte: startBlock, $lte: endBlock },
      });
      for (let i = 0; i < txRecords.length; i += 500) {
        await base44.asServiceRole.entities.PulseTransaction.bulkCreate(txRecords.slice(i, i + 500));
      }
    }

    // Advance the cursor.
    const newLastIndexed = endBlock;
    await base44.asServiceRole.entities.PulseIndexerCursor.update(cursor.id, {
      last_indexed_block: newLastIndexed,
      last_run_at: new Date().toISOString(),
      chain_head_at_last_run: chainHead,
      blocks_indexed_total: (cursor.blocks_indexed_total || 0) + blockRecords.length,
      txs_indexed_total: (cursor.txs_indexed_total || 0) + txRecords.length,
    });

    return Response.json({
      status: 'indexed',
      from_block: startBlock,
      to_block: endBlock,
      blocks_indexed: blockRecords.length,
      txs_indexed: txRecords.length,
      last_indexed_block: newLastIndexed,
      chain_head: chainHead,
      blocks_behind: chainHead - newLastIndexed,
    });
  } catch (error: any) {
    console.error('pulse-indexer error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}