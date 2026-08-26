// get-crypto-prices — fetches current crypto prices from Coinbase for all
// major supported chain native tokens against USD, GBP, and EUR. Used by
// the wallet UI and conversion modal to display accurate fiat equivalents.
// Falls back to approximate static rates if the API is unavailable.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';

// All major crypto symbols supported across the chain registry
const SYMBOLS = [
  'POL', 'MATIC', 'ETH', 'BTC', 'SOL', 'USDC', 'USDT',
  'AVAX', 'BNB', 'ARB', 'OP', 'DAI', 'WBTC', 'LINK', 'UNI',
  'PLS',
];

const FALLBACK_RATES: Record<string, { usd: number; gbp: number; eur: number }> = {
  pol: { usd: 0.50, gbp: 0.39, eur: 0.46 },
  matic: { usd: 0.50, gbp: 0.39, eur: 0.46 },
  eth: { usd: 3000, gbp: 2370, eur: 2760 },
  btc: { usd: 60000, gbp: 47400, eur: 55200 },
  sol: { usd: 150, gbp: 118, eur: 138 },
  usdc: { usd: 1.0, gbp: 0.79, eur: 0.92 },
  usdt: { usd: 1.0, gbp: 0.79, eur: 0.92 },
  dai: { usd: 1.0, gbp: 0.79, eur: 0.92 },
  wbtc: { usd: 60000, gbp: 47400, eur: 55200 },
  pls: { usd: 0.00002, gbp: 0.000016, eur: 0.000018 },
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    try {
      const me = await base44.auth.me();
      if (!me?.id) throw new Error('unauthenticated');
    } catch {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const ratesUrl = 'https://api.coinbase.com/v2/exchange-rates?currency=USD';
    await assertSafeHost(new URL(ratesUrl).hostname);

    // Fetch USD exchange rates and all crypto spot prices in parallel
    const [ratesRes, ...priceResults] = await Promise.all([
      fetch(ratesUrl, { headers: { Accept: 'application/json' } }),
      ...SYMBOLS.map((sym) =>
        fetch(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`, {
          headers: { Accept: 'application/json' },
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      ),
    ]);

    if (!ratesRes.ok) {
      return Response.json({ prices: FALLBACK_RATES, fallback: true, fetched_at: new Date().toISOString() });
    }

    const ratesData = await ratesRes.json();
    const rates = ratesData?.data?.rates || {};
    const usdToGbp = parseFloat(rates.GBP || '0') || 0.79;
    const usdToEur = parseFloat(rates.EUR || '0') || 0.92;

    const prices: Record<string, { usd: number; gbp: number; eur: number }> = {};
    SYMBOLS.forEach((sym, i) => {
      const data = priceResults[i];
      const usdPrice = data?.data?.amount
        ? parseFloat(data.data.amount)
        : FALLBACK_RATES[sym.toLowerCase()]?.usd || 0;
      prices[sym.toLowerCase()] = {
        usd: usdPrice,
        gbp: usdPrice * usdToGbp,
        eur: usdPrice * usdToEur,
      };
    });

    // Alias PLS (Coinbase ticker) to 'pulse' (chain registry key) so the
    // wallet UI can look up the PulseChain native token price by chain key.
    if (prices.pls && !prices.pulse) {
      prices.pulse = prices.pls;
    }

    return Response.json({ prices, fetched_at: new Date().toISOString() });
  } catch (error: any) {
    console.error('get-crypto-prices error:', error?.message || error);
    const fallbackWithAlias = { ...FALLBACK_RATES, pulse: FALLBACK_RATES.pls };
    return Response.json({ prices: fallbackWithAlias, fallback: true, fetched_at: new Date().toISOString() });
  }
}