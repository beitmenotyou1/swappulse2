import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    const code = (body.code || '').trim();
    if (!email || !code) return Response.json({ error: 'Email and code are required' }, { status: 400 });

    // Find the login code
    const codes = await svc.entities.LoginCode.filter({ email, code, used: false }, '-created_date', 1);
    if (!codes || codes.length === 0) {
      return Response.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    const loginCode = codes[0];

    // Check expiry
    if (new Date(loginCode.expires_at) < new Date()) {
      return Response.json({ error: 'Code expired. Please request a new one.' }, { status: 400 });
    }

    // Mark as used
    try {
      await svc.entities.LoginCode.update(loginCode.id, { used: true });
    } catch (e) {
      console.error('verify-login-code: failed to mark code as used:', e?.message || e);
    }

    // Find user and return login_key
    const users = await svc.entities.User.filter({ email }, '-created_date', 1);
    if (!users || users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    const user = users[0];

    // If user has no login_key yet, auto-generate one so they can log in
    // passwordlessly without ever seeing a password or setup link.
    if (!user.login_key) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const generatedKey = Array.from(bytes).map((b) => b.toString(36).padStart(2, '0')).join('') + '!A1';
      try {
        await svc.entities.User.update(user.id, { login_key: generatedKey });
        return Response.json({ login_key: generatedKey });
      } catch (e) {
        console.error('verify-login-code: failed to store login_key:', e?.message || e);
        return Response.json({ error: 'Could not complete login. Please try again.' }, { status: 500 });
      }
    }

    return Response.json({ login_key: user.login_key });
  } catch (error) {
    console.error('verify-login-code error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}