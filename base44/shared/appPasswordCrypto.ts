// Shared crypto utilities for app passwords: generation, hashing, AES-GCM
// encryption/decryption (reversible re-reveal), and HMAC-signed action tokens
// that gate create/reveal/delete after email-code verification.
import { secrets } from 'base44:runtime';

const CHARSET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no ambiguous chars (0/O/1/I/l)

// Generate a cryptographically random 16-char app password, formatted xxxx-xxxx-xxxx-xxxx.
export function generateAppPassword(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let raw = '';
  for (let i = 0; i < 16; i++) {
    raw += CHARSET[bytes[i] % CHARSET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

// One-way SHA-256 hash for auth validation.
export async function hashPassword(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(plain);
  return timingSafeEqual(computed, hash);
}

// AES-GCM encryption for reversible re-reveal. Key derived from the
// APP_PASSWORD_ENCRYPTION_KEY secret via SHA-256 → 256-bit AES key.
async function getEncryptionKey(): Promise<CryptoKey> {
  const secretHex = secrets.get('APP_PASSWORD_ENCRYPTION_KEY');
  if (!secretHex) throw new Error('APP_PASSWORD_ENCRYPTION_KEY secret is not set.');
  // Hash the secret to get a deterministic 32-byte key (handles arbitrary-length input).
  const keyData = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secretHex));
  return crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptPassword(plain: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plain);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const cipherBytes = new Uint8Array(cipher);
  // Store as base64(iv + ciphertext) for compact, single-field storage.
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptPassword(cipherB64: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

// --- Action tokens (short-lived, HMAC-signed) ---
// Issued by verify-app-password-code after email-code verification; consumed by
// manage-app-password to authorize create/reveal/delete without re-sending the code.

function getSigningSecret(): string {
  const s = secrets.get('BACKEND_FUNCTION_SECRET');
  if (!s) throw new Error('BACKEND_FUNCTION_SECRET is not set.');
  return s;
}

export async function signActionToken(payload: {
  userId: string;
  action: string;
  targetId?: string;
  ttlMs?: number;
}): Promise<string> {
  const exp = Date.now() + (payload.ttlMs ?? 10 * 60 * 1000); // 10 min default
  const body = {
    uid: payload.userId,
    act: payload.action,
    tid: payload.targetId || '',
    exp: exp,
  };
  const bodyStr = JSON.stringify(body);
  const bodyB64 = btoa(bodyStr);
  const signingKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSigningSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(bodyB64));
  const sigHex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${bodyB64}.${sigHex}`;
}

export async function verifyActionToken(
  token: string,
  expectedAction: string,
  expectedUserId: string,
): Promise<{ valid: boolean; targetId?: string; error?: string }> {
  try {
    const [bodyB64, sigHex] = token.split('.');
    if (!bodyB64 || !sigHex) return { valid: false, error: 'Malformed token' };
    const signingKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(getSigningSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    if (!/^[0-9a-f]{64}$/i.test(sigHex)) return { valid: false, error: 'Invalid token signature' };
    const signatureBytes = new Uint8Array(sigHex.match(/../g)!.map((byte) => Number.parseInt(byte, 16)));
    const signatureValid = await crypto.subtle.verify(
      'HMAC',
      signingKey,
      signatureBytes,
      new TextEncoder().encode(bodyB64),
    );
    if (!signatureValid) return { valid: false, error: 'Invalid token signature' };
    const body = JSON.parse(atob(bodyB64));
    if (body.exp < Date.now()) return { valid: false, error: 'Token expired' };
    if (body.act !== expectedAction) return { valid: false, error: 'Token action mismatch' };
    if (body.uid !== expectedUserId) return { valid: false, error: 'Token user mismatch' };
    return { valid: true, targetId: body.tid || undefined };
  } catch (e: any) {
    return { valid: false, error: 'Token verification failed' };
  }
}

// Constant-time string comparison to prevent timing attacks.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}