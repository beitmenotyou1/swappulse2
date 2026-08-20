// manage-app-password — performs the create/reveal/delete operation after the
// user has verified their email code (verified via the HMAC action token).
// Returns the plaintext password for create/reveal; confirms deletion.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  generateAppPassword,
  hashPassword,
  encryptPassword,
  decryptPassword,
  verifyActionToken,
} from '../../shared/appPasswordCrypto.ts';

const VALID_SCOPES = new Set(['read_only', 'read_write', 'full_access']);
const VALID_ACTIONS = new Set(['create', 'reveal', 'delete']);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Sign in to manage app passwords.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    const actionToken = String(body.action_token || '').trim();
    const label = String(body.label || '').trim();
    const scope = String(body.scope || '').trim();
    const targetId = String(body.target_id || '').trim() || undefined;

    if (!VALID_ACTIONS.has(action)) return Response.json({ error: 'Invalid action.' }, { status: 400 });
    if (!actionToken) return Response.json({ error: 'Action token required.' }, { status: 400 });

    // Verify the action token (confirms email-code verification + user + action match).
    const tokenCheck = await verifyActionToken(actionToken, action, user.id);
    if (!tokenCheck.valid) {
      return Response.json({ error: tokenCheck.error || 'Invalid or expired action token.' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    if (action === 'create') {
      if (!label) return Response.json({ error: 'A label is required.' }, { status: 400 });
      if (!VALID_SCOPES.has(scope)) return Response.json({ error: 'Invalid scope.' }, { status: 400 });

      const plain = generateAppPassword();
      const passwordHash = await hashPassword(plain);
      const passwordCipher = await encryptPassword(plain);

      const created = await svc.entities.AppPassword.create({
        label,
        scope,
        password_hash: passwordHash,
        password_cipher: passwordCipher,
        created_by_id: user.id,
      });

      return Response.json({
        created: true,
        id: created.id,
        password: plain,
        label,
        scope,
      });
    }

    if (action === 'reveal') {
      const id = targetId || tokenCheck.targetId;
      if (!id) return Response.json({ error: 'Target app password not specified.' }, { status: 400 });

      const records = await svc.entities.AppPassword.filter({ id, created_by_id: user.id }, '-created_date', 1).catch(() => []);
      if (!records || records.length === 0) {
        return Response.json({ error: 'App password not found.' }, { status: 404 });
      }
      const record = records[0];
      const plain = await decryptPassword(record.password_cipher);
      return Response.json({ revealed: true, id: record.id, password: plain, label: record.label, scope: record.scope });
    }

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