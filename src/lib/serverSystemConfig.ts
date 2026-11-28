import { FIREBASE_CLIENT_CONFIG } from './firebaseConfig';
import {
  DEFAULT_SYSTEM_CONFIG,
  sanitizeSystemConfig,
  type SystemConfig,
} from './systemConfig';

interface FirestoreValue {
  booleanValue?: boolean;
  stringValue?: string;
  integerValue?: string | number;
  doubleValue?: number;
}

const SERVER_CONFIG_TTL_MS = 15_000;

let cachedConfig: { value: SystemConfig; fetchedAt: number; source: 'firestore' | 'fallback' } | null = null;

function decodeFirestoreFields(fields: Record<string, FirestoreValue> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    if (!v || typeof v !== 'object') continue;
    if ('booleanValue' in v) out[k] = Boolean(v.booleanValue);
    else if ('stringValue' in v) out[k] = String(v.stringValue ?? '');
    else if ('integerValue' in v) out[k] = Number(v.integerValue);
    else if ('doubleValue' in v) out[k] = Number(v.doubleValue);
  }
  return out;
}

export function invalidateServerSystemConfigCache() {
  cachedConfig = null;
}

export function getServerSystemConfigMeta() {
  if (!cachedConfig) {
    return { cached: false, source: 'none' as const, ageMs: 0 };
  }
  return {
    cached: true,
    source: cachedConfig.source,
    ageMs: Math.max(0, Date.now() - cachedConfig.fetchedAt),
  };
}

/**
 * Server-side reader for `app/systemConfig` via Firestore REST (with 15s cache)
 * so feature flags & AI/link-preview kill-switches are enforced at API boundaries.
 */
export async function getServerSystemConfig(forceRefresh = false): Promise<SystemConfig> {
  if (!forceRefresh && cachedConfig && Date.now() - cachedConfig.fetchedAt < SERVER_CONFIG_TTL_MS) {
    return cachedConfig.value;
  }

  const projectId = FIREBASE_CLIENT_CONFIG.projectId;
  if (!projectId) {
    const fallback = { ...DEFAULT_SYSTEM_CONFIG };
    cachedConfig = { value: fallback, fetchedAt: Date.now(), source: 'fallback' };
    return fallback;
  }

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/(default)/documents/app/systemConfig`;
    const resp = await fetch(endpoint, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });

    if (!resp.ok) {
      const fallback = cachedConfig?.value ?? { ...DEFAULT_SYSTEM_CONFIG };
      cachedConfig = { value: fallback, fetchedAt: Date.now(), source: 'fallback' };
      return fallback;
    }

    const raw = (await resp.json()) as { fields?: Record<string, FirestoreValue> };
    const decoded = decodeFirestoreFields(raw.fields);
    const sanitized = sanitizeSystemConfig(decoded);
    cachedConfig = { value: sanitized, fetchedAt: Date.now(), source: 'firestore' };
    return sanitized;
  } catch {
    const fallback = cachedConfig?.value ?? { ...DEFAULT_SYSTEM_CONFIG };
    cachedConfig = { value: fallback, fetchedAt: Date.now(), source: 'fallback' };
    return fallback;
  }
}
