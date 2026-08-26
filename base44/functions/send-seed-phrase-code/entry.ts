// send-seed-phrase-code — generates a 6-digit one-time code and emails it to
// the collector's registered address as a verification factor before
// revealing their 24-word seed phrase. The code is stored hashed (SHA-256)
// in SeedPhraseCode with a 60-second TTL. Rate-limited to 5 requests per
// 15 minutes per DID.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const email = user.email;
    if (!email) return Response.json({ error: 'No email on file' }, { status: 400 });

    // Rate limit: max 5 code requests per 15 minutes per DID
    const rlKey = `seed-phrase-code:${did}`;
    const rlRecords = await base44.asServiceRole.entities.AuthRateLimit
      .filter({ email: rlKey }, '-created_date', 1).catch(() => []);
    const rl = rlRecords?.[0];
    const now = Date.now();
    if (rl) {
      const elapsed = now - new Date(rl.window_start || rl.created_date).getTime();
      if (elapsed < 900000 && (rl.count || 0) >= 5) {
        return Response.json({ error: 'Too many code requests. Try again later.' }, { status: 429 });
      }
      await base44.asServiceRole.entities.AuthRateLimit.update(rl.id, {
        last_request_at: new Date(now).toISOString(),
        count: elapsed < 900000 ? (rl.count || 0) + 1 : 1,
        window_start: elapsed < 900000 ? rl.window_start : new Date(now).toISOString(),
      }).catch(() => {});
    } else {
      await base44.asServiceRole.entities.AuthRateLimit.create({
        email: rlKey,
        last_request_at: new Date(now).toISOString(),
        window_start: new Date(now).toISOString(),
        count: 1,
      }).catch(() => {});
    }

    // Generate 6-digit code
    const code = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);

    // Hash the code (SHA-256) — never store plaintext
    const codeHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const codeHash = Array.from(new Uint8Array(codeHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    // 60-second TTL
    const expiresAt = new Date(Date.now() + 60000).toISOString();

    // Invalidate old unused codes for this DID
    try {
      await base44.asServiceRole.entities.SeedPhraseCode.deleteMany({ did, used: false });
    } catch {}

    // Store the hashed code
    await base44.entities.SeedPhraseCode.create({
      did,
      code_hash: codeHash,
      expires_at: expiresAt,
      used: false,
      created_at: new Date().toISOString(),
    });

    // Email the code
    const subject = 'Your SwapPulse Seed Phrase Code';
    const textVersion =
      'Your SwapPulse Seed Phrase Code\n\n' +
      'Here is your one-time verification code:\n\n' +
      code + '\n\n' +
      'This code expires in 60 seconds. Use it to view your recovery phrase.\n\n' +
      'If you did not request this code, you can safely ignore this email.\n\n' +
      'The SwapPulse Team';

    const htmlVersion =
      '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0F1117;color:#e2e8f0;">' +
      '<h1 style="color:#6d4aff;font-size:24px;margin-bottom:16px;">Seed Phrase Verification</h1>' +
      '<p style="line-height:1.6;">Here is your one-time verification code to view your recovery phrase:</p>' +
      '<div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:24px;background:#1a1d2e;border-radius:12px;margin:16px 0;color:#fbbf24;">' + code + '</div>' +
      '<p style="line-height:1.6;">This code expires in <strong>60 seconds</strong>. If you did not request this code, you can safely ignore this email.</p>' +
      '<p style="color:#64748b;font-size:12px;margin-top:24px;text-align:center;">The SwapPulse Team</p>' +
      '</div>';

    try {
      await sendBrandedEmail({ to: email, subject, html: htmlVersion, text: textVersion });
    } catch (e) {
      console.error('send-seed-phrase-code: email send failed:', (e as any)?.message || e);
    }

    return Response.json({ sent: true, expires_at: expiresAt });
  } catch (error: any) {
    console.error('send-seed-phrase-code error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}