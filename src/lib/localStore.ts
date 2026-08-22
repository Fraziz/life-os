export const CLOUD_SYNC_EVENT = 'life_os_cloud_synced';
const META_KEY = 'life_os_kv_updated_v1';

export function loadJsonArray<T>(key: string): T[] | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadJsonObject<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function readUpdateMeta(): Record<string, number> {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function touchUpdateMeta(key: string, at = Date.now()) {
  const meta = readUpdateMeta();
  meta[key] = at;
  rawSet(META_KEY, JSON.stringify(meta));
}

function rawSet(key: string, value: string) {
  const proto = Storage.prototype.setItem;
  proto.call(localStorage, key, value);
}
