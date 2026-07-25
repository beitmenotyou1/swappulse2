// verify-activation-link - validates an activation link token from /activate?token=
// and returns the account email + validity. Unauthenticated (called from the
// activate page before the user has a session). The token is unguessable random.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch {}
    const token = String(body.token || '');
    if (!token) return Response.json({ valid: false, reason: 'missing' }, { status: 400 });

    const records = await base44.asServiceRole.entities.Activation.filter({ link_token: token });
    if (!records.length) return Response.json({ valid: false, reason: 'invalid' });
    const r = records[0];
    const expired = r.expires_at ? new Date(r.expires_at).getTime() < Date.now() : true;
    if (expired) return Response.json({ valid: false, reason: 'expired', email: r.email });
    return Response.json({ valid: true, email: r.email, expires_at: r.expires_at });
  } catch (error) {
    console.error('verify-activation-link error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});