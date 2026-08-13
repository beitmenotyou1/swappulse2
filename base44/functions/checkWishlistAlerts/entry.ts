import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import webPush from 'npm:web-push@3.6.7';

// §4 Wishlist alerts - scans SavedSearch records, matches each against current
// CardPricing (price at/under target) and open TradeListings (card offered),
// then notifies the owner via push and/or email. Admin-gated; runs on schedule.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole;

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    let pushReady = false;
    try {
      if (publicKey && privateKey) {
        webPush.setVapidDetails('mailto:support@swappulse.org', publicKey, privateKey);
        pushReady = true;
      }
    } catch { /* VAPID keys not yet valid - email alerts still work */ }

    // Parallelize the four independent initial fetches.
    const [searches, pricing, trades, users] = await Promise.all([
      svc.entities.SavedSearch.list('-updated_date', 500),
      svc.entities.CardPricing.list('-updated_date', 500),
      svc.entities.TradeListing.filter({ status: 'open' }, '-created_date', 200).catch(() => []),
      svc.entities.User.list(),
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));

    const triggeredIds: string[] = [];
    let triggered = 0;
    let notified = 0;
    for (const s of searches) {
      if (!s.notify || s.notify === 'none') continue;
      const want = (s.card_name || '').toLowerCase().trim();
      if (!want) continue;
      const max = s.max_price;

      const priceMatch = pricing.find((p) => {
        if ((p.card_name || '').toLowerCase().trim() !== want) return false;
        if (s.set_code && p.set_id && p.set_id.toLowerCase() !== s.set_code.toLowerCase()) return false;
        const price = p.low ?? p.avg;
        return max == null || (price != null && price <= max);
      });
      const tradeMatch = trades.find((t) =>
        (t.offer_card_names || []).some((n) => (n || '').toLowerCase().trim() === want)
      );

      if (!priceMatch && !tradeMatch) continue;

      // De-dupe: at most one notification per search per 24h.
      if (s.last_triggered_at) {
        const sinceH = (Date.now() - new Date(s.last_triggered_at).getTime()) / 3600000;
        if (sinceH < 24) continue;
      }

      const owner = userById.get(s.created_by_id);
      const pushWanted = s.notify === 'push' || s.notify === 'both';
      const emailWanted = s.notify === 'email' || s.notify === 'both';

      const detail = priceMatch
        ? `${s.card_name} dropped to your target price`
        : `${s.card_name} is listed in an open trade`;
      const url = priceMatch ? `/card/${priceMatch.card_id}` : '/trades';

      if (pushWanted && pushReady && owner?.push_subscription) {
        try {
          await webPush.sendNotification(JSON.parse(owner.push_subscription), JSON.stringify({
            title: 'SwapPulse wishlist alert',
            body: detail,
            url,
          }));
          notified++;
        } catch { /* subscription invalid or blocked */ }
      }
      if (emailWanted && owner?.email) {
        try {
          await svc.integrations.Core.SendEmail({
            to: owner.email,
            subject: 'SwapPulse alert: ' + s.card_name,
            body: `Hi ${owner.full_name || 'collector'},\n\n${detail}.\n\nView it on SwapPulse: https://swappulse.org${url}\n\nManage your alerts from any card's Price Alert button.`,
            from_name: 'SwapPulse',
          });
          notified++;
        } catch { /* email delivery failed */ }
      }

      triggeredIds.push(s.id);
      triggered++;
    }

    // Batch-update last_triggered_at for all triggered searches in one call.
    if (triggeredIds.length) {
      await svc.entities.SavedSearch.updateMany(
        { id: { $in: triggeredIds } },
        { $set: { last_triggered_at: new Date().toISOString() } },
      ).catch(() => {});
    }

    return Response.json({ triggered, notified, searches: searches.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});