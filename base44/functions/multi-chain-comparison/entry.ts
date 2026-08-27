// multi-chain-comparison — fetches current gas price and recent transaction
// activity for all supported EVM chains in parallel, returning a normalized
// comparison array with a "best for trading" recommendation (low gas + high
// activity). Public read (no auth required).

import { createEvmRpc } from '../../shared/evmRpc.ts';
import { SUPPORTED_CHAINS, getChainRpcUrl } from '../../shared/chainRegistry.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const results = await Promise.allSettled(
      SUPPORTED_CHAINS.map(async (chain) => {
        const rpcUrl = getChainRpcUrl(chain.key);
        const rpc = createEvmRpc(rpcUrl);

        // 1. Batch-fetch gas price + chain head.
        const [gasHex, headHex] = await rpc.rpcBatch([
          { method: 'eth_gasPrice', params: [] },
          { method: 'eth_blockNumber', params: [] },
        ]);

        const head = headHex ? parseInt(headHex, 16) : null;
        let gasPriceWei = '0';
        let gasPriceGwei = '0';
        let recentTxCount = 0;
        let recentValueWei = '0';

        if (gasHex) {
          const wei = BigInt(gasHex);
          gasPriceWei = wei.toString();
          const gwei = wei / 10n ** 9n;
          const gweiRem = wei % 10n ** 9n;
          const gweiFrac = gweiRem.toString().padStart(9, '0').slice(0, 2).replace(/0+$/, '');
          gasPriceGwei = gweiFrac ? `${gwei.toString()}.${gweiFrac}` : gwei.toString();
        }

        // 2. Fetch the latest block (with full txs) to count recent activity.
        if (head != null) {
          const block = await rpc.rpcCall('eth_getBlockByNumber', ['0x' + head.toString(16), true]);
          if (block && block.transactions) {
            recentTxCount = block.transactions.length;
            let totalValue = 0n;
            for (const tx of block.transactions) {
              if (tx.value) totalValue += BigInt(tx.value);
            }
            recentValueWei = totalValue.toString();
          }
        }

        // Score: high activity / low gas = good for trading.
        const gweiNum = parseFloat(gasPriceGwei) || 0.01;
        const score = recentTxCount / (gweiNum + 0.01);

        return {
          key: chain.key,
          name: chain.name,
          chainId: chain.chainId,
          symbol: chain.symbol,
          isMain: chain.isMain || false,
          gasPriceWei,
          gasPriceGwei,
          chainHead: head,
          recentTxCount,
          recentValueWei,
          score,
          error: null,
        };
      }),
    );

    const chains = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      const chain = SUPPORTED_CHAINS[i];
      return {
        key: chain.key,
        name: chain.name,
        chainId: chain.chainId,
        symbol: chain.symbol,
        isMain: chain.isMain || false,
        gasPriceWei: '0',
        gasPriceGwei: '0',
        chainHead: null,
        recentTxCount: 0,
        recentValueWei: '0',
        score: 0,
        error: 'unreachable',
      };
    });

    // Pick the best chain for trading: highest score among reachable chains.
    const reachable = chains.filter((c) => !c.error && c.chainHead != null);
    const bestChain = reachable.length > 0
      ? reachable.reduce((best, c) => (c.score > best.score ? c : best)).key
      : null;

    return Response.json({ chains, bestChain });
  } catch (error: any) {
    console.error('multi-chain-comparison error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}