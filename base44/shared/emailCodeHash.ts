import { secrets } from 'base44:runtime';

// A six-digit code is too small for an unkeyed hash. Bind the HMAC to its
// purpose, account email and exact action/target before storing it.
export async function emailCodeHash(purpose: string, email: string, code: string): Promise<string> {
  const secret = secrets.get('BACKEND_FUNCTION_SECRET');
  if (!secret) throw new Error('BACKEND_FUNCTION_SECRET is not configured.');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const data = new TextEncoder().encode(JSON.stringify([purpose, email.toLowerCase(), code]));
  const digest = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
