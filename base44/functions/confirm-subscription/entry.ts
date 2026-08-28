// confirm-subscription — public, server-signed capability endpoint for status
// email confirmation and one-click unsubscribe.
//
// No login is required because the email link itself is the authorisation, but
// the presented capability must carry a valid HMAC-SHA256 signature produced
// with BACKEND_FUNCTION_SECRET before any subscription record is read/mutated.
// Confirmation capabilities additionally expire after 24 hours and are cleared
// after first successful use. Matched capabilities are rate-limited.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyStatusCapability } from '../../shared/statusSubscriptionTokens.ts';

const WINDOW_MS = 60 * 60 * 1000;
const MAX_MATCHED_ATTEMPTS = 10;

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function consumeRateLimit(svc: any, action: string, rawToken: string): Promise<boolean> {
  // This is only reached after the HMAC signature has verified, so arbitrary
  // garbage cannot create unbounded throttle records.
  const digest = await sha256Hex(`${action}:${rawToken}`);
  const key = `status-capability:${digest}`;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const rows = await svc.entities.AuthRateLimit.filter({ email: key }, '-created_date', 1).catch(() => []);
  const row = rows?.[0];

  if (!row) {
    await svc.entities.AuthRateLimit.create({
      email: key,
      count: 1,
      window_start: nowIso,
      last_request_at: nowIso,
    });
    return true;
  }

  const windowStart = Date.parse(row.window_start || '');
  if (!Number.isFinite(windowStart) || now - windowStart >= WINDOW_MS) {
    await svc.entities.AuthRateLimit.update(row.id, {
      count: 1,
      window_start: nowIso,
      last_request_at: nowIso,
    });
    return true;
  }

  const count = Math.max(0, Number(row.count || 0));
  if (count >= MAX_MATCHED_ATTEMPTS) return false;

  await svc.entities.AuthRateLimit.update(row.id, {
    count: count + 1,
    last_request_at: nowIso,
  });
  return true;
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const presentedToken = String(body.token || '').trim();
    const action = String(body.action || 'confirm').trim().toLowerCase();

    if (!['confirm', 'unsubscribe'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Verify cryptographic caller capability before obtaining service-role data.
    const rawToken = await verifyStatusCapability(
      action as 'confirm' | 'unsubscribe',
      presentedToken,
    );
    if (!rawToken) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const allowed = await consumeRateLimit(svc, action, rawToken);
    if (!allowed) {
      return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    if (action === 'unsubscribe') {
      const matches = await svc.entities.StatusSubscriber
        .filter({ unsubscribe_token: rawToken }, '-created_date', 1)
        .catch(() => []);
      const sub = matches?.[0];
      if (!sub) return Response.json({ error: 'Invalid or expired token' }, { status: 400 });

      await svc.entities.StatusSubscriber.delete(sub.id);
      return Response.json({ ok: true, unsubscribed: true });
    }

    const matches = await svc.entities.StatusSubscriber
      .filter({ confirm_token: rawToken }, '-created_date', 1)
      .catch(() => []);
    const sub = matches?.[0];
    if (!sub) return Response.json({ error: 'Invalid or expired token' }, { status: 400 });

    const expiresAt = Date.parse(sub.confirm_expires_at || '');
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      await svc.entities.StatusSubscriber.update(sub.id, { confirm_token: '' }).catch(() => {});
      return Response.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    await svc.entities.StatusSubscriber.update(sub.id, {
      confirmed_at: sub.confirmed_at || nowIso,
      confirm_consumed_at: nowIso,
      confirm_token: '',
    });

    return Response.json({ ok: true, confirmed: true });
  } catch (error: any) {
    console.error('confirm-subscription error', error?.message || error);
    return Response.json({ error: 'Subscription operation failed' }, { status: 500 });
  }
}
