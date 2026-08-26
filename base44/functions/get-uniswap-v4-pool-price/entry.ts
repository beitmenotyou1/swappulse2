// get-uniswap-v4-pool-price — reads the live state of the SwapPulse $PULSE/USDC
// Uniswap v4 liquidity pool on Polygon via the StateView lens contract (no
// subgraph/API key required — uses the existing POLYGON_RPC_URL secret).
//
// The pool is identified by reading position #134728 from the v4 PositionManager,
// which returns the full PoolKey (token0, token1, fee, tickSpacing, hooks). From
// the PoolKey we compute the v4 PoolId (keccak256 of the abi-encoded key) and call
// StateView.getSlot0(poolId) for the current sqrtPriceX96 + tick.
//
// Pure read by default (used by the admin UI). Pass { alert: true } (the scheduled
// "Uniswap Pool Price Monitor" workflow does this) to additionally compare the
// price against the $0.001/PULSE target and email every admin when it drifts
// beyond a threshold or the position falls out of range. Alerts are throttled to
// one per 24h via a Notification marker record.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';

// Polygon mainnet v4 deployments (https://developers.uniswap.org/deployments.json)
const POSITION_MANAGER = '0x1Ec2eBf4F37E7363FDfe3551602425af0B3ceef9';
const STATE_VIEW = '0x5eA1bD7974c8A611cBAB0bDCAFcB1D9CC9b3BA5a';
const POSITION_TOKEN_ID = 134728n;
const POSITION_URL = 'https://app.uniswap.org/positions/v4/polygon/134728';

const TARGET_USDC_PER_PULSE = 0.001; // 1 PULSE = $0.001

const POSITION_MANAGER_ABI = [
  {
    name: 'getPoolAndPositionInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        name: 'poolKey',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      { name: 'info', type: 'uint256' },
    ],
  },
  {
    name: 'getPositionLiquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
];

const STATE_VIEW_ABI = [
  {
    name: 'getSlot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
  },
  {
    name: 'getLiquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
];

const ERC20_DECIMALS_ABI = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
];

// Decode the v4 packed position-info word into tickLower / tickUpper (24-bit signed).
function decodeTicks(info: bigint): { tickLower: number; tickUpper: number } {
  const signExtend24 = (raw: bigint) => {
    const v = Number(raw & 0xffffffn);
    return v >= 0x800000 ? v - 0x1000000 : v;
  };
  return {
    tickLower: signExtend24((info >> 8n) & 0xffffffn),
    tickUpper: signExtend24((info >> 32n) & 0xffffffn),
  };
}

// price_token1_per_token0 = (sqrtPriceX96^2 / 2^192) * 10^(dec0 - dec1), as a JS number.
function priceToken1PerToken0(sqrtPriceX96: bigint, dec0: number, dec1: number): number {
  const num = sqrtPriceX96 * sqrtPriceX96;
  const den = 2n ** 192n;
  const exp = dec0 - dec1;
  let n = num;
  let d = den;
  if (exp >= 0) n *= 10n ** BigInt(exp);
  else d *= 10n ** BigInt(-exp);
  const PREC = 10n ** 18n;
  const scaled = (n * PREC) / d;
  return Number(scaled) / 1e18;
}

export default async function (req: Request): Promise<Response> {
  try {
    // Auth: shared secret (external callers) OR admin (workflow service JWT / admin UI).
    const expectedSecret = Deno.env.get('BACKEND_FUNCTION_SECRET');
    const headerSecret = req.headers.get('x-trigger-secret') || '';
    let body: any = {};
    try {
      body = await req.clone().json().catch(() => ({}));
    } catch {}
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
    if (!rpcUrl) {
      return Response.json({ error: 'POLYGON_RPC_URL secret not set' }, { status: 400 });
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const positionManager = new ethers.Contract(POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
    const stateView = new ethers.Contract(STATE_VIEW, STATE_VIEW_ABI, provider);

    // 1. Read the position's pool key + packed tick info.
    const [poolKey, info] = await positionManager.getPoolAndPositionInfo(POSITION_TOKEN_ID);
    const currency0: string = poolKey.currency0;
    const currency1: string = poolKey.currency1;
    const fee: number = Number(poolKey.fee);
    const tickSpacing: number = Number(poolKey.tickSpacing);
    const hooks: string = poolKey.hooks;
    const { tickLower, tickUpper } = decodeTicks(BigInt(info));

    const positionLiquidity: bigint = await positionManager.getPositionLiquidity(POSITION_TOKEN_ID);

    // 2. Compute the v4 PoolId = keccak256(abi.encode(PoolKey)).
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [currency0, currency1, fee, tickSpacing, hooks],
    );
    const poolId = ethers.keccak256(encoded);

    // 3. Read the current pool price + active liquidity from StateView.
    const slot0 = await stateView.getSlot0(poolId);
    const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96);
    const tick: number = Number(slot0.tick);
    const poolLiquidity: bigint = await stateView.getLiquidity(poolId);

    // 4. Resolve token decimals + identify PULSE vs USDC.
    const pulseAddr = (secrets.get('PULSE_TOKEN_CONTRACT') || '').toLowerCase();
    const token0Contract = new ethers.Contract(currency0, ERC20_DECIMALS_ABI, provider);
    const token1Contract = new ethers.Contract(currency1, ERC20_DECIMALS_ABI, provider);
    const [dec0Raw, dec1Raw] = await Promise.all([
      token0Contract.decimals().catch(() => 18),
      token1Contract.decimals().catch(() => 6),
    ]);
    const dec0 = Number(dec0Raw);
    const dec1 = Number(dec1Raw);

    const priceT1PerT0 = priceToken1PerToken0(sqrtPriceX96, dec0, dec1);
    const token0IsPulse = currency0.toLowerCase() === pulseAddr;
    let priceUsdcPerPulse: number;
    let pricePulsePerUsdc: number;
    if (token0IsPulse) {
      // token0 = PULSE, token1 = USDC → priceT1PerT0 = USDC per PULSE
      priceUsdcPerPulse = priceT1PerT0;
      pricePulsePerUsdc = priceT1PerT0 > 0 ? 1 / priceT1PerT0 : 0;
    } else {
      // token0 = USDC, token1 = PULSE → priceT1PerT0 = PULSE per USDC
      pricePulsePerUsdc = priceT1PerT0;
      priceUsdcPerPulse = priceT1PerT0 > 0 ? 1 / priceT1PerT0 : 0;
    }

    const inRange = tick >= tickLower && tick <= tickUpper;
    const driftPct = Math.abs(priceUsdcPerPulse - TARGET_USDC_PER_PULSE) / TARGET_USDC_PER_PULSE;
    const threshold = Number(body?.threshold) || 0.25; // 25% default
    const drifted = driftPct > threshold;

    const result = {
      positionUrl: POSITION_URL,
      positionTokenId: Number(POSITION_TOKEN_ID),
      poolId,
      poolKey: { currency0, currency1, fee, tickSpacing, hooks },
      feeTierPct: fee / 10000,
      tick,
      tickLower,
      tickUpper,
      inRange,
      positionLiquidity: positionLiquidity.toString(),
      poolLiquidity: poolLiquidity.toString(),
      sqrtPriceX96: sqrtPriceX96.toString(),
      priceUsdcPerPulse,
      pricePulsePerUsdc,
      targetUsdcPerPulse: TARGET_USDC_PER_PULSE,
      driftPct,
      drifted,
      threshold,
      token0: { address: currency0, decimals: dec0, isPulse: token0IsPulse },
      token1: { address: currency1, decimals: dec1, isPulse: !token0IsPulse },
    };

    // 5. Optional alert path (scheduled workflow). Throttled to 1 / 24h.
    let alerted = false;
    if (body?.alert === true && (drifted || !inRange)) {
      const recent = await svc.entities.Notification.filter(
        { action_type: 'price_alert', group_key: 'uniswap_pool_drift' },
        '-created_date',
        1,
      ).catch(() => []);
      const last = recent[0];
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const throttled = last && last.created_date && new Date(last.created_date).getTime() > oneDayAgo;

      if (!throttled) {
        // Email every admin (registered users — SendEmail always reaches them).
        const admins = await svc.entities.User.list().catch(() => []);
        const reason = !inRange
          ? `position is OUT OF RANGE (tick ${tick} outside ${tickLower}–${tickUpper})`
          : `price drifted ${Math.round(driftPct * 100)}% from target`;
        const subject = `⚠️ SwapPulse Pool Alert: ${reason}`;
        const emailBody =
          `Your Uniswap v4 PULSE/USDC pool needs attention.\n\n` +
          `Reason: ${reason}\n\n` +
          `Current price: 1 PULSE = $${priceUsdcPerPulse.toPrecision(6)} (${pricePulsePerUsdc.toPrecision(6)} PULSE per USDC)\n` +
          `Target price: 1 PULSE = $0.001 (1000 PULSE per USDC)\n` +
          `Drift: ${Math.round(driftPct * 100)}% (threshold ${Math.round(threshold * 100)}%)\n` +
          `In range: ${inRange}\n` +
          `Current tick: ${tick} (position range ${tickLower} to ${tickUpper})\n\n` +
          `View / manage: ${POSITION_URL}\n\n` +
          `— SwapPulse Pool Monitor`;

        for (const a of admins) {
          if (a.role !== 'admin' || !a.email) continue;
          try {
            await svc.integrations.Core.SendEmail({
              to: a.email,
              subject,
              body: emailBody,
            });
          } catch (e) {
            console.error('[pool-monitor] email to admin failed', a.email, (e as any)?.message);
          }
        }

        // Throttle marker (sentinel did — no bell/push, just a dedup record admins can read).
        try {
          await svc.entities.Notification.create({
            did: 'uniswap-pool-monitor',
            action_type: 'price_alert',
            is_read: false,
            group_key: 'uniswap_pool_drift',
            target_type: 'wallet',
            target_path: '/wallet',
            target_label: `PULSE at $${priceUsdcPerPulse.toPrecision(4)} — ${reason}`,
            metadata: {
              priceUsdcPerPulse,
              pricePulsePerUsdc,
              tick,
              tickLower,
              tickUpper,
              inRange,
              driftPct,
              reason,
            },
          });
        } catch (e) {
          console.error('[pool-monitor] throttle marker create failed', (e as any)?.message);
        }
        alerted = true;
      }
    }

    return Response.json({ ...result, alerted });
  } catch (error: any) {
    console.error('get-uniswap-v4-pool-price error:', error?.message || error);
    return Response.json({ error: error?.message || 'Failed to read pool price' }, { status: 500 });
  }
}