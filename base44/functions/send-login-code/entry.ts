import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';
import { checkBlocklist } from '../../shared/enforcement.ts';
import { checkBotRisk } from '../../shared/botGuard.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    if (!email) return Response.json({ error: 'Email is required' }, { status: 400 });

    // Bot protection runs before account lookup so request behaviour does not
    // become an account-existence oracle.
    // Bot protection — block automated login-code requests (bot UA, hard
    // rate, active block window). The captcha challenge flow is handled on
    // the client for authenticated writes; for the auth flow a challenge
    // verdict is treated as a soft block to stop bots without breaking humans.
    try {
      const verdict = await checkBotRisk(svc, { user: null, actionType: 'login_code', req, anonId: email });
      if (verdict.block || verdict.challengeRequired) {
        return Response.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
      }
    } catch (e) {
      console.error('send-login-code: bot guard failed', e?.message || e);
    }

    // Rate-limit: min 60s between sends, max 5 per hour per email. Apply this
    // before account lookup so known/unknown emails follow the same throttle.
    const rlNow = Date.now();
    const rlRecords = await svc.entities.AuthRateLimit.filter({ email }, '-created_date', 1).catch(() => []);
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
        email,
        last_request_at: new Date(rlNow).toISOString(),
        window_start: new Date(rlNow).toISOString(),
        count: 1,
      });
    }

    // Account lookup happens only after bot/rate controls. Unknown addresses get
    // the same success response but no LoginCode and no email, preventing user
    // enumeration while keeping the UX deterministic.
    const users = await svc.entities.User.filter({ email }, '-created_date', 1).catch(() => []);
    const user = users?.[0] || null;
    if (!user) return Response.json({ code_sent: true });

    // A blocked account also gets the generic response. Do not disclose account
    // or enforcement state before mailbox ownership is proven.
    const isBlocked = await checkBlocklist(svc, email);
    if (isBlocked) return Response.json({ code_sent: true });

    // Generate 6-digit code (cryptographically secure), valid for the same
    // five-minute window shown by the login UI.
    const code = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Delete old codes for this email
    try {
      await svc.entities.LoginCode.deleteMany({ email });
    } catch (e) {
      console.error('send-login-code: failed to delete old codes:', e?.message || e);
    }

    // Create new code
    await svc.entities.LoginCode.create({
      email,
      code,
      expires_at: expiresAt,
      used: false,
    });

    // Send the code via email (plain text body, no markdown)
    const subject = 'Your SwapPulse Login Code';
    const textVersion =
      'Your SwapPulse Login Code\n\n' +
      'Here is your one-time login code:\n\n' +
      code + '\n\n' +
      'This code expires in 15 minutes. If you did not request this code, you can safely ignore this email.\n\n' +
      'The SwapPulse Team';

    const htmlVersion =
      '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0F1117;color:#e2e8f0;">' +
      '<h1 style="color:#6d4aff;font-size:24px;margin-bottom:16px;">Your SwapPulse Login Code</h1>' +
      '<p style="line-height:1.6;">Here is your one-time login code:</p>' +
      '<div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:24px;background:#1a1d2e;border-radius:12px;margin:16px 0;color:#fbbf24;">' + code + '</div>' +
      '<p style="line-height:1.6;">This code expires in 15 minutes. If you did not request this code, you can safely ignore this email.</p>' +
      '<p style="color:#64748b;font-size:12px;margin-top:24px;text-align:center;">The SwapPulse Team</p>' +
      '</div>';

    // Send the email. The login code is already saved in the database, so
    // even if the SMTP send is slow or times out, we return success so the
    // user can proceed to the code-entry step. The email likely went out
    // (the SMTP server accepted it) even if the response was slow. If the
    // user doesn't receive it, they can request a new code after the
    // rate-limit window.
    try {
      await sendBrandedEmail({
        to: email,
        subject,
        html: htmlVersion,
        text: textVersion,
      });
    } catch (e) {
      console.error('send-login-code: email send failed/timed out:', e?.message || e);
    }

    return Response.json({ code_sent: true });
  } catch (error) {
    console.error('send-login-code error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}