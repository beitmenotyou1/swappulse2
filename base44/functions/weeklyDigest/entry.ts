import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendMail } from "../../shared/smtp.ts";

function fmt(pence) {
  if (!pence) return "£0.00";
  return "£" + (pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function buildDigest(base44, user) {
  const [collection, trades, wishlist, posts] = await Promise.all([
    base44.entities.CollectionEntry.filter({ created_by_id: user.id }, "-updated_date", 500).catch(() => []),
    base44.entities.TradeListing.filter({ created_by_id: user.id }, "-created_date", 20).catch(() => []),
    base44.entities.Wishlist.filter({ created_by_id: user.id }, "-updated_date", 50).catch(() => []),
    base44.entities.Post.filter({ created_by_id: user.id }, "-created_date", 5).catch(() => []),
  ]);

  const totalValue = collection.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
  const openTrades = trades.filter((t) => t.status === "open").length;
  const recentCards = collection.slice(0, 5).map(
    (c) => `<li>${escapeHtml(c.card_name || "Unnamed")} — ${escapeHtml(c.set_name || "")} · ${fmt(c.market_value || c.purchase_price)}</li>`
  ).join("");
  const wishRows = wishlist.slice(0, 5).map(
    (w) => `<li>${escapeHtml(w.card_name || "Unnamed")}${w.max_price ? " (max " + fmt(w.max_price) + ")" : ""}</li>`
  ).join("");

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0F1117;font-family:Inter,Arial,sans-serif;color:#F5F6FA;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(120deg,#3B82F6,#8B5CF6);padding:20px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;font-weight:800;color:#fff;">Your SwapPulse Weekly Digest</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:13px;">Hi ${escapeHtml(user.full_name || "collector")} — here's your week in cards.</p>
    </div>
    <div style="background:#1A1D28;border-radius:0 0 12px 12px;padding:20px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        <tr>
          <td style="background:#252936;padding:14px;border-radius:8px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#3B82F6;">${collection.length}</div>
            <div style="font-size:11px;color:#A0A6B8;">Cards</div>
          </td>
          <td style="background:#252936;padding:14px;border-radius:8px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#F5B700;">${fmt(totalValue)}</div>
            <div style="font-size:11px;color:#A0A6B8;">Portfolio</div>
          </td>
          <td style="background:#252936;padding:14px;border-radius:8px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#10B981;">${openTrades}</div>
            <div style="font-size:11px;color:#A0A6B8;">Open Trades</div>
          </td>
        </tr>
      </table>
      <h2 style="font-size:14px;color:#F5B700;margin:0 0 8px;">Recently added cards</h2>
      <ul style="margin:0 0 16px 18px;padding:0;font-size:13px;color:#F5F6FA;">${recentCards || "<li>No new cards this week.</li>"}</ul>
      <h2 style="font-size:14px;color:#F5B700;margin:0 0 8px;">Your wishlist</h2>
      <ul style="margin:0 0 16px 18px;padding:0;font-size:13px;color:#F5F6FA;">${wishRows || "<li>Your wishlist is empty.</li>"}</ul>
      <p style="font-size:12px;color:#A0A6B8;margin-top:18px;border-top:1px solid #252936;padding-top:14px;">
        You're receiving this because you enabled the weekly digest in your SwapPulse settings.
        Visit your profile to turn it off any time.
      </p>
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.secret !== Deno.env.get("DIGEST_TRIGGER_SECRET")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const base44 = createClientFromRequest(req);
    const all = await base44.asServiceRole.entities.User.list();
    const opted = all.filter((u) => u.weekly_digest === true);
    let sent = 0;
    let failed = 0;
    for (const u of opted) {
      if (!u.email) continue;
      try {
        const html = await buildDigest(base44.asServiceRole, u);
        await sendMail({ to: u.email, subject: "Your SwapPulse Weekly Digest", html });
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