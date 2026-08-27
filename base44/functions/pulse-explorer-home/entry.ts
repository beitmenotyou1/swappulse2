// pulse-explorer-home — returns the latest 25 indexed blocks and 25 indexed
// transactions for the explorer homepage, plus the live chain head block
// number. Public read (no auth required).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getBlockNumber } from '../../shared/pulseRpc.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const [blocks, transactions, cursor] = await Promise.all([
      svc.entities.PulseBlock.list('-block_number', 25).catch(() => []),
      svc.entities.PulseTransaction.list('-block_number', 25).catch(() => []),
      svc.entities.PulseIndexerCursor.filter({}, '-created_date', 1).catch(() => []),
    ]);

    let chainHead: number | null = null;
    try { chainHead = await getBlockNumber(); } catch { /* RPC optional */ }

    return Response.json({
      latest_blocks: blocks,
      latest_transactions: transactions,
      cursor: cursor[0] || null,
      chain_head: chainHead,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}