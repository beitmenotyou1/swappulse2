// get-pulse-token-stats — reads $PULSE ERC-20 token stats via the Etherscan API
// (holder count, top holders, price) plus on-chain RPC (total supply + recent
// Transfer logs for whale-move detection). Mirrors get-uniswap-v4-pool-price.
//
// Hybrid: Etherscan's tokeninfo/topholders/tokenholdercount are PRO endpoints
// (may be unavailable on the free tier), so total supply and whale transfers
// are always read on-chain via POLYGON_RPC_URL (free + reliable). Etherscan
// fields gracefully degrade to null when unavailable.
//
// Pure read by default (admin UI). Pass { alert: true } (the scheduled
// "Pulse Token Monitor" workflow does this) to additionally email admins on:
//   - whale transfers > 1% of supply in the last ~hour (throttled 1/hour)
//   - top-10 holder concentration > 50% (throttled 1/24h)
//   - price deviating > 25% from the $0.001/PULSE target (throttled 1/24h)
// Each alert type is throttled via Notification marker records (group_key).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';

const PULSE_TARGET_USD = 0.001;
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b4ef';
const ERC20_ABI = [
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
];

async function etherscan(action: string, params: Record<string, string>): Promise<any> {
  const key = secrets.get('ETHERSCAN_API_KEY');
  if (!key) throw new Error('ETHERSCAN_API_KEY not set');
  const qs = new URLSearchParams({ module: 'token', action, ...params, apikey: key }).toString();
  const url = `https://api.etherscan.io/v2/api?chainid=137&${qs}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== '1') throw new Error(`Etherscan ${action}: ${json.message || 'failed'}`);
  return json.result;
}

export default async function (req: Request): Promise<Response> {
  try {
    // Auth: shared secret (external/scheduled callers) OR admin (workflow
    // service JWT / admin UI). Mirrors get-uniswap-v4-pool-price.
    const expectedSecret = Deno.env.get('BACKEND_FUNCTION_SECRET');
    const headerSecret = req.headers.get('x-trigger-secret') || '';
    let body: any = {};
    try { body = await req.clone().json().catch(() => ({})); } catch {}
    const bodySecret = String(body?.trigger_secret || '');
    const secretOk = expectedSecret && expectedSecret.length > 0 &&
      (headerSecret === expectedSecret || bodySecret === expectedSecret);

    const base44 = createClientFromRequest(req);
    if (!secretOk) {
      const caller = await base44.auth.me().catch(() => null);
      if (!caller || caller.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
    }
    const svc = base44.asServiceRole;

    const rpcUrl = secrets.get('POLYGON_RPC_URL');
    const tokenAddr = secrets.get('PULSE_TOKEN_CONTRACT');
    if (!rpcUrl || !tokenAddr) {
      return Response.json({ error: 'POLYGON_RPC_URL and PULSE_TOKEN_CONTRACT secrets required' }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const token = new ethers.Contract(tokenAddr, ERC20_ABI, provider);

    // --- On-chain: total supply + decimals ---
    const [totalSupplyRaw, decimalsRaw] = await Promise.all([
      token.totalSupply(),
      token.decimals().catch(() => 18n),
    ]);
    const totalSupply = BigInt(totalSupplyRaw);
    const decimals = Number(decimalsRaw);
    const humanSupply = Number(totalSupply) / 10 ** decimals;

    // --- On-chain: recent Transfer logs (whale detection + recent list) ---
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000); // ~1 hour window on Polygon
    let transfers: any[] = [];
    try {
      const logs = await provider.getLogs({
        address: tokenAddr,
        topics: [TRANSFER_TOPIC],
        fromBlock,
        toBlock: 'latest',
      });
      transfers = logs.map((l) => ({
        hash: l.transactionHash,
        blockNumber: l.blockNumber,
        from: l.topics[1] ? ethers.getAddress(ethers.dataSlice(l.topics[1], 12)) : ethers.ZeroAddress,
        to: l.topics[2] ? ethers.getAddress(ethers.dataSlice(l.topics[2], 12)) : ethers.ZeroAddress,
        value: BigInt(l.data),
      })).sort((a, b) => b.blockNumber - a.blockNumber);
    } catch (e) {
      console.error('[pulse-token-stats] getLogs failed', (e as any)?.message);
    }

    const whaleThreshold = totalSupply / 100n; // 1% of supply
    const recentTransfers = transfers.slice(0, 25).map((t) => ({
      hash: t.hash,
      blockNumber: t.blockNumber,
      from: t.from,
      to: t.to,
      value: t.value.toString(),
      valueHuman: Number(t.value) / 10 ** decimals,
      isWhale: t.value > whaleThreshold,
    }));
    const whales = recentTransfers.filter((t) => t.isWhale);

    // --- Etherscan: token info (price), top holders, holder count ---
    let priceUsd: number | null = null;
    let tokenName = 'PULSE';
    let tokenSymbol = 'PULSE';
    try {
      const info = await etherscan('tokeninfo', { contractaddress: tokenAddr });
      const t = Array.isArray(info) ? info[0] : info;
      if (t) {
        tokenName = t.tokenName || tokenName;
        tokenSymbol = t.symbol || tokenSymbol;
        const p = Number(t.tokenPriceUSD);
        if (p > 0) priceUsd = p;
      }
    } catch (e) {
      console.error('[pulse-token-stats] tokeninfo failed', (e as any)?.message);
    }

    let topHolders: { address: string; quantity: number; pct: number }[] = [];
    let top10ConcentrationPct: number | null = null;
    try {
      const holders = await etherscan('topholders', { contractaddress: tokenAddr, offset: '10' });
      const list = (Array.isArray(holders) ? holders : []).map((h: any) => ({
        address: h.TokenHolderAddress,
        quantity: Number(h.TokenHolderQuantity),
        pct: humanSupply > 0 ? (Number(h.TokenHolderQuantity) / humanSupply) * 100 : 0,
      }));
      topHolders = list;
      top10ConcentrationPct = list.reduce((s, h) => s + h.pct, 0);
    } catch (e) {
      console.error('[pulse-token-stats] topholders failed', (e as any)?.message);
    }

    let holderCount: number | null = null;
    try {
      const count = await etherscan('tokenholdercount', { contractaddress: tokenAddr });
      const n = Number(Array.isArray(count) ? count[0] : count);
      if (Number.isFinite(n)) holderCount = n;
    } catch (e) {
      console.error('[pulse-token-stats] tokenholdercount failed', (e as any)?.message);
    }

    const result = {
      token: { address: tokenAddr, name: tokenName, symbol: tokenSymbol, decimals },
      totalSupply: totalSupply.toString(),
      humanSupply,
      holderCount,
      priceUsd,
      top10ConcentrationPct,
      topHolders,
      recentTransfers,
      whaleCount: whales.length,
      whaleThresholdPct: 1,
      windowBlocks: 1000,
      checkedAt: new Date().toISOString(),
      etherscanAvailable: priceUsd !== null || topHolders.length > 0 || holderCount !== null,
    };

    // --- Optional alert path (scheduled workflow) ---
    let alerted = false;
    if (body?.alert === true) {
      const alerts: string[] = [];

      if (whales.length > 0 && await shouldAlert(svc, 'pulse_token_whale', 60 * 60 * 1000)) {
        alerts.push(`${whales.length} whale transfer(s) > 1% of supply in the last hour`);
        await markAlert(svc, 'pulse_token_whale', { whaleCount: whales.length });
      }
      if (top10ConcentrationPct !== null && top10ConcentrationPct > 50 &&
          await shouldAlert(svc, 'pulse_token_concentration', 24 * 60 * 60 * 1000)) {
        alerts.push(`top-10 holders control ${top10ConcentrationPct.toFixed(1)}% of supply`);
        await markAlert(svc, 'pulse_token_concentration', { top10ConcentrationPct });
      }
      if (priceUsd !== null) {
        const drift = Math.abs(priceUsd - PULSE_TARGET_USD) / PULSE_TARGET_USD;
        if (drift > 0.25 && await shouldAlert(svc, 'pulse_token_price', 24 * 60 * 60 * 1000)) {
          alerts.push(`price $${priceUsd} drifted ${Math.round(drift * 100)}% from $0.001 target`);
          await markAlert(svc, 'pulse_token_price', { priceUsd, drift });
        }
      }

      if (alerts.length > 0) {
        const admins = await svc.entities.User.list().catch(() => []);
        const subject = `⚠️ SwapPulse $PULSE Token Alert`;
        const emailBody =
          `The $PULSE token needs attention.\n\n` +
          `Alerts:\n` + alerts.map((a) => `  • ${a}`).join('\n') + '\n\n' +
          `Token: ${tokenName} (${tokenSymbol}) at ${tokenAddr}\n` +
          `Total supply: ${humanSupply.toLocaleString()} ${tokenSymbol}\n` +
          (holderCount !== null ? `Holders: ${holderCount}\n` : '') +
          (top10ConcentrationPct !== null ? `Top-10 concentration: ${top10ConcentrationPct.toFixed(1)}%\n` : '') +
          (priceUsd !== null ? `Price: $${priceUsd}\n` : '') +
          `Whale transfers (>1% supply, last hour): ${whales.length}\n\n` +
          `View: https://polygonscan.com/token/${tokenAddr}\n\n` +
          `— SwapPulse Token Monitor`;
        for (const a of admins) {
          if (a.role !== 'admin' || !a.email) continue;
          try { await svc.integrations.Core.SendEmail({ to: a.email, subject, body: emailBody }); }
          catch (e) { console.error('[pulse-token-stats] email failed', a.email, (e as any)?.message); }
        }
        alerted = true;
      }
    }

    return Response.json({ ...result, alerted });
  } catch (error: any) {
    console.error('get-pulse-token-stats error:', error?.message || error);
    return Response.json({ error: error?.message || 'Failed to read token stats' }, { status: 500 });
  }
}

async function shouldAlert(svc: any, groupKey: string, throttleMs: number): Promise<boolean> {
  const recent = await svc.entities.Notification.filter(
    { action_type: 'token_alert', group_key: groupKey },
    '-created_date', 1,
  ).catch(() => []);
  const last = recent[0];
  if (!last || !last.created_date) return true;
  return new Date(last.created_date).getTime() < Date.now() - throttleMs;
}

async function markAlert(svc: any, groupKey: string, metadata: any): Promise<void> {
  try {
    await svc.entities.Notification.create({
      did: 'pulse-token-monitor',
      action_type: 'token_alert',
      is_read: false,
      group_key: groupKey,
      target_type: 'wallet',
      target_path: '/wallet',
      target_label: `$PULSE token alert: ${groupKey}`,
      metadata,
    });
  } catch (e) {
    console.error('[pulse-token-stats] markAlert failed', (e as any)?.message);
  }
}