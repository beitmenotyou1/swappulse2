// capture-portfolio-snapshots — daily snapshot capture for the portfolio value
// history chart. Iterates every user who has CollectionEntry records, computes
// their total portfolio value (sum of market_value, falling back to
// purchase_price) and cost basis, and writes one PortfolioSnapshot record per
// user per day. Called by the Portfolio Snapshot Capture scheduled workflow.
//
// Dedup: skips users who already have a snapshot for today's date so re-runs
// on the same day are idempotent. Uses the service role so RLS on
// CollectionEntry (owner-only read) is bypassed — all users' entries are
// aggregated. PortfolioSnapshot create is admin-only, which the service role
// satisfies.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SNAPSHOT_DATE = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const today = SNAPSHOT_DATE();

    // Gather all CollectionEntry records (service role bypasses owner RLS).
    // Paginate up to a reasonable cap.
    const allEntries: any[] = [];
    let batch: any[] = [];
    let offset = 0;
    do {
      batch = await svc.entities.CollectionEntry.list('-created_date', 500, offset).catch(() => []);
      allEntries.push(...batch);
      offset += batch.length;
    } while (batch.length === 500 && allEntries.length < 5000);

    // Group totals by owner (created_by_id)
    const byUser = new Map();
    for (const entry of allEntries) {
      const uid = entry.created_by_id;
      if (!uid) continue;
      if (!byUser.has(uid)) byUser.set(uid, { total_value: 0, cost_basis: 0, card_count: 0 });
      const agg = byUser.get(uid);
      agg.total_value += Number(entry.market_value ?? entry.purchase_price ?? 0);
      agg.cost_basis += Number(entry.purchase_price ?? 0);
      agg.card_count += 1;
    }

    if (byUser.size === 0) {
      return Response.json({ captured: 0, reason: 'no_collection_entries' });
    }

    // Dedup: find users who already have a snapshot for today.
    const userIds = [...byUser.keys()];
    const existing = await svc.entities.PortfolioSnapshot
      .filter({ date: today, created_by_id: { $in: userIds } }, '-date', 5000)
      .catch(() => []);
    const alreadyCaptured = new Set(existing.map((s: any) => s.created_by_id));

    const toCreate = [];
    for (const [uid, agg] of byUser) {
      if (alreadyCaptured.has(uid)) continue;
      toCreate.push({
        date: today,
        total_value: Math.round(agg.total_value),
        cost_basis: Math.round(agg.cost_basis),
        card_count: agg.card_count,
        created_by_id: uid,
      });
    }

    if (toCreate.length === 0) {
      return Response.json({ captured: 0, reason: 'already_captured', users: userIds.length });
    }

    // Bulk create (service role satisfies admin-only create RLS).
    let created = 0;
    const errors: string[] = [];
    // bulkCreate caps at 500 per call
    for (let i = 0; i < toCreate.length; i += 500) {
      const chunk = toCreate.slice(i, i + 500);
      try {
        await svc.entities.PortfolioSnapshot.bulkCreate(chunk);
        created += chunk.length;
      } catch (e: any) {
        errors.push(`bulkCreate: ${e?.message || e}`);
      }
    }

    return Response.json({
      captured: created,
      skipped: alreadyCaptured.size,
      users: userIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('capture-portfolio-snapshots error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});