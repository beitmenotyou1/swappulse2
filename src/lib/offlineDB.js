// IndexedDB offline cache - §8 Layer 2 catalog data cache + outbox for sync.
const DB_NAME = 'swappulse';
const DB_VERSION = 1;
const STORES = ['catalog', 'outbox', 'shares'];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function store(name, mode) {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export async function idbGet(name, key) {
  const os = await store(name, 'readonly');
  return new Promise((res) => {
    const r = os.get(key);
    r.onsuccess = () => res(r.result ? r.result.value : undefined);
    r.onerror = () => res(undefined);
  });
}

export async function idbGetAll(name) {
  const os = await store(name, 'readonly');
  return new Promise((res) => {
    const r = os.getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => res([]);
  });
}

export async function idbPut(name, key, value) {
  const os = await store(name, 'readwrite');
  return new Promise((res, rej) => {
    const r = os.put({ key, value, ts: Date.now() });
    r.onsuccess = () => res(value);
    r.onerror = () => rej(r.error);
  });
}

export async function idbDelete(name, key) {
  const os = await store(name, 'readwrite');
  return new Promise((res) => {
    const r = os.delete(key);
    r.onsuccess = () => res();
    r.onerror = () => res();
  });
}

export async function idbClear(name) {
  const os = await store(name, 'readwrite');
  return new Promise((res) => {
    const r = os.clear();
    r.onsuccess = () => res();
    r.onerror = () => res();
  });
}