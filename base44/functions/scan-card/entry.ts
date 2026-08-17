// scan-card — rebuilt for the ML learning loop.
//
// Changes from v1:
//  - Resolves candidates against the local TcgdexCard cache (no live per-scan
//    TCGDex search as the primary path); falls back to a live TCGDex name
//    search only when the local cache misses (catalog not yet synced or a
//    partial-name match the exact-match cache can't find).
//  - Full TCGDex rarity taxonomy: the LLM returns a rarity from the taxonomy
//    and a detected_language tag; the prompt handles non-English card text.
//  - Applies ScannerModelWeights (correction-derived per-card adjustments)
//    when ranking candidates, so the scanner improves between offline
//    retrains.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchTcgdex } from '../../shared/tcgdexClient.ts';
import { MODEL_VERSION, normalizeName, canonicalizeRarity } from '../../shared/scannerLearning.ts';

const SCAN_PROMPT = `You are a Pokémon TCG card identification expert. Analyze the attached card photo carefully and identify the card. The card may be in ANY language (English, French, German, Italian, Spanish, Portuguese, Japanese, Chinese, or Korean) — read the printed text in whatever language appears on the card.
Return JSON with:
- card_name: the Pokémon or trainer name exactly as printed on the card, in the card's own language. Empty string if the image is not a Pokémon card.
- set_name: the set name as printed or inferred via its symbol. Empty if unreadable.
- card_number: the collector number printed (e.g. "025/198"). Empty if unreadable.
- rarity: the rarity as printed, using this taxonomy: Common, Uncommon, Rare, Rare Holo, Reverse Holo, Full Art, Illustration Rare, Special Illustration Rare, Ultra Rare, Secret Rare, Hyper Rare, Shiny Rare, Shiny Holo Rare, Promo. Empty if unreadable.
- variant: "normal", "holo", or "reverse_holo" based on the foil treatment you can see.
- detected_language: the 2-letter language code of the printed text (en, fr, de, it, es, pt, jp, zh, ko). Default "en".
- confidence: a number from 0 to 1 for how sure you are of the card_name.
Use only what is visible. Do not guess wildly; if the photo is not a Pokémon card, set card_name to "" and confidence to 0.`;

function buildImage(imageField: any): string | null {
  if (!imageField) return null;
  const base = typeof imageField === 'string' ? imageField : (imageField?.base || imageField?.high || '');
  if (!base) return null;
  if (String(base).startsWith('http')) return `${base}/high.webp`;
  return `https://assets.tcgdex.net/${base}/high.webp`;
}

function scoreCandidate(card: any, pred: any): number {
  let score = 0;
  const cName = normalizeName(card.name);
  const pName = normalizeName(pred.card_name);
  if (cName && pName) {
    if (cName === pName) score += 60;
    else if (cName.includes(pName) || pName.includes(cName)) score += 40;
    else if (pName.length > 2 && cName.slice(0, 4) === pName.slice(0, 4)) score += 20;
  }
  const cSet = normalizeName(card.set_name);
  const pSet = normalizeName(pred.set_name);
  if (cSet && pSet) {
    if (cSet === pSet) score += 25;
    else if (cSet.includes(pSet) || pSet.includes(cSet)) score += 15;
  }
  const cNum = normalizeName(card.local_id);
  const pNum = normalizeName(pred.card_number);
  if (cNum && pNum && cNum === pNum) score += 15;
  return score;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const imageUrl = body.image_url;
    if (!imageUrl) return Response.json({ error: 'image_url required' }, { status: 400 });

    const scanId = crypto.randomUUID();
    const imageHash = await sha256(imageUrl);
    const timestamp = new Date().toISOString();

    let prediction: any = {};
    try {
      const llmRes: any = await base44.integrations.Core.InvokeLLM({
        prompt: SCAN_PROMPT,
        file_urls: [imageUrl],
        model: 'gpt_5_4',
        response_json_schema: {
          type: 'object',
          properties: {
            card_name: { type: 'string' },
            set_name: { type: 'string' },
            card_number: { type: 'string' },
            rarity: { type: 'string' },
            variant: { type: 'string', enum: ['normal', 'holo', 'reverse_holo'] },
            detected_language: { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['card_name', 'confidence'],
        },
      });
      prediction = llmRes || {};
    } catch (e: any) {
      console.error('scan-card LLM failed', e?.message || e);
      return Response.json({
        scan_id: scanId, model_version: MODEL_VERSION, image_hash: imageHash, timestamp,
        prediction: {}, candidates: [], image_url: imageUrl, fallback: true,
        error: 'Scan failed — try manual search',
      });
    }

    // Canonicalise the LLM rarity into the taxonomy.
    prediction.rarity = canonicalizeRarity(prediction.rarity);
    const lang = String(prediction.detected_language || 'en').slice(0, 2).toLowerCase();

    if (!prediction.card_name) {
      return Response.json({
        scan_id: scanId, model_version: MODEL_VERSION, image_hash: imageHash, timestamp,
        prediction, candidates: [], image_url: imageUrl, fallback: true,
      });
    }

    // Resolve candidates against the local TcgdexCard cache (primary path).
    const norm = normalizeName(prediction.card_name);
    const normField = `name_norm_${lang}`;
    let cards: any[] = [];
    try {
      cards = await svc.entities.TcgdexCard.filter({ [normField]: norm }, '-created_date', 50);
      if ((!cards || cards.length === 0) && lang !== 'en') {
        cards = await svc.entities.TcgdexCard.filter({ name_norm_en: norm }, '-created_date', 50);
      }
    } catch (e: any) {
      console.error('scan-card local cache lookup failed', e?.message || e);
    }

    // Live TCGDex fallback when the local cache misses (not yet synced, or a
    // partial-name match the exact-match cache can't find).
    if (!cards || cards.length === 0) {
      try {
        const params = new URLSearchParams();
        params.set('name', prediction.card_name);
        params.set('pagination:itemsPerPage', '12');
        const live: any = await fetchTcgdex(`/cards?${params.toString()}`, lang);
        const liveCards = Array.isArray(live) ? live : (live?.data || []);
        cards = liveCards.map((c: any) => ({
          card_id: c.id, name: c.name, set_name: c.set?.name || c.setName || '',
          set_id: c.set?.id || '', local_id: c.localId || '', rarity: c.rarity || '',
          image: buildImage(c.image),
        }));
      } catch (e: any) {
        console.error('scan-card live fallback failed', e?.message || e);
      }
    }

    // Score candidates.
    const scored = cards.map((c: any) => ({
      card_id: c.card_id,
      card_name: c.name,
      set_name: c.set_name,
      set_id: c.set_id,
      local_id: c.local_id,
      rarity: c.rarity || '',
      image: c.image || buildImage(c.image),
      score: scoreCandidate(c, prediction),
    }));

    // Fetch model weights for all candidate card_ids and apply them.
    const cardIds = scored.map((c: any) => c.card_id).filter(Boolean);
    let weights: any[] = [];
    if (cardIds.length) {
      try {
        weights = await svc.entities.ScannerModelWeights.filter({ card_id: { $in: cardIds } }, '-created_date', 50);
      } catch (e: any) {
        console.error('scan-card weights lookup failed', e?.message || e);
      }
    }
    const weightMap = new Map(weights.map((w: any) => [w.card_id, w.weight || 1]));

    const maxScore = scored[0]?.score || 1;
    const llmConfidence = prediction.confidence || 0;

    const candidates = scored
      .map((c: any) => {
        const w = weightMap.get(c.card_id) ?? 1;
        return { ...c, weight: w, adjustedScore: c.score * w };
      })
      .sort((a: any, b: any) => b.adjustedScore - a.adjustedScore)
      .slice(0, 5)
      .map((c: any, i: number) => ({
        card_id: c.card_id, card_name: c.card_name, set_name: c.set_name, set_id: c.set_id,
        local_id: c.local_id, rarity: c.rarity, image: c.image, weight: c.weight,
        confidence: i === 0 ? llmConfidence : Math.max(0, Math.min(1, (c.adjustedScore / (maxScore || 1)) * llmConfidence)),
        rank: i + 1,
      }));

    return Response.json({
      scan_id: scanId,
      model_version: MODEL_VERSION,
      image_hash: imageHash,
      timestamp,
      prediction,
      candidates,
      predicted_card_id: candidates[0]?.card_id || '',
      predicted_set_id: candidates[0]?.set_id || '',
      image_url: imageUrl,
    });
  } catch (error: any) {
    console.error('scan-card error', error?.message || error);
    return Response.json({ error: error?.message, fallback: true }, { status: 500 });
  }
}