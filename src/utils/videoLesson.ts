/**
 * Video Lesson Block Generator, Parser & Deduplicator for Life OS
 * Universal multi-platform video lesson support (YouTube, TikTok, Instagram, X, Facebook, Telegram, Direct MP4, etc.)
 * Supports HTML data-attribute format and markdown syntax:
 * :::video-lesson{id="..." url="..." title="..." start="..." platform="..."}:::
 * Guarantees exactly ONE video block per video ID without duplicate iframes.
 */

import { parseUniversalVideoUrl, extractYouTubeVideoDetails } from './universalVideo';

export interface VideoLessonData {
  videoId: string;
  url: string;
  title: string;
  startTime: number;
  platform?: string;
}

export interface VideoBlockRenderOptions extends VideoLessonData {
  isEditMode?: boolean;
  isFocusSpace?: boolean;
}

/**
 * Checks whether a document represents a Video Lesson
 */
export function isDocVideoLesson(doc: {
  docType?: string;
  tags?: string[];
  content?: string;
  title?: string;
} | null | undefined): boolean {
  if (!doc) return false;
  if (doc.docType === 'video-lesson') return true;
  if (Array.isArray(doc.tags) && doc.tags.some((t) => {
    const lower = (t || '').toLowerCase();
    return lower === 'video-lesson' || lower === 'video' || lower === 'video lesson';
  })) {
    return true;
  }
  const content = doc.content || '';
  if (/data-video-lesson=["']true["']|class=["'][^"']*\bvideo-lesson-block\b|:::video-lesson\{|youtube-nocookie\.com\/embed\/|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch|tiktok\.com|instagram\.com\/reel/i.test(content)) {
    return true;
  }
  return false;
}

/**
 * Checks whether a document represents a written book, guide, or reading document.
 * Documents with video embeds are STILL books if they contain study notes, book tags, or reading progress!
 */
export function isDocBookOrDocument(doc: {
  docType?: string;
  tags?: string[];
  content?: string;
  title?: string;
  category?: string;
  readProgress?: number;
  totalPages?: number;
} | null | undefined): boolean {
  if (!doc) return false;
  // If explicitly tagged or marked as a book, reading material, or imported doc, always true
  if (Array.isArray(doc.tags) && doc.tags.some((t) => {
    const lower = (t || '').toLowerCase();
    return lower === 'book' || lower === 'reading' || lower === 'pdf' || lower === 'imported' || lower === 'notes' || lower === 'guide' || lower === 'manual';
  })) {
    return true;
  }
  // If user has reading progress or pages tracked, it is a book
  if ((doc.readProgress !== undefined && doc.readProgress > 0) || doc.totalPages) {
    return true;
  }
  // Standard document type
  if (!doc.docType || doc.docType === 'document') {
    return true;
  }
  // Even if docType === 'video-lesson', if it has written notes, it is also a study book
  const content = doc.content || '';
  if (content.length > 250) {
    return true;
  }
  return false;
}

/**
 * Extracts primary video lesson data from content string
 */
export function extractVideoLessonData(content: string): VideoLessonData | null {
  if (!content) return null;

  // 1. Markdown syntax: :::video-lesson{...}:::
  const mdMatch = content.match(/:::video-lesson\{([^}]+)\}:::/);
  if (mdMatch) {
    const idMatch = mdMatch[1].match(/id="([^"]+)"/);
    const urlMatch = mdMatch[1].match(/url="([^"]+)"/);
    const titleMatch = mdMatch[1].match(/title="([^"]+)"/);
    const startMatch = mdMatch[1].match(/start="([^"]+)"/);
    const platformMatch = mdMatch[1].match(/platform="([^"]+)"/);

    let rawId = idMatch ? idMatch[1] : '';
    let rawUrl = urlMatch ? urlMatch[1] : (rawId && !rawId.startsWith('custom-') ? `https://www.youtube.com/watch?v=${rawId}` : '');
    let platform = platformMatch ? platformMatch[1] : undefined;

    const yt = extractYouTubeVideoDetails(rawUrl) || extractYouTubeVideoDetails(rawId);
    if (yt) {
      rawId = yt.videoId;
      platform = 'youtube';
      if (!rawUrl || rawUrl.includes('custom-')) {
        rawUrl = `https://www.youtube.com/watch?v=${yt.videoId}`;
      }
    }

    if (rawId) {
      return {
        videoId: rawId,
        url: rawUrl,
        title: titleMatch ? titleMatch[1] : 'Video Lesson',
        startTime: startMatch ? parseInt(startMatch[1], 10) : (yt?.startTime || 0),
        platform,
      };
    }
  }

  // 2. HTML block data attributes
  const idMatch = content.match(/data-video-id=["']([^"']+)["']/i);
  if (idMatch && idMatch[1]) {
    const urlMatch = content.match(/data-url=["']([^"']+)["']/i);
    const titleMatch = content.match(/data-title=["']([^"']+)["']/i);
    const startMatch = content.match(/data-start=["']([^"']+)["']/i);
    const platformMatch = content.match(/data-platform=["']([^"']+)["']/i);

    let rawId = idMatch[1];
    let rawUrl = urlMatch ? urlMatch[1] : (rawId && !rawId.startsWith('custom-') ? `https://www.youtube.com/watch?v=${rawId}` : '');
    let platform = platformMatch ? platformMatch[1] : undefined;

    const yt = extractYouTubeVideoDetails(rawUrl) || extractYouTubeVideoDetails(rawId);
    if (yt) {
      rawId = yt.videoId;
      platform = 'youtube';
      if (!rawUrl || rawUrl.includes('custom-')) {
        rawUrl = `https://www.youtube.com/watch?v=${yt.videoId}`;
      }
    }

    return {
      videoId: rawId,
      url: rawUrl,
      title: titleMatch ? titleMatch[1] : 'Video Lesson',
      startTime: startMatch ? parseInt(startMatch[1], 10) : (yt?.startTime || 0),
      platform,
    };
  }

  // 3. YouTube or other iframe embed
  const iframeMatch = content.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    const src = iframeMatch[1];
    const ytMatch = src.match(/(?:youtube-nocookie|youtube)\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?([^"']*))?/i);
    if (ytMatch) {
      const videoId = ytMatch[1];
      const params = new URLSearchParams(ytMatch[2] || '');
      const startTime = parseInt(params.get('start') || '0', 10);
      return {
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: 'Video Lesson',
        startTime,
        platform: 'youtube',
      };
    }
  }

  // 4. Standalone YouTube URL in content
  const ytFallbackMatch = content.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/[^\s"'>]+|youtu\.be\/[a-zA-Z0-9_-]+)/i);
  if (ytFallbackMatch) {
    const yt = extractYouTubeVideoDetails(ytFallbackMatch[0]);
    if (yt) {
      return {
        videoId: yt.videoId,
        url: ytFallbackMatch[0],
        title: 'Video Lesson',
        startTime: yt.startTime,
        platform: 'youtube',
      };
    }
  }

  return null;
}

/**
 * Extracts practice and study notes from a video lesson content string
 * by removing the video lesson embed block or markdown tag.
 */
export function extractVideoLessonNotes(content: string): string {
  if (!content) return '';

  let notes = content
    // Remove markdown custom block: :::video-lesson{...}:::
    .replace(/:::video-lesson\{[^}]*\}:::/gi, '')
    // Remove HTML video lesson block
    .replace(/<div[^>]*class=["'][^"']*\bvideo-lesson-block\b[^"']*["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, '')
    .replace(/<div[^>]*data-video-lesson=["']true["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, '')
    // Remove standalone iframes and frame wraps
    .replace(/<div[^>]*class=["'][^"']*\bvideo-lesson-frame-wrap\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<iframe[^>]*src=["'][^"']*(?:youtube-nocookie|youtube|tiktok|instagram|twitter|facebook|vimeo)[^"']*["'][^>]*><\/iframe>/gi, '')
    .replace(/<video[^>]*src=["'][^"']*["'][^>]*><\/video>/gi, '')
    // Clean up stray timestamp chips or stuck badges
    .replace(/<button[^>]*class=["'][^"']*video-timestamp-chip[^"']*["'][^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<span[^>]*class=["'][^"']*video-timestamp-chip[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/\[00:00\]/g, '')
    .replace(/(?:--\s*){3,}/g, '')
    .trim();

  if (!notes) {
    notes = '### Practice & Study Notes\n- Key chords, tabs, and study insights...';
  }

  return notes;
}

/**
 * Generates semantic, robust HTML for a Universal Video Lesson card.
 * Embedded players play directly inline inside the document.
 */
export function generateVideoBlockHtml(options: VideoBlockRenderOptions): string {
  const { videoId: rawVideoId, url: rawUrl, title, startTime: rawStartTime = 0, isEditMode = false, isFocusSpace = false } = options;
  const safeTitle = (title || 'Video Lesson').replace(/"/g, '&quot;');

  // Robust YouTube URL and ID detection
  const ytDetails = extractYouTubeVideoDetails(rawUrl) || extractYouTubeVideoDetails(rawVideoId);
  const isYouTube = Boolean(
    ytDetails ||
    options.platform === 'youtube' ||
    (rawUrl && (rawUrl.includes('youtu.be') || rawUrl.includes('youtube.com') || rawUrl.includes('youtube-nocookie.com'))) ||
    (rawVideoId && /^[a-zA-Z0-9_-]{11}$/.test(rawVideoId))
  );

  let platform = options.platform || 'youtube';
  let platformName = 'Video';
  let videoId = rawVideoId || '';
  let startTime = rawStartTime || 0;
  let isVertical = false;
  let innerMediaHtml = '';
  let safeUrl = (rawUrl || '').replace(/"/g, '&quot;');

  if (isYouTube) {
    const effectiveId =
      ytDetails?.videoId ||
      (rawVideoId && /^[a-zA-Z0-9_-]{11}$/.test(rawVideoId)
        ? rawVideoId
        : rawUrl?.match(/(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1] || '');
    const effectiveStart = ytDetails?.startTime ?? rawStartTime ?? 0;
    const isShorts = ytDetails?.isShorts || Boolean(rawUrl?.includes('/shorts/'));

    platform = 'youtube';
    platformName = isShorts ? 'YouTube Shorts' : 'YouTube';
    videoId = effectiveId || rawVideoId || '';
    startTime = effectiveStart;
    isVertical = isShorts;

    if (!safeUrl || safeUrl.includes('custom-')) {
      safeUrl = isShorts
        ? `https://www.youtube.com/shorts/${videoId}`
        : `https://www.youtube.com/watch?v=${videoId}${startTime > 0 ? `&t=${startTime}s` : ''}`;
    }

    const ytEmbedUrl = `https://www.youtube.com/embed/${videoId}?rel=0${startTime > 0 ? `&start=${startTime}` : ''}`;
    innerMediaHtml = `<iframe src="${ytEmbedUrl}" title="${safeTitle}" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  } else {
    // Universal parsing for other platforms (Vimeo, TikTok, Instagram, Direct MP4, etc.)
    const parsed = parseUniversalVideoUrl(rawUrl || rawVideoId);
    platform = parsed ? parsed.platform : (options.platform || 'custom');
    platformName = parsed ? parsed.platformName : 'Video';
    isVertical = parsed ? parsed.aspectRatio === '9/16' : false;
    safeUrl = (parsed?.cleanExternalUrl || rawUrl || (rawVideoId ? `https://www.youtube.com/watch?v=${rawVideoId}` : '')).replace(/"/g, '&quot;');

    if (platform === 'direct') {
      innerMediaHtml = `<video src="${safeUrl}" controls playsinline preload="metadata" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;background:#000;"></video>`;
    } else if (parsed && parsed.canEmbedDirectly && parsed.embedUrl) {
      innerMediaHtml = `<iframe src="${parsed.embedUrl}" title="${safeTitle}" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    } else {
      innerMediaHtml = `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;gap:12px;background:var(--color-surface-2);">
        <p style="margin:0;font-size:0.875rem;color:var(--color-text-secondary);">${platformName} video is ready to watch.</p>
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:var(--color-accent);color:#fff;border-radius:6px;font-size:0.8125rem;font-weight:600;text-decoration:none;">Open ${platformName} Video ↗</a>
      </div>`;
    }
  }

  const verticalStyles = isVertical
    ? ' style="aspect-ratio: 9/16; max-width: 360px; margin: 0 auto;"'
    : '';

  if (isEditMode) {
    return `<div class="video-lesson-block video-lesson-edit" contenteditable="false" data-video-lesson="true" data-video-id="${videoId}" data-url="${safeUrl}" data-title="${safeTitle}" data-start="${startTime}" data-platform="${platform}">
  <div class="video-lesson-header">
    <div class="video-lesson-info-left">
      <span class="video-lesson-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
        ${platformName} Lesson
      </span>
      <strong class="video-lesson-title">${safeTitle}</strong>
    </div>
    <div class="video-lesson-tools">
      <button type="button" class="video-lesson-open-link" data-action="popout-video" data-url="${safeUrl}" title="Watch in floating companion window with your full login session">
        <span>Pop-out ⧉</span>
      </button>
      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="video-lesson-open-link" title="Open ${platformName} directly in browser or app">
        <span>Open ${platformName} ↗</span>
      </a>
      <button type="button" class="video-lesson-action-btn" data-action="focus-view" data-video-id="${videoId}" data-url="${safeUrl}" data-title="${safeTitle}" data-start="${startTime}" data-platform="${platform}" title="Open Focus View in Focus Space">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>
        Focus View
      </button>
      <button type="button" class="video-lesson-tool-btn" data-action="move-up-video" title="Move Video Up">↑</button>
      <button type="button" class="video-lesson-tool-btn" data-action="move-down-video" title="Move Video Down">↓</button>
      <button type="button" class="video-lesson-tool-btn" data-action="edit-video" title="Edit Video Title or URL">✎ Edit</button>
      <button type="button" class="video-lesson-tool-btn video-lesson-tool-danger" data-action="delete-video" title="Delete Video Lesson">✕</button>
    </div>
  </div>
  <div class="video-lesson-frame-wrap"${verticalStyles}>
    ${innerMediaHtml}
  </div>
  <div class="video-lesson-sub-hint">
    <span>If playback is restricted by the video creator, click <strong>Pop-out ⧉</strong> or <strong>Open ${platformName} ↗</strong> above to watch.</span>
  </div>
</div>`;
  }

  // Reader / Book Mode
  const actionButtonHtml = isFocusSpace
    ? `<button type="button" class="video-lesson-action-btn" data-action="switch-target" title="Switch focus target">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
        <span>Switch Target</span>
      </button>`
    : `<button type="button" class="video-lesson-action-btn" data-action="focus-view" data-video-id="${videoId}" data-url="${safeUrl}" data-title="${safeTitle}" data-start="${startTime}" data-platform="${platform}" title="Open Focus View in Focus Space">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>
        <span>Focus View</span>
      </button>`;

  return `<div class="video-lesson-block video-lesson-reader" contenteditable="false" data-video-lesson="true" data-video-id="${videoId}" data-url="${safeUrl}" data-title="${safeTitle}" data-start="${startTime}" data-platform="${platform}">
  <div class="video-lesson-header">
    <div class="video-lesson-info-left">
      <span class="video-lesson-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
        ${platformName} Lesson
      </span>
      <h3 class="video-lesson-title">${safeTitle}</h3>
    </div>
    <div class="video-lesson-tools">
      ${actionButtonHtml}
      <button type="button" class="video-lesson-open-link" data-action="popout-video" data-url="${safeUrl}" title="Watch in floating companion window with your full login session">
        <span>Pop-out ⧉</span>
      </button>
      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="video-lesson-open-link" title="Open ${platformName} directly in browser or app">
        <span>Open ${platformName} ↗</span>
      </a>
      <button type="button" class="video-lesson-open-link" data-action="edit-video" data-url="${safeUrl}" data-title="${safeTitle}" data-video-id="${videoId}" title="Edit video link and lesson name">
        <span>Edit ✎</span>
      </button>
    </div>
  </div>
  <div class="video-lesson-frame-wrap"${verticalStyles}>
    ${innerMediaHtml}
  </div>
  <div class="video-lesson-sub-hint">
    <span>If playback is restricted by the video creator, click <strong>Pop-out ⧉</strong> or <strong>Open ${platformName} ↗</strong> above to watch.</span>
  </div>
</div>`;
}

/**
 * Cleans, deduplicates, and transforms all video lesson blocks in an HTML string.
 * Automatically upgrades any legacy fallback blocks to playable direct iframes.
 */
export function transformVideoLessonsInHtml(
  html: string,
  isEditMode: boolean,
  isFocusSpace: boolean = false,
  overrideTitle?: string
): string {
  if (!html) return '';

  // 1. Transform markdown custom block: :::video-lesson{id="..." url="..." title="..." start="..." platform="..."}:::
  let result = html.replace(
    /:::video-lesson\{([^}]+)\}:::/g,
    (_, attrsStr) => {
      const idMatch = attrsStr.match(/id="([^"]+)"/);
      const urlMatch = attrsStr.match(/url="([^"]+)"/);
      const titleMatch = attrsStr.match(/title="([^"]+)"/);
      const startMatch = attrsStr.match(/start="([^"]+)"/);
      const platformMatch = attrsStr.match(/platform="([^"]+)"/);

      const videoId = idMatch ? idMatch[1] : '';
      if (!videoId) return '';

      return generateVideoBlockHtml({
        videoId,
        url: urlMatch ? urlMatch[1] : `https://www.youtube.com/watch?v=${videoId}`,
        title: overrideTitle || (titleMatch ? titleMatch[1] : 'Video Lesson'),
        startTime: startMatch ? parseInt(startMatch[1], 10) : 0,
        platform: platformMatch ? platformMatch[1] : undefined,
        isEditMode,
        isFocusSpace,
      });
    }
  );

  // 2. Client-side DOMParser pass for rich transformation & fallback recovery
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(result, 'text/html');
      const seenVideoKeys = new Set<string>();

      const blocks = Array.from(doc.querySelectorAll<HTMLElement>('.video-lesson-block, [data-video-lesson="true"]'));
      blocks.forEach((block) => {
        let videoId = block.getAttribute('data-video-id') || '';
        let url = block.getAttribute('data-url') || '';
        const title = overrideTitle || block.getAttribute('data-title') || 'Video Lesson';
        const startTime = parseInt(block.getAttribute('data-start') || '0', 10);
        let platform = block.getAttribute('data-platform') || undefined;

        // If block has a fallback link inside, recover the URL from it
        if (!url) {
          const innerLink = block.querySelector<HTMLAnchorElement>('a[href]');
          if (innerLink && innerLink.href) {
            url = innerLink.href;
          }
        }

        // Recover YouTube videoId if url was stored
        const yt = extractYouTubeVideoDetails(url) || extractYouTubeVideoDetails(videoId);
        if (yt) {
          videoId = yt.videoId;
          platform = 'youtube';
          if (!url || url.includes('custom-')) {
            url = yt.isShorts ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`;
          }
        }

        const dedupeKey = videoId || url;
        if (!dedupeKey || seenVideoKeys.has(dedupeKey)) {
          block.remove();
          return;
        }

        seenVideoKeys.add(dedupeKey);

        // Remove any immediate sibling orphaned .video-lesson-frame-wrap or iframes
        let sib = block.nextElementSibling;
        while (
          sib &&
          (sib.classList.contains('video-lesson-frame-wrap') ||
            sib.tagName === 'IFRAME' ||
            sib.tagName === 'VIDEO' ||
            (sib.querySelector && sib.querySelector('iframe, video')))
        ) {
          const toRemove = sib;
          sib = sib.nextElementSibling;
          toRemove.remove();
        }

        const newHtml = generateVideoBlockHtml({
          videoId,
          url,
          title,
          startTime,
          platform,
          isEditMode,
          isFocusSpace,
        });

        const temp = doc.createElement('div');
        temp.innerHTML = newHtml;
        if (temp.firstElementChild) {
          block.replaceWith(temp.firstElementChild);
        }
      });

      return doc.body.innerHTML;
    } catch {
      // Fallback below
    }
  }

  return result;
}

/**
 * Sanitizes and deduplicates document content.
 */
export function cleanDocumentContent(content: string): string {
  if (!content) return '';
  let result = transformVideoLessonsInHtml(content, false);
  result = result
    .replace(/<button[^>]*class=["'][^"']*video-timestamp-chip[^"']*["'][^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<span[^>]*class=["'][^"']*video-timestamp-chip[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/\[00:00\]/g, '')
    .replace(/(?:--\s*){3,}/g, '');
  return result;
}
