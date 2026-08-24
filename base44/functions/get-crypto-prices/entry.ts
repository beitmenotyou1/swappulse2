// get-crypto-prices — fetches current crypto prices from Coinbase for
// POL, ETH, SOL, BTC, and USDC against USD, GBP, and EUR. Used by the wallet
// UI to display multi-chain holdings in the user's preferred display currency.
// Falls back to approximate static rates if the API is unavailable.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';

const FALLBACK_RATES = {
  pol: { usd: 0.50, gbp: 0.39, eur: 0.46 },
  eth: { usd: 3000, gbp: 2370, eur: 2760 },
  sol: { usd: 150, gbp: 118, eur: 138 },
  btc: { usd: 60000, gbp: 47400, eur: 55200 },
  usdc: { usd: 1.0, gbp: 0.79, eur: 0.92 },
};

async function fetchSpot(pair: string): Promise<number> {
  try {
    const url = `https://api.coinbase.com/v2/prices/${pair}/spot`;
    await assertSafeHost(new URL(url).hostname);
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return 0;
    const data: any = await res.json();
    return parseFloat(data?.data?.amount || '0');
  } catch {
    return 0;
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    createClientFromRequest(req);

    const ratesUrl = new URL('https://api.coinbase.com/v2/exchange-rates?currency=USD');
    await assertSafeHost(ratesUrl.hostname);

    const [ratesRes, polUsd, ethUsd, solUsd, btcUsd] = await Promise.all([
      fetch(ratesUrl.toString(), { headers: { Accept: 'application/json' } }),
      fetchSpot('MATIC-USD'),
      fetchSpot('ETH-USD'),
      fetchSpot('SOL-USD'),
      fetchSpot('BTC-USD'),
    ]);

    if (!ratesRes.ok) {
      return Response.json({ prices: FALLBACK_RATES, fallback: true, fetched_at: new Date().toISOString() });
    }

    const ratesData = await ratesRes.json();
    const rates = ratesData?.data?.rates || {};
    const usdToGbp = parseFloat(rates.GBP || '0') || FALLBACK_RATES.usdc.gbp;
    const usdToEur = parseFloat(rates.EUR || '0') || FALLBACK_RATES.usdc.eur;

    const pol = polUsd || FALLBACK_RATES.pol.usd;
    const eth = ethUsd || FALLBACK_RATES.eth.usd;
    const sol = solUsd || FALLBACK_RATES.sol.usd;
    const btc = btcUsd || FALLBACK_RATES.btc.usd;

    return Response.json({
      prices: {
        pol: { usd: pol, gbp: pol * usdToGbp, eur: pol * usdToEur },
        eth: { usd: eth, gbp: eth * usdToGbp, eur: eth * usdToEur },
        sol: { usd: sol, gbp: sol * usdToGbp, eur: sol * usdToEur },
        btc: { usd: btc, gbp: btc * usdToGbp, eur: btc * usdToEur },
        usdc: { usd: 1.0, gbp: usdToGbp, eur: usdToEur },
      },
      fetched_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('get-crypto-prices error:', error?.message || error);
    return Response.json({ prices: FALLBACK_RATES, fallback: true, fetched_at: new Date().toISOString() });
  }
}