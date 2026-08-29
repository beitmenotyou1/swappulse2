import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyActionToken } from '../../shared/appPasswordCrypto.ts';

// Server-side passwordless recovery. Requires BOTH the platform reset token
// and a short-lived setup capability issued only after SwapPulse login-factor
// verification. The capability binds the operation to one user/email; after
// resetting, the backend also proves the new password authenticates that same
// account before persisting login_key.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const resetToken = String(body.reset_token || body.resetToken || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const setupToken = String(body.setup_token || body.setupToken || '').trim();
    if (!resetToken || !email || !setupToken) {
      return Response.json({ error: 'Invalid or expired setup link' }, { status: 403 });
    }

    // Look up the claimed email, but return the same generic failure for an
    // unknown account or invalid capability so this endpoint is not an account
    // enumeration oracle.
    const users = await svc.entities.User.filter({ email }, '-created_date', 1).catch(() => []);
    const user = users?.[0] || null;
    if (!user) return Response.json({ error: 'Invalid or expired setup link' }, { status: 403 });

    const capability = await verifyActionToken(setupToken, 'login_key_setup', user.id);
    if (!capability.valid || capability.targetId !== email) {
      return Response.json({ error: 'Invalid or expired setup link' }, { status: 403 });
    }

    // Generate a strong random password server-side. The client never sees
    // or chooses this value until the reset token has been validated.
    const randomPassword = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(36).padStart(2, '0')).join('') + '!A1';

    // Validate the reset token and bind the platform password in one step.
    try {
      await base44.auth.resetPassword({ resetToken, newPassword: randomPassword });
    } catch (e) {
      console.error('store-login-key: resetPassword failed:', e?.response?.data || e?.message || e);
      return Response.json({ error: 'Invalid or expired setup link' }, { status: 403 });
    }

    // Prove the reset token belonged to the same email/account before updating
    // the persistent login_key. A token for some other account may change that
    // other account's password, but cannot desynchronise this target user.
    try {
      const login = await base44.auth.loginViaEmailPassword(email, randomPassword);
      if (login?.user?.id && login.user.id !== user.id) {
        throw new Error('Account mismatch');
      }
    } catch (e) {
      console.error('store-login-key: post-reset account binding failed:', e?.message || e);
      return Response.json({ error: 'Invalid or expired setup link' }, { status: 403 });
    }

    await svc.entities.User.update(user.id, { login_key: randomPassword });
    return Response.json({ success: true, login_key: randomPassword });
  } catch (error) {
    console.error('store-login-key error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}