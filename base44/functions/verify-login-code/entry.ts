import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getActiveSuspension } from '../../shared/enforcement.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    const code = (body.code || '').trim();
    if (!email || !code) return Response.json({ error: 'Email and code are required' }, { status: 400 });

    // Find the active (unused, unexpired) code for this email
    const codes = await svc.entities.LoginCode.filter({ email, used: false }, '-created_date', 5);
    const now = new Date();
    const active = (codes || []).find((c) => new Date(c.expires_at) > now);

    if (!active) {
      return Response.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // Wrong code: increment failed attempts, lock (delete) after 5 failures
    if (active.code !== code) {
      const attempts = (active.failed_attempts || 0) + 1;
      if (attempts >= 5) {
        await svc.entities.LoginCode.delete(active.id).catch(() => {});
        return Response.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 400 });
      }
      await svc.entities.LoginCode.update(active.id, { failed_attempts: attempts }).catch(() => {});
      return Response.json({ error: 'Invalid code' }, { status: 400 });
    }

    // Find user
    const users = await svc.entities.User.filter({ email }, '-created_date', 1);
    if (!users || users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    const user = users[0];

    // Check suspension BEFORE marking the code used — a suspended user's code
    // shouldn't be consumed so they can retry once reinstated.
    const suspension = await getActiveSuspension(svc, user.id);
    if (suspension) {
      return Response.json({
        suspended: true,
        reason: suspension.suspension_reason || 'Your account has been suspended.',
        suspended_until: suspension.suspended_until || null,
      });
    }

    // If user has no login_key, they need a one-time setup via the reset flow
    if (!user.login_key) {
      return Response.json({ needs_setup: true });
    }

    // Mark code as used
    try {
      await svc.entities.LoginCode.update(active.id, { used: true });
    } catch (e) {
      console.error('verify-login-code: failed to mark code as used:', e?.message || e);
    }

    return Response.json({ login_key: user.login_key });
  } catch (error) {
    console.error('verify-login-code error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}