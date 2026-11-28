export interface LinkPreviewData {
  url: string;
  hostname: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string;
  siteName: string;
}

const previewCache = new Map<string, { data: LinkPreviewData; timestamp: number }>();
export const LINK_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const MAX_PREVIEW_CACHE_ENTRIES = 500;

export function getCachedPreview(key: string): LinkPreviewData | null {
  const cached = previewCache.get(key);
  if (cached && Date.now() - cached.timestamp < LINK_CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

export function setPreviewCache(key: string, data: LinkPreviewData) {
  if (previewCache.size >= MAX_PREVIEW_CACHE_ENTRIES) {
    const oldestKey = previewCache.keys().next().value;
    if (oldestKey) previewCache.delete(oldestKey);
  }
  previewCache.set(key, { data, timestamp: Date.now() });
}

export function getPreviewCacheStats() {
  return {
    entries: previewCache.size,
    maxEntries: MAX_PREVIEW_CACHE_ENTRIES,
  };
}

export function getPreviewCacheSampleHosts(limit = 8): string[] {
  const counts = new Map<string, number>();
  const now = Date.now();
  for (const record of previewCache.values()) {
    if (now - record.timestamp >= LINK_CACHE_TTL_MS) continue;
    const host = record.data.hostname || 'unknown';
    counts.set(host, (counts.get(host) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, limit))
    .map(([host, n]) => (n > 1 ? `${host} (${n})` : host));
}

export function clearPreviewCache(): number {
  const count = previewCache.size;
  previewCache.clear();
  return count;
}
