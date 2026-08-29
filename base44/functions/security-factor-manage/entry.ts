import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyActionToken } from '../../shared/appPasswordCrypto.ts';

function safeLabel(value: unknown): string {
  return String(value || '').trim().slice(0, 60);
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    const token = String(body.management_token || '').trim();
    const authz = await verifyActionToken(token, 'security_manage', user.id);
    if (!authz.valid) return Response.json({ error: 'Fresh security verification required' }, { status: 403 });

    if (action === 'disable_totp') {
      await svc.entities.User.update(user.id, {
        two_factor_enabled: false,
        two_factor_secret: '',
      });
      return Response.json({ ok: true, two_factor_enabled: false });
    }

    if (action === 'rename_webauthn') {
      const credentialId = String(body.credential_id || '').trim();
      const label = safeLabel(body.label);
      if (!credentialId || !label) return Response.json({ error: 'Credential and label are required' }, { status: 400 });
      const rows = await svc.entities.WebAuthnCredential
        .filter({ id: credentialId, user_id: user.id }, '-created_date', 1)
        .catch(() => []);
      const credential = rows?.[0];
      if (!credential) return Response.json({ error: 'Security key not found' }, { status: 404 });
      await svc.entities.WebAuthnCredential.update(credential.id, { label });
      return Response.json({ ok: true, label });
    }

    if (action === 'delete_webauthn') {
      const credentialId = String(body.credential_id || '').trim();
      if (!credentialId) return Response.json({ error: 'Credential is required' }, { status: 400 });
      const rows = await svc.entities.WebAuthnCredential
        .filter({ id: credentialId, user_id: user.id }, '-created_date', 1)
        .catch(() => []);
      const credential = rows?.[0];
      if (!credential) return Response.json({ error: 'Security key not found' }, { status: 404 });
      await svc.entities.WebAuthnCredential.delete(credential.id);
      const remaining = await svc.entities.WebAuthnCredential
        .filter({ user_id: user.id }, '-created_date', 2)
        .catch(() => []);
      const enabled = (remaining || []).length > 0;
      await svc.entities.User.update(user.id, { webauthn_enabled: enabled });
      return Response.json({ ok: true, webauthn_enabled: enabled });
    }

    return Response.json({ error: 'Unsupported security action' }, { status: 400 });
  } catch (error: any) {
    console.error('security-factor-manage error', error?.message || error);
    return Response.json({ error: 'Security change failed' }, { status: 500 });
  }
}
