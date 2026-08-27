// multi-chain-charts — returns 7-day daily transaction count and gas used
// series for any supported EVM chain. Samples block headers across the
// 7-day window (one per ~3-hour interval = ~56 blocks) and estimates daily
// totals by averaging sampled blocks and scaling to blocks-per-day.
// Public read.

import { createEvmRpc } from '../../shared/evmRpc.ts';
import { getChain, getChainRpcUrl, getMainChain } from '../../shared/chainRegistry.ts';

const SAMPLE_COUNT = 56;
const SECONDS_PER_DAY = 86400;

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const chainKey = body.chain || getMainChain().key;

    const chain = getChain(chainKey);
    if (!chain) return Response.json({ error: `Unsupported chain: ${chainKey}` }, { status: 400 });
    const rpc = createEvmRpc(getChainRpcUrl(chainKey));

    // 1. Get chain head and estimate block time from last 2 blocks.
    const chainHead = await rpc.getBlockNumber();
    const recentBlocks = await rpc.getBlocksByNumberBatch([chainHead, chainHead - 1], false).catch(() => []);
    let blockTime = 12;
    if (recentBlocks[0]?.timestamp && recentBlocks[1]?.timestamp) {
      const diff = parseInt(recentBlocks[0].timestamp, 16) - parseInt(recentBlocks[1].timestamp, 16);
      if (diff > 0) blockTime = diff;
    }

    // 2. Calculate block range for 7 days.
    const blocksPerDay = Math.max(1, Math.floor(SECONDS_PER_DAY / blockTime));
    const totalBlocks = blocksPerDay * 7;
    const fromBlock = Math.max(0, chainHead - totalBlocks);

    // 3. Sample block numbers evenly across the range.
    const sampleNums: number[] = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const num = Math.floor(fromBlock + ((chainHead - fromBlock) * i) / (SAMPLE_COUNT - 1));
      sampleNums.push(num);
    }

    // 4. Fetch sampled block headers (batch).
    const blocks = await rpc.getBlocksByNumberBatch(sampleNums, false);

    // 5. Aggregate by day — estimate daily totals from sampled averages.
    const now = new Date();
    const dayMap = new Map<string, { date: string; txSamples: number[]; gasSamples: bigint[] }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { date: key, txSamples: [], gasSamples: [] });
    }

    for (const block of blocks) {
      if (!block?.timestamp) continue;
      const ts = parseInt(block.timestamp, 16) * 1000;
      const d = new Date(ts);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      if (!dayMap.has(key)) continue;
      const entry = dayMap.get(key)!;
      entry.txSamples.push(block.transactions ? block.transactions.length : 0);
      entry.gasSamples.push(block.gasUsed ? BigInt(block.gasUsed) : 0n);
    }

    const txCounts = Array.from(dayMap.values()).map((d) => {
      const avg = d.txSamples.length > 0
        ? d.txSamples.reduce((a, b) => a + b, 0) / d.txSamples.length
        : 0;
      return { date: d.date, count: Math.round(avg * blocksPerDay) };
    });

    const gasUsed = Array.from(dayMap.values()).map((d) => {
      if (d.gasSamples.length === 0) return { date: d.date, gas: '0' };
      const sum = d.gasSamples.reduce((a, b) => a + b, 0n);
      const avg = sum / BigInt(d.gasSamples.length);
      return { date: d.date, gas: (avg * BigInt(blocksPerDay)).toString() };
    });

    return Response.json({
      chain: { key: chain.key, name: chain.name, symbol: chain.symbol },
      blockTime: Math.round(blockTime * 10) / 10,
      blocksPerDay,
      txCounts,
      gasUsed,
    });
  } catch (error: any) {
    console.error('multi-chain-charts error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}