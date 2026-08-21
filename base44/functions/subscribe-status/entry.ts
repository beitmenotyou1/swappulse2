// subscribe-status — public function to subscribe an email to status updates.
// Creates a StatusSubscriber with a confirm_token (double-opt-in) and sends a
// confirmation email. If already subscribed and confirmed, returns early.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';
import { resolveAppUrl } from '../../shared/appUrl.ts';

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ error: 'Valid email required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const existing = await svc.entities.StatusSubscriber.list('-created_date', 500);
    const sub = existing.find((s) => (s.email || '').toLowerCase() === email);

    if (sub && sub.confirmed_at) {
      return Response.json({ ok: true, alreadySubscribed: true });
    }

    const confirmToken = randomToken();
    const unsubscribeToken = randomToken();

    if (sub) {
      await svc.entities.StatusSubscriber.update(sub.id, {
        confirm_token: confirmToken,
        unsubscribe_token: unsubscribeToken,
      });
    } else {
      await svc.entities.StatusSubscriber.create({
        email,
        confirm_token: confirmToken,
        unsubscribe_token: unsubscribeToken,
        preferences: { incidents: true, resolutions: true, maintenance: true },
      });
    }

    const origin = resolveAppUrl(req);
    const confirmUrl = `${origin}/status?confirm=${confirmToken}`;

    const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0b0e14;font-family:Inter,Arial,sans-serif;color:#e6edf3">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#111827;border-radius:16px;overflow:hidden;border:1px solid #1e293b">
      <div style="padding:32px;text-align:center">
        <h2 style="margin:0 0 12px;color:#f8fafc">Confirm your subscription</h2>
        <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6">
          You're one step away from receiving SwapPulse status updates. Click the button below to confirm your email address.
        </p>
        <a href="${confirmUrl}" style="display:inline-block;padding:12px 32px;border-radius:999px;background:#6d4aff;color:#fff;text-decoration:none;font-size:15px;font-weight:600">Confirm Subscription</a>
        <p style="margin:24px 0 0;color:#64748b;font-size:12px">If you didn't subscribe, you can safely ignore this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
    const text = `Confirm your SwapPulse status subscription:\n\n${confirmUrl}\n\nIf you didn't subscribe, ignore this email.`;

    try {
      await sendBrandedEmail({ to: email, subject: 'Confirm your SwapPulse status subscription', html, text });
    } catch (e) {
      console.error('subscribe-status email failed', e?.message || e);
      return Response.json({ error: 'Failed to send confirmation email' }, { status: 500 });
    }

    return Response.json({ ok: true, message: 'Check your email to confirm' });
  } catch (error) {
    console.error('subscribe-status error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}