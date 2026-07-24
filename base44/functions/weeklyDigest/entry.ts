import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function fmt(pence) {
  if (!pence) return "£0.00";
  return "£" + (pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function buildDigestText(svc, user) {
  const [collection, trades, wishlist] = await Promise.all([
    svc.entities.CollectionEntry.filter({ created_by_id: user.id }, "-updated_date", 500).catch(() => []),
    svc.entities.TradeListing.filter({ created_by_id: user.id }, "-created_date", 20).catch(() => []),
    svc.entities.Wishlist.filter({ created_by_id: user.id }, "-updated_date", 50).catch(() => []),
  ]);

  const totalValue = collection.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
  const openTrades = trades.filter((t) => t.status === "open").length;
  const recentCards = collection.slice(0, 5).map(
    (c) => `  • ${c.card_name || "Unnamed"} — ${c.set_name || ""} · ${fmt(c.market_value || c.purchase_price)}`
  ).join("\n");
  const wishRows = wishlist.slice(0, 5).map(
    (w) => `  • ${w.card_name || "Unnamed"}${w.max_price ? " (max " + fmt(w.max_price) + ")" : ""}`
  ).join("\n");

  return [
    "Your SwapPulse Weekly Digest",
    "",
    `Hi ${user.full_name || "collector"} — here's your week in cards.`,
    "",
    `Cards: ${collection.length}`,
    `Portfolio: ${fmt(totalValue)}`,
    `Open Trades: ${openTrades}`,
    "",
    "Recently added cards:",
    recentCards || "  No new cards this week.",
    "",
    "Your wishlist:",
    wishRows || "  Your wishlist is empty.",
    "",
    "You're receiving this because you enabled the weekly digest in your SwapPulse settings.",
    "Visit your profile to turn it off any time.",
  ].join("\n");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole;
    const all = await svc.entities.User.list();
    const opted = all.filter((u) => u.weekly_digest === true);
    let sent = 0;
    let failed = 0;
    for (const u of opted) {
      if (!u.email) continue;
      try {
        const body = await buildDigestText(svc, u);
        await svc.integrations.Core.SendEmail({
          to: u.email,
          subject: "Your SwapPulse Weekly Digest",
          body,
          from_name: "SwapPulse",
        });
        sent++;
      } catch (e) {
        failed++;
      }
    }
    return Response.json({ sent, failed, opted_in: opted.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});