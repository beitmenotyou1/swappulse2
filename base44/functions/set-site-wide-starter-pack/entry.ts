import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Admin only. Marks a single StarterPack as the site-wide newcomer welcome pack.
// Clears is_site_wide on all other packs first (only one at a time). Pass
// { starterPackId } to set, or { starterPackId: null } to unset.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const packId = body.starterPackId || null;

    // Clear all existing site-wide flags.
    const current = await base44.asServiceRole.entities.StarterPack.filter({ is_site_wide: true }, '-created_date', 50);
    if (current.length) {
      await base44.asServiceRole.entities.StarterPack.bulkUpdate(
        current.map((p) => ({ id: p.id, is_site_wide: false })),
      );
    }

    if (packId) {
      await base44.asServiceRole.entities.StarterPack.update(packId, { is_site_wide: true });
    }
    return Response.json({ ok: true, siteWidePackId: packId || null });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}