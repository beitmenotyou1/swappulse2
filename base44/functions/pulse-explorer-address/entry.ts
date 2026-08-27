// pulse-explorer-address — returns the live PLS balance, contract status,
// nonce, and a paginated transaction history for a PulseChain address.
// Transaction history is pulled from the indexed PulseTransaction entities
// (both sent and received), sorted by block number descending. Public read.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getBalance, getCode, getTransactionCount } from '../../shared/pulseRpc.ts';

const MAX_HISTORY = 1000;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const address = String(body?.address || '').toLowerCase().trim();
    const page = Math.max(1, parseInt(body?.page || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(body?.limit || '25', 10)), 100);

    if (!/^0x[a-f0-9]{40}$/.test(address)) {
      return Response.json({ error: 'Invalid address' }, { status: 400 });
    }

    // Live chain state in parallel.
    const [balanceWei, code, nonce] = await Promise.all([
      getBalance(address).catch(() => 0n),
      getCode(address).catch(() => '0x'),
      getTransactionCount(address).catch(() => 0),
    ]);

    const isContract = !!(code && code !== '0x');

    // Fetch indexed txs where the address is sender OR recipient.
    const allTxs = await svc.entities.PulseTransaction.filter(
      { $or: [{ from_address: address }, { to_address: address }] },
      '-block_number',
      MAX_HISTORY,
    ).catch(() => []);

    // Tag direction and dedupe (a tx could be self-send).
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const tx of allTxs) {
      if (seen.has(tx.tx_hash)) continue;
      seen.add(tx.tx_hash);
      merged.push({
        ...tx,
        direction: tx.from_address === address ? 'out' : 'in',
      });
    }
    merged.sort((a, b) => b.block_number - a.block_number);

    const total = merged.length;
    const skip = (page - 1) * limit;
    const paged = merged.slice(skip, skip + limit);

    return Response.json({
      address,
      balance_wei: balanceWei.toString(),
      is_contract: isContract,
      nonce,
      transactions: paged,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}