// validate-app-password — validates an app password for external AT Protocol app
// authentication (flow 4). Called by the PDS or external apps to check a collector's
// SwapPulse app password, enforce scope, and update last_used_at.
//
// This is a PUBLIC endpoint (called before the external app has a session), but
// it only validates credentials and returns scope info — it does not grant access
// to anything beyond what the caller already has. The PDS is responsible for
// issuing the actual session token after this validation passes.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyPassword } from '../../shared/appPasswordCrypto.ts';

const APPVIEW = 'https://public.api.bsky.app';

async function resolveHandle(handle: string): Promise<string> {
  if (handle.startsWith('did:')) return handle;
  try {
    const res = await fetch(
      `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.did) return data.did;
    }
  } catch {}
  try {
    const base = handle.includes('.') ? `https://${handle}` : `https://${handle}.bsky.social`;
    const res = await fetch(`${base}/.well-known/atproto-did`, { redirect: 'follow' });
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text.startsWith('did:')) return text;
    }
  } catch {}
  throw new Error('Could not resolve handle to a DID.');
}

// Scope enforcement: map requested XRPC operations to the minimum scope required.
function scopeAllows(scope: string, operation: string): boolean {
  if (!operation) return true; // no specific operation → just validating identity
  // Write operations (putRecord, deleteRecord, createRecord, uploadBlob, etc.)
  const isWrite = /^(com\.atproto\.repo\.(putRecord|deleteRecord|createRecord)|com\.atproto\.blob\.upload)/.test(operation);
  // Account-level operations (handle change, password reset, email change, etc.)
  const isAccountLevel = /^com\.atproto\.server\.(updateHandle|resetPassword|updateEmail|deleteAccount)/.test(operation);
  // Account deletion is never allowed via app password.
  if (/com\.atproto\.server\.deleteAccount/.test(operation)) return false;

  if (scope === 'full_access') return true;
  if (scope === 'read_write') return !isAccountLevel;
  if (scope === 'read_only') return !isWrite && !isAccountLevel;
  return false;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const handle = String(body.handle || '').trim().replace(/^@/, '');
    const appPassword = String(body.app_password || '').trim();
    const requestedOperation = String(body.requested_operation || '').trim();

    if (!handle || !appPassword) {
      return Response.json({ valid: false, error: 'Handle and app password are required.' }, { status: 400 });
    }

    // 1. Resolve handle → DID.
    const did = await resolveHandle(handle).catch(() => null);
    if (!did) {
      return Response.json({ valid: false, error: 'Could not resolve handle.' }, { status: 400 });
    }

    // 2. Find the SwapPulse user by DID.
    const users = await svc.entities.User.filter({ did }, '-created_date', 1).catch(() => []);
    if (!users || users.length === 0) {
      return Response.json({ valid: false, error: 'No SwapPulse account for this identity.' }, { status: 404 });
    }
    const user = users[0];

    // 3. Find the user's app passwords and check for a hash match.
    const passwords = await svc.entities.AppPassword.filter({ created_by_id: user.id }, '-created_date', 100).catch(() => []);
    if (!passwords || passwords.length === 0) {
      return Response.json({ valid: false, error: 'Invalid credentials.' }, { status: 401 });
    }

    let matched: any = null;
    for (const pw of passwords) {
      const ok = await verifyPassword(appPassword, pw.password_hash);
      if (ok) { matched = pw; break; }
    }

    if (!matched) {
      return Response.json({ valid: false, error: 'Invalid credentials.' }, { status: 401 });
    }

    // 4. Scope enforcement.
    if (requestedOperation && !scopeAllows(matched.scope, requestedOperation)) {
      return Response.json({
        valid: false,
        error: `This app password's scope (${matched.scope}) does not allow the requested operation.`,
        scope: matched.scope,
      }, { status: 403 });
    }

    // 5. Update last_used_at (fire-and-forget).
    const userAgent = String(req.headers.get('user-agent') || '').slice(0, 120);
    svc.entities.AppPassword.update(matched.id, {
      last_used_at: new Date().toISOString(),
      last_used_app: userAgent,
    }).catch((e: any) => console.error('validate-app-password: last_used update failed:', e?.message || e));

    return Response.json({
      valid: true,
      did,
      user_id: user.id,
      scope: matched.scope,
      label: matched.label,
    });
  } catch (error) {
    console.error('validate-app-password error:', error?.message || error);
    return Response.json({ valid: false, error: error?.message || 'Validation failed.' }, { status: 500 });
  }
}