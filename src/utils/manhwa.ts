/**
 * Manhwa / Webtoon Reader Utilities for Life OS
 * Supports popular scanlation sites (Asura Scans, RoliaScan, Vortex Scans, Reaper Scans, etc.)
 * Provides metadata parsing, URL normalization, chapter navigation stepper, and in-web reading support.
 */

export interface ParsedManhwaInfo {
  url: string;
  domain: string;
  siteName: string;
  titleHint: string;
  chapterHint?: string;
  chapterNumber?: number;
}

const KNOWN_MANHWA_SITES: Record<string, string> = {
  'asuracomic.net': 'Asura Scans',
  'asurascans.com': 'Asura Scans',
  'asura.gg': 'Asura Scans',
  'roliascan.com': 'RoliaScan',
  'rolia.io': 'RoliaScan',
  'vortexscans.org': 'Vortex Scans',
  'vortexscans.com': 'Vortex Scans',
  'reaperscans.com': 'Reaper Scans',
  'flamecomics.xyz': 'Flame Comics',
  'flamecomics.me': 'Flame Comics',
  'flamescans.org': 'Flame Comics',
  'mangadex.org': 'MangaDex',
  'webtoons.com': 'WEBTOON',
  'manhwatop.com': 'ManhwaTop',
  'manhuaplus.org': 'ManhuaPlus',
  'manganato.com': 'Manganato',
  'tapas.io': 'Tapas',
  'zero-scans.com': 'Zero Scans',
  'luminousscans.gg': 'Luminous Scans',
  'void-scans.com': 'Hive Toons',
};

/**
 * Checks if a given URL is likely a manhwa/manga/webtoon website
 */
export function isManhwaUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // Check against known scanlation domains
    for (const domain of Object.keys(KNOWN_MANHWA_SITES)) {
      if (host === domain || host.endsWith(`.${domain}`)) return true;
    }

    // Check URL pattern keywords
    const full = (host + parsed.pathname).toLowerCase();
    if (
      full.includes('manhwa') ||
      full.includes('webtoon') ||
      full.includes('manhua') ||
      full.includes('scan') ||
      full.includes('manga') ||
      full.includes('rolia') ||
      full.includes('vortex') ||
      full.includes('asura')
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Parses a manhwa URL to extract site name, title hint, and chapter
 */
export function parseManhwaUrl(rawUrl: string): ParsedManhwaInfo | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let clean = rawUrl.trim();
  if (!/^https?:\/\//i.test(clean)) {
    clean = `https://${clean}`;
  }

  try {
    const parsed = new URL(clean);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    let siteName = '';
    for (const [dom, name] of Object.entries(KNOWN_MANHWA_SITES)) {
      if (host === dom || host.endsWith(`.${dom}`)) {
        siteName = name;
        break;
      }
    }

    if (!siteName) {
      // Derive readable site name from hostname (e.g. roliascan -> Roliascan)
      const base = host.split('.')[0] || 'Webtoon';
      siteName = base.charAt(0).toUpperCase() + base.slice(1);
    }

    // Extract title & chapter from pathname
    // e.g. /series/return-of-the-mount-hua-sect-chapter-112/
    // e.g. /manga/solo-leveling/chapter-45/
    const segments = parsed.pathname.split('/').filter(Boolean);
    let titleHint = '';
    let chapterHint = '';
    let chapterNumber: number | undefined = undefined;

    // Look for chapter in segments
    for (const seg of segments) {
      const chMatch = seg.match(/(?:chapter|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)/i);
      if (chMatch) {
        chapterNumber = parseFloat(chMatch[1]);
        chapterHint = `Chapter ${chMatch[1]}`;
        break;
      }
    }

    // If chapter wasn't in path segments, check query params
    if (!chapterHint) {
      const qChapter = parsed.searchParams.get('chapter') || parsed.searchParams.get('ch');
      if (qChapter) {
        chapterNumber = parseFloat(qChapter);
        chapterHint = `Chapter ${qChapter}`;
      }
    }

    // Extract title from appropriate segment
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (['series', 'manga', 'manhwa', 'comic', 'webtoon', 'read'].includes(s.toLowerCase())) {
        // Next segment is usually title
        if (segments[i + 1]) {
          const rawSlug = segments[i + 1]
            .replace(/(?:-|_)?(?:chapter|ch|episode|ep)[-_]?\d+(?:\.\d+)?/i, '')
            .replace(/[-_]/g, ' ')
            .trim();
          if (rawSlug) {
            titleHint = toTitleCase(rawSlug);
          }
        }
        break;
      }
    }

    if (!titleHint && segments.length > 0) {
      const mainSeg = segments[0]
        .replace(/(?:-|_)?(?:chapter|ch|episode|ep)[-_]?\d+(?:\.\d+)?/i, '')
        .replace(/[-_]/g, ' ')
        .trim();
      if (mainSeg) {
        titleHint = toTitleCase(mainSeg);
      }
    }

    if (!titleHint) {
      titleHint = `${siteName} Reading`;
    }

    return {
      url: parsed.href,
      domain: host,
      siteName,
      titleHint,
      chapterHint: chapterHint || undefined,
      chapterNumber,
    };
  } catch {
    return null;
  }
}

function toTitleCase(str: string): string {
  return str
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Checks if a document item is a Manhwa reading document
 */
export function isDocManhwa(doc: {
  docType?: string;
  tags?: string[];
  manhwaUrl?: string;
  category?: string;
} | null | undefined): boolean {
  if (!doc) return false;
  if (doc.docType === 'manhwa') return true;
  if (Boolean(doc.manhwaUrl)) return true;
  if (Array.isArray(doc.tags) && doc.tags.some((t) => {
    const l = (t || '').toLowerCase();
    return l === 'manhwa' || l === 'manga' || l === 'manhua' || l === 'webtoon';
  })) {
    return true;
  }
  return false;
}

/**
 * Calculates next or previous chapter URL by incrementing/decrementing chapter number in URL
 */
export function shiftChapterUrl(currentUrl: string, delta: number): { nextUrl: string; nextChapter: string } | null {
  if (!currentUrl) return null;
  try {
    const parsed = new URL(currentUrl);

    // 1. Try matching chapter pattern in pathname: e.g. chapter-45 or ch-45
    const chRegex = /((?:chapter|ch|episode|ep)[-_]?)(\d+)(\b|[-_/]|$)/i;
    const match = parsed.pathname.match(chRegex);
    if (match) {
      const prefix = match[1];
      const curNum = parseInt(match[2], 10);
      const nextNum = Math.max(1, curNum + delta);
      const suffix = match[3] || '';
      parsed.pathname = parsed.pathname.replace(chRegex, `${prefix}${nextNum}${suffix}`);
      return {
        nextUrl: parsed.href,
        nextChapter: `Chapter ${nextNum}`,
      };
    }

    // 2. Try matching query parameter
    const qCh = parsed.searchParams.get('chapter') || parsed.searchParams.get('ch');
    if (qCh) {
      const curNum = parseInt(qCh, 10);
      const nextNum = Math.max(1, curNum + delta);
      parsed.searchParams.set(parsed.searchParams.has('chapter') ? 'chapter' : 'ch', String(nextNum));
      return {
        nextUrl: parsed.href,
        nextChapter: `Chapter ${nextNum}`,
      };
    }

    // 3. Fallback: match trailing number in pathname: e.g. /series/solo-leveling/45/
    const numRegex = /\/(\d+)(\/?)$/;
    const numMatch = parsed.pathname.match(numRegex);
    if (numMatch) {
      const curNum = parseInt(numMatch[1], 10);
      const nextNum = Math.max(1, curNum + delta);
      parsed.pathname = parsed.pathname.replace(numRegex, `/${nextNum}${numMatch[2]}`);
      return {
        nextUrl: parsed.href,
        nextChapter: `Chapter ${nextNum}`,
      };
    }
  } catch {
    return null;
  }
  return null;
}
