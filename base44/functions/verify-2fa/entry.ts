import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(str: string): Uint8Array {
  const cleaned = str.replace(/=+$/, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of cleaned) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

async function generateTotp(secret: string, period = 30, digits = 6): Promise<string> {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / period);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter & 0xffffffff);
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const hmac = await crypto.subtle.sign('HMAC', cryptoKey, buffer);
  const hmacBytes = new Uint8Array(hmac);
  const offset = hmacBytes[hmacBytes.length - 1] & 0xf;
  const code = ((hmacBytes[offset] & 0x7f) << 24) | (hmacBytes[offset + 1] << 16) | (hmacBytes[offset + 2] << 8) | hmacBytes[offset + 3];
  return (code % 10 ** digits).toString().padStart(digits, '0');
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const mode = body.mode || 'verify';

  try {
    if (mode === 'check') {
      // Check if 2FA is required for an email (login flow, no auth needed)
      const email = String(body.email || '').toLowerCase().trim();
      if (!email) return Response.json({ error: 'Email required' }, { status: 400 });
      const users = await base44.asServiceRole.entities.User.filter({ email });
      if (users.length === 0) return Response.json({ requires_2fa: false });
      return Response.json({ requires_2fa: !!users[0].two_factor_enabled });
    }

    if (mode === 'setup') {
      // Verify code against provided secret, then save (auth required)
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const { secret, code } = body;
      if (!secret || !code) return Response.json({ error: 'Secret and code required' }, { status: 400 });
      const expected = await generateTotp(secret);
      if (code !== expected) return Response.json({ verified: false, error: 'Invalid code' });
      await base44.auth.updateMe({ two_factor_enabled: true, two_factor_secret: secret });
      return Response.json({ verified: true });
    }

    // Default: verify TOTP for login (no auth, lookup by email)
    const { email, code } = body;
    if (!email || !code) return Response.json({ error: 'Email and code required' }, { status: 400 });
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (users.length === 0) return Response.json({ verified: false, error: 'User not found' });
    const user = users[0];
    if (!user.two_factor_enabled || !user.two_factor_secret) {
      return Response.json({ verified: true });
    }
    const expected = await generateTotp(user.two_factor_secret);
    if (code !== expected) return Response.json({ verified: false, error: 'Invalid 2FA code' });
    return Response.json({ verified: true });
  } catch (e) {
    console.error('verify-2fa error', e?.message || e);
    return Response.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}