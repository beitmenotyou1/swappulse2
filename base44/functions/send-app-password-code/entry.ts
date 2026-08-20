// send-app-password-code — generates and emails a 6-digit verification code
// required before creating, revealing, or deleting an app password.
// Requires an authenticated user; the code is sent to their email on file.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

const VALID_ACTIONS = new Set(['create', 'reveal', 'delete']);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Sign in to manage app passwords.' }, { status: 401 });
    if (!user.email) return Response.json({ error: 'No email on file for your account.' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    const targetId = String(body.target_id || '').trim() || undefined;

    if (!VALID_ACTIONS.has(action)) {
      return Response.json({ error: 'Invalid action.' }, { status: 400 });
    }

    // For reveal/delete, verify the target belongs to the caller before sending a code.
    if ((action === 'reveal' || action === 'delete') && targetId) {
      const svc = base44.asServiceRole;
      const existing = await svc.entities.AppPassword.filter({ id: targetId, created_by_id: user.id }, '-created_date', 1).catch(() => []);
      if (!existing || existing.length === 0) {
        return Response.json({ error: 'App password not found.' }, { status: 404 });
      }
    }

    const email = user.email.toLowerCase();
    const svc = base44.asServiceRole;

    // Rate-limit: min 60s between sends, max 5 per hour per email (namespaced to avoid
    // collision with login-code rate limits).
    const rlKey = `app-pw:${email}`;
    const rlNow = Date.now();
    const rlRecords = await svc.entities.AuthRateLimit.filter({ email: rlKey }, '-created_date', 1).catch(() => []);
    const rlExisting = rlRecords[0];
    if (rlExisting) {
      const lastAgo = rlNow - new Date(rlExisting.last_request_at || rlExisting.created_date).getTime();
      if (lastAgo < 60_000) {
        return Response.json({ error: 'Please wait a minute before requesting another code.' }, { status: 429 });
      }
      const windowStart = new Date(rlExisting.window_start || rlExisting.created_date).getTime();
      const inWindow = rlNow - windowStart < 3_600_000;
      if (inWindow && (rlExisting.count || 0) >= 5) {
        return Response.json({ error: 'Too many code requests. Please try again later.' }, { status: 429 });
      }
      await svc.entities.AuthRateLimit.update(rlExisting.id, {
        last_request_at: new Date(rlNow).toISOString(),
        count: inWindow ? (rlExisting.count || 0) + 1 : 1,
        window_start: inWindow ? rlExisting.window_start : new Date(rlNow).toISOString(),
      });
    } else {
      await svc.entities.AuthRateLimit.create({
        email: rlKey,
        last_request_at: new Date(rlNow).toISOString(),
        window_start: new Date(rlNow).toISOString(),
        count: 1,
      });
    }

    // Generate 6-digit code (cryptographically secure).
    const code = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete old codes for this email + action.
    try {
      await svc.entities.AppPasswordCode.deleteMany({ email, action });
    } catch (e) {
      console.error('send-app-password-code: failed to delete old codes:', e?.message || e);
    }

    await svc.entities.AppPasswordCode.create({
      email,
      code,
      expires_at: expiresAt,
      used: false,
      action,
      target_id: targetId || '',
    });

    const actionLabel = action === 'create' ? 'create a new app password' : action === 'reveal' ? 'reveal an app password' : 'delete an app password';

    const subject = 'Your SwapPulse App Password Code';
    const textVersion =
      'Your SwapPulse App Password Code\n\n' +
      `You requested to ${actionLabel}.\n\n` +
      'Here is your one-time verification code:\n\n' +
      code + '\n\n' +
      'This code expires in 10 minutes. If you did not request this, you can safely ignore this email.\n\n' +
      'The SwapPulse Team';

    const htmlVersion =
      '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0F1117;color:#e2e8f0;">' +
      '<h1 style="color:#6d4aff;font-size:24px;margin-bottom:16px;">Your SwapPulse App Password Code</h1>' +
      `<p style="line-height:1.6;">You requested to <strong>${actionLabel}</strong>.</p>` +
      '<p style="line-height:1.6;">Here is your one-time verification code:</p>' +
      '<div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:24px;background:#1a1d2e;border-radius:12px;margin:16px 0;color:#fbbf24;">' + code + '</div>' +
      '<p style="line-height:1.6;">This code expires in 10 minutes. If you did not request this, you can safely ignore this email.</p>' +
      '<p style="color:#64748b;font-size:12px;margin-top:24px;text-align:center;">The SwapPulse Team</p>' +
      '</div>';

    try {
      await sendBrandedEmail({ to: email, subject, html: htmlVersion, text: textVersion });
    } catch (e) {
      console.error('send-app-password-code: email failed:', e?.message || e);
      return Response.json({ error: 'Could not send verification code email.' }, { status: 500 });
    }

    return Response.json({ code_sent: true });
  } catch (error) {
    console.error('send-app-password-code error:', error?.message || error);
    return Response.json({ error: error?.message || 'Failed to send code.' }, { status: 500 });
  }
}