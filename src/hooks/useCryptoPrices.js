// useCryptoPrices — fetches and caches crypto prices from the get-crypto-prices
// backend function. Provides a conversion helper to display USDC holdings in
// the user's preferred display currency (USDC, POL, GBP, EUR, USD).

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

let _cachedPrices = null;
let _fetchPromise = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export function useCryptoPrices() {
  const [prices, setPrices] = useState(_cachedPrices);
  const [loading, setLoading] = useState(!_cachedPrices);

  useEffect(() => {
    if (_cachedPrices && Date.now() - _cacheTime < CACHE_TTL) {
      setPrices(_cachedPrices);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (!_fetchPromise) {
          _fetchPromise = base44.functions.invoke('get-crypto-prices', {})
            .then((res) => {
              _cacheTime = Date.now();
              return res.data?.prices || null;
            })
            .catch(() => null)
            .finally(() => { _fetchPromise = null; });
        }
        const p = await _fetchPromise;
        _cachedPrices = p;
        if (!cancelled) {
          setPrices(p);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { prices, loading };
}

// Converts a USDC wei amount to the user's display currency.
// Returns { amount, label, symbol, formatted }.
export function convertUsdcToDisplay(usdcWei, displayCurrency, prices) {
  const usdcAmount = Number(BigInt(usdcWei || '0')) / 1_000_000;

  switch (displayCurrency) {
    case 'USDC':
      return {
        amount: usdcAmount,
        label: 'USDC',
        symbol: '',
        formatted: `${usdcAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
      };
    case 'POL': {
      const polPriceUsd = prices?.pol?.usd || 0;
      const usdcPriceUsd = prices?.usdc?.usd || 1;
      if (polPriceUsd === 0) {
        return { amount: 0, label: 'POL', symbol: '', formatted: '— POL' };
      }
      const polAmount = (usdcAmount * usdcPriceUsd) / polPriceUsd;
      return {
        amount: polAmount,
        label: 'POL',
        symbol: '',
        formatted: `${polAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} POL`,
      };
    }
    case 'GBP': {
      const rate = prices?.usdc?.gbp || 0;
      const amount = usdcAmount * rate;
      return {
        amount,
        label: 'GBP',
        symbol: '£',
        formatted: rate > 0 ? `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '£—',
      };
    }
    case 'EUR': {
      const rate = prices?.usdc?.eur || 0;
      const amount = usdcAmount * rate;
      return {
        amount,
        label: 'EUR',
        symbol: '€',
        formatted: rate > 0 ? `€${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '€—',
      };
    }
    case 'USD': {
      const rate = prices?.usdc?.usd || 1;
      const amount = usdcAmount * rate;
      return {
        amount,
        label: 'USD',
        symbol: '$',
        formatted: `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      };
    }
    default:
      return {
        amount: usdcAmount,
        label: 'USDC',
        symbol: '',
        formatted: `${usdcAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
      };
  }
}