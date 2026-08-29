import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';
import { consumeAuthAttempt } from '../../shared/authThrottle.ts';

function randomDigits(): string {
  return String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
}

function randomHex(bytesLength = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
    if (!user.email) return Response.json({ error: 'Account email is unavailable' }, { status: 400 });

    const svc = base44.asServiceRole;
    const throttle = await consumeAuthAttempt(svc, 'security-stepup-send', user.id, {
      maxAttempts: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!throttle.allowed) {
      return Response.json(
        { error: 'Too many security-code requests. Try again later.', retry_after: throttle.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds || 3600) } },
      );
    }

    const code = randomDigits();
    const salt = randomHex();
    const codeHash = await sha256Hex(`${user.id}:${salt}:${code}`);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await svc.entities.SecurityStepUpCode.deleteMany({ user_id: user.id }).catch(() => {});
    await svc.entities.SecurityStepUpCode.create({
      user_id: user.id,
      code_hash: codeHash,
      salt,
      expires_at: expiresAt,
      failed_attempts: 0,
    });

    const subject = 'Confirm your SwapPulse security change';
    const text = `SwapPulse security verification\n\nYour verification code is:\n\n${code}\n\nIt expires in 10 minutes. If you did not request a security change, do not share this code and review your account security.`;
    const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0F1117;color:#e2e8f0"><h1 style="font-size:22px;color:#fff">Confirm your security change</h1><p>Enter this code in SwapPulse to unlock sensitive security settings:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:24px;background:#1a1d2e;border-radius:12px;margin:18px 0;color:#fbbf24">${code}</div><p>This code expires in 10 minutes. If you did not request this, do not share the code and review your account security.</p></div>`;

    try {
      await sendBrandedEmail({ to: user.email, subject, html, text });
    } catch (e: any) {
      await svc.entities.SecurityStepUpCode.deleteMany({ user_id: user.id }).catch(() => {});
      console.error('security-stepup-send: email failed', e?.message || e);
      return Response.json({ error: 'Could not send security verification email' }, { status: 502 });
    }

    return Response.json({ sent: true, expires_in_seconds: 600 });
  } catch (error: any) {
    console.error('security-stepup-send error', error?.message || error);
    return Response.json({ error: 'Could not start security verification' }, { status: 500 });
  }
}
