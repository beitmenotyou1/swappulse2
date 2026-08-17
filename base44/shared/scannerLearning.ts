// Shared scanner learning module — rarity taxonomy, name normalisation,
// model-version constant, and the correction→weight feedback helper used by
// submitScannerCorrection and scan-card.

export const MODEL_VERSION = 'llm-vision-v2';

export const RARITY_TAXONOMY = [
  'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Reverse Holo', 'Full Art',
  'Illustration Rare', 'Special Illustration Rare', 'Ultra Rare', 'Secret Rare',
  'Hyper Rare', 'Shiny Rare', 'Shiny Holo Rare', 'Promo', 'Unknown',
] as const;

// Maps a canonical rarity to the existing rarity-glow CSS class (index.css).
export const RARITY_GLOW_CLASS: Record<string, string> = {
  'Common': '',
  'Uncommon': 'rarity-glow-uncommon',
  'Rare': '',
  'Rare Holo': 'rarity-glow-holo',
  'Reverse Holo': 'rarity-glow-holo',
  'Full Art': 'rarity-glow-ex',
  'Illustration Rare': 'rarity-glow-ex',
  'Special Illustration Rare': 'rarity-glow-secret',
  'Ultra Rare': 'rarity-glow-secret',
  'Secret Rare': 'rarity-glow-secret',
  'Hyper Rare': 'rarity-glow-secret',
  'Shiny Rare': 'rarity-glow-holo',
  'Shiny Holo Rare': 'rarity-glow-holo',
  'Promo': '',
  'Unknown': '',
};

// Normalise a card name for exact-match lookup: lowercase, strip accents,
// keep only a-z0-9.
export function normalizeName(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Map a free-text rarity string from the LLM to the canonical taxonomy.
export function canonicalizeRarity(raw: string): string {
  if (!raw) return 'Unknown';
  const r = String(raw).toLowerCase().trim();
  const map: Record<string, string> = {
    'common': 'Common', 'uncommon': 'Uncommon', 'rare': 'Rare',
    'rare holo': 'Rare Holo', 'holo rare': 'Rare Holo', 'holo': 'Rare Holo',
    'reverse holo': 'Reverse Holo', 'reverse': 'Reverse Holo', 'reverse holo rare': 'Reverse Holo',
    'full art': 'Full Art', 'full-art': 'Full Art', 'full art rare': 'Full Art',
    'illustration rare': 'Illustration Rare', 'illustration': 'Illustration Rare',
    'special illustration rare': 'Special Illustration Rare',
    'ultra rare': 'Ultra Rare', 'ultra': 'Ultra Rare',
    'secret rare': 'Secret Rare', 'secret': 'Secret Rare',
    'hyper rare': 'Hyper Rare', 'hyper': 'Hyper Rare',
    'shiny rare': 'Shiny Rare', 'shiny': 'Shiny Rare',
    'shiny holo rare': 'Shiny Holo Rare', 'shiny holo': 'Shiny Holo Rare',
    'promo': 'Promo',
  };
  if (map[r]) return map[r];
  const found = (RARITY_TAXONOMY as readonly string[]).find((t) => t.toLowerCase() === r);
  return found || 'Unknown';
}

// Recompute a scanner weight from confirm/wrong counts.
// confirm_correct: +0.05 (capped at 1.5). wrong_*: -0.1 (floored at 0.3).
export function recomputeWeight(confirmCount: number, wrongCount: number): number {
  const raw = 1 + 0.05 * confirmCount - 0.1 * wrongCount;
  return Math.max(0.3, Math.min(1.5, Math.round(raw * 1000) / 1000));
}

// Upsert a ScannerModelWeights record for a card_id from a correction.
// isConfirm = true → boost (confirm_correct); false → penalise (wrong_*).
// Returns the new weight.
export async function applyCorrectionToWeights(svc: any, cardId: string, isConfirm: boolean): Promise<number> {
  if (!cardId) return 1;
  const existing = await svc.entities.ScannerModelWeights.filter({ card_id: cardId }, '-created_date', 1).catch(() => []);
  const rec = existing[0];
  const confirmCount = (rec?.confirm_count || 0) + (isConfirm ? 1 : 0);
  const wrongCount = (rec?.wrong_count || 0) + (isConfirm ? 0 : 1);
  const weight = recomputeWeight(confirmCount, wrongCount);
  const now = new Date().toISOString();
  if (rec) {
    await svc.entities.ScannerModelWeights.update(rec.id, {
      weight, confirm_count: confirmCount, wrong_count: wrongCount, last_applied_at: now,
    });
  } else {
    await svc.entities.ScannerModelWeights.create({
      card_id: cardId, weight, confirm_count: confirmCount, wrong_count: wrongCount, last_applied_at: now,
    });
  }
  return weight;
}