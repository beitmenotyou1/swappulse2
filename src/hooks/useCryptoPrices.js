// useCryptoPrices — fetches and caches multi-chain crypto prices from the
// get-crypto-prices backend function. Provides conversion helpers to display
// holdings (USDC + native tokens across all chains) in the user's preferred
// display currency.

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

let _cachedPrices = null;
let _fetchPromise = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000;

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
            .then((res) => { _cacheTime = Date.now(); return res.data?.prices || null; })
            .catch(() => null)
            .finally(() => { _fetchPromise = null; });
        }
        const p = await _fetchPromise;
        _cachedPrices = p;
        if (!cancelled) { setPrices(p); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { prices, loading };
}

// Convert a raw native token amount to its USD value
export function nativeToUsd(rawAmount, decimals, symbol, prices) {
  const tokenAmount = Number(BigInt(rawAmount || '0')) / Math.pow(10, decimals);
  const priceUsd = prices?.[symbol.toLowerCase()]?.usd || 0;
  return tokenAmount * priceUsd;
}

// Convert USDC wei to USD value
export function usdcToUsd(usdcWei, prices) {
  const usdcAmount = Number(BigInt(usdcWei || '0')) / 1_000_000;
  return usdcAmount * (prices?.usdc?.usd || 1);
}

// Convert a USD value to the user's display currency
export function usdToDisplay(usdValue, displayCurrency, prices) {
  if (!prices) return { amount: 0, label: displayCurrency, symbol: '', formatted: '—' };

  switch (displayCurrency) {
    case 'USD':
      return { amount: usdValue, label: 'USD', symbol: '$', formatted: `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` };
    case 'GBP':
      return { amount: usdValue * (prices.usdc?.gbp || 0), label: 'GBP', symbol: '£', formatted: `£${(usdValue * (prices.usdc?.gbp || 0)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` };
    case 'EUR':
      return { amount: usdValue * (prices.usdc?.eur || 0), label: 'EUR', symbol: '€', formatted: `€${(usdValue * (prices.usdc?.eur || 0)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` };
    case 'USDC':
      return { amount: usdValue, label: 'USDC', symbol: '', formatted: `${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC` };
    case 'POL': {
      const p = prices.pol?.usd || 0;
      return { amount: p > 0 ? usdValue / p : 0, label: 'POL', symbol: '', formatted: p > 0 ? `${(usdValue / p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} POL` : '— POL' };
    }
    case 'ETH': {
      const p = prices.eth?.usd || 0;
      return { amount: p > 0 ? usdValue / p : 0, label: 'ETH', symbol: '', formatted: p > 0 ? `${(usdValue / p).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ETH` : '— ETH' };
    }
    case 'SOL': {
      const p = prices.sol?.usd || 0;
      return { amount: p > 0 ? usdValue / p : 0, label: 'SOL', symbol: '', formatted: p > 0 ? `${(usdValue / p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SOL` : '— SOL' };
    }
    case 'BTC': {
      const p = prices.btc?.usd || 0;
      return { amount: p > 0 ? usdValue / p : 0, label: 'BTC', symbol: '', formatted: p > 0 ? `${(usdValue / p).toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })} BTC` : '— BTC' };
    }
    default:
      return { amount: usdValue, label: 'USDC', symbol: '', formatted: `${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC` };
  }
}

// Compute the total portfolio value across all chains + fiat + USDC
export function calculatePortfolioTotal(chainBalances, fiatCents, fiatCurrency, usdcWei, displayCurrency, prices) {
  let totalUsd = 0;

  // Fiat
  const fiatUsdRate = { GBP: prices?.usdc?.gbp || 0.79, EUR: prices?.usdc?.eur || 0.92, USD: 1 };
  totalUsd += (fiatCents || 0) / 100 / (fiatUsdRate[fiatCurrency] || 1);

  // USDC
  totalUsd += usdcToUsd(usdcWei, prices);

  // Native tokens across chains
  if (chainBalances) {
    for (const cb of chainBalances) {
      totalUsd += nativeToUsd(cb.native, cb.nativeDecimals, cb.nativeSymbol, prices);
      if (cb.usdc) totalUsd += usdcToUsd(cb.usdc, prices);
    }
  }

  return usdToDisplay(totalUsd, displayCurrency, prices);
}

// Legacy helper — kept for backward compat
export function convertUsdcToDisplay(usdcWei, displayCurrency, prices) {
  const usd = usdcToUsd(usdcWei, prices);
  return usdToDisplay(usd, displayCurrency, prices);
}