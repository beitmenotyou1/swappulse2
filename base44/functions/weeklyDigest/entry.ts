import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildWeeklyDigestEmail } from '../../shared/emailContent.ts';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

function fmt(pence) {
  if (!pence) return "£0.00";
  return "£" + (pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function partitionByOwner(records) {
  const map = new Map();
  for (const r of records) {
    const key = r.created_by_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

async function buildDigestStats(svc, user, collectionByOwner, tradesByOwner, wishlistByOwner) {
  const collection = collectionByOwner.get(user.id) || [];
  const trades = tradesByOwner.get(user.id) || [];
  const wishlist = wishlistByOwner.get(user.id) || [];

  const totalValue = collection.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
  const openTrades = trades.filter((t) => t.status === "open").length;
  const recentCards = collection.slice(0, 5).map((c) => ({
    name: c.card_name || "Unnamed",
    setValue: `${c.set_name || ""} · ${fmt(c.market_value || c.purchase_price)}`,
  }));
  const wishItems = wishlist.slice(0, 5).map((w) => ({
    name: w.card_name || "Unnamed",
    maxPrice: w.max_price ? fmt(w.max_price) : undefined,
  }));

  return {
    cardCount: collection.length,
    portfolioValue: fmt(totalValue),
    openTrades,
    recentCards,
    wishlist: wishItems,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole;
    const [all, collection, trades, wishlist] = await Promise.all([
      svc.entities.User.list(),
      svc.entities.CollectionEntry.list("-updated_date", 500).catch(() => []),
      svc.entities.TradeListing.list("-created_date", 200).catch(() => []),
      svc.entities.Wishlist.list("-updated_date", 500).catch(() => []),
    ]);
    const opted = all.filter((u) => u.weekly_digest === true);
    const collectionByOwner = partitionByOwner(collection);
    const tradesByOwner = partitionByOwner(trades);
    const wishlistByOwner = partitionByOwner(wishlist);
    let sent = 0;
    let failed = 0;
    for (const u of opted) {
      if (!u.email) continue;
      try {
        const stats = buildDigestStats(svc, u, collectionByOwner, tradesByOwner, wishlistByOwner);
        const email = buildWeeklyDigestEmail(u.full_name, stats);
        await sendBrandedEmail({ to: u.email, ...email });
        sent++;
      } catch (e) {
        console.error('weeklyDigest send failed for', u.email, e?.message || e);
        failed++;
      }
    }
    return Response.json({ sent, failed, opted_in: opted.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});