// security-action-code — authenticated step-up email challenge for changing
// security factors. The six-digit code is never stored in plaintext; the DB
// contains a keyed SHA-256 hash and the email itself carries the code.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';
import { signActionToken } from '../../shared/appPasswordCrypto.ts';
import { secrets } from 'base44:runtime';

const PURPOSE = 'manage_security_factors';
const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function codeHash(userId: string, code: string): Promise<string> {
  const secret = secrets.get('BACKEND_FUNCTION_SECRET');
  if (!secret) throw new Error('BACKEND_FUNCTION_SECRET is not configured.');
  const bytes = new TextEncoder().encode(`${PURPOSE}:${userId}:${code}:${secret}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomCode(): string {
  return String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
}

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id || !user.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim().toLowerCase();

    if (action === 'send') {
      const rlKey = `security-factor-code:${user.id}`;
      const now = Date.now();
      const rows = await svc.entities.AuthRateLimit.filter({ email: rlKey }, '-created_date', 1).catch(() => []);
      const row = rows?.[0];
      if (row) {
        const last = Date.parse(row.last_request_at || row.created_date || '');
        if (Number.isFinite(last) && now - last < 60_000) {
          return Response.json({ error: 'Please wait a minute before requesting another security code.' }, { status: 429 });
        }
        const start = Date.parse(row.window_start || row.created_date || '');
        const inWindow = Number.isFinite(start) && now - start < 3_600_000;
        const count = Number(row.count || 0);
        if (inWindow && count >= 5) {
          return Response.json({ error: 'Too many security-code requests. Try again later.' }, { status: 429 });
        }
        await svc.entities.AuthRateLimit.update(row.id, {
          last_request_at: new Date(now).toISOString(),
          count: inWindow ? count + 1 : 1,
          window_start: inWindow ? row.window_start : new Date(now).toISOString(),
        });
      } else {
        await svc.entities.AuthRateLimit.create({
          email: rlKey,
          last_request_at: new Date(now).toISOString(),
          window_start: new Date(now).toISOString(),
          count: 1,
        });
      }

      await svc.entities.SecurityActionCode.deleteMany({ user_id: user.id, purpose: PURPOSE }).catch(() => {});
      const code = randomCode();
      await svc.entities.SecurityActionCode.create({
        user_id: user.id,
        purpose: PURPOSE,
        code_hash: await codeHash(user.id, code),
        expires_at: new Date(now + TTL_MS).toISOString(),
        used: false,
        failed_attempts: 0,
        created_at: new Date(now).toISOString(),
      });

      await sendBrandedEmail({
        to: user.email,
        subject: 'Your SwapPulse security code',
        text: `Your SwapPulse security code is ${code}. It expires in 10 minutes. If you did not request a security change, do not share this code.`,
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0F1117;color:#e2e8f0"><h1 style="color:#6d4aff;font-size:22px">Confirm your security change</h1><p>Enter this code in SwapPulse:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:24px;background:#1a1d2e;border-radius:12px;margin:16px 0;color:#fbbf24">${code}</div><p style="color:#94a3b8">It expires in 10 minutes. If you did not request a security change, do not share this code.</p></div>`,
      });
      return Response.json({ sent: true });
    }

    if (action === 'verify') {
      const code = String(body.code || '').trim();
      if (!/^\d{6}$/.test(code)) return Response.json({ error: 'Enter the 6-digit code.' }, { status: 400 });
      const rows = await svc.entities.SecurityActionCode
        .filter({ user_id: user.id, purpose: PURPOSE, used: false }, '-created_date', 5)
        .catch(() => []);
      const record = (rows || []).find((r: any) => r.expires_at && Date.parse(r.expires_at) > Date.now());
      if (!record) return Response.json({ error: 'Invalid or expired security code.' }, { status: 400 });
      if (Number(record.failed_attempts || 0) >= MAX_ATTEMPTS) {
        return Response.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 429 });
      }
      const expected = await codeHash(user.id, code);
      if (expected !== record.code_hash) {
        await svc.entities.SecurityActionCode.update(record.id, { failed_attempts: Number(record.failed_attempts || 0) + 1 }).catch(() => {});
        return Response.json({ error: 'Invalid security code.' }, { status: 400 });
      }
      await svc.entities.SecurityActionCode.update(record.id, { used: true }).catch(() => {});
      const management_token = await signActionToken({ userId: user.id, action: 'security-factor-management', ttlMs: 10 * 60 * 1000 });
      return Response.json({ verified: true, management_token });
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('security-action-code error:', error?.message || error);
    return Response.json({ error: 'Security verification failed.' }, { status: 500 });
  }
}
