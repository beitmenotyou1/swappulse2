// send-activation - (re)issues an account activation link email.
// Creates/refreshes an Activation record (link token valid 48h) and emails the
// link to the account holder. Called after register and from the persistent
// activation banner. The 6-digit code itself is delivered by the platform's
// own verification email; this function delivers the activation LINK.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { randomToken, HOURS_48, THROTTLE_MS } from '../../shared/activation.ts';
import { buildActivationEmail } from '../../shared/emailContent.ts';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch {}
    const emailParam = String(body.email || '').trim().toLowerCase();

    // Prefer the authenticated caller's email when available; fall back to the
    // provided email (used right after register, before the user has a token).
    let me = null;
    try { me = await base44.auth.me(); } catch {}
    const targetEmail = (me?.email || emailParam || '').trim().toLowerCase();
    if (!targetEmail) return Response.json({ error: 'Email is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const users = await svc.entities.User.list('-created_date', 500);
    const u = users.find((x) => (x.email || '').toLowerCase() === targetEmail);
    if (!u) return Response.json({ error: 'No account found for that email' }, { status: 404 });
    if (u.is_verified) return Response.json({ ok: true, alreadyActivated: true });

    const existing = await svc.entities.Activation.filter({ user_id: u.id });
    let record = existing[0];
    const now = Date.now();
    if (record) {
      const last = record.updated_date ? new Date(record.updated_date).getTime() : 0;
      if (now - last < THROTTLE_MS) {
        return Response.json({ ok: true, throttled: true, expires_at: record.expires_at });
      }
      record = await svc.entities.Activation.update(record.id, {
        link_token: randomToken(),
        expires_at: new Date(now + HOURS_48).toISOString(),
        status: 'pending',
      });
    } else {
      record = await svc.entities.Activation.create({
        user_id: u.id,
        email: u.email,
        link_token: randomToken(),
        expires_at: new Date(now + HOURS_48).toISOString(),
        status: 'pending',
      });
    }

    const origin = req.headers.get('origin') || req.headers.get('Origin') || '';
    const link = `${origin}/activate?token=${record.link_token}`;
    try {
      const email = buildActivationEmail(u.full_name, link);
      await sendBrandedEmail({ to: u.email, ...email });
    } catch (e) {
      console.error('send-activation email failed', e?.message || e);
    }

    return Response.json({ ok: true, token: record.link_token, expires_at: record.expires_at });
  } catch (error) {
    console.error('send-activation error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});