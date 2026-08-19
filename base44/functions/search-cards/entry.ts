// search-cards — multi-identifier card search over the local TcgdexCard cache.
// Parses a free-text query into tokens and matches them against set_id,
// local_id, name_norm_<lang> (all 9 languages), and canonicalized rarity.
// Ranks by how many tokens each card satisfies, with exact set_id + local_id
// combos ranking highest. Falls back to the live TCGDex API when the cache has
// no matches so coverage stays complete. Public catalogue data — no auth.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizeSetId, fetchTcgdex, TCGDEX_LANGS } from '../../shared/tcgdexClient.ts';
import { canonicalizeRarity } from '../../shared/scannerLearning.ts';
import { resolveSetAlias } from '../../shared/setCodeAliases.ts';

const SUPPORTED_LANGS = TCGDEX_LANGS; // en, fr, de, it, es, pt, jp, zh, ko

function parseTokens(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

const RARITY_KEYWORDS = new Set([
  'common', 'uncommon', 'rare', 'holo', 'reverse', 'full', 'art',
  'illustration', 'special', 'secret', 'hyper', 'ultra', 'shiny',
  'promo', 'rainbow', 'normal', 'first', 'ed',
]);

function isRarityToken(token: string): boolean {
  return RARITY_KEYWORDS.has(token);
}

// Candidate set_id: a letter+digit code (e.g. "m4", "sv01", "swsh1") or a short
// pure-letter code (e.g. "pel") — but never a rarity keyword.
function looksLikeSetId(token: string): boolean {
  if (RARITY_KEYWORDS.has(token)) return false;
  if (/^[a-z]+\d/.test(token)) return true;
  return /^[a-z]{2,4}$/.test(token);
}

// Candidate local_id (card number): "058", "25", "025/198".
function looksLikeLocalId(token: string): boolean {
  return /^\d{1,4}(\/\d{1,4})?$/.test(token);
}

// Normalize a local_id for comparison: drop the "/NNN" suffix and leading zeros.
function normalizeLocalId(s: string): string {
  const n = String(s || '').split('/')[0].replace(/^0+/, '');
  return n || '0';
}

// Map a cached TcgdexCard record to the card shape used by the UI.
// When lang is 'all', the card is displayed in its native set language
// (names[set_lang]), falling back to the English name. When lang is a specific
// code, the card is displayed in that language when available.
function toCardShape(card: any, lang: string): any {
  const names = card.names || {};
  let name: string;
  if (lang === 'all') {
    name = names[card.set_lang] || card.name || names['en'] || card.card_id;
  } else {
    name = names[lang] || card.name || card.card_id;
  }
  return {
    id: card.card_id,
    name,
    image: card.image,
    rarity: card.rarity,
    local_id: card.local_id,
    set: { id: card.set_id, name: card.set_name || card.set_id },
  };
}

// Map a TCGDex API card object to the same shape.
function toCardShapeApi(card: any): any {
  return {
    id: card.id || card.cardId,
    name: card.name,
    image: card.image,
    rarity: card.rarity,
    local_id: card.localId || card.local_id,
    set: { id: card.set?.id || card.set_id, name: card.set?.name || card.set_name },
  };
}

// Score a cached card by how many query tokens it satisfies.
function scoreCard(card: any, tokens: string[], setIdToken: string | null, localIdToken: string | null): number {
  let score = 0;
  const nameVals = SUPPORTED_LANGS.map((l) => card[`name_norm_${l}`]).filter(Boolean);
  const rarityNorm = card.rarity ? String(card.rarity).toLowerCase() : '';
  const rarityCanon = card.rarity ? canonicalizeRarity(card.rarity).toLowerCase() : '';
  const setId = card.set_id ? String(card.set_id).toLowerCase() : '';
  const localId = card.local_id ? normalizeLocalId(card.local_id) : '';

  for (const tok of tokens) {
    if (tok === setIdToken || tok === localIdToken) continue;
    let matched = false;
    for (const nv of nameVals) {
      if (typeof nv === 'string' && nv.includes(tok)) { score += 1; matched = true; break; }
    }
    if (matched) continue;
    if (rarityNorm.includes(tok) || rarityCanon.includes(tok)) { score += 1; continue; }
    if (localId && localId === normalizeLocalId(tok)) { score += 1; continue; }
    if (setId && setId === tok) { score += 1; continue; }
  }
  // Strong bonus for an exact set_id + local_id combo (the "M4 058" case).
  if (setIdToken && setId === setIdToken && localIdToken && localId === normalizeLocalId(localIdToken)) {
    score += 10;
  }
  return score;
}

// Name search across TCGDex languages. Tries the preferred language first, and
// when it returns no results, retries across the remaining TCGDex languages so
// cards exclusive to another language catalog (e.g. Chinese-only sets) are
// findable. Merges and dedupes by card id, keeping preferred-language results
// first, capped at perPage.
async function nameSearchAcrossLanguages(
  nameQuery: string,
  rarityCanon: string,
  preferredLang: string,
  perPage: number,
): Promise<any[]> {
  const seen = new Set<string>();
  const merged: any[] = [];

  const doSearch = async (l: string): Promise<any[]> => {
    const params = new URLSearchParams();
    params.set('name', nameQuery);
    if (rarityCanon && rarityCanon !== 'Unknown') params.set('rarity', rarityCanon);
    params.set('pagination:page', '1');
    params.set('pagination:itemsPerPage', String(perPage));
    const data = await fetchTcgdex(`/cards?${params.toString()}`, l);
    return Array.isArray(data) ? data : [];
  };

  // Preferred language first. 'all' isn't a real TCGDex catalog language, so
  // start from English and iterate every language; the returned card.name is
  // the native name from whichever language catalog matched.
  const preferred = preferredLang === 'all' ? 'en' : preferredLang;
  const order = [preferred, ...SUPPORTED_LANGS.filter((l) => l !== preferred)];
  for (const l of order) {
    if (merged.length >= perPage) break;
    try {
      const list = await doSearch(l);
      for (const card of list) {
        const id = card.id || card.cardId;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        merged.push(toCardShapeApi(card));
        if (merged.length >= perPage) break;
      }
    } catch { /* a language catalog may 404 or be empty; try the next */ }
    // Stop early once the preferred language yielded results — only fall back to
    // other languages when it returned nothing.
    if (l === preferred && merged.length > 0) break;
  }
  return merged;
}

// Probe the cache to resolve a raw token to a stored set_id (tries raw + normalized).
async function resolveSetId(svc: any, rawToken: string): Promise<string | null> {
  const lower = rawToken.toLowerCase();
  const norm = normalizeSetId(rawToken);
  const upper = lower.charAt(0).toUpperCase() + lower.slice(1);
  const candidates = Array.from(new Set([lower, norm, upper].filter(Boolean)));
  for (const c of candidates) {
    try {
      const hits = await svc.entities.TcgdexCard.filter({ set_id: c }, '-updated_date', 1);
      if (hits && hits.length > 0) return c;
    } catch { /* ignore */ }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const query = String(body.query || '').trim();
    const lang = (body.lang === 'all' || TCGDEX_LANGS.includes(body.lang)) ? body.lang : 'en';
    const perPage = Math.min(50, Math.max(1, Number(body.perPage) || 24));

    if (!query) return Response.json({ data: [] });

    const tokens = parseTokens(query);
    if (tokens.length === 0) return Response.json({ data: [] });

    // Detect a local_id token (pure number / "NNN/NNN").
    const localIdToken = tokens.find((t) => looksLikeLocalId(t)) || null;

    // Detect a set_id candidate token (short alphanumeric with a letter).
    const setCandidateToken = tokens.find((t) => looksLikeSetId(t) && t !== localIdToken) || null;

    // Resolve to a TCGDex set_id: official-code alias first (MEW→sv03.5, SSH→swsh1,
    // …), then a cache probe (raw + normalized). Null when neither matches.
    let effectiveSetId: string | null = null;
    if (setCandidateToken) {
      const alias = resolveSetAlias(setCandidateToken);
      effectiveSetId = alias || await resolveSetId(svc, setCandidateToken);
    }

    // A set candidate is treated as an identifier (excluded from name search) only
    // when it actually resolved to a real TCGDex set (alias or cache hit). An
    // unresolved set-code token stays in the name search so the query yields name
    // matches instead of zero results. Pure-letter codes like "mew" with no card
    // number also stay in the name search so searching the Pokémon "mew" works.
    const setTokenIsLetterDigit = setCandidateToken ? /^[a-z]+\d/.test(setCandidateToken) : false;
    const excludeSetFromName = !!setCandidateToken && !!effectiveSetId &&
      (setTokenIsLetterDigit || !!localIdToken);

    let matched: any[] = [];

    // Cache path: only when we resolved a stored set_id.
    if (effectiveSetId) {
      const cards = await svc.entities.TcgdexCard.filter({ set_id: effectiveSetId }, '-updated_date', 500).catch(() => []);
      const scored = cards
        .map((c: any) => ({ card: c, score: scoreCard(c, tokens, effectiveSetId, localIdToken) }))
        .filter((s: any) => s.score > 0)
        .sort((a: any, b: any) => b.score - a.score);
      matched = scored.slice(0, perPage).map((s: any) => toCardShape(s.card, lang));
    }

    // Fallback to the live TCGDex API when the cache has no matches.
    if (matched.length === 0) {
      try {
        // Precise set_id + local_id lookup (uses the alias target, the raw token,
        // and the normalized form so coverage stays complete).
        if (setCandidateToken && localIdToken) {
          const numPart = localIdToken.split('/')[0];
          const sidForms = Array.from(new Set(
            [effectiveSetId, setCandidateToken, normalizeSetId(setCandidateToken)].filter(Boolean)
          ));
          const apiLang = lang === 'all' ? 'en' : lang;
          for (const sid of sidForms) {
            try {
              const card = await fetchTcgdex(`/sets/${encodeURIComponent(sid)}/${encodeURIComponent(numPart)}`, apiLang);
              if (card) { matched = [toCardShapeApi(card)]; break; }
            } catch { /* try next form */ }
          }
          // Multi-language fallback: if the precise lookup found nothing in the
          // preferred language, retry across the other TCGDex languages (a set may
          // be exclusive to another language catalog, e.g. Chinese-only sets).
          if (matched.length === 0) {
            for (const altLang of SUPPORTED_LANGS) {
              if (altLang === apiLang) continue;
              for (const sid of sidForms) {
                try {
                  const card = await fetchTcgdex(`/sets/${encodeURIComponent(sid)}/${encodeURIComponent(numPart)}`, altLang);
                  if (card) { matched = [toCardShapeApi(card)]; break; }
                } catch { /* try next */ }
              }
              if (matched.length > 0) break;
            }
          }
        }
        // Set-only fallback: fetch all cards in the set from the API (for
        // set-code searches without a card number, e.g. "M2" or "M4").
        if (matched.length === 0 && effectiveSetId && !localIdToken) {
          const sidForms = Array.from(new Set(
            [effectiveSetId, setCandidateToken, normalizeSetId(setCandidateToken)].filter(Boolean)
          ));
          for (const sid of sidForms) {
            for (const l of SUPPORTED_LANGS) {
              try {
                const setData = await fetchTcgdex(`/sets/${encodeURIComponent(sid)}`, l);
                if (setData?.cards?.length) {
                  matched = setData.cards.slice(0, perPage).map((c: any) => ({
                    id: c.id || c.cardId,
                    name: c.name,
                    image: c.image,
                    rarity: c.rarity,
                    local_id: c.localId || c.local_id,
                    set: { id: setData.id || sid, name: setData.name || sid },
                  }));
                  break;
                }
              } catch { /* try next language/form */ }
            }
            if (matched.length > 0) break;
          }
        }
        if (matched.length === 0) {
          // Name search using the non-identifier, non-rarity tokens.
          const nameTokens = tokens.filter((t) =>
            t !== localIdToken && !(t === setCandidateToken && excludeSetFromName) && !isRarityToken(t)
          );
          const nameQuery = nameTokens.join(' ');
          const rarityTokens = tokens.filter((t) => isRarityToken(t));
          const rarityCanon = rarityTokens.length ? canonicalizeRarity(rarityTokens.join(' ')) : '';
          if (nameQuery) {
            matched = await nameSearchAcrossLanguages(nameQuery, rarityCanon, lang, perPage);
          }
        }
      } catch (e) {
        console.error('search-cards: API fallback failed', e?.message || e);
      }
    }

    return Response.json({ data: matched }, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch (error) {
    console.error('search-cards error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});