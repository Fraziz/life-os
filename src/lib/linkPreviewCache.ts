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

export function clearPreviewCache(): number {
  const count = previewCache.size;
  previewCache.clear();
  return count;
}
