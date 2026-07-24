import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { RateLimiter, fetchTcgdex, num } from '../../shared/tcgdexClient.ts';

// §7.5 Pricing Sync Service — refreshes TCGDex market prices for every card
// that is owned, wishlisted, or listed in an open trade. Runs on a 30-minute
// schedule (see base44/workflows/Pricing Sync.jsonc).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole;
    const limiter = new RateLimiter();

    // Gather the distinct set of tracked card ids + their display metadata.
    const tracked = new Map();
    const add = (id: any, name: any, setId: any) => {
      if (!id) return;
      const key = String(id);
      if (!tracked.has(key)) tracked.set(key, { name: name || '', setId: setId || '' });
    };

    const collection = await svc.entities.CollectionEntry.filter({}, '-updated_date', 500);
    for (const c of collection) add(c.card_id, c.card_name, c.set_id);

    const wishlists = await svc.entities.Wishlist.filter({}, '-updated_date', 500);
    for (const w of wishlists) add(w.card_id, w.card_name, w.set_id);

    const trades = await svc.entities.TradeListing.filter({ status: 'open' }, '-updated_date', 200);
    for (const t of trades) {
      (t.offer_card_ids || []).forEach((id: string, i: number) => add(id, (t.offer_card_names || [])[i], null));
      (t.wanted_card_ids || []).forEach((id: string, i: number) => add(id, (t.wanted_card_names || [])[i], null));
    }

    // Cap per run so the rate limiter + function timeout stay bounded; the
    // 30-minute recurrence mops up the rest on subsequent runs.
    const ids = [...tracked.keys()].slice(0, 80);
    let updated = 0;
    const errors: any[] = [];

    for (const cardId of ids) {
      try {
        const card: any = await limiter.enqueue(() => fetchTcgdex(`/cards/${encodeURIComponent(cardId)}`));
        const meta = tracked.get(cardId);
        const sources: any[] = [];
        if (card.pricing?.tcgplayer) sources.push(['tcgplayer', card.pricing.tcgplayer]);
        if (card.pricing?.cardmarket) sources.push(['cardmarket', card.pricing.cardmarket]);

        for (const [source, p] of sources) {
          const payload = {
            card_name: card.name || meta.name,
            set_id: card.set?.id || meta.setId,
            unit: p.unit || '',
            avg: num(p.avg),
            low: num(p.low),
            trend: num(p.trend),
            avg1: num(p.avg1),
            avg7: num(p.avg7),
            avg30: num(p.avg30),
            normal_market: num(p.normal?.market),
            normal_low: num(p.normal?.low),
            normal_avg: num(p.normal?.average),
            holofoil_market: num(p.holofoil?.market),
            holofoil_low: num(p.holofoil?.low),
            holofoil_avg: num(p.holofoil?.average),
          };

          const existing = await svc.entities.CardPricing.filter({ card_id: cardId, source });
          if (existing.length) {
            await svc.entities.CardPricing.update(existing[0].id, payload);
          } else {
            await svc.entities.CardPricing.create({ card_id: cardId, source, ...payload });
          }
        }
        updated++;
      } catch (e) {
        errors.push({ card_id: cardId, error: e.message });
      }
    }

    return Response.json({
      tracked: tracked.size,
      processed: ids.length,
      updated,
      errors: errors.slice(0, 5),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});