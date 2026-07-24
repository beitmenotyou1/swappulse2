// §2.6 Sentiment Poll resolution service — runs on an hourly schedule (see
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
    let resolved = 0;
    let inconclusive = 0;
    const errors: any[] = [];

    for (const poll of polls) {
      if (poll.outcome) continue;
      if (!poll.expires_at) continue;
      if (new Date(poll.expires_at).getTime() > now) continue;
      try {
        const priceAtCreation = Number(poll.price_at_creation) || 0;
        const pricing = await svc.entities.CardPricing.filter({
          card_id: poll.card_id,
          source: poll.resolution_source || 'tcgplayer',
        });
        const currentAvg = pricing.length ? Number(pricing[0].avg) || 0 : 0;

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
        await svc.entities.SentimentPoll.update(poll.id, { outcome });
      } catch (e) {
        errors.push({ id: poll.id, error: e.message });
      }
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