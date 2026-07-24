import { base44 } from '@/api/base44Client';

const TCGDEX_IMAGE_BASE = 'https://assets.tcgdex.net';

export function cardImageUrl(imageField, quality = 'high', extension = 'webp') {
  if (!imageField) return null;
  const suffix = `/${quality}.${extension}`;
  if (imageField.startsWith('http')) return `${imageField}${suffix}`;
  return `${TCGDEX_IMAGE_BASE}/${imageField}${suffix}`;
}

export async function searchCards(query, { page = 1, perPage = 24, setName, rarity } = {}) {
  const res = await base44.functions.invoke('tcgdex', {
    action: 'search',
    query,
    page,
    perPage,
    setName,
    rarity,
  });
  return res.data?.data ?? [];
}

export async function getCard(cardId) {
  const res = await base44.functions.invoke('tcgdex', {
    action: 'getCard',
    cardId,
  });
  return res.data?.data ?? null;
}

export async function getSets() {
  const res = await base44.functions.invoke('tcgdex', { action: 'getSets' });
  return res.data?.data ?? [];
}

export async function getSet(setId) {
  const res = await base44.functions.invoke('tcgdex', {
    action: 'getSet',
    setId,
  });
  return res.data?.data ?? null;
}

export async function getSeries() {
  const res = await base44.functions.invoke('tcgdex', { action: 'getSeries' });
  return res.data?.data ?? [];
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
  return { key, text: map[key] };
}