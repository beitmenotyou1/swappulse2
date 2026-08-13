// §2.6 Sentiment Poll resolution service - runs on an hourly schedule (see
// base44/workflows/Poll Resolution.jsonc). For every expired, unresolved poll
// it compares the card's current market average (CardPricing) against the
// price captured at creation and marks the creator's prediction
// correct / incorrect / inconclusive.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const THRESHOLD = 0.02; // ±2% noise band around the creation price

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const svc = base44.asServiceRole;

    const now = Date.now();
    const polls = await svc.entities.SentimentPoll.list('-created_date', 200);

    // Filter to expired unresolved polls (avoids per-poll DB reads for non-candidates).
    const expired = polls.filter(
      (p) => !p.outcome && p.expires_at && new Date(p.expires_at).getTime() <= now,
    );

    // Batch-fetch all CardPricing records for the relevant card_ids in one call
    // (replaces per-poll CardPricing.filter N+1).
    const cardIds = [...new Set(expired.map((p) => p.card_id).filter(Boolean))];
    const pricingRecords = cardIds.length > 0
      ? await svc.entities.CardPricing.filter({ card_id: { $in: cardIds } }, '-created_date', 500).catch(() => [])
      : [];
    // Build lookup: card_id|source → avg
    const pricingLookup = new Map<string, number>();
    for (const pr of pricingRecords) {
      const key = `${pr.card_id}|${pr.source || 'tcgplayer'}`;
      // Keep the most recent per key (records are sorted -created_date).
      if (!pricingLookup.has(key)) pricingLookup.set(key, Number(pr.avg) || 0);
    }

    let resolved = 0;
    let inconclusive = 0;
    const errors: any[] = [];
    const updates: Array<{ id: string; outcome: string }> = [];

    for (const poll of expired) {
      try {
        const priceAtCreation = Number(poll.price_at_creation) || 0;
        const source = poll.resolution_source || 'tcgplayer';
        const currentAvg = pricingLookup.get(`${poll.card_id}|${source}`) || 0;

        let outcome = 'inconclusive';
        if (priceAtCreation > 0 && currentAvg > 0) {
          const ratio = currentAvg / priceAtCreation;
          let movement = 'flat';
          if (ratio > 1 + THRESHOLD) movement = 'up';
          else if (ratio < 1 - THRESHOLD) movement = 'down';
          const dir = poll.direction;
          const correct =
            (dir === 'bullish' && movement === 'up') ||
            (dir === 'bearish' && movement === 'down') ||
            (dir === 'neutral' && movement === 'flat');
          outcome = correct ? 'correct' : 'incorrect';
        }
        if (outcome === 'inconclusive') inconclusive++;
        else resolved++;
        updates.push({ id: poll.id, outcome });
      } catch (e) {
        errors.push({ id: poll.id, error: e.message });
      }
    }

    // Batch-update all resolved polls in one call (replaces per-poll SentimentPoll.update N+1).
    if (updates.length > 0) {
      await svc.entities.SentimentPoll.bulkUpdate(updates).catch((e) => {
        errors.push({ error: `bulkUpdate failed: ${e?.message || e}` });
      });
    }

    return Response.json({
      checked: polls.length,
      resolved,
      inconclusive,
      errors: errors.slice(0, 5),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});