import { base44 } from '@/api/base44Client';
import { idbGet, idbPut } from '@/lib/offlineDB';
import { getCurrentTcgdexLang } from '@/lib/i18n/currentLang';

const TCGDEX_IMAGE_BASE = 'https://assets.tcgdex.net';

// TCGDex serves per-language catalogs at /v2/{lang}/... (en, fr, de, it, es, pt, jp, zh, ko).
const TCGDEX_LANGS = ['en', 'fr', 'de', 'it', 'es', 'pt', 'jp', 'zh', 'ko'];
const LOCALE_TO_TCGDEX = {
  'en-GB': 'en', 'en-US': 'en', 'es-ES': 'es', 'fr-FR': 'fr', 'de-DE': 'de',
  'it-IT': 'it', 'pt-BR': 'pt', 'ja-JP': 'jp', 'zh-CN': 'zh', 'ko-KR': 'ko',
};

/** Map a user locale (e.g. fr-FR) to a TCGDex language code; unknown -> en. */
export function localeToTcgdexLang(locale) {
  if (!locale) return 'en';
  if (LOCALE_TO_TCGDEX[locale]) return LOCALE_TO_TCGDEX[locale];
  const two = String(locale).slice(0, 2).toLowerCase();
  return TCGDEX_LANGS.includes(two) ? two : 'en';
}

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

export async function searchCards(query, { page = 1, perPage = 24, setName, rarity, lang = getCurrentTcgdexLang() } = {}) {
  return cached(`search:${lang}:${query}:${page}:${perPage}:${setName || ''}:${rarity || ''}`, async () => {
    const res = await base44.functions.invoke('tcgdex', {
      action: 'search', query, page, perPage, setName, rarity, lang,
    });
    return res.data?.data ?? [];
  });
}

export async function getCard(cardId, lang = getCurrentTcgdexLang()) {
  return cached(`card:${lang}:${cardId}`, async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getCard', cardId, lang });
    return res.data?.data ?? null;
  });
}

/** Fetch a card by its set id + local id (TCGDex /sets/{setId}/{localId}). */
export async function getCardBySet(setId, localId, lang = getCurrentTcgdexLang()) {
  const nid = normalizeSetId(setId);
  return cached(`card:${lang}:${nid}:${localId}`, async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getCardBySet', setId: nid, localId, lang });
    return res.data?.data ?? null;
  });
}

export async function getSets(lang = getCurrentTcgdexLang()) {
  return cached(`sets:${lang}`, async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getSets', lang });
    return res.data?.data ?? [];
  });
}

export async function getSet(setId, lang = getCurrentTcgdexLang()) {
  const nid = normalizeSetId(setId);
  return cached(`set:${lang}:${nid}`, async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getSet', setId: nid, lang });
    return res.data?.data ?? null;
  });
}

export async function getSeries(lang = getCurrentTcgdexLang()) {
  return cached(`series:${lang}`, async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getSeries', lang });
    return res.data?.data ?? [];
  });
}

export async function getSerie(serieId, lang = getCurrentTcgdexLang()) {
  return cached(`serie:${lang}:${serieId}`, async () => {
    const res = await base44.functions.invoke('tcgdex', { action: 'getSerie', serieId, lang });
    return res.data?.data ?? null;
  });
}

function listEndpoint(action, cacheKey, lang = getCurrentTcgdexLang()) {
  return cached(`${cacheKey}:${lang}`, async () => {
    const res = await base44.functions.invoke('tcgdex', { action, lang });
    return res.data?.data ?? [];
  });
}

export const getCategories = (lang) => listEndpoint('getCategories', 'categories', lang);
export const getRarities = (lang) => listEndpoint('getRarities', 'rarities', lang);
export const getIllustrators = (lang) => listEndpoint('getIllustrators', 'illustrators', lang);
export const getVariants = (lang) => listEndpoint('getVariants', 'variants', lang);
export const getTypes = (lang) => listEndpoint('getTypes', 'types', lang);
export const getHps = (lang) => listEndpoint('getHps', 'hps', lang);
export const getRetreats = (lang) => listEndpoint('getRetreats', 'retreats', lang);
export const getStages = (lang) => listEndpoint('getStages', 'stages', lang);
export const getDexIds = (lang) => listEndpoint('getDexIds', 'dexids', lang);
export const getEnergyTypes = (lang) => listEndpoint('getEnergyTypes', 'energytypes', lang);
export const getRegulationMarks = (lang) => listEndpoint('getRegulationMarks', 'regulationmarks', lang);
export const getSuffixes = (lang) => listEndpoint('getSuffixes', 'suffixes', lang);
export const getTrainerTypes = (lang) => listEndpoint('getTrainerTypes', 'trainertypes', lang);

/**
 * Normalize a set ID to TCGDex's canonical format.
 * TCGDex uses leading zeros for single-digit SV sets (sv01, sv02, ...) and
 * ".5" for half-sets (sv04.5, sv06.5). Some stored data uses short forms
 * like "sv4a" (a = .5) or "sv1" (no leading zero).
 *   sv4a  → sv04.5,  sv1 → sv01,  sv04.5 → sv04.5 (no change)
 */
export function normalizeSetId(setId) {
  if (!setId) return setId;
  let s = String(setId).toLowerCase().trim();
  s = s.replace(/^([a-z]+)(\d+)a$/, '$1$2.5');
  s = s.replace(/^([a-z]+)(\d)(\D|$)/, '$10$2$3');
  return s;
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