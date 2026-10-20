/**
 * YouTube Utility: parsing, validation, and embedding.
 * Supports standard watch, youtu.be, shorts, and embed URLs with timestamp preservation.
 */

export interface ParsedYouTube {
  videoId: string;
  startTime: number;
  originalUrl: string;
  embedUrl: string;
  watchUrl: string;
}

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/**
 * Parses timestamp string into seconds.
 * Supports "120", "120s", "2m15s", "1h2m3s", "90s".
 */
export function parseYouTubeTimestamp(raw?: string | null): number {
  if (!raw) return 0;
  const str = raw.trim().toLowerCase();

  // Pure digits: "120"
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  // Combined time: e.g. "1h2m3s", "2m15s", "45s"
  let total = 0;
  const hours = str.match(/(\d+)\s*h/);
  const minutes = str.match(/(\d+)\s*m/);
  const seconds = str.match(/(\d+)\s*s/);

  if (hours) total += parseInt(hours[1], 10) * 3600;
  if (minutes) total += parseInt(minutes[1], 10) * 60;
  if (seconds) total += parseInt(seconds[1], 10);

  return total > 0 ? total : 0;
}

/**
 * Extracts YouTube video ID and start time from an input URL string.
 * Returns ParsedYouTube or null if not a valid YouTube URL.
 */
export function parseYouTubeUrl(input: string): ParsedYouTube | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length < 5) return null;

  let urlStr = trimmed;
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = `https://${urlStr}`;
  }

  let urlObj: URL;
  try {
    urlObj = new URL(urlStr);
  } catch {
    return null;
  }

  const hostname = urlObj.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    return null;
  }

  let videoId: string | null = null;
  let startTime = 0;

  // Check query params for timestamp: 't' or 'start'
  const tParam = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
  if (tParam) {
    startTime = parseYouTubeTimestamp(tParam);
  }

  // 1. youtu.be/VIDEO_ID
  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    const pathPart = urlObj.pathname.slice(1).split('/')[0];
    if (pathPart && /^[\w-]{11}$/.test(pathPart)) {
      videoId = pathPart;
    }
  }
  // 2. youtube.com/shorts/VIDEO_ID
  else if (urlObj.pathname.startsWith('/shorts/')) {
    const pathPart = urlObj.pathname.replace('/shorts/', '').split('/')[0];
    if (pathPart && /^[\w-]{11}$/.test(pathPart)) {
      videoId = pathPart;
    }
  }
  // 3. youtube.com/embed/VIDEO_ID
  else if (urlObj.pathname.startsWith('/embed/')) {
    const pathPart = urlObj.pathname.replace('/embed/', '').split('/')[0];
    if (pathPart && /^[\w-]{11}$/.test(pathPart)) {
      videoId = pathPart;
    }
  }
  // 4. youtube.com/watch?v=VIDEO_ID
  else if (urlObj.searchParams.has('v')) {
    const v = urlObj.searchParams.get('v');
    if (v && /^[\w-]{11}$/.test(v)) {
      videoId = v;
    }
  }

  if (!videoId) return null;

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?start=${startTime}&enablejsapi=1`;
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}${startTime > 0 ? `&t=${startTime}s` : ''}`;

  return {
    videoId,
    startTime,
    originalUrl: trimmed,
    embedUrl,
    watchUrl,
  };
}

/**
 * Checks if a string is a standalone YouTube URL.
 */
export function isStandaloneYouTubeUrl(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  // No whitespace inside the URL
  if (/\s/.test(trimmed)) return false;
  return parseYouTubeUrl(trimmed) !== null;
}

/**
 * Formats seconds into mm:ss or hh:mm:ss.
 * E.g., 265 -> "04:25", 3665 -> "1:01:05"
 */
export function formatSecondsToTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Parses timestamp string into seconds.
 * Matches: "04:25", "1:02:15", "[04:25]", "[1:02:15]".
 */
export function parseTimestampStringToSeconds(str: string): number | null {
  if (!str) return null;
  const clean = str.replace(/[\[\]\(\)]/g, '').trim();

  // Match hh:mm:ss or mm:ss
  const parts = clean.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;

  if (parts.length === 2) {
    // mm:ss
    const [mins, secs] = parts;
    return mins * 60 + secs;
  }
  if (parts.length === 3) {
    // hh:mm:ss
    const [hrs, mins, secs] = parts;
    return hrs * 3600 + mins * 60 + secs;
  }
  return null;
}

/**
 * Extracts all timestamp markers from text / HTML notes.
 * Matches patterns like [04:25], (04:25), or standalone timestamps.
 */
export function extractTimestampMarkers(content: string): Array<{ seconds: number; label: string }> {
  if (!content) return [];
  const regex = /\[?(\b(?:\d{1,2}:)?\d{2}:\d{2}\b)\]?/g;
  const markers: Array<{ seconds: number; label: string }> = [];
  const seen = new Set<number>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const raw = match[1];
    const sec = parseTimestampStringToSeconds(raw);
    if (sec !== null && sec > 0 && !seen.has(sec)) {
      seen.add(sec);
      markers.push({ seconds: sec, label: raw });
    }
  }

  return markers.sort((a, b) => a.seconds - b.seconds);
}

export interface VideoProgressRecord {
  videoId: string;
  currentTime: number;
  duration: number;
  progressPct: number;
  isCompleted: boolean;
  lastWatched: number;
}

const STORAGE_KEY_PREFIX = 'lifeos_video_progress_';

/**
 * Retrieves saved video progress from localStorage.
 */
export function getVideoProgress(videoId: string): VideoProgressRecord | null {
  if (typeof window === 'undefined' || !videoId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${videoId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Persists video progress in localStorage.
 */
export function saveVideoProgress(
  videoId: string,
  data: { currentTime: number; duration: number; isCompleted?: boolean }
): void {
  if (typeof window === 'undefined' || !videoId) return;
  try {
    const duration = Math.max(0, data.duration || 0);
    const currentTime = Math.max(0, data.currentTime || 0);
    const progressPct = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
    const isCompleted = data.isCompleted ?? (progressPct >= 90);

    const record: VideoProgressRecord = {
      videoId,
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration),
      progressPct,
      isCompleted,
      lastWatched: Date.now(),
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${videoId}`, JSON.stringify(record));
  } catch {
    // Storage quota or private browsing safe
  }
}
