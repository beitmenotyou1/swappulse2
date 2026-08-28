// confirm-subscription — public capability-token endpoint for status email
// confirmation and one-click unsubscribe.
//
// This endpoint is intentionally usable without a logged-in account: possession
// of the 256-bit token sent to the subscriber's email is the authorisation.
// Security properties:
// - exact 64-hex token format (32 random bytes)
// - confirmation token expires after 24 hours
// - confirmation token is cleared after first successful use
// - no full-table scan; lookup is by exact capability token
// - matched tokens are throttled using a SHA-256-derived AuthRateLimit key
// - responses never expose subscriber email or other subscription data
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TOKEN_RE = /^[0-9a-f]{64}$/;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_MATCHED_ATTEMPTS = 10;

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function consumeRateLimit(svc: any, action: string, token: string): Promise<boolean> {
  // Only call this after a token has matched a real subscription. That avoids
  // letting random internet garbage create unbounded throttle rows.
  const digest = await sha256Hex(`${action}:${token}`);
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
    const token = String(body.token || '').trim().toLowerCase();
    const action = String(body.action || 'confirm').trim().toLowerCase();

    if (!['confirm', 'unsubscribe'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (!TOKEN_RE.test(token)) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    if (action === 'unsubscribe') {
      const matches = await svc.entities.StatusSubscriber
        .filter({ unsubscribe_token: token }, '-created_date', 1)
        .catch(() => []);
      const sub = matches?.[0];
      if (!sub) return Response.json({ error: 'Invalid or expired token' }, { status: 400 });

      const allowed = await consumeRateLimit(svc, action, token);
      if (!allowed) {
        return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
      }

      await svc.entities.StatusSubscriber.delete(sub.id);
      return Response.json({ ok: true, unsubscribed: true });
    }

    const matches = await svc.entities.StatusSubscriber
      .filter({ confirm_token: token }, '-created_date', 1)
      .catch(() => []);
    const sub = matches?.[0];
    if (!sub) return Response.json({ error: 'Invalid or expired token' }, { status: 400 });

    const allowed = await consumeRateLimit(svc, action, token);
    if (!allowed) {
      return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const expiresAt = Date.parse(sub.confirm_expires_at || '');
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      // Destroy the expired capability so it cannot become valid later through
      // accidental clock/config changes.
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
