/**
 * PokeAPI species-enrichment client.
 *
 * PokeAPI is a public GET-only API with no authentication. Its fair-use policy
 * asks clients to cache every resource they request, so all upstream reads here
 * are persisted in the private PokeApiCache entity before being reused.
 *
 * PokeAPI docs: https://pokeapi.co/docs/v2
 */

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const inflight = new Map<string, Promise<any>>();

type PokeResourceType = 'pokemon' | 'species' | 'evolution';

function numericResourceId(url: string | null | undefined): number | null {
  const match = String(url || '').match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

function cleanFlavor(value: unknown): string {
  return String(value || '').replace(/[\f\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function getCache(svc: any, cacheKey: string): Promise<any | null> {
  const rows = await svc.entities.PokeApiCache
    .filter({ cache_key: cacheKey }, '-updated_date', 1)
    .catch(() => []);
  return rows?.[0] || null;
}

async function saveCache(
  svc: any,
  cacheKey: string,
  type: PokeResourceType,
  resourceId: string,
  payload: any,
  sourceUrl: string,
): Promise<void> {
  const now = new Date();
  const record = {
    cache_key: cacheKey,
    resource_type: type,
    resource_id: resourceId,
    payload,
    source_url: sourceUrl,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
    schema_version: 1,
  };
  const existing = await getCache(svc, cacheKey);
  if (existing?.id) await svc.entities.PokeApiCache.update(existing.id, record);
  else await svc.entities.PokeApiCache.create(record);
}

async function cachedResource(svc: any, type: PokeResourceType, id: number, path: string): Promise<{ data: any; fromCache: boolean; stale: boolean }> {
  const cacheKey = `${type}:${id}`;
  const existing = await getCache(svc, cacheKey);
  const expires = existing?.expires_at ? Date.parse(existing.expires_at) : 0;
  if (existing?.payload && expires > Date.now()) {
    return { data: existing.payload, fromCache: true, stale: false };
  }

  const active = inflight.get(cacheKey);
  if (active) return active;

  const task = (async () => {
    try {
      const sourceUrl = `${POKEAPI_BASE}${path}`;
      const res = await fetch(sourceUrl, {
        headers: { Accept: 'application/json', 'User-Agent': 'SwapPulse/0.7 (+https://swappulse.org)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`PokeAPI HTTP ${res.status}`);
      const raw = await res.json();
      const normalized = normalizeResource(type, raw);
      await saveCache(svc, cacheKey, type, String(id), normalized, sourceUrl);
      return { data: normalized, fromCache: false, stale: false };
    } catch (error) {
      // Species/game data changes slowly. An expired cache is safer and friendlier
      // than dropping the enrichment panel during a temporary PokeAPI outage.
      if (existing?.payload) return { data: existing.payload, fromCache: true, stale: true };
      throw error;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, task);
  return task;
}

function normalizeResource(type: PokeResourceType, raw: any): any {
  if (type === 'pokemon') {
    return {
      id: raw?.id ?? null,
      name: raw?.name || null,
      height: raw?.height ?? null,
      weight: raw?.weight ?? null,
      baseExperience: raw?.base_experience ?? null,
      types: Array.isArray(raw?.types)
        ? raw.types.map((x: any) => ({ slot: x.slot ?? null, name: x.type?.name || null })).filter((x: any) => x.name)
        : [],
      abilities: Array.isArray(raw?.abilities)
        ? raw.abilities.map((x: any) => ({ slot: x.slot ?? null, name: x.ability?.name || null, hidden: !!x.is_hidden })).filter((x: any) => x.name)
        : [],
      stats: Array.isArray(raw?.stats)
        ? raw.stats.map((x: any) => ({ name: x.stat?.name || null, base: x.base_stat ?? null, effort: x.effort ?? null })).filter((x: any) => x.name)
        : [],
      speciesId: numericResourceId(raw?.species?.url),
    };
  }

  if (type === 'species') {
    return {
      id: raw?.id ?? null,
      name: raw?.name || null,
      order: raw?.order ?? null,
      generation: raw?.generation?.name || null,
      color: raw?.color?.name || null,
      habitat: raw?.habitat?.name || null,
      shape: raw?.shape?.name || null,
      isBaby: !!raw?.is_baby,
      isLegendary: !!raw?.is_legendary,
      isMythical: !!raw?.is_mythical,
      evolutionChainId: numericResourceId(raw?.evolution_chain?.url),
      names: Array.isArray(raw?.names)
        ? raw.names.map((x: any) => ({ language: x.language?.name || null, name: x.name || null })).filter((x: any) => x.language && x.name)
        : [],
      genera: Array.isArray(raw?.genera)
        ? raw.genera.map((x: any) => ({ language: x.language?.name || null, genus: x.genus || null })).filter((x: any) => x.language && x.genus)
        : [],
      flavorTexts: Array.isArray(raw?.flavor_text_entries)
        ? raw.flavor_text_entries.map((x: any) => ({
            language: x.language?.name || null,
            version: x.version?.name || null,
            text: cleanFlavor(x.flavor_text),
          })).filter((x: any) => x.language && x.text)
        : [],
    };
  }

  const walk = (node: any): any => {
    if (!node?.species) return null;
    return {
      id: numericResourceId(node.species.url),
      name: node.species.name || null,
      evolvesTo: Array.isArray(node.evolves_to) ? node.evolves_to.map(walk).filter(Boolean) : [],
    };
  };
  return {
    id: raw?.id ?? null,
    chain: walk(raw?.chain),
  };
}

function languageCandidates(lang: string): string[] {
  const raw = String(lang || 'en').trim();
  const lower = raw.toLowerCase();
  const map: Record<string, string[]> = {
    en: ['en'],
    fr: ['fr', 'en'],
    de: ['de', 'en'],
    it: ['it', 'en'],
    es: ['es', 'en'],
    pt: ['pt-BR', 'pt', 'en'],
    'pt-br': ['pt-BR', 'pt', 'en'],
    'pt-pt': ['pt', 'pt-BR', 'en'],
    ja: ['ja-Hrkt', 'ja', 'en'],
    jp: ['ja-Hrkt', 'ja', 'en'],
    ko: ['ko', 'en'],
    zh: ['zh-Hant', 'zh-Hans', 'en'],
    'zh-cn': ['zh-Hans', 'zh-Hant', 'en'],
    nl: ['nl', 'en'],
    pl: ['pl', 'en'],
    ru: ['ru', 'en'],
    id: ['id', 'en'],
    th: ['th', 'en'],
  };
  return map[lower] || map[lower.split('-')[0]] || ['en'];
}

function firstLocalized(items: any[], field: string, langs: string[]): string | null {
  for (const lang of langs) {
    const found = items.find((x: any) => String(x?.language || '').toLowerCase() === lang.toLowerCase());
    if (found?.[field]) return found[field];
  }
  return items?.[0]?.[field] || null;
}

function localizedFlavor(items: any[], langs: string[]): string | null {
  for (const lang of langs) {
    const matches = items.filter((x: any) => String(x?.language || '').toLowerCase() === lang.toLowerCase());
    if (matches.length) return matches[matches.length - 1]?.text || null;
  }
  return items?.[items.length - 1]?.text || null;
}

function titleCaseToken(value: unknown): string {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function getPokemonProfile(svc: any, dexId: number, lang = 'en'): Promise<any> {
  if (!Number.isInteger(dexId) || dexId < 1 || dexId > 100000) {
    throw new Error('Invalid National Pokédex id');
  }

  const [pokemon, species] = await Promise.all([
    cachedResource(svc, 'pokemon', dexId, `/pokemon/${dexId}`),
    cachedResource(svc, 'species', dexId, `/pokemon-species/${dexId}`),
  ]);

  const chainId = species.data?.evolutionChainId;
  const evolution = chainId
    ? await cachedResource(svc, 'evolution', chainId, `/evolution-chain/${chainId}`)
    : null;
  const langs = languageCandidates(lang);

  return {
    dexId,
    name: firstLocalized(species.data?.names || [], 'name', langs) || titleCaseToken(pokemon.data?.name),
    canonicalName: pokemon.data?.name || species.data?.name || null,
    genus: firstLocalized(species.data?.genera || [], 'genus', langs),
    flavorText: localizedFlavor(species.data?.flavorTexts || [], langs),
    generation: titleCaseToken(species.data?.generation),
    types: (pokemon.data?.types || []).map((x: any) => titleCaseToken(x.name)),
    abilities: (pokemon.data?.abilities || []).map((x: any) => ({ name: titleCaseToken(x.name), hidden: !!x.hidden })),
    stats: (pokemon.data?.stats || []).map((x: any) => ({ name: titleCaseToken(x.name), base: x.base })),
    heightMetres: typeof pokemon.data?.height === 'number' ? pokemon.data.height / 10 : null,
    weightKg: typeof pokemon.data?.weight === 'number' ? pokemon.data.weight / 10 : null,
    baseExperience: pokemon.data?.baseExperience ?? null,
    color: titleCaseToken(species.data?.color),
    habitat: titleCaseToken(species.data?.habitat),
    legendary: !!species.data?.isLegendary,
    mythical: !!species.data?.isMythical,
    baby: !!species.data?.isBaby,
    evolution: evolution?.data?.chain || null,
    freshness: {
      fromCache: !!pokemon.fromCache && !!species.fromCache && (!evolution || !!evolution.fromCache),
      stale: !!pokemon.stale || !!species.stale || !!evolution?.stale,
    },
  };
}
