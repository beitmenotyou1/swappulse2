// pulse-explorer-search — detects the input type (address, transaction hash,
// or block number) and returns a redirect path to the matching detail page.
// Now chain-aware: accepts a `chain` param and uses the chain's RPC for live
// lookups. Appends ?chain= to redirects for non-default chains. Public read.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { createEvmRpc } from '../../shared/evmRpc.ts';
import { getChain, getChainRpcUrl, getMainChain } from '../../shared/chainRegistry.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const query = String(body?.query || '').trim();
    const chainKey = body.chain || getMainChain().key;
    if (!query) return Response.json({ type: 'invalid', message: 'Enter a search term' }, { status: 400 });

    const q = query.toLowerCase();
    const chain = getChain(chainKey);
    if (!chain) return Response.json({ error: `Unsupported chain: ${chainKey}` }, { status: 400 });

    const chainSuffix = chain.isMain ? '' : `?chain=${chainKey}`;

    // For PulseChain, use the indexed entities first (fast path).
    // For other chains, use live RPC.

    // Transaction hash: 0x + 64 hex chars.
    if (/^0x[a-f0-9]{64}$/.test(q)) {
      if (chain.isMain) {
        const indexed = await svc.entities.PulseTransaction.filter({ tx_hash: q }, '-block_number', 1).catch(() => []);
        if (indexed.length) {
          return Response.json({ type: 'tx', hash: q, redirect: `/blockchain/tx/${q}${chainSuffix}` });
        }
      }
      // Live RPC fallback for any chain
      const rpc = createEvmRpc(getChainRpcUrl(chainKey));
      const liveTx = await rpc.getTransactionByHash(q).catch(() => null);
      if (liveTx) return Response.json({ type: 'tx', hash: q, redirect: `/blockchain/tx/${q}${chainSuffix}` });
      return Response.json({ type: 'not_found', message: 'Transaction not found' });
    }

    // Address: 0x + 40 hex chars.
    if (/^0x[a-f0-9]{40}$/.test(q)) {
      return Response.json({ type: 'address', address: q, redirect: `/blockchain/address/${q}${chainSuffix}` });
    }

    // Block number: pure integer.
    if (/^\d+$/.test(query)) {
      const num = parseInt(query, 10);
      if (chain.isMain) {
        const indexed = await svc.entities.PulseBlock.filter({ block_number: num }, '-block_number', 1).catch(() => []);
        if (indexed.length) {
          return Response.json({ type: 'block', block_number: num, redirect: `/blockchain/block/${num}${chainSuffix}` });
        }
      }
      const rpc = createEvmRpc(getChainRpcUrl(chainKey));
      const blocks = await rpc.getBlocksByNumberBatch([num], false).catch(() => [null]);
      if (blocks[0]?.number) {
        return Response.json({ type: 'block', block_number: num, redirect: `/blockchain/block/${num}${chainSuffix}` });
      }
      return Response.json({ type: 'not_found', message: 'Block not found' });
    }

    return Response.json({ type: 'invalid', message: 'Enter a valid address, transaction hash, or block number' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}