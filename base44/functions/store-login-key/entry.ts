import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    const loginKey = body.login_key || '';
    if (!email || !loginKey) return Response.json({ error: 'Email and login_key are required' }, { status: 400 });

    // Find user by email
    const users = await svc.entities.User.filter({ email }, '-created_date', 1);
    if (!users || users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    const user = users[0];

    // Store the login_key
    await svc.entities.User.update(user.id, { login_key: loginKey });

    return Response.json({ success: true });
  } catch (error) {
    console.error('store-login-key error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}