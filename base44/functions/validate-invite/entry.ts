import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || '').trim();
    if (!code) return Response.json({ valid: false, error: 'code required' });

    const found = await base44.asServiceRole.entities.InviteCode.filter({ code }, '-created_date', 1);
    const invite = found[0];
    if (!invite || invite.status !== 'active') return Response.json({ valid: false });

    if (body.redeem) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ valid: true, redeemed: false, error: 'auth required to redeem' });
      await base44.asServiceRole.entities.InviteCode.update(invite.id, {
        status: 'used',
        used_by_did: user.email || user.id,
        used_at: new Date().toISOString(),
      });
      return Response.json({ valid: true, redeemed: true });
    }
    return Response.json({ valid: true });
  } catch (e) {
    return Response.json({ valid: false, error: e?.message || String(e) }, { status: 500 });
  }
}