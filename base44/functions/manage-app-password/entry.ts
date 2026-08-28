// manage-app-password — performs the create/reveal/delete operation after the
// user has verified their email code (verified via the HMAC action token).
// Returns the plaintext password for create/reveal; confirms deletion.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  verifyActionToken,
} from '../../shared/appPasswordCrypto.ts';

const VALID_ACTIONS = new Set(['delete']);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Sign in to manage app passwords.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    const actionToken = String(body.action_token || '').trim();
    const targetId = String(body.target_id || '').trim() || undefined;

    // Legacy SwapPulse-specific app passwords are being retired in favour of
    // standard AT Protocol OAuth. Existing credentials may be revoked, but new
    // credentials and plaintext re-reveal are deliberately disabled.
    if (action === 'create' || action === 'reveal') {
      return Response.json({ error: 'Legacy app-password creation and reveal are disabled. Existing credentials can still be revoked.' }, { status: 410 });
    }
    if (!VALID_ACTIONS.has(action)) return Response.json({ error: 'Invalid action.' }, { status: 400 });
    if (!actionToken) return Response.json({ error: 'Action token required.' }, { status: 400 });

    // Verify the action token (confirms email-code verification + user + action match).
    const tokenCheck = await verifyActionToken(actionToken, action, user.id);
    if (!tokenCheck.valid) {
      return Response.json({ error: tokenCheck.error || 'Invalid or expired action token.' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    if (action === 'delete') {
      const id = targetId || tokenCheck.targetId;
      if (!id) return Response.json({ error: 'Target app password not specified.' }, { status: 400 });

      const records = await svc.entities.AppPassword.filter({ id, created_by_id: user.id }, '-created_date', 1).catch(() => []);
      if (!records || records.length === 0) {
        return Response.json({ error: 'App password not found.' }, { status: 404 });
      }
      await svc.entities.AppPassword.delete(records[0].id);
      return Response.json({ deleted: true, id: records[0].id });
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    console.error('manage-app-password error:', error?.message || error);
    return Response.json({ error: error?.message || 'Operation failed.' }, { status: 500 });
  }
}