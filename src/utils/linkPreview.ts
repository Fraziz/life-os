'use client';

export interface LinkPreviewData {
  url: string;
  hostname: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string;
  siteName: string;
}

const clientCache = new Map<string, Promise<LinkPreviewData>>();

/**
 * Fetch rich metadata for any URL via the server-side API route.
 * Bypasses CORS and utilizes multi-layer in-memory caching.
 */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreviewData> {
  const clean = rawUrl.trim();
  if (clientCache.has(clean)) {
    return clientCache.get(clean)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(clean)}`);
      if (!res.ok) {
        return createFallback(clean);
      }
      const data: LinkPreviewData = await res.json();
      return data;
    } catch {
      return createFallback(clean);
    }
  })();

  clientCache.set(clean, promise);
  return promise;
}

function createFallback(url: string): LinkPreviewData {
  try {
    const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const parsed = new URL(full);
    const host = parsed.hostname.replace(/^www\./i, '');
    let name = host.split('.')[0];
    name = name.charAt(0).toUpperCase() + name.slice(1);
    return {
      url: full,
      hostname: host,
      title: `${name} — ${parsed.pathname === '/' ? 'Official Website' : parsed.pathname.replace(/^\//, '').replace(/[-_/]/g, ' ')}`,
      description: `Visit ${host} in a new tab.`,
      image: null,
      favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
      siteName: name,
    };
  } catch {
    return {
      url,
      hostname: 'website',
      title: url,
      description: 'External link',
      image: null,
      favicon: '/favicon.ico',
      siteName: 'Web Link',
    };
  }
}
