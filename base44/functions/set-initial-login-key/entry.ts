// set-initial-login-key — authenticated one-time registration bridge.
// Registration still requires a Base44 password client-side, but the persistent
// login_key field itself is backend-only and cannot be read or overwritten via
// auth.me()/updateMe after initial setup.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const loginKey = String(body.login_key || '');
    if (loginKey.length < 32 || loginKey.length > 256) {
      return Response.json({ error: 'Invalid login key' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const rows = await svc.entities.User.filter({ id: user.id }, '-created_date', 1).catch(() => []);
    const fresh = rows?.[0];
    if (!fresh) return Response.json({ error: 'User not found' }, { status: 404 });
    if (fresh.login_key) {
      // Never allow an authenticated browser session to rotate this long-lived
      // password bridge. Existing-account recovery is handled by store-login-key
      // after validation of a platform reset token.
      return Response.json({ error: 'Login key is already configured' }, { status: 409 });
    }

    await svc.entities.User.update(user.id, { login_key: loginKey });
    return Response.json({ configured: true });
  } catch (error: any) {
    console.error('set-initial-login-key error:', error?.message || error);
    return Response.json({ error: 'Could not complete account setup' }, { status: 500 });
  }
}
