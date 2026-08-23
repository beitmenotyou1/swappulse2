import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Generate a personal invite link tied to the current user. Reuses the
// InviteCode entity with origin "user" and caches the inviter's profile so the
// /invite/:code landing page can show who invited them without an extra lookup.
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

    const did = user.data?.did || '';
    if (!did) return Response.json({ error: 'Identity not provisioned yet — try again in a moment.' }, { status: 409 });

    // Cap personal invite codes per user to prevent abuse (20 active max).
    const existing = await base44.asServiceRole.entities.InviteCode.filter(
      { inviter_did: did, status: 'active' },
      '-created_date',
      50,
    );
    if (existing.length >= 20) {
      return Response.json({ error: 'You already have 20 active invite links. Revoke one before creating more.' }, { status: 429 });
    }

    const code = genCode();
    const created = await base44.asServiceRole.entities.InviteCode.create({
      code,
      status: 'active',
      origin: 'user',
      inviter_did: did,
      inviter_name: user.full_name || user.email || '',
      inviter_handle: user.data?.bsky_handle || '',
      inviter_avatar: user.data?.avatar_url || '',
      created_at: new Date().toISOString(),
      batch: `user-${user.id}`,
    });

    return Response.json({ code: created.code, url: `/invite/${created.code}` });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}