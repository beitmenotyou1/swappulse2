// get-uniswap-v4-pool-price — reads the live state of the SwapPulse $PULSE/USDC
// Uniswap v4 liquidity pool on Polygon via the StateView lens contract (no
// subgraph/API key required — uses the existing POLYGON_RPC_URL secret).
//
// The on-chain read lives in base44/shared/uniswapPoolPrice.ts and is shared
// with execute-conversion, which uses the pool price as the trusted source
// for treasury disbursement.
//
// Pure read by default (used by the admin UI). Pass { alert: true } (the scheduled
// "Uniswap Pool Price Monitor" workflow does this) to additionally compare the
// price against the $0.001/PULSE target and email every admin when it drifts
// beyond a threshold or the position falls out of range. Alerts are throttled to
// one per 24h via a Notification marker record.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  readPulseUsdcPoolPrice,
  POSITION_URL,
  POSITION_TOKEN_ID,
} from '../../shared/uniswapPoolPrice.ts';

const TARGET_USDC_PER_PULSE = 0.001; // 1 PULSE = $0.001

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

    // 1. Read the live pool state (shared on-chain reader).
    const pool = await readPulseUsdcPoolPrice();

    const driftPct = Math.abs(pool.priceUsdcPerPulse - TARGET_USDC_PER_PULSE) / TARGET_USDC_PER_PULSE;
    const threshold = Number(body?.threshold) || 0.25; // 25% default
    const drifted = driftPct > threshold;

    const result = {
      positionUrl: POSITION_URL,
      positionTokenId: Number(POSITION_TOKEN_ID),
      poolId: pool.poolId,
      poolKey: pool.poolKey,
      feeTierPct: pool.feeTierPct,
      tick: pool.tick,
      tickLower: pool.tickLower,
      tickUpper: pool.tickUpper,
      inRange: pool.inRange,
      positionLiquidity: pool.positionLiquidity.toString(),
      poolLiquidity: pool.poolLiquidity.toString(),
      sqrtPriceX96: pool.sqrtPriceX96.toString(),
      priceUsdcPerPulse: pool.priceUsdcPerPulse,
      pricePulsePerUsdc: pool.pricePulsePerUsdc,
      targetUsdcPerPulse: TARGET_USDC_PER_PULSE,
      driftPct,
      drifted,
      threshold,
      token0: pool.token0,
      token1: pool.token1,
    };

    // 2. Optional alert path (scheduled workflow). Throttled to 1 / 24h.
    let alerted = false;
    if (body?.alert === true && (drifted || !pool.inRange)) {
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
        const reason = !pool.inRange
          ? `position is OUT OF RANGE (tick ${pool.tick} outside ${pool.tickLower}–${pool.tickUpper})`
          : `price drifted ${Math.round(driftPct * 100)}% from target`;
        const subject = `⚠️ SwapPulse Pool Alert: ${reason}`;
        const emailBody =
          `Your Uniswap v4 PULSE/USDC pool needs attention.\n\n` +
          `Reason: ${reason}\n\n` +
          `Current price: 1 PULSE = $${pool.priceUsdcPerPulse.toPrecision(6)} (${pool.pricePulsePerUsdc.toPrecision(6)} PULSE per USDC)\n` +
          `Target price: 1 PULSE = $0.001 (1000 PULSE per USDC)\n` +
          `Drift: ${Math.round(driftPct * 100)}% (threshold ${Math.round(threshold * 100)}%)\n` +
          `In range: ${pool.inRange}\n` +
          `Current tick: ${pool.tick} (position range ${pool.tickLower} to ${pool.tickUpper})\n\n` +
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
            target_label: `PULSE at $${pool.priceUsdcPerPulse.toPrecision(4)} — ${reason}`,
            metadata: {
              priceUsdcPerPulse: pool.priceUsdcPerPulse,
              pricePulsePerUsdc: pool.pricePulsePerUsdc,
              tick: pool.tick,
              tickLower: pool.tickLower,
              tickUpper: pool.tickUpper,
              inRange: pool.inRange,
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