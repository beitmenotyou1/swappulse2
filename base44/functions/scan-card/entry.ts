import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchTcgdex } from '../../shared/tcgdexClient.ts';

const SCAN_PROMPT = `You are a Pokémon TCG card identification expert. Analyze the attached card photo carefully and identify the card.
Return JSON with:
- card_name: the Pokémon or trainer name exactly as printed (e.g. "Pikachu", "Charizard ex"). Empty string if the image is not a Pokémon card.
- set_name: the set name as printed or via its symbol (e.g. "Scarlet & Violet", "Base Set"). Empty if unreadable.
- card_number: the collector number printed (e.g. "025/198"). Empty if unreadable.
- rarity: the rarity as printed (e.g. "Common", "Uncommon", "Rare Holo", "Illustration Rare"). Empty if unreadable.
- variant: "normal", "holo", or "reverse_holo" based on the foil treatment you can see.
- confidence: a number from 0 to 1 for how sure you are of the card_name.
Use only what is visible. Do not guess wildly; if the photo is not a Pokémon card, set card_name to "" and confidence to 0.`;

function norm(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function scoreCandidate(card, pred) {
  let score = 0;
  const cName = norm(card.name);
  const pName = norm(pred.card_name);
  if (cName && pName) {
    if (cName === pName) score += 60;
    else if (cName.includes(pName) || pName.includes(cName)) score += 40;
    else if (pName.length > 2 && cName.slice(0, 4) === pName.slice(0, 4)) score += 20;
  }
  const cSet = norm(card.set?.name || card.setName);
  const pSet = norm(pred.set_name);
  if (cSet && pSet) {
    if (cSet === pSet) score += 25;
    else if (cSet.includes(pSet) || pSet.includes(cSet)) score += 15;
  }
  const cNum = norm(card.localId);
  const pNum = norm(pred.card_number);
  if (cNum && pNum && cNum === pNum) score += 15;
  return score;
}

function buildImage(imageField) {
  if (!imageField) return null;
  const suffix = '/high.webp';
  if (String(imageField).startsWith('http')) return `${imageField}${suffix}`;
  return `https://assets.tcgdex.net/${imageField}${suffix}`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const imageUrl = body.image_url;
    const lang = body.lang || 'en';
    if (!imageUrl) return Response.json({ error: 'image_url required' }, { status: 400 });

    let prediction = {};
    try {
      const llmRes = await base44.integrations.Core.InvokeLLM({
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
            confidence: { type: 'number' },
          },
          required: ['card_name', 'confidence'],
        },
      });
      prediction = llmRes || {};
    } catch (e) {
      console.error('scan-card LLM failed', e?.message || e);
      return Response.json({ error: 'Scan failed — try manual search', fallback: true, image_url: imageUrl });
    }

    if (!prediction.card_name) {
      return Response.json({ prediction, candidates: [], image_url: imageUrl, fallback: true });
    }

    let cards = [];
    try {
      const params = new URLSearchParams();
      params.set('name', prediction.card_name);
      params.set('pagination:itemsPerPage', '12');
      const searchRes = await fetchTcgdex(`/cards?${params.toString()}`, lang);
      cards = Array.isArray(searchRes) ? searchRes : searchRes?.data || [];
    } catch (e) {
      console.error('scan-card catalog lookup failed', e?.message || e);
    }

    const candidates = cards
      .map((c) => ({
        card_id: c.id,
        card_name: c.name,
        set_name: c.set?.name || c.setName || '',
        set_id: c.set?.id || '',
        local_id: c.localId || '',
        rarity: c.rarity || '',
        image: buildImage(c.image),
        score: scoreCandidate(c, prediction),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return Response.json({ prediction, candidates, image_url: imageUrl });
  } catch (error) {
    console.error('scan-card error', error?.message || error);
    return Response.json({ error: error.message, fallback: true }, { status: 500 });
  }
}