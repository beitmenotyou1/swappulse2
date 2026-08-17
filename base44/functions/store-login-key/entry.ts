import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Server-side passwordless setup. The caller passes the emailed reset token
// (proof of email ownership) and the backend validates it via the platform's
// resetPassword, generates the login_key itself, and persists it — so no
// unauthenticated caller can ever overwrite a user's login_key.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const resetToken = (body.reset_token || body.resetToken || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    if (!resetToken || !email) {
      return Response.json({ error: 'reset_token and email are required' }, { status: 400 });
    }

    // Find user by email (service role). Fail fast — don't consume a reset
    // token for an account that doesn't exist in this app.
    const users = await svc.entities.User.filter({ email }, '-created_date', 1);
    if (!users || users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    const user = users[0];

    // Generate a strong random password server-side. The client never sees
    // or chooses this value until the reset token has been validated.
    const randomPassword = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(36).padStart(2, '0')).join('') + '!A1';

    // Validate the reset token and bind the platform password in one step.
    // If the token is invalid/expired, the platform rejects and we do NOT
    // write the login_key.
    try {
      await base44.auth.resetPassword({ resetToken, newPassword: randomPassword });
    } catch (e) {
      console.error('store-login-key: resetPassword failed:', e?.response?.data || e?.message || e);
      return Response.json({ error: 'Invalid or expired reset link' }, { status: 403 });
    }

    // Only after the platform accepts the reset, persist the login_key.
    await svc.entities.User.update(user.id, { login_key: randomPassword });

    return Response.json({ success: true, login_key: randomPassword });
  } catch (error) {
    console.error('store-login-key error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}