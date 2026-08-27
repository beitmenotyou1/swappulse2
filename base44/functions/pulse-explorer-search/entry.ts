// pulse-explorer-search — detects the input type (address, transaction hash,
// or block number) and returns a redirect path to the matching detail page.
// Falls back to a live RPC lookup for tx hashes and block numbers that may
// not be indexed yet. Public read.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getTransactionByHash, getBlockByNumber } from '../../shared/pulseRpc.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const query = String(body?.query || '').trim();
    if (!query) return Response.json({ type: 'invalid', message: 'Enter a search term' }, { status: 400 });

    const q = query.toLowerCase();

    // Transaction hash: 0x + 64 hex chars.
    if (/^0x[a-f0-9]{64}$/.test(q)) {
      const indexed = await svc.entities.PulseTransaction.filter({ tx_hash: q }, '-block_number', 1).catch(() => []);
      if (indexed.length) {
        return Response.json({ type: 'tx', hash: q, redirect: `/pulse-explorer/tx/${q}` });
      }
      const liveTx = await getTransactionByHash(q).catch(() => null);
      if (liveTx) return Response.json({ type: 'tx', hash: q, redirect: `/pulse-explorer/tx/${q}` });
      return Response.json({ type: 'not_found', message: 'Transaction not found' });
    }

    // Address: 0x + 40 hex chars.
    if (/^0x[a-f0-9]{40}$/.test(q)) {
      return Response.json({ type: 'address', address: q, redirect: `/pulse-explorer/address/${q}` });
    }

    // Block number: pure integer.
    if (/^\d+$/.test(query)) {
      const num = parseInt(query, 10);
      const indexed = await svc.entities.PulseBlock.filter({ block_number: num }, '-block_number', 1).catch(() => []);
      if (indexed.length) {
        return Response.json({ type: 'block', block_number: num, redirect: `/pulse-explorer/block/${num}` });
      }
      const liveBlock = await getBlockByNumber(num, false).catch(() => null);
      if (liveBlock && liveBlock.number) {
        return Response.json({ type: 'block', block_number: num, redirect: `/pulse-explorer/block/${num}` });
      }
      return Response.json({ type: 'not_found', message: 'Block not found' });
    }

    return Response.json({ type: 'invalid', message: 'Enter a valid address, transaction hash, or block number' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}