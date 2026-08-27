// pulse-explorer-block — returns the block header (from the indexed PulseBlock
// entity, falling back to a live RPC eth_getBlockByNumber) plus the full list
// of transactions in that block (joined from PulseTransaction). Public read.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getBlockByNumber } from '../../shared/pulseRpc.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const num = parseInt(body?.block_number, 10);

    if (!isFinite(num) || num < 0) {
      return Response.json({ error: 'Invalid block number' }, { status: 400 });
    }

    // Indexed block, then live RPC fallback.
    let block = (await svc.entities.PulseBlock.filter({ block_number: num }, '-block_number', 1).catch(() => []))[0];

    if (!block) {
      const liveBlock = await getBlockByNumber(num, false).catch(() => null);
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
    }

    const transactions = await svc.entities.PulseTransaction.filter(
      { block_number: num }, '-block_number', 500,
    ).catch(() => []);

    return Response.json({
      block,
      transactions,
      explorer_url: `/pulse-explorer/block/${num}`,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}