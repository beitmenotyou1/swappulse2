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

    // Return the inviter's cached profile for user-generated codes so the
    // invite landing page can show who invited them.
    const inviter = invite.inviter_did ? {
      did: invite.inviter_did,
      name: invite.inviter_name || '',
      handle: invite.inviter_handle || '',
      avatar: invite.inviter_avatar || '',
    } : null;

    return Response.json({ valid: true, origin: invite.origin || 'admin', inviter });
  } catch (e) {
    return Response.json({ valid: false, error: e?.message || String(e) }, { status: 500 });
  }
}