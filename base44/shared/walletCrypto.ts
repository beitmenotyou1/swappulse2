// Shared crypto utilities for custodial wallets: AES-GCM encryption with
// the server encryption key (for passkey-gated wallets and mnemonic backups),
// PBKDF2-derived PIN encryption, and PIN hashing for verification.
//
// The private key is encrypted with either:
//   - 'server': APP_PASSWORD_ENCRYPTION_KEY (passkey gates access to decrypt)
//   - 'pin': PBKDF2(PIN, salt) (the PIN itself is the decryption key)
//
// The mnemonic is ALWAYS encrypted with the server key so it can be recovered
// regardless of encryption method, after passkey or PIN authentication.

import { secrets } from 'base44:runtime';

// --- Server-key encryption (AES-GCM with APP_PASSWORD_ENCRYPTION_KEY) ---

async function getServerEncryptionKey(): Promise<CryptoKey> {
  const secret = secrets.get('APP_PASSWORD_ENCRYPTION_KEY');
  if (!secret) throw new Error('APP_PASSWORD_ENCRYPTION_KEY secret is not set');
  const keyData = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptWithServerKey(plaintext: string): Promise<string> {
  const key = await getServerEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const cipherBytes = new Uint8Array(cipher);
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptWithServerKey(cipherB64: string): Promise<string> {
  const key = await getServerEncryptionKey();
  const combined = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

// --- PIN-derived key encryption (PBKDF2 + AES-GCM) ---

function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

async function derivePinKey(pin: string, saltB64: string, iterations: number): Promise<CryptoKey> {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptWithPin(
  plaintext: string,
  pin: string,
  saltB64?: string,
  iterations = 100000,
): Promise<{ cipher: string; salt: string; iterations: number }> {
  const salt = saltB64 || generateSalt();
  const key = await derivePinKey(pin, salt, iterations);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const cipherBytes = new Uint8Array(cipher);
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);
  return { cipher: btoa(String.fromCharCode(...combined)), salt, iterations };
}

export async function decryptWithPin(
  cipherB64: string,
  pin: string,
  saltB64: string,
  iterations: number,
): Promise<string> {
  const key = await derivePinKey(pin, saltB64, iterations);
  const combined = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

// --- PIN hashing (for verification) ---

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// --- Decrypt helpers ---

export async function decryptPrivateKey(wallet: any, pin?: string): Promise<string> {
  // Works with both CustodialWallet (encrypted_private_key) and
  // MultiChainWallet (evm_private_key_cipher) — both store the EVM key.
  const cipher = wallet.encrypted_private_key || wallet.evm_private_key_cipher;
  if (wallet.encryption_method === 'pin') {
    if (!pin) throw new Error('PIN required to unlock this wallet');
    return decryptWithPin(cipher, pin, wallet.pin_salt, wallet.kdf_iterations || 100000);
  }
  return decryptWithServerKey(cipher);
}

export async function decryptMnemonic(wallet: any): Promise<string> {
  return decryptWithServerKey(wallet.mnemonic_cipher);
}

// --- Verify PIN against stored hash ---

export async function verifyPin(wallet: any, pin: string): Promise<boolean> {
  if (!wallet.has_pin || !wallet.pin_hash) return false;
  const pinHash = await hashPin(pin);
  return timingSafeEqual(pinHash, wallet.pin_hash);
}