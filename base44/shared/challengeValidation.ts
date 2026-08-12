// Quality filter engine for challenge entries (org.swappulse.challengeEntry).
// Validates contribution records (CollectionEntry rows) against the parent
// challenge's goal.filters: min rarity, element types, min condition, and
// duplicate exclusion. Applies a diminishing-returns cap on collective entries
// so one user can't single-handedly complete a community goal, and emits a
// SHA-256 verification hash for integrity. minValueUsd enforcement is deferred
// (no reliable USD price field on CollectionEntry).

export interface ValidationResult {
  valid: boolean;
  validatedCount: number;
  rejectedUris: string[];
  rejectionReasons: Record<string, string>;
  contributionScore: number;
  verificationHash: string;
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'holo', 'secret_rare', 'ex', 'v', 'vmax', 'rainbow'];
const COND_IDX: Record<string, number> = { damaged: 0, poor: 1, fair: 2, good: 3, excellent: 4, near_mint: 5, mint: 6 };

function meetsMinRarity(cardRarity: string, minRarity: string): boolean {
  const c = RARITY_ORDER.indexOf((cardRarity || '').toLowerCase());
  const m = RARITY_ORDER.indexOf((minRarity || '').toLowerCase());
  if (c === -1 || m === -1) return false;
  return c >= m;
}

function meetsMinCondition(cardCond: string, minCond: string): boolean {
  const c = COND_IDX[(cardCond || '').toLowerCase()] ?? -1;
  const m = COND_IDX[(minCond || '').toLowerCase()] ?? -1;
  if (c === -1 || m === -1) return false;
  return c >= m;
}

export async function generateVerificationHash(data: object): Promise<string> {
  const enc = new TextEncoder();
  const buf = enc.encode(JSON.stringify(data));
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ValidateInput {
  challenge: any;
  contributionRecords: any[]; // CollectionEntry rows
  authorDid: string;
}

export async function validateEntry({ challenge, contributionRecords, authorDid }: ValidateInput): Promise<ValidationResult> {
  const rejectedUris: string[] = [];
  const rejectionReasons: Record<string, string> = {};
  const filters = challenge.goal?.filters || {};
  const now = new Date();

  if (challenge.starts_at && now < new Date(challenge.starts_at)) {
    return { valid: false, validatedCount: 0, rejectedUris, rejectionReasons: { _: 'Challenge has not started' }, contributionScore: 0, verificationHash: '' };
  }
  if (challenge.ends_at && now > new Date(challenge.ends_at)) {
    return { valid: false, validatedCount: 0, rejectedUris, rejectionReasons: { _: 'Challenge has ended' }, contributionScore: 0, verificationHash: '' };
  }

  const valid: any[] = [];
  for (const c of contributionRecords) {
    const uri = c.id || c.at_uri || c.card_id;
    if (c.did && c.did !== authorDid) {
      rejectedUris.push(uri); rejectionReasons[uri] = 'Card does not belong to you'; continue;
    }
    if (filters.min_rarity && !meetsMinRarity(c.rarity, filters.min_rarity)) {
      rejectedUris.push(uri); rejectionReasons[uri] = `Rarity below ${filters.min_rarity}`; continue;
    }
    if (filters.element_types?.length && !filters.element_types.includes(c.category)) {
      rejectedUris.push(uri); rejectionReasons[uri] = 'Element type not allowed'; continue;
    }
    if (filters.condition_min && !meetsMinCondition(c.condition, filters.condition_min)) {
      rejectedUris.push(uri); rejectionReasons[uri] = `Condition below ${filters.condition_min}`; continue;
    }
    valid.push(c);
  }

  let validated = valid;
  if (filters.exclude_duplicates) {
    const seen = new Set<string>();
    const dedup: any[] = [];
    for (const c of valid) {
      if (seen.has(c.card_id)) { rejectedUris.push(c.id); rejectionReasons[c.id] = 'Duplicate card'; }
      else { seen.add(c.card_id); dedup.push(c); }
    }
    validated = dedup;
  }

  const validatedCount = validated.length;
  let score = validatedCount;
  if (challenge.mode === 'collective') {
    const cap = Math.max(10, Math.ceil((challenge.goal?.target || 100) * 0.1));
    score = Math.min(validatedCount, cap);
  }

  const verificationHash = await generateVerificationHash({
    challengeId: challenge.id,
    authorDid,
    contributionUris: validated.map((c) => c.id),
    score,
    timestamp: now.toISOString(),
  });

  return { valid: validatedCount > 0, validatedCount, rejectedUris, rejectionReasons, contributionScore: score, verificationHash };
}