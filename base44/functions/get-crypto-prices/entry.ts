// get-crypto-prices — fetches current crypto prices from Coinbase for
// POL (MATIC) and USDC against major fiat currencies. Used by the wallet
// UI to display crypto holdings in the user's preferred display currency.
// Falls back to approximate static rates if the API is unavailable.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';

// Fallback rates (approximate, used only if the API is down)
const FALLBACK_RATES = {
  pol: { usd: 0.50, gbp: 0.39, eur: 0.46 },
  usdc: { usd: 1.0, gbp: 0.79, eur: 0.92 },
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Verify the caller is an authenticated SwapPulse user before running
    // external price lookups on their behalf.
    try {
      const me = await base44.auth.me();
      if (!me?.id) throw new Error('unauthenticated');
    } catch {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const ratesUrl = new URL('https://api.coinbase.com/v2/exchange-rates?currency=USD');
    await assertSafeHost(ratesUrl.hostname);

    const [ratesRes, polRes] = await Promise.all([
      fetch(ratesUrl.toString(), { headers: { 'Accept': 'application/json' } }),
      fetch('https://api.coinbase.com/v2/prices/MATIC-USD/spot', {
        headers: { 'Accept': 'application/json' },
      }).catch(() => null),
    ]);

    if (!ratesRes.ok) {
      // API down — return fallback rates so the wallet still works
      return Response.json({ prices: FALLBACK_RATES, fallback: true, fetched_at: new Date().toISOString() });
    }

    const ratesData = await ratesRes.json();
    const rates = ratesData?.data?.rates || {};

    const usdToGbp = parseFloat(rates.GBP || '0') || FALLBACK_RATES.usdc.gbp;
    const usdToEur = parseFloat(rates.EUR || '0') || FALLBACK_RATES.usdc.eur;

    let polPriceUsd = 0;
    if (polRes && polRes.ok) {
      const polData = await polRes.json().catch(() => null);
      polPriceUsd = parseFloat(polData?.data?.amount || '0');
    }
    if (!polPriceUsd) polPriceUsd = FALLBACK_RATES.pol.usd;

    return Response.json({
      prices: {
        pol: {
          usd: polPriceUsd,
          gbp: polPriceUsd * usdToGbp,
          eur: polPriceUsd * usdToEur,
        },
        usdc: {
          usd: 1.0,
          gbp: usdToGbp,
          eur: usdToEur,
        },
      },
      fetched_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('get-crypto-prices error:', error?.message || error);
    // Return fallback rates so the wallet UI still works
    return Response.json({ prices: FALLBACK_RATES, fallback: true, fetched_at: new Date().toISOString() });
  }
}