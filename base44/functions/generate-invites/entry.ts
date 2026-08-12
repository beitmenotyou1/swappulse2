import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function genCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const count = Math.min(Math.max(parseInt(body.count) || 10, 1), 500);
    const batch = body.batch || `batch-${Date.now()}`;
    const now = new Date().toISOString();
    const records = Array.from({ length: count }, () => ({
      code: genCode(),
      status: 'active',
      created_at: now,
      batch,
    }));

    const created = await base44.asServiceRole.entities.InviteCode.bulkCreate(records);
    return Response.json({ codes: created.map((r) => r.code), count: created.length, batch });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}