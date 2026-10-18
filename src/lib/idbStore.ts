/**
 * Lightweight native IndexedDB key-value storage for Life OS.
 * Solves browser localStorage 5MB quota limits for large knowledge books,
 * PDFs, reading documents, and offline cached assets.
 */

const DB_NAME = 'life_os_indexeddb_v1';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in browser'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('[LifeOS IDB] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };
    } catch (err) {
      console.warn('[LifeOS IDB] IndexedDB initialization error:', err);
      reject(err);
    }
  });

  return dbPromise;
}

export async function idbGet<T = unknown>(key: string): Promise<T | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await getDb();
    return await new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function idbSet<T = unknown>(key: string, value: T): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.warn('[LifeOS IDB] idbSet failed for key:', key, err);
  }
}

export async function idbDelete(key: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await getDb();
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    /* noop */
  }
}
