import { NextRequest, NextResponse } from 'next/server';

export interface LinkPreviewData {
  url: string;
  hostname: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string;
  siteName: string;
}

// In-memory server cache to ensure instantaneous responses for repeated link previews
const previewCache = new Map<string, { data: LinkPreviewData; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

/**
 * Clean and normalize candidate URL
 */
function normalizeUrl(raw: string): string | null {
  try {
    let clean = raw.trim();
    if (!/^https?:\/\//i.test(clean)) {
      clean = `https://${clean}`;
    }
    const parsed = new URL(clean);
    // Block private IP ranges and localhost to prevent SSRF
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Extracts a high-resolution favicon for any domain
 */
function getFaviconUrl(urlStr: string, parsedHtmlIcon?: string | null): string {
  try {
    const parsed = new URL(urlStr);
    if (parsedHtmlIcon) {
      if (/^https?:\/\//i.test(parsedHtmlIcon)) return parsedHtmlIcon;
      if (parsedHtmlIcon.startsWith('//')) return `https:${parsedHtmlIcon}`;
      if (parsedHtmlIcon.startsWith('/')) return `${parsed.origin}${parsedHtmlIcon}`;
      return `${parsed.origin}/${parsedHtmlIcon}`;
    }
    // High-res Google favicon service (128px) works for 99.9% of all web domains reliably
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=128`;
  } catch {
    return '/favicon.ico';
  }
}

/**
 * Intelligent metadata fallbacks for popular sites (even if they block scraping or return 403/captcha)
 */
function getSmartFallback(urlStr: string): LinkPreviewData {
  const parsed = new URL(urlStr);
  const hostname = parsed.hostname.replace(/^www\./i, '');
  const pathname = parsed.pathname;

  let siteName = hostname.split('.')[0];
  siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
  let title = `${siteName} — ${parsed.pathname === '/' ? 'Official Website' : parsed.pathname.replace(/^\//, '').replace(/[-_/]/g, ' ')}`;
  let description = `Explore content on ${hostname}. Click to visit the official page.`;
  let image: string | null = null;

  // YouTube
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    siteName = 'YouTube';
    let videoId: string | null = null;
    if (hostname.includes('youtu.be')) {
      videoId = pathname.replace(/^\//, '');
    } else {
      videoId = parsed.searchParams.get('v');
    }
    if (videoId) {
      title = 'Watch on YouTube';
      description = `YouTube video ID: ${videoId}`;
      image = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    } else {
      title = 'YouTube';
      description = 'Enjoy the videos and music you love, upload original content, and share it all with friends, family, and the world on YouTube.';
    }
  }

  // GitHub
  else if (hostname.includes('github.com')) {
    siteName = 'GitHub';
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      title = `${parts[0]}/${parts[1]}`;
      description = `View ${parts[0]}/${parts[1]} repository on GitHub. Code, issues, pull requests, and documentation.`;
      image = `https://opengraph.githubassets.com/1/${parts[0]}/${parts[1]}`;
    } else if (parts.length === 1) {
      title = `${parts[0]} on GitHub`;
      description = `View ${parts[0]}'s profile and repositories on GitHub.`;
    } else {
      title = 'GitHub: Let’s build from here';
      description = 'GitHub is where over 100 million developers shape the future of software, together.';
    }
  }

  // Wikipedia
  else if (hostname.includes('wikipedia.org')) {
    siteName = 'Wikipedia';
    const article = pathname.replace(/^\/wiki\//, '').replace(/_/g, ' ');
    if (article) {
      title = `${decodeURIComponent(article)} — Wikipedia`;
      description = `Free encyclopedia entry for ${decodeURIComponent(article)} on Wikipedia.`;
    }
  }

  // Twitter / X
  else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    siteName = 'X (formerly Twitter)';
    title = 'Post on X';
    description = 'From breaking news and entertainment to sports and politics, get the full story with all the live commentary.';
  }

  return {
    url: urlStr,
    hostname,
    title,
    description,
    image,
    favicon: getFaviconUrl(urlStr),
    siteName,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url query parameter' }, { status: 400 });
  }

  const validUrl = normalizeUrl(rawUrl);
  if (!validUrl) {
    return NextResponse.json({ error: 'Invalid or forbidden URL' }, { status: 400 });
  }

  // Check cache
  const cached = previewCache.get(validUrl);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const parsedUrl = new URL(validUrl);
  const hostname = parsedUrl.hostname.replace(/^www\./i, '');
  const fallback = getSmartFallback(validUrl);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(validUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; SarilingMundoBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 3600 },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      previewCache.set(validUrl, { data: fallback, timestamp: Date.now() });
      return NextResponse.json(fallback);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      previewCache.set(validUrl, { data: fallback, timestamp: Date.now() });
      return NextResponse.json(fallback);
    }

    // Read initial 75KB (enough for <head> where all meta tags live)
    const reader = response.body?.getReader();
    let htmlChunk = '';
    if (reader) {
      let bytesRead = 0;
      const decoder = new TextDecoder();
      while (bytesRead < 75000) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        bytesRead += value.length;
        htmlChunk += decoder.decode(value, { stream: true });
        if (htmlChunk.includes('</head>')) break;
      }
      try {
        reader.cancel();
      } catch {}
    } else {
      htmlChunk = await response.text();
    }

    // Parse Meta Tags via regex
    const getMeta = (prop: string): string | null => {
      // property="og:..." content="..." OR name="..." content="..."
      const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'),
      ];
      for (const pat of patterns) {
        const m = htmlChunk.match(pat);
        if (m && m[1]) {
          return decodeHtmlEntities(m[1].trim());
        }
      }
      return null;
    };

    const getTagContent = (tag: string): string | null => {
      const m = htmlChunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m && m[1] ? decodeHtmlEntities(m[1].trim()) : null;
    };

    // Favicon link tag
    let iconUrl: string | null = null;
    const iconMatch = htmlChunk.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']*)["']/i) ||
                      htmlChunk.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
    if (iconMatch && iconMatch[1]) {
      iconUrl = iconMatch[1];
    }

    const ogTitle = getMeta('og:title') || getMeta('twitter:title') || getTagContent('title');
    const ogDesc = getMeta('og:description') || getMeta('twitter:description') || getMeta('description');
    let ogImage = getMeta('og:image') || getMeta('twitter:image');
    const ogSite = getMeta('og:site_name');

    if (ogImage && !/^https?:\/\//i.test(ogImage)) {
      if (ogImage.startsWith('//')) {
        ogImage = `https:${ogImage}`;
      } else if (ogImage.startsWith('/')) {
        ogImage = `${parsedUrl.origin}${ogImage}`;
      } else {
        ogImage = `${parsedUrl.origin}/${ogImage}`;
      }
    }

    const result: LinkPreviewData = {
      url: validUrl,
      hostname,
      title: ogTitle || fallback.title,
      description: ogDesc || fallback.description,
      image: ogImage || fallback.image,
      favicon: getFaviconUrl(validUrl, iconUrl),
      siteName: ogSite || fallback.siteName,
    };

    previewCache.set(validUrl, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch {
    // If request timed out or network blocked, use high quality fallback
    previewCache.set(validUrl, { data: fallback, timestamp: Date.now() });
    return NextResponse.json(fallback);
  }
}

/**
 * Decode basic HTML entities for clean title & description display
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}
