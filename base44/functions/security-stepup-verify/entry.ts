import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { consumeAuthAttempt, resetAuthAttempts } from '../../shared/authThrottle.ts';
import { timingSafeEqual } from '../../shared/cryptoCompare.ts';
import { signActionToken } from '../../shared/appPasswordCrypto.ts';

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || '').trim();
    if (!/^\d{6}$/.test(code)) return Response.json({ error: 'Enter the 6-digit code' }, { status: 400 });

    const throttle = await consumeAuthAttempt(svc, 'security-stepup-verify', user.id, {
      maxAttempts: 6,
      windowMs: 15 * 60 * 1000,
    });
    if (!throttle.allowed) {
      return Response.json(
        { error: 'Too many attempts. Try again later.', retry_after: throttle.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds || 900) } },
      );
    }

    const rows = await svc.entities.SecurityStepUpCode
      .filter({ user_id: user.id }, '-created_date', 5)
      .catch(() => []);
    const now = Date.now();
    const active = (rows || []).find((row: any) =>
      !row.used_at && row.expires_at && new Date(row.expires_at).getTime() > now
    );
    if (!active) return Response.json({ error: 'Invalid or expired code' }, { status: 400 });

    const candidate = await sha256Hex(`${user.id}:${active.salt}:${code}`);
    if (!(await timingSafeEqual(candidate, String(active.code_hash || '')))) {
      const failed = Number(active.failed_attempts || 0) + 1;
      if (failed >= 5) {
        await svc.entities.SecurityStepUpCode.delete(active.id).catch(() => {});
        return Response.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 400 });
      }
      await svc.entities.SecurityStepUpCode.update(active.id, { failed_attempts: failed }).catch(() => {});
      return Response.json({ error: 'Invalid code' }, { status: 400 });
    }

    await svc.entities.SecurityStepUpCode.update(active.id, { used_at: new Date().toISOString() });
    await resetAuthAttempts(svc, 'security-stepup-verify', user.id).catch(() => {});
    const token = await signActionToken({ userId: user.id, action: 'security_manage', ttlMs: 10 * 60 * 1000 });
    return Response.json({ verified: true, management_token: token, expires_in_seconds: 600 });
  } catch (error: any) {
    console.error('security-stepup-verify error', error?.message || error);
    return Response.json({ error: 'Security verification failed' }, { status: 500 });
  }
}
