// End-to-end encryption for direct messages using the Web Crypto API.
//
// Each user gets an ECDH (P-256) keypair. The private key lives only in the
// browser (IndexedDB); the public key is published to the DmPublicKey entity
// so conversation partners can fetch it. Messages are encrypted with AES-GCM
// using a shared secret derived via ECDH (my private + their public). Only the
// two participants can derive the same secret, so ciphertext is all that's
// stored in DirectMessage.body. Direct messages are never federated to a PDS.
//
// NOTE: private keys are device-local. Clearning IndexedDB or switching
// devices loses the ability to decrypt old messages (key backup/restore is a
// deferred data-portability task).

import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';

const DB_NAME = 'swappulse-e2ee';
const DB_VERSION = 1;
const STORE = 'keys';
const KEY_ID = 'private-key';
const PREFIX = 'e2ee:';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// In-flight singleton so concurrent first-use calls share one generation.
// Without this, two parallel callers (e.g. publishPublicKey on mount +
// sendDirectMessage) both see no stored key, each generates a different
// keypair, and the second write wins — leaving the published public key
// mismatched with the stored private key, so messages become undecryptable.
let _keyPairPromise = null;

// Get the user's ECDH keypair from IndexedDB, generating + storing a new one
// on first use. Returns { privateKey, publicKeyJwk }.
export async function getOrCreateKeyPair() {
  if (_keyPairPromise) return _keyPairPromise;
  _keyPairPromise = (async () => {
    const existing = await idbGet(KEY_ID).catch(() => null);
    if (existing) return existing;
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey'],
    );
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const entry = { privateKey: keyPair.privateKey, publicKeyJwk };
    await idbPut(KEY_ID, entry).catch(() => {});
    return entry;
  })();
  try {
    return await _keyPairPromise;
  } finally {
    _keyPairPromise = null;
  }
}

// Publish the current user's public key to the DmPublicKey entity (idempotent).
export async function publishPublicKey() {
  try {
    const { did } = await ensureUserDid();
    if (!did) return;
    const { publicKeyJwk } = await getOrCreateKeyPair();
    const public_key = JSON.stringify(publicKeyJwk);
    const existing = await base44.entities.DmPublicKey.filter({ did }, '-created_date', 1).catch(() => []);
    if (existing[0]) {
      if (existing[0].public_key !== public_key) {
        await base44.entities.DmPublicKey.update(existing[0].id, { public_key }).catch(() => {});
      }
      return;
    }
    await base44.entities.DmPublicKey.create({ did, public_key });
  } catch { /* Publishing failure is non-fatal here; sendDirectMessage still fails closed. */ }
}

// Fetch a user's published public key JWK by DID.
export async function fetchPublicKey(did) {
  if (!did) return null;
  try {
    const rows = await base44.entities.DmPublicKey.filter({ did }, '-created_date', 1);
    if (!rows[0]) return null;
    return JSON.parse(rows[0].public_key);
  } catch {
    return null;
  }
}

async function deriveSharedKey(privateKey, theirPublicJwk) {
  const imported = await crypto.subtle.importKey(
    'jwk',
    theirPublicJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: imported },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// Encrypt plaintext for a conversation partner. DMs fail closed: plaintext is
// never persisted or sent when an E2EE session cannot be established.
export async function encryptMessage(plaintext, myDid, theirDid) {
  const theirKey = await fetchPublicKey(theirDid);
  if (!theirKey) {
    throw new Error('This collector has not enabled encrypted messaging on a device yet. Ask them to open Messages, then try again.');
  }
  try {
    const { privateKey } = await getOrCreateKeyPair();
    const shared = await deriveSharedKey(privateKey, theirKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, shared, enc.encode(plaintext));
    return { body: `${PREFIX}${bufToBase64(iv.buffer)}:${bufToBase64(ct)}`, encrypted: true };
  } catch {
    throw new Error('Could not establish encrypted messaging. Nothing was sent.');
  }
}

// Decrypt a message body. Returns { text, encrypted, pending, failed }.
// Non-e2ee bodies pass through as plaintext (legacy compatibility).
export async function decryptMessage(body, myDid, theirDid) {
  if (!body || typeof body !== 'string' || !body.startsWith(PREFIX)) {
    return { text: body || '', encrypted: false };
  }
  try {
    const theirKey = await fetchPublicKey(theirDid);
    if (!theirKey) return { text: '🔒 Encrypted message', encrypted: true, pending: true };
    const { privateKey } = await getOrCreateKeyPair();
    const shared = await deriveSharedKey(privateKey, theirKey);
    const parts = body.split(':');
    const iv = base64ToBuf(parts[1]);
    const ct = base64ToBuf(parts[2]);
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, shared, ct);
    return { text: new TextDecoder().decode(dec), encrypted: true };
  } catch {
    return { text: '🔒 Unable to decrypt', encrypted: true, failed: true };
  }
}