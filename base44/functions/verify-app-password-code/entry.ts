// verify-app-password-code — validates the 6-digit email code and returns a
// short-lived HMAC-signed action token that manage-app-password consumes to
// authorize deletion of a legacy SwapPulse app password.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { timingSafeEqual, signActionToken } from '../../shared/appPasswordCrypto.ts';

const VALID_ACTIONS = new Set(['delete']);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Sign in to manage app passwords.' }, { status: 401 });
    if (!user.email) return Response.json({ error: 'No email on file.' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    const code = String(body.code || '').trim();
    const targetId = String(body.target_id || '').trim() || undefined;

    if (!VALID_ACTIONS.has(action)) return Response.json({ error: 'Invalid action.' }, { status: 400 });
    if (!code) return Response.json({ error: 'Code is required.' }, { status: 400 });

    const email = user.email.toLowerCase();
    const svc = base44.asServiceRole;

    // Find the active (unused, unexpired) code for this email + action.
    const codes = await svc.entities.AppPasswordCode.filter({ email, action, used: false }, '-created_date', 5);
    const now = new Date();
    const active = (codes || []).find((c) => new Date(c.expires_at) > now);

    if (!active) {
      return Response.json({ error: 'Invalid or expired code.' }, { status: 400 });
    }

    // The code must be scoped to the same deletion target.
    if (action === 'delete' && targetId && active.target_id && active.target_id !== targetId) {
      return Response.json({ error: 'This code was not issued for that app password.' }, { status: 400 });
    }

    if (!timingSafeEqual(active.code, code)) {
      const attempts = (active.failed_attempts || 0) + 1;
      if (attempts >= 5) {
        await svc.entities.AppPasswordCode.delete(active.id).catch(() => {});
        return Response.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 400 });
      }
      await svc.entities.AppPasswordCode.update(active.id, { failed_attempts: attempts }).catch(() => {});
      return Response.json({ error: 'Invalid code.' }, { status: 400 });
    }

    // Mark code as used.
    try {
      await svc.entities.AppPasswordCode.update(active.id, { used: true });
    } catch (e) {
      console.error('verify-app-password-code: failed to mark code used:', e?.message || e);
    }

    // Issue a short-lived action token.
    const actionToken = await signActionToken({
      userId: user.id,
      action,
      targetId: targetId || active.target_id || undefined,
      ttlMs: 10 * 60 * 1000,
    });

    return Response.json({ verified: true, action_token: actionToken });
  } catch (error) {
    console.error('verify-app-password-code error:', error?.message || error);
    return Response.json({ error: error?.message || 'Verification failed.' }, { status: 500 });
  }
}