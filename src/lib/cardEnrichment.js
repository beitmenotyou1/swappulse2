import { base44 } from '@/api/base44Client';
import { idbGet, idbPut } from '@/lib/offlineDB';
import { localeToTcgdexLang } from '@/lib/tcgdex';

function now() {
  return Date.now();
}

async function cachedEnrichment(key, ttlMs, fetcher) {
  const stored = await idbGet('catalog', key).catch(() => null);
  if (stored?.data && stored?.cachedAt && now() - stored.cachedAt < ttlMs) {
    return stored.data;
  }

  try {
    const data = await fetcher();
    if (data) {
      await idbPut('catalog', key, { data, cachedAt: now() }).catch(() => {});
    }
    return data;
  } catch (error) {
    if (stored?.data) return stored.data;
    throw error;
  }
}

export async function getPokeWalletMarket(cardId) {
  if (!cardId) return null;
  return cachedEnrichment(`pokewallet-market:${cardId}`, 15 * 60 * 1000, async () => {
    const res = await base44.functions.invoke('pokewallet-market', { cardId });
    return res?.data ?? null;
  });
}

export async function getPokemonEnrichment(cardId, locale = 'en') {
  if (!cardId) return null;
  const lang = localeToTcgdexLang(locale);
  return cachedEnrichment(`pokeapi-profile:${lang}:${cardId}`, 24 * 60 * 60 * 1000, async () => {
    const res = await base44.functions.invoke('pokemon-enrichment', { cardId, lang });
    return res?.data ?? null;
  });
}

export async function getPokemonPriceTrackerMarket(cardId) {
  if (!cardId) return null;
  return cachedEnrichment(`pokemon-price-tracker:${cardId}`, 30 * 60 * 1000, async () => {
    const res = await base44.functions.invoke('pokemon-price-tracker-market', { cardId });
    return res?.data ?? null;
  });
}

export async function getTcgplayerMarket(cardId) {
  if (!cardId) return null;
  return cachedEnrichment(`tcgplayer-market:${cardId}`, 30 * 60 * 1000, async () => {
    const res = await base44.functions.invoke('tcgplayer-market', { cardId });
    return res?.data ?? null;
  });
}
