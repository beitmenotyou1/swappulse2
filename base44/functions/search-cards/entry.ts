// search-cards — multi-identifier card search over the local TcgdexCard cache.
// Parses a free-text query into tokens and matches them against set_id,
// local_id, name_norm_<lang> (all 9 languages), and canonicalized rarity.
// Ranks by how many tokens each card satisfies, with exact set_id + local_id
// combos ranking highest. Falls back to the live TCGDex API when the cache has
// no matches so coverage stays complete. Public catalog data — no auth.
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
function toCardShape(card: any, lang: string): any {
  const names = card.names || {};
  const name = names[lang] || card.name || card.card_id;
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

// Probe the cache to resolve a raw token to a stored set_id (tries raw + normalized).
async function resolveSetId(svc: any, rawToken: string): Promise<string | null> {
  const lower = rawToken.toLowerCase();
  const norm = normalizeSetId(rawToken);
  const candidates = Array.from(new Set([lower, norm].filter(Boolean)));
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
    const lang = TCGDEX_LANGS.includes(body.lang) ? body.lang : 'en';
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
    // when it's a clear letter+digit code (sv01, swsh1) or a set+number lookup that
    // resolved to a real set. Pure-letter codes like "mew" stay in the name search
    // when there's no card number, so searching the Pokémon "mew" still works.
    const setTokenIsLetterDigit = setCandidateToken ? /^[a-z]+\d/.test(setCandidateToken) : false;
    const excludeSetFromName = !!setCandidateToken &&
      (setTokenIsLetterDigit || (!!localIdToken && !!effectiveSetId));

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
          for (const sid of sidForms) {
            try {
              const card = await fetchTcgdex(`/sets/${encodeURIComponent(sid)}/${encodeURIComponent(numPart)}`, lang);
              if (card) { matched = [toCardShapeApi(card)]; break; }
            } catch { /* try next form */ }
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
            const params = new URLSearchParams();
            params.set('name', nameQuery);
            if (rarityCanon && rarityCanon !== 'Unknown') params.set('rarity', rarityCanon);
            params.set('pagination:page', '1');
            params.set('pagination:itemsPerPage', String(perPage));
            const data = await fetchTcgdex(`/cards?${params.toString()}`, lang);
            const list = Array.isArray(data) ? data : [];
            matched = list.slice(0, perPage).map(toCardShapeApi);
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