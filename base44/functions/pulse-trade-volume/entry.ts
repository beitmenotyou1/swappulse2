// pulse-trade-volume — returns PulseChain network activity summary with two
// side-by-side metrics:
// 1. On-chain PLS transfer volume: sum of value_wei across indexed
//    PulseTransaction records in the last 24h and 7d.
// 2. SwapPulse trade volume: sum of usdc_amount_wei across completed
//    (status='released') EscrowTrade records in the last 24h and 7d.
// Public read (no auth required).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * DAY_MS;
const DATE_24H_AGO = new Date(NOW - DAY_MS).toISOString();
const DATE_7D_AGO = new Date(NOW - SEVEN_DAYS_MS).toISOString();

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // --- 1. On-chain PLS transfer volume from indexed PulseTransaction ---
    // Fetch recent records (sorted by created_date desc) and filter by
    // timestamp in code. The indexer tracks recent blocks so a few hundred
    // records covers the 24h/7d windows.
    let plsVolume24h = 0n;
    let plsVolume7d = 0n;
    let plsTxCount24h = 0;
    let plsTxCount7d = 0;

    try {
      const txs = await svc.entities.PulseTransaction.list('-created_date', 500);
      for (const tx of txs) {
        const ts = tx.timestamp || tx.created_date;
        if (!ts) continue;
        const tsMs = new Date(ts).getTime();
        if (isNaN(tsMs)) continue;
        const value = BigInt(tx.value_wei || '0');
        if (tsMs >= NOW - DAY_MS) {
          plsVolume24h += value;
          plsTxCount24h++;
        }
        if (tsMs >= NOW - SEVEN_DAYS_MS) {
          plsVolume7d += value;
          plsTxCount7d++;
        }
      }
    } catch (e) {
      console.error('PulseTransaction volume query failed:', e?.message || e);
    }

    // --- 2. SwapPulse trade volume from completed EscrowTrade records ---
    let tradeVolume24h = 0n;
    let tradeVolume7d = 0n;
    let tradeCount24h = 0;
    let tradeCount7d = 0;

    try {
      // Fetch recent released trades; filter by date in code.
      const trades = await svc.entities.EscrowTrade.filter(
        { status: 'released' },
        '-updated_date',
        500,
      );
      for (const trade of trades) {
        const ts = trade.updated_date || trade.updated_at || trade.created_date;
        if (!ts) continue;
        const tsMs = new Date(ts).getTime();
        if (isNaN(tsMs)) continue;
        const value = BigInt(trade.usdc_amount_wei || '0');
        if (tsMs >= NOW - DAY_MS) {
          tradeVolume24h += value;
          tradeCount24h++;
        }
        if (tsMs >= NOW - SEVEN_DAYS_MS) {
          tradeVolume7d += value;
          tradeCount7d++;
        }
      }
    } catch (e) {
      console.error('EscrowTrade volume query failed:', e?.message || e);
    }

    return Response.json({
      pulsechain: {
        plsTransferVolume: {
          '24h': plsVolume24h.toString(),
          '7d': plsVolume7d.toString(),
        },
        plsTxCount: {
          '24h': plsTxCount24h,
          '7d': plsTxCount7d,
        },
      },
      swapPulse: {
        tradeVolume: {
          '24h': tradeVolume24h.toString(),
          '7d': tradeVolume7d.toString(),
        },
        tradeCount: {
          '24h': tradeCount24h,
          '7d': tradeCount7d,
        },
      },
    });
  } catch (error: any) {
    console.error('pulse-trade-volume error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}