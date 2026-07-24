import { base44 } from '@/api/base44Client';
import { idbGet, idbPut } from '@/lib/offlineDB';

const TCGDEX_IMAGE_BASE = 'https://assets.tcgdex.net';

export function cardImageUrl(imageField, quality = 'high', extension = 'webp') {
  if (!imageField) return null;
  const suffix = `/${quality}.${extension}`;
  if (imageField.startsWith('http')) return `${imageField}${suffix}`;
  return `${TCGDEX_IMAGE_BASE}/${imageField}${suffix}`;
}

// Write-through catalog cache + offline fallback (§8 Layer 2).
async function cached(key, fetcher) {
  try {
    const data = await fetcher();
    await idbPut('catalog', key, data).catch(() => {});
    return data;
  } catch (e) {
    const hit = await idbGet('catalog', key).catch(() => undefined);
    if (hit) return hit;
    throw e;
  }
}

export async function searchCards(query, { page = 1, perPage = 24, setName, rarity } = {}) {
  return cached(`search:${query}:${page}:${perPage}:${setName || ''}:${rarity || ''}`, async () => {
    const res = await base44.functions.invoke('tcgdex', {
      action: 'search', query, page, perPage, setName, rarity,
    });
    return res.data?.data ?? [];
  });
}

export async function getCard(cardId) {
  return cached(`card:${cardId}`, async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getCard', cardId });
    return res.data?.data ?? null;
  });
}

export async function getSets() {
  return cached('sets', async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getSets' });
    return res.data?.data ?? [];
  });
}

export async function getSet(setId) {
  return cached(`set:${setId}`, async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getSet', setId });
    return res.data?.data ?? null;
  });
}

export async function getSeries() {
  return cached('series', async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getSeries' });
    return res.data?.data ?? [];
  });
}

export async function getCategories() {
  return cached('categories', async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getCategories' });
    return res.data?.data ?? [];
  });
}

export async function getRarities() {
  return cached('rarities', async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getRarities' });
    return res.data?.data ?? [];
  });
}

export async function getIllustrators() {
  return cached('illustrators', async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getIllustrators' });
    return res.data?.data ?? [];
  });
}

export async function getVariants() {
  return cached('variants', async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getVariants' });
    return res.data?.data ?? [];
  });
}

export async function getTypes() {
  return cached('types', async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getTypes' });
    return res.data?.data ?? [];
  });
}

export function rarityKey(rarityStr) {
  if (!rarityStr) return 'common';
  const r = rarityStr.toLowerCase();
  if (r.includes('secret') || r.includes('rainbow')) return 'secret';
  if (r.includes('ex') || r.includes('vmax') || r.includes('vstar') || r.includes('gx')) return 'ex';
  if (r.includes('holo') || r.includes('ultra') || r.includes('full')) return 'holo';
  if (r.includes('rare')) return 'rare';
  if (r.includes('uncommon')) return 'uncommon';
  return 'common';
}

export function rarityClasses(rarityStr) {
  const key = rarityKey(rarityStr);
  const map = {
    common: 'text-rarity-common',
    uncommon: 'text-rarity-uncommon',
    rare: 'text-rarity-rare',
    holo: 'text-rarity-holo',
    ex: 'text-rarity-ex',
    secret: 'text-rarity-secret',
  };
  const glowMap = {
    common: '',
    uncommon: 'rarity-glow-uncommon',
    rare: 'rarity-glow-rare',
    holo: 'rarity-glow-holo',
    ex: 'rarity-glow-ex',
    secret: 'rarity-glow-secret',
  };
  return { key, text: map[key], glow: glowMap[key] };
}