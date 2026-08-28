import { secrets } from 'base44:runtime';

const RAW_TOKEN_RE = /^[0-9a-f]{64}$/;
const SIGNATURE_RE = /^[0-9a-f]{64}$/;

function backendSecret(): string {
  const value = String(secrets.get('BACKEND_FUNCTION_SECRET') || '');
  if (!value) throw new Error('BACKEND_FUNCTION_SECRET is not configured');
  return value;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(backendSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function signStatusCapability(
  action: 'confirm' | 'unsubscribe',
  rawToken: string,
): Promise<string> {
  const token = String(rawToken || '').trim().toLowerCase();
  if (!RAW_TOKEN_RE.test(token)) throw new Error('Invalid raw status capability token');
  const signature = await hmacHex(`swappulse-status-v1:${action}:${token}`);
  return `${token}.${signature}`;
}

export async function verifyStatusCapability(
  action: 'confirm' | 'unsubscribe',
  presentedToken: string,
): Promise<string | null> {
  const presented = String(presentedToken || '').trim().toLowerCase();
  const parts = presented.split('.');
  if (parts.length !== 2) return null;
  const [rawToken, signature] = parts;
  if (!RAW_TOKEN_RE.test(rawToken) || !SIGNATURE_RE.test(signature)) return null;

  const expected = await hmacHex(`swappulse-status-v1:${action}:${rawToken}`);
  return timingSafeEqual(signature, expected) ? rawToken : null;
}
