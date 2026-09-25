import { collection, doc, getDocs, setDoc, writeBatch, deleteDoc, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { readUpdateMeta, touchUpdateMeta } from './localStore';

const PREFIX = 'life_os_';
const rawSetItem = typeof Storage !== 'undefined' ? Storage.prototype.setItem : undefined;
const rawRemoveItem = typeof Storage !== 'undefined' ? Storage.prototype.removeItem : undefined;
const rawClear = typeof Storage !== 'undefined' ? Storage.prototype.clear : undefined;

let activeUid: string | null = null;
let pending = new Map<string, string>();
let pendingDeletions = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let patched = false;
let unsubscribeSnapshot: (() => void) | null = null;

function kvRef(uid: string, key: string) {
  return doc(getFirebaseDb(), 'users', uid, 'kv', key);
}

function snapshotLocal(): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (typeof localStorage === 'undefined') return rows;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) rows.push([key, value]);
  }
  return rows;
}

export async function flushCloudNow(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!activeUid) return;
  if (pending.size === 0 && pendingDeletions.size === 0) return;

  const uid = activeUid;
  const db = getFirebaseDb();
  
  const entriesToSet = Array.from(pending.entries());
  pending = new Map();

  const entriesToDelete = Array.from(pendingDeletions);
  pendingDeletions = new Set();

  try {
    // Commit updates/creations
    for (let i = 0; i < entriesToSet.length; i += 400) {
      const chunk = entriesToSet.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach(([key, value]) => {
        const updatedAt = Date.now();
        batch.set(kvRef(uid, key), { v: value, updatedAt });
      });
      await batch.commit();
    }

    // Commit key deletions
    for (let i = 0; i < entriesToDelete.length; i += 400) {
      const chunk = entriesToDelete.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((key) => {
        batch.delete(kvRef(uid, key));
      });
      await batch.commit();
    }
  } catch (err) {
    // If flush fails, re-queue the entries so they retry on next flush
    console.warn('[LifeOS] Cloud flush failed, will retry:', err);
    entriesToSet.forEach(([k, v]) => pending.set(k, v));
    entriesToDelete.forEach((k) => pendingDeletions.add(k));
    scheduleFlush();
  }
}

function scheduleFlush() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void flushCloudNow();
  }, 150);
}

function patchLocalStorage() {
  if (patched || !rawSetItem) return;
  patched = true;

  Storage.prototype.setItem = function patchedSetItem(key: string, value: string) {
    rawSetItem.call(this, key, value);
    if (this === localStorage && key.startsWith(PREFIX) && key !== 'life_os_kv_updated_v1' && key !== 'life_os_active_uid' && activeUid) {
      touchUpdateMeta(key);
      pendingDeletions.delete(key);
      pending.set(key, value);
      scheduleFlush();
      // Notify UI that a write is in progress so sync indicator can show
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('life_os_writing'));
      }
    }
  };

  if (rawRemoveItem) {
    Storage.prototype.removeItem = function patchedRemoveItem(key: string) {
      rawRemoveItem.call(this, key);
      if (this === localStorage && key.startsWith(PREFIX) && key !== 'life_os_kv_updated_v1' && key !== 'life_os_active_uid' && activeUid) {
        pending.delete(key);
        pendingDeletions.add(key);
        scheduleFlush();
      }
    };
  }

  if (rawClear) {
    Storage.prototype.clear = function patchedClear() {
      if (this === localStorage && activeUid) {
        const local = snapshotLocal();
        local.forEach(([k]) => {
          if (k !== 'life_os_kv_updated_v1' && k !== 'life_os_active_uid') {
            pending.delete(k);
            pendingDeletions.add(k);
          }
        });
        scheduleFlush();
      }
      rawClear.call(this);
    };
  }
}

/**
 * Hydrates local storage from Firestore.
 * If Firestore already has user data, syncs the cloud state to localStorage.
 */
export async function hydrateFromCloud(uid: string): Promise<void> {
  // Check if last active user was different to isolate user data
  if (typeof localStorage !== 'undefined') {
    const lastUid = localStorage.getItem('life_os_active_uid');
    if (lastUid && lastUid !== uid) {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX) && k !== 'life_os_sidebar_collapsed') {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => {
        if (rawRemoveItem) rawRemoveItem.call(localStorage, k);
        else localStorage.removeItem(k);
      });
    }
    if (rawSetItem) rawSetItem.call(localStorage, 'life_os_active_uid', uid);
    else localStorage.setItem('life_os_active_uid', uid);
  }

  const fetchDocsPromise = getDocs(collection(getFirebaseDb(), 'users', uid, 'kv'));
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
  
  const snap = await Promise.race([fetchDocsPromise, timeoutPromise]);
  if (!snap) {
    activeUid = uid;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('life_os_cloud_synced'));
    }
    return;
  }

  const meta = readUpdateMeta();

  if (!snap.empty) {
    snap.forEach((item) => {
      const value = item.data().v;
      if (typeof value !== 'string') return;
      const cloudAt = Number(item.data().updatedAt) || 0;
      const localValue = localStorage.getItem(item.id);
      const localAt = meta[item.id] || 0;

      // Cloud data wins on hydration unless local has a pending uncommitted write that is strictly newer
      if (localValue === null || cloudAt >= localAt || !pending.has(item.id)) {
        if (rawSetItem) rawSetItem.call(localStorage, item.id, value);
        touchUpdateMeta(item.id, cloudAt || Date.now());
      }
    });
  }

  activeUid = uid;
  if (pending.size > 0 || pendingDeletions.size > 0) {
    await flushCloudNow();
  }

  // Notify all components that cloud data is loaded
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('life_os_cloud_synced'));
  }
}

export function startCloudSync(uid: string) {
  if (activeUid === uid && unsubscribeSnapshot) {
    return;
  }

  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  activeUid = uid;
  patchLocalStorage();

  // Attach real-time Firestore listener so changes on other devices sync instantly
  try {
    const db = getFirebaseDb();
    const kvCollection = collection(db, 'users', uid, 'kv');
    
    unsubscribeSnapshot = onSnapshot(
      kvCollection,
      (snap) => {
        let hasChanges = false;
        const meta = readUpdateMeta();

        snap.docChanges().forEach((change) => {
          const key = change.doc.id;
          if (!key.startsWith(PREFIX) || key === 'life_os_kv_updated_v1' || key === 'life_os_active_uid') {
            return;
          }

          if (change.type === 'removed') {
            if (!pending.has(key) && !pendingDeletions.has(key)) {
              if (typeof localStorage !== 'undefined' && localStorage.getItem(key) !== null) {
                if (rawRemoveItem) rawRemoveItem.call(localStorage, key);
                else localStorage.removeItem(key);
                hasChanges = true;
              }
            }
          } else if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            const cloudVal = data?.v;
            const cloudAt = Number(data?.updatedAt) || 0;

            if (typeof cloudVal !== 'string') return;
            if (pending.has(key)) return; // Skip if we have an un-flushed local edit

            const localVal = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
            const localAt = meta[key] || 0;

            if (localVal === null || localVal !== cloudVal) {
              if (cloudAt >= localAt || localVal === null) {
                if (rawSetItem) rawSetItem.call(localStorage, key, cloudVal);
                else localStorage.setItem(key, cloudVal);
                touchUpdateMeta(key, cloudAt || Date.now());
                hasChanges = true;
              }
            }
          }
        });

        if (hasChanges && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('life_os_cloud_synced'));
        }
      },
      (err) => {
        console.warn('[LifeOS] Realtime sync listener warning:', err);
      }
    );
  } catch (err) {
    console.warn('[LifeOS] Could not start realtime sync listener:', err);
  }

  if (typeof window === 'undefined' || (window as Window & { __lifeOsFlushBound?: boolean }).__lifeOsFlushBound) {
    return;
  }
  (window as Window & { __lifeOsFlushBound?: boolean }).__lifeOsFlushBound = true;
  const flush = () => {
    void flushCloudNow();
  };
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export async function stopCloudSync() {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  await flushCloudNow();
  activeUid = null;
}

export async function wipeCloudKv(uid: string) {
  const snap = await getDocs(collection(getFirebaseDb(), 'users', uid, 'kv'));
  await Promise.all(snap.docs.map((item) => deleteDoc(item.ref)));
}
