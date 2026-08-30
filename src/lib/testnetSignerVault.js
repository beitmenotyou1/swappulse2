import { getStarkKey, sign, utils as starkUtils } from '@scure/starknet';

const DB_NAME = 'swappulse-testnet-signer-v1';
const DB_VERSION = 1;
const STORE = 'signers';
const VAULT_VERSION = 1;
const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;

// The device key must only ever sign a well-formed Starknet transaction hash.
// Without this guard a malformed or non-hash value is stringified and signed
// anyway, producing a signature over garbage.
function assertTransactionHash(messageHash) {
  const raw = String(messageHash ?? '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{1,64}$/.test(raw)) {
    throw new Error('Refusing to sign: value is not a Starknet transaction hash.');
  }
  const value = BigInt(raw);
  if (value <= 0n || value >= STARK_FIELD_PRIME) {
    throw new Error('Refusing to sign: hash is outside the Starknet field.');
  }
  return `0x${value.toString(16)}`;
}

function requireBrowserCrypto() {
  if (typeof window === 'undefined' || !window.indexedDB || !window.crypto?.subtle) {
    throw new Error('Secure device key storage is not available in this browser.');
  }
}

function openDb() {
  requireBrowserCrypto();
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'userId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open device signer vault.'));
  });
}

async function withStore(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let request;
      try {
        request = action(store);
      } catch (error) {
        reject(error);
        return;
      }
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Device signer vault operation failed.'));
      tx.onabort = () => reject(tx.error || new Error('Device signer vault transaction was aborted.'));
    });
  } finally {
    db.close();
  }
}

async function getRecord(userId) {
  if (!userId) return null;
  return withStore('readonly', (store) => store.get(String(userId)));
}

function publicMetadata(record) {
  if (!record) return null;
  return {
    exists: true,
    publicKey: String(record.publicKey || ''),
    createdAt: String(record.createdAt || ''),
    vaultVersion: Number(record.vaultVersion || 0),
    signerVersion: String(record.signerVersion || 'STARK_V1'),
  };
}

export async function getDeviceTestSigner(userId) {
  return publicMetadata(await getRecord(userId));
}

export async function createDeviceTestSigner(userId) {
  requireBrowserCrypto();
  if (!window.isSecureContext) throw new Error('Device signer setup requires a secure HTTPS context.');
  if (!userId) throw new Error('Sign in before creating a device signer.');

  const existing = await getRecord(userId);
  if (existing) return publicMetadata(existing);

  const privateKey = starkUtils.randomPrivateKey();
  try {
    const publicKey = getStarkKey(privateKey);
    const encryptionKey = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, privateKey);
    const record = {
      userId: String(userId),
      publicKey,
      signerVersion: 'STARK_V1',
      vaultVersion: VAULT_VERSION,
      createdAt: new Date().toISOString(),
      encryptionKey,
      iv,
      ciphertext,
    };
    await withStore('readwrite', (store) => store.add(record));
    return publicMetadata(record);
  } catch (error) {
    throw new Error(error?.message || 'Could not create the device test signer.');
  } finally {
    privateKey.fill(0);
  }
}

export async function signTestnetHash(userId, messageHash) {
  requireBrowserCrypto();
  const safeHash = assertTransactionHash(messageHash);
  const record = await getRecord(userId);
  if (!record) throw new Error('No device test signer exists for this account.');
  if (Number(record.vaultVersion) !== VAULT_VERSION) throw new Error('Unsupported device signer vault version.');
  if (!record.encryptionKey || !record.iv || !record.ciphertext) throw new Error('Device signer vault is incomplete.');

  const plaintext = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: record.iv },
    record.encryptionKey,
    record.ciphertext,
  );
  const privateKey = new Uint8Array(plaintext);
  try {
    const signature = sign(safeHash, privateKey);
    return { r: `0x${signature.r.toString(16)}`, s: `0x${signature.s.toString(16)}` };
  } finally {
    privateKey.fill(0);
  }
}

export async function deleteDeviceTestSigner(userId) {
  if (!userId) return;
  await withStore('readwrite', (store) => store.delete(String(userId)));
}