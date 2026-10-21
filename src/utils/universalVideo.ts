/**
 * Universal Video Link Parser & Embed Resolver for Life OS
 * Supports: YouTube, TikTok, Instagram, X (Twitter), Telegram, Facebook, Vimeo, Direct MP4/WebM files, and Web Links.
 */

export type VideoPlatform =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'x'
  | 'telegram'
  | 'facebook'
  | 'vimeo'
  | 'direct'
  | 'custom';

export interface ParsedVideoInfo {
  originalUrl: string;
  platform: VideoPlatform;
  platformName: string;
  videoId: string;
  embedUrl: string | null;
  aspectRatio: '16/9' | '9/16' | '1/1';
  canEmbedDirectly: boolean;
  cleanExternalUrl: string;
  titleHint?: string;
  startTime: number;
}

/**
 * Parses timestamps like 1h20m30s, 90s, or 120 into seconds.
 */
export function parseVideoTimestamp(raw?: string | null): number {
  if (!raw) return 0;
  const str = raw.trim().toLowerCase();

  const hmsMatch = str.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
    const hours = parseInt(hmsMatch[1] || '0', 10);
    const minutes = parseInt(hmsMatch[2] || '0', 10);
    const seconds = parseInt(hmsMatch[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  const plainNum = parseInt(str, 10);
  return isNaN(plainNum) ? 0 : Math.max(0, plainNum);
}

/**
 * Universal video parser that supports all major video platforms and direct files.
 */
export function parseUniversalVideoUrl(rawUrl: string): ParsedVideoInfo | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;

  // 1. YouTube & YouTube Shorts
  const ytRegex = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
  const ytMatch = trimmed.match(ytRegex);
  if (ytMatch) {
    const videoId = ytMatch[1];
    const isShorts = trimmed.includes('/shorts/');

    let startTime = 0;
    try {
      const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const tParam = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
      startTime = parseVideoTimestamp(tParam);
    } catch {
      // fallback
    }

    return {
      originalUrl: trimmed,
      platform: 'youtube',
      platformName: isShorts ? 'YouTube Shorts' : 'YouTube',
      videoId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?start=${startTime}&rel=0&modestbranding=1`,
      aspectRatio: isShorts ? '9/16' : '16/9',
      canEmbedDirectly: true,
      cleanExternalUrl: isShorts
        ? `https://www.youtube.com/shorts/${videoId}`
        : `https://www.youtube.com/watch?v=${videoId}${startTime > 0 ? `&t=${startTime}s` : ''}`,
      titleHint: isShorts ? 'YouTube Short Lesson' : 'YouTube Video Lesson',
      startTime,
    };
  }

  // 2. TikTok
  const tiktokRegex = /tiktok\.com\/(?:@([^\/\?#]+)\/video\/|v\/|embed\/v2\/)(\d+)/i;
  const tiktokMatch = trimmed.match(tiktokRegex);
  if (tiktokMatch) {
    const creator = tiktokMatch[1] || '';
    const videoId = tiktokMatch[2];
    return {
      originalUrl: trimmed,
      platform: 'tiktok',
      platformName: 'TikTok',
      videoId,
      embedUrl: `https://www.tiktok.com/player/v1/${videoId}?autoplay=0`,
      aspectRatio: '9/16',
      canEmbedDirectly: true,
      cleanExternalUrl: creator
        ? `https://www.tiktok.com/@${creator}/video/${videoId}`
        : `https://www.tiktok.com/video/${videoId}`,
      titleHint: creator ? `@${creator} on TikTok` : 'TikTok Video Lesson',
      startTime: 0,
    };
  }

  // TikTok short links (vm.tiktok.com or tiktok.com/t/)
  if (trimmed.includes('tiktok.com/')) {
    return {
      originalUrl: trimmed,
      platform: 'tiktok',
      platformName: 'TikTok',
      videoId: `tiktok-${Date.now()}`,
      embedUrl: null,
      aspectRatio: '9/16',
      canEmbedDirectly: false,
      cleanExternalUrl: trimmed,
      titleHint: 'TikTok Video Lesson',
      startTime: 0,
    };
  }

  // 3. Instagram (Reels & Posts)
  const instaRegex = /(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/i;
  const instaMatch = trimmed.match(instaRegex);
  if (instaMatch) {
    const shortcode = instaMatch[1];
    const isReel = trimmed.includes('/reel/') || trimmed.includes('/reels/');
    return {
      originalUrl: trimmed,
      platform: 'instagram',
      platformName: isReel ? 'Instagram Reel' : 'Instagram Post',
      videoId: shortcode,
      embedUrl: `https://www.instagram.com/p/${shortcode}/embed/`,
      aspectRatio: isReel ? '9/16' : '1/1',
      canEmbedDirectly: true,
      cleanExternalUrl: `https://www.instagram.com/reel/${shortcode}/`,
      titleHint: isReel ? 'Instagram Reel Lesson' : 'Instagram Video',
      startTime: 0,
    };
  }

  // 4. X (Twitter)
  const xRegex = /(?:twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i;
  const xMatch = trimmed.match(xRegex);
  if (xMatch) {
    const username = xMatch[1];
    const tweetId = xMatch[2];
    return {
      originalUrl: trimmed,
      platform: 'x',
      platformName: 'X (Twitter)',
      videoId: tweetId,
      embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark&dnt=true`,
      aspectRatio: '16/9',
      canEmbedDirectly: true,
      cleanExternalUrl: `https://x.com/${username}/status/${tweetId}`,
      titleHint: `@${username} on X`,
      startTime: 0,
    };
  }

  // 5. Telegram
  const tgRegex = /(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)\/(\d+)/i;
  const tgMatch = trimmed.match(tgRegex);
  if (tgMatch) {
    const channel = tgMatch[1];
    const msgId = tgMatch[2];
    return {
      originalUrl: trimmed,
      platform: 'telegram',
      platformName: 'Telegram',
      videoId: `${channel}-${msgId}`,
      embedUrl: `https://t.me/${channel}/${msgId}?embed=1&dark=1`,
      aspectRatio: '16/9',
      canEmbedDirectly: true,
      cleanExternalUrl: `https://t.me/${channel}/${msgId}`,
      titleHint: `${channel} on Telegram`,
      startTime: 0,
    };
  }

  // 6. Facebook Video & Facebook Reels
  if (trimmed.includes('facebook.com') || trimmed.includes('fb.watch')) {
    let cleanUrl = trimmed;
    try {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      ['mibextid', 'rdid', 'ref', 'source', 'locale', 'sfnsn', 'fs', 'idorvanity', 'vh'].forEach((p) =>
        u.searchParams.delete(p)
      );
      cleanUrl = u.toString();
    } catch {
      // fallback
    }

    const isReel = cleanUrl.includes('/reel/') || cleanUrl.includes('/share/r/');
    const idMatch = cleanUrl.match(/(?:watch\/\?v=|videos\/|reel\/|fb\.watch\/)([a-zA-Z0-9_-]+)/i);
    const videoId = idMatch ? idMatch[1] : `fb-${Date.now()}`;
    return {
      originalUrl: trimmed,
      platform: 'facebook',
      platformName: isReel ? 'Facebook Reel' : 'Facebook Video',
      videoId,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(cleanUrl)}&show_text=0&width=500`,
      aspectRatio: isReel ? '9/16' : '16/9',
      canEmbedDirectly: true,
      cleanExternalUrl: cleanUrl,
      titleHint: isReel ? 'Facebook Reel Lesson' : 'Facebook Video Lesson',
      startTime: 0,
    };
  }

  // 7. Direct Video Files (.mp4, .webm, .ogg, .mov, .m4v)
  const directVideoRegex = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;
  if (directVideoRegex.test(trimmed)) {
    const filename = trimmed.split('/').pop()?.split('?')[0] || 'Video';
    return {
      originalUrl: trimmed,
      platform: 'direct',
      platformName: 'Direct Video (MP4/WebM)',
      videoId: `direct-${encodeURIComponent(filename.slice(0, 20))}`,
      embedUrl: trimmed,
      aspectRatio: '16/9',
      canEmbedDirectly: true,
      cleanExternalUrl: trimmed,
      titleHint: filename.replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, ''),
      startTime: 0,
    };
  }

  // 8. Vimeo
  const vimeoRegex = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i;
  const vimeoMatch = trimmed.match(vimeoRegex);
  if (vimeoMatch) {
    const vimeoId = vimeoMatch[3];
    return {
      originalUrl: trimmed,
      platform: 'vimeo',
      platformName: 'Vimeo',
      videoId: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?autoplay=0&title=0&byline=0`,
      aspectRatio: '16/9',
      canEmbedDirectly: true,
      cleanExternalUrl: `https://vimeo.com/${vimeoId}`,
      titleHint: 'Vimeo Video Lesson',
      startTime: 0,
    };
  }

  // 9. Generic URL validation
  try {
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const hostname = urlObj.hostname.replace('www.', '');
    return {
      originalUrl: trimmed,
      platform: 'custom',
      platformName: hostname,
      videoId: `custom-${Date.now()}`,
      embedUrl: null,
      aspectRatio: '16/9',
      canEmbedDirectly: false,
      cleanExternalUrl: trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
      titleHint: `${hostname} Video Link`,
      startTime: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Checks if a string is a recognized video URL
 */
export function isSupportedVideoUrl(url: string): boolean {
  return parseUniversalVideoUrl(url) !== null;
}
