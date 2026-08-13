import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    if (!email) return Response.json({ error: 'Email is required' }, { status: 400 });

    // Find user by email — return not_found so the UI can guide to registration
    const users = await svc.entities.User.filter({ email }, '-created_date', 1);
    if (!users || users.length === 0) {
      // Let the user know they need to create an account first
      return Response.json({ not_found: true });
    }
    const user = users[0];

    // If user has no login_key, they need a one-time setup via the reset flow.
    // Don't send a code — the frontend will trigger resetPasswordRequest instead.
    if (!user.login_key) {
      return Response.json({ needs_setup: true });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

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
      '— The SwapPulse Team';

    const htmlVersion =
      '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0F1117;color:#e2e8f0;">' +
      '<h1 style="color:#6d4aff;font-size:24px;margin-bottom:16px;">Your SwapPulse Login Code</h1>' +
      '<p style="line-height:1.6;">Here is your one-time login code:</p>' +
      '<div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:24px;background:#1a1d2e;border-radius:12px;margin:16px 0;color:#fbbf24;">' + code + '</div>' +
      '<p style="line-height:1.6;">This code expires in 15 minutes. If you did not request this code, you can safely ignore this email.</p>' +
      '<p style="color:#64748b;font-size:12px;margin-top:24px;text-align:center;">— The SwapPulse Team</p>' +
      '</div>';

    try {
      await sendBrandedEmail({
        to: email,
        subject,
        html: htmlVersion,
        text: textVersion,
      });
    } catch (e) {
      console.error('send-login-code: email failed:', e?.message || e);
      return Response.json({ error: 'Could not send login code' }, { status: 500 });
    }

    return Response.json({ code_sent: true });
  } catch (error) {
    console.error('send-login-code error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}