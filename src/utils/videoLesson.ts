/**
 * Video Lesson Block Generator, Parser & Deduplicator
 * Supports HTML data-attribute format and markdown syntax:
 * :::video-lesson{id="..." url="..." title="..." start="..."}:::
 * Guarantees exactly ONE video block per video ID without duplicate iframes.
 */

export interface VideoLessonData {
  videoId: string;
  url: string;
  title: string;
  startTime: number;
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
  if (/data-video-lesson=["']true["']|class=["'][^"']*\bvideo-lesson-block\b|:::video-lesson\{|youtube-nocookie\.com\/embed\/|youtube\.com\/embed\//i.test(content)) {
    return true;
  }
  return false;
}

/**
 * Extracts primary video lesson data from content string
 */
export function extractVideoLessonData(content: string): VideoLessonData | null {
  if (!content) return null;

  // 1. Markdown syntax
  const mdMatch = content.match(/:::video-lesson\{([^}]+)\}:::/);
  if (mdMatch) {
    const idMatch = mdMatch[1].match(/id="([^"]+)"/);
    const urlMatch = mdMatch[1].match(/url="([^"]+)"/);
    const titleMatch = mdMatch[1].match(/title="([^"]+)"/);
    const startMatch = mdMatch[1].match(/start="([^"]+)"/);
    if (idMatch && idMatch[1]) {
      return {
        videoId: idMatch[1],
        url: urlMatch ? urlMatch[1] : `https://www.youtube.com/watch?v=${idMatch[1]}`,
        title: titleMatch ? titleMatch[1] : 'Video Lesson',
        startTime: startMatch ? parseInt(startMatch[1], 10) : 0,
      };
    }
  }

  // 2. HTML block data attributes
  const idMatch = content.match(/data-video-id=["']([^"']+)["']/i);
  if (idMatch && idMatch[1]) {
    const urlMatch = content.match(/data-url=["']([^"']+)["']/i);
    const titleMatch = content.match(/data-title=["']([^"']+)["']/i);
    const startMatch = content.match(/data-start=["']([^"']+)["']/i);
    return {
      videoId: idMatch[1],
      url: urlMatch ? urlMatch[1] : `https://www.youtube.com/watch?v=${idMatch[1]}`,
      title: titleMatch ? titleMatch[1] : 'Video Lesson',
      startTime: startMatch ? parseInt(startMatch[1], 10) : 0,
    };
  }

  // 3. YouTube iframe embed
  const iframeMatch = content.match(/src=["'](?:https?:)?\/\/(?:www\.)?(?:youtube-nocookie|youtube)\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?([^"']*))?["']/i);
  if (iframeMatch && iframeMatch[1]) {
    const videoId = iframeMatch[1];
    const params = new URLSearchParams(iframeMatch[2] || '');
    const startTime = parseInt(params.get('start') || '0', 10);
    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: 'Video Lesson',
      startTime,
    };
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
    .replace(/<div[^>]*class=["'][^"']*\bvideo-lesson-block\b[^"']*["'][^>]*>[\s\S]*?<\/iframe>\s*<\/div>\s*<\/div>/gi, '')
    .replace(/<div[^>]*data-video-lesson=["']true["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, '')
    // Remove standalone iframes matching youtube
    .replace(/<div[^>]*class=["'][^"']*\bvideo-lesson-frame-wrap\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<iframe[^>]*src=["'][^"']*(?:youtube-nocookie|youtube)\.com\/embed\/[^"']*["'][^>]*><\/iframe>/gi, '')
    // Clean up stray timestamp chips or stuck badges
    .replace(/<button[^>]*class=["'][^"']*video-timestamp-chip[^"']*["'][^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<span[^>]*class=["'][^"']*video-timestamp-chip[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/\[00:00\]/g, '')
    .replace(/(?:--\s*){3,}/g, '')
    .trim();

  // If notes is empty, provide a clean default
  if (!notes) {
    notes = '### Practice & Study Notes\n- Key chords, tabs, and study insights...';
  }

  return notes;
}

/**
 * Generates semantic, robust HTML for a Video Lesson card.
 */
export function generateVideoBlockHtml(options: VideoBlockRenderOptions): string {
  const { videoId, url, title, startTime = 0, isEditMode = false, isFocusSpace = false } = options;
  const safeTitle = (title || 'Video Lesson').replace(/"/g, '&quot;');
  const safeUrl = (url || `https://www.youtube.com/watch?v=${videoId}`).replace(/"/g, '&quot;');
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?start=${startTime}&enablejsapi=1&rel=0`;

  if (isEditMode) {
    return `<div class="video-lesson-block video-lesson-edit" contenteditable="false" data-video-lesson="true" data-video-id="${videoId}" data-url="${safeUrl}" data-title="${safeTitle}" data-start="${startTime}">
  <div class="video-lesson-header">
    <div class="video-lesson-info-left">
      <span class="video-lesson-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
        Video Lesson
      </span>
      <strong class="video-lesson-title">${safeTitle}</strong>
    </div>
    <div class="video-lesson-tools">
      <button type="button" class="video-lesson-action-btn" data-action="focus-view" data-video-id="${videoId}" data-title="${safeTitle}" data-start="${startTime}" title="Open Focus View in Focus Space">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>
        Focus View
      </button>
      <button type="button" class="video-lesson-tool-btn" data-action="move-up-video" title="Move Video Up">↑</button>
      <button type="button" class="video-lesson-tool-btn" data-action="move-down-video" title="Move Video Down">↓</button>
      <button type="button" class="video-lesson-tool-btn" data-action="edit-video" title="Edit Video Title or URL">✎ Edit</button>
      <button type="button" class="video-lesson-tool-btn video-lesson-tool-danger" data-action="delete-video" title="Delete Video Lesson">✕</button>
    </div>
  </div>
  <div class="video-lesson-frame-wrap">
    <iframe src="${embedUrl}" title="${safeTitle}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
  </div>
</div>`;
  }

  // Reader / Book Mode
  const actionButtonHtml = isFocusSpace
    ? `<button type="button" class="video-lesson-action-btn" data-action="switch-target" title="Switch focus target (Tasks, Books, or Video Lessons)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
        <span>Switch Target</span>
      </button>`
    : `<button type="button" class="video-lesson-action-btn" data-action="focus-view" data-video-id="${videoId}" data-title="${safeTitle}" data-start="${startTime}" title="Open Focus View in Focus Space">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>
        <span>Focus View</span>
      </button>`;

  return `<div class="video-lesson-block video-lesson-reader" contenteditable="false" data-video-lesson="true" data-video-id="${videoId}" data-url="${safeUrl}" data-title="${safeTitle}" data-start="${startTime}">
  <div class="video-lesson-header">
    <div class="video-lesson-info-left">
      <span class="video-lesson-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
        Video Lesson
      </span>
      <h3 class="video-lesson-title">${safeTitle}</h3>
    </div>
    <div class="video-lesson-tools">
      ${actionButtonHtml}
    </div>
  </div>
  <div class="video-lesson-frame-wrap">
    <iframe src="${embedUrl}" title="${safeTitle}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
  </div>
</div>`;
}

/**
 * Cleans, deduplicates, and transforms all video lesson blocks in an HTML string.
 * Strictly guarantees exactly ONE embedded player per video ID, and cleans up
 * any orphaned duplicate iframes or stray frames caused by previous bugs.
 */
export function transformVideoLessonsInHtml(
  html: string,
  isEditMode: boolean,
  isFocusSpace: boolean = false,
  overrideTitle?: string
): string {
  if (!html) return '';

  // 1. Transform markdown custom block: :::video-lesson{id="..." url="..." title="..." start="..."}:::
  let result = html.replace(
    /:::video-lesson\{([^}]+)\}:::/g,
    (_, attrsStr) => {
      const idMatch = attrsStr.match(/id="([^"]+)"/);
      const urlMatch = attrsStr.match(/url="([^"]+)"/);
      const titleMatch = attrsStr.match(/title="([^"]+)"/);
      const startMatch = attrsStr.match(/start="([^"]+)"/);

      const videoId = idMatch ? idMatch[1] : '';
      if (!videoId) return '';

      return generateVideoBlockHtml({
        videoId,
        url: urlMatch ? urlMatch[1] : `https://www.youtube.com/watch?v=${videoId}`,
        title: overrideTitle || (titleMatch ? titleMatch[1] : 'Video Lesson'),
        startTime: startMatch ? parseInt(startMatch[1], 10) : 0,
        isEditMode,
        isFocusSpace,
      });
    }
  );

  // Use DOM parser when available (browser client-side) for 100% nested-element safety
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(result, 'text/html');
      const seenVideoIds = new Set<string>();

      // A. Process all .video-lesson-block and [data-video-lesson="true"] elements
      const blocks = Array.from(doc.querySelectorAll<HTMLElement>('.video-lesson-block, [data-video-lesson="true"]'));
      blocks.forEach((block) => {
        const videoId = block.getAttribute('data-video-id') || '';
        const url = block.getAttribute('data-url') || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');
        const title = overrideTitle || block.getAttribute('data-title') || 'Video Lesson';
        const startTime = parseInt(block.getAttribute('data-start') || '0', 10);

        if (!videoId || seenVideoIds.has(videoId)) {
          // Already have a player for this video! Remove duplicate
          block.remove();
          return;
        }

        seenVideoIds.add(videoId);

        // Remove any immediate sibling orphaned .video-lesson-frame-wrap or iframes
        let sib = block.nextElementSibling;
        while (
          sib &&
          (sib.classList.contains('video-lesson-frame-wrap') ||
            sib.tagName === 'IFRAME' ||
            (sib.querySelector && sib.querySelector('iframe')))
        ) {
          const toRemove = sib;
          sib = sib.nextElementSibling;
          toRemove.remove();
        }

        // Re-generate single clean block
        const newHtml = generateVideoBlockHtml({
          videoId,
          url,
          title,
          startTime,
          isEditMode,
          isFocusSpace,
        });

        const temp = doc.createElement('div');
        temp.innerHTML = newHtml;
        if (temp.firstElementChild) {
          block.replaceWith(temp.firstElementChild);
        }
      });

      // B. Remove any orphaned .video-lesson-frame-wrap not inside a block
      const strayWraps = Array.from(doc.querySelectorAll<HTMLElement>('.video-lesson-frame-wrap'));
      strayWraps.forEach((wrap) => {
        if (!wrap.closest('.video-lesson-block')) {
          wrap.remove();
        }
      });

      // C. Remove duplicate YouTube iframes that match already seen video IDs
      const iframes = Array.from(doc.querySelectorAll<HTMLIFrameElement>('iframe'));
      iframes.forEach((iframe) => {
        if (!iframe.closest('.video-lesson-block')) {
          const src = iframe.getAttribute('src') || '';
          const match = src.match(/embed\/([a-zA-Z0-9_-]+)/);
          if (match && seenVideoIds.has(match[1])) {
            iframe.remove();
          }
        }
      });

      return doc.body.innerHTML;
    } catch {
      // Fallback to regex below if DOMParser encountered an error
    }
  }

  // Fallback regex approach for SSR:
  // Match full video lesson block including its frame wrap and iframe
  const seenIds = new Set<string>();
  result = result.replace(
    /<div[^>]*class=["'][^"']*\bvideo-lesson-block\b[^"']*["'][^>]*>[\s\S]*?<\/iframe>\s*<\/div>\s*<\/div>/gi,
    (blockMatch) => {
      const idMatch = blockMatch.match(/data-video-id=["']([^"']+)["']/i);
      const urlMatch = blockMatch.match(/data-url=["']([^"']+)["']/i);
      const titleMatch = blockMatch.match(/data-title=["']([^"']+)["']/i);
      const startMatch = blockMatch.match(/data-start=["']([^"']+)["']/i);

      if (!idMatch || !idMatch[1]) return '';
      const videoId = idMatch[1];
      if (seenIds.has(videoId)) return ''; // Deduplicate
      seenIds.add(videoId);

      const url = urlMatch ? urlMatch[1] : `https://www.youtube.com/watch?v=${videoId}`;
      const title = titleMatch ? titleMatch[1] : 'Video Lesson';
      const startTime = startMatch ? parseInt(startMatch[1], 10) : 0;

      return generateVideoBlockHtml({
        videoId,
        url,
        title,
        startTime,
        isEditMode,
      });
    }
  );

  // Clean any orphaned video-lesson-frame-wrap elements left outside
  result = result.replace(/<div class=["']video-lesson-frame-wrap["']>[\s\S]*?<\/div>/gi, '');

  return result;
}

/**
 * Sanitizes and deduplicates document content, removing any accumulated duplicate
 * video frames or iframes from historical saves.
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
