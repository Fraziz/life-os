/**
 * Extracts clean, readable text from PDF, Word (.docx, .doc), Text, Markdown, HTML, and data files.
 * Works entirely client-side with offline local PDF.js and Mammoth.js parsers.
 * Auto-formats extracted content into clean, readable Knowledge Base notes.
 */

import mammoth from 'mammoth';

// Dynamically load PDF.js from local /vendor/pdfjs/ with CDN fallback
async function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  // Try local /vendor/pdfjs first, then CDN if local is unavailable
  const candidateScripts = [
    '/vendor/pdfjs/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  ];

  for (const src of candidateScripts) {
    try {
      const lib = await new Promise<any>((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
          const loaded = (window as any).pdfjsLib;
          if (loaded) {
            // Configure worker: try local worker first
            const workerUrl = src.startsWith('/')
              ? '/vendor/pdfjs/pdf.worker.min.js'
              : 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            try {
              // Create same-origin Blob URL worker to prevent cross-origin SecurityError
              if (workerUrl.startsWith('http')) {
                const blob = new Blob([`importScripts("${workerUrl}");`], { type: 'application/javascript' });
                loaded.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
              } else {
                loaded.GlobalWorkerOptions.workerSrc = workerUrl;
              }
            } catch {
              loaded.GlobalWorkerOptions.workerSrc = workerUrl;
            }
          }
          resolve(loaded || null);
        };
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
      });

      if (lib) return lib;
    } catch {
      // try next candidate
    }
  }

  return null;
}

/**
 * Intelligently reconstructs lines, paragraphs, and headings from PDF text content items.
 * Uses PDF coordinate transforms (Y and X coordinates) and font sizes to ensure words
 * and lines are reconstructed accurately without running together or breaking apart.
 */
function extractStructuredPageText(tc: any): string {
  if (!tc || !tc.items || tc.items.length === 0) return '';

  const items = tc.items.filter((item: any) => typeof item.str === 'string' && item.str.length > 0);
  if (items.length === 0) return '';

  // Sort items top-to-bottom (Y descending in PDF coordinate space), then left-to-right (X ascending)
  items.sort((a: any, b: any) => {
    const yA = a.transform ? a.transform[5] : 0;
    const yB = b.transform ? b.transform[5] : 0;
    const xA = a.transform ? a.transform[4] : 0;
    const xB = b.transform ? b.transform[4] : 0;

    // Within 3.5 points on Y axis, consider items on the same line
    if (Math.abs(yA - yB) < 3.5) {
      return xA - xB;
    }
    return yB - yA; // Higher Y = higher on page
  });

  interface PageLine {
    text: string;
    fontSize: number;
    isBold: boolean;
    y: number;
  }

  const lines: PageLine[] = [];
  let currentLine = '';
  let lastY: number | null = null;
  let lastX = 0;
  let maxFontSizeOnLine = 12;
  let lineIsBold = false;

  for (const item of items) {
    const str: string = item.str;
    const y: number = item.transform ? item.transform[5] : 0;
    const x: number = item.transform ? item.transform[4] : 0;
    const fontSize: number = item.height || (item.transform ? Math.abs(item.transform[0]) : 12);
    const fontName: string = (item.fontName || '').toLowerCase();
    const isBold: boolean = fontName.includes('bold') || fontName.includes('black') || fontName.includes('heavy');

    const isNewLine = lastY !== null && Math.abs(y - lastY) >= 3.5;

    if (isNewLine) {
      if (currentLine.trim()) {
        lines.push({
          text: currentLine.trim(),
          fontSize: maxFontSizeOnLine,
          isBold: lineIsBold,
          y: lastY!,
        });
      }
      currentLine = '';
      maxFontSizeOnLine = fontSize;
      lineIsBold = isBold;
    } else {
      maxFontSizeOnLine = Math.max(maxFontSizeOnLine, fontSize);
      if (isBold) lineIsBold = true;
    }

    // Insert natural word space if gap between characters is greater than 2px and not already spaced
    if (currentLine && !currentLine.endsWith(' ') && !str.startsWith(' ') && (x - lastX) > 2.5) {
      currentLine += ' ';
    }
    currentLine += str;
    lastY = y;
    lastX = x + (item.width || 0);

    if (item.hasEOL && currentLine.trim()) {
      lines.push({
        text: currentLine.trim(),
        fontSize: maxFontSizeOnLine,
        isBold: lineIsBold,
        y: lastY!,
      });
      currentLine = '';
      lastY = null;
    }
  }

  if (currentLine.trim()) {
    lines.push({
      text: currentLine.trim(),
      fontSize: maxFontSizeOnLine,
      isBold: lineIsBold,
      y: lastY || 0,
    });
  }

  if (lines.length === 0) return '';

  // Determine median body font size
  const fontSizes = lines.map((l) => l.fontSize).filter((s) => s > 0).sort((a, b) => a - b);
  const medianFontSize = fontSizes.length > 0 ? fontSizes[Math.floor(fontSizes.length / 2)] : 12;

  // Group lines into paragraphs and markdown headings
  const paragraphs: string[] = [];
  let currentPara: string[] = [];

  const flushPara = () => {
    if (currentPara.length > 0) {
      const p = currentPara.join(' ').replace(/\s{2,}/g, ' ').trim();
      if (p) paragraphs.push(p);
      currentPara = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text;

    // Filter out common PDF headers/footers (single page numbers)
    if (/^(page\s+)?\d+(\s+of\s+\d+)?$/i.test(text.trim())) {
      continue;
    }

    const isLargeHeading = line.fontSize > medianFontSize * 1.35;
    const isMediumHeading = line.fontSize > medianFontSize * 1.15 || (line.isBold && text.length < 80 && !text.endsWith('.'));
    const isBullet = /^([•\-*–—\u2022]|\d+[\.\)])\s+/i.test(text);

    if (isLargeHeading) {
      flushPara();
      paragraphs.push(`## ${text.replace(/^#+\s*/, '')}`);
    } else if (isMediumHeading) {
      flushPara();
      paragraphs.push(`### ${text.replace(/^#+\s*/, '')}`);
    } else if (isBullet) {
      flushPara();
      paragraphs.push(`- ${text.replace(/^[•\-*–—\u2022]\s*/, '')}`);
    } else {
      const prevLine = lines[i - 1];
      // Vertical gap larger than 1.8x line height indicates a paragraph break
      if (prevLine && Math.abs(prevLine.y - line.y) > medianFontSize * 1.8) {
        flushPara();
      }
      currentPara.push(text);
    }
  }
  flushPara();

  return paragraphs.join('\n\n');
}

/**
 * Fallback PDF stream decompressor for when PDF.js fails.
 * Searches for FlateDecode streams, decompresses them, and extracts text operators.
 * NEVER outputs raw binary byte garbage.
 */
async function extractTextFromPdfStreams(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('latin1').decode(bytes);
  const extractedLines: string[] = [];

  // Look for uncompressed Tj and TJ text operators
  const tjRegex = /\(([^)]+)\)\s*Tj|\[([^\]]+)\]\s*TJ/g;
  let match;
  while ((match = tjRegex.exec(text)) !== null) {
    if (match[1]) {
      const clean = match[1].replace(/\\([()\\])/g, '$1').trim();
      if (clean.length > 1 && /[A-Za-z0-9]/.test(clean)) extractedLines.push(clean);
    } else if (match[2]) {
      const parts = match[2].match(/\(([^)]+)\)/g);
      if (parts) {
        const line = parts.map((p) => p.slice(1, -1).replace(/\\([()\\])/g, '$1')).join(' ').trim();
        if (line.length > 1 && /[A-Za-z0-9]/.test(line)) extractedLines.push(line);
      }
    }
  }

  // If uncompressed operators yielded readable text, return it
  if (extractedLines.length > 5) {
    return extractedLines.join('\n');
  }

  // Attempt stream decompression using browser DecompressionStream if available
  if (typeof DecompressionStream !== 'undefined') {
    const streamStartRegex = /stream\r?\n/g;
    let streamMatch;
    let streamCount = 0;

    while ((streamMatch = streamStartRegex.exec(text)) !== null && streamCount < 20) {
      streamCount++;
      const startIdx = streamMatch.index + streamMatch[0].length;
      const endIdx = text.indexOf('endstream', startIdx);
      if (endIdx > startIdx && (endIdx - startIdx) > 20) {
        try {
          const rawStream = bytes.subarray(startIdx, endIdx);
          const ds = new DecompressionStream('deflate');
          const writer = ds.writable.getWriter();
          writer.write(rawStream);
          writer.close();
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
          const decompressed = new Uint8Array(totalLength);
          let offset = 0;
          for (const c of chunks) {
            decompressed.set(c, offset);
            offset += c.length;
          }
          const decompText = new TextDecoder('utf-8').decode(decompressed);

          let innerMatch;
          while ((innerMatch = tjRegex.exec(decompText)) !== null) {
            if (innerMatch[1]) {
              const clean = innerMatch[1].replace(/\\([()\\])/g, '$1').trim();
              if (clean.length > 1 && /[A-Za-z0-9]/.test(clean)) extractedLines.push(clean);
            }
          }
        } catch {
          // ignore stream decompression failure
        }
      }
    }
  }

  // Filter out any lines that are just symbols or control codes
  const validLines = extractedLines.filter((l) => {
    const alphanumericCount = (l.match(/[A-Za-z0-9]/g) || []).length;
    return alphanumericCount >= 4 && alphanumericCount / l.length > 0.4;
  });

  return validLines.join('\n');
}

/**
 * Extracts readable text from legacy binary Word (.doc) files.
 * Filters out OLE binary control structures and preserves actual text blocks.
 */
function extractTextFromBinaryDoc(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  
  // Try UTF-16LE first (standard in Word 97-2003 documents)
  try {
    const text16 = new TextDecoder('utf-16le').decode(bytes);
    const words16 = text16.match(/[\w\s,.\-!?:;"'()]{20,}/g);
    if (words16 && words16.length > 3) {
      const clean = words16
        .map((w) => w.trim())
        .filter((w) => {
          const alpha = (w.match(/[A-Za-z]/g) || []).length;
          return alpha > 10 && alpha / w.length > 0.5;
        });
      if (clean.length > 0) return clean.join('\n\n');
    }
  } catch {
    // ignore
  }

  // Fallback to ASCII
  const textAscii = new TextDecoder('latin1').decode(bytes);
  const matches = textAscii.match(/[A-Za-z0-9\s,.\-!?:;"'()]{25,}/g) || [];
  const cleanMatches = matches
    .map((m) => m.trim())
    .filter((m) => {
      const words = m.split(/\s+/).filter((w) => w.length > 2);
      return words.length >= 4;
    });

  return cleanMatches.join('\n\n');
}

/**
 * Clean and structure extracted text into readable markdown with clean headings & spacing.
 */
export function formatAsNotes(raw: string, docTitle: string): string {
  if (!raw || raw.trim().length < 5) {
    return `# ${docTitle}\n\n`;
  }
  return cleanAndFormatPastedText(raw, undefined, docTitle).markdown;
}

/**
 * Main import function — extracts clean, readable text and formats as markdown notes.
 */
export async function extractTextFromFile(file: File): Promise<{ title: string; content: string }> {
  const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
  const title = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // 1. Markdown (.md, .markdown) — keep pure markdown format
  if (ext === 'md' || ext === 'markdown') {
    const text = await file.text();
    return { title, content: text.trim() };
  }

  // 2. Word Document (.docx) — parse cleanly using Mammoth
  if (ext === 'docx' || file.type.includes('wordprocessingml')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const rawText = result.value || '';
      if (rawText.trim().length > 10) {
        return { title, content: formatAsNotes(rawText, title) };
      }
    } catch (docxErr) {
      console.warn('[File Importer] Mammoth docx extraction failed, trying fallback:', docxErr);
    }
  }

  // 3. Legacy Word Document (.doc) — extract readable UTF-16LE / ASCII text
  if (ext === 'doc' || file.type === 'application/msword') {
    try {
      const buffer = await file.arrayBuffer();
      const rawText = extractTextFromBinaryDoc(buffer);
      if (rawText.trim().length > 15) {
        return { title, content: formatAsNotes(rawText, title) };
      }
    } catch (docErr) {
      console.warn('[File Importer] .doc extraction failed:', docErr);
    }
  }

  // 4. HTML (.html, .htm) — parse via DOMParser for clean text
  if (ext === 'html' || ext === 'htm' || file.type.includes('html')) {
    try {
      const html = await file.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // Remove scripts and styles
      doc.querySelectorAll('script, style, noscript, svg, nav, footer').forEach((el) => el.remove());
      const bodyText = doc.body.innerText || doc.body.textContent || '';
      if (bodyText.trim().length > 5) {
        return { title, content: formatAsNotes(bodyText, title) };
      }
    } catch (htmlErr) {
      console.warn('[File Importer] HTML extraction failed:', htmlErr);
    }
  }

  // 5. Plain text, CSV, JSON, TSV
  if (
    ext === 'txt' ||
    ext === 'csv' ||
    ext === 'tsv' ||
    ext === 'json' ||
    file.type.includes('text') ||
    file.type.includes('json') ||
    file.type.includes('csv')
  ) {
    try {
      const text = await file.text();
      return { title, content: formatAsNotes(text, title) };
    } catch (textErr) {
      console.warn('[File Importer] Plain text reading failed:', textErr);
    }
  }

  // 6. PDF Documents (.pdf)
  if (ext === 'pdf' || file.type.includes('pdf')) {
    try {
      const buffer = await file.arrayBuffer();
      const pdfjs = await loadPdfJs();

      if (pdfjs) {
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(buffer),
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        const pageTexts: string[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const tc = await page.getTextContent();
            const pageText = extractStructuredPageText(tc);
            if (pageText.trim()) {
              pageTexts.push(pageText.trim());
            }
          } catch (pageErr) {
            console.warn(`[File Importer] Error extracting page ${i}:`, pageErr);
          }
        }

        const fullText = pageTexts.join('\n\n');

        if (fullText.trim().length > 20) {
          return {
            title,
            content: formatAsNotes(fullText, title),
          };
        }
      }

      // Fallback: stream decompression for text operators
      const fallbackText = await extractTextFromPdfStreams(buffer);
      if (fallbackText.trim().length > 20) {
        return {
          title,
          content: formatAsNotes(fallbackText, title),
        };
      }

      // If PDF has no text layer (e.g. scanned image / photo PDF), provide clean notice instead of gibberish
      return {
        title,
        content: `# ${title}\n\n> 📄 **Scanned or Image-Only PDF Notice:**\n> This PDF contains pages without an embedded digital text layer (such as scanned physical papers or photos).\n> \n> **Next Steps:**\n> - You can paste or type your study notes directly here.\n> - Or ask the **AI Tools** on the toolbar to analyze and summarize this topic.\n\n## Summary & Notes\n\n`,
      };
    } catch (pdfErr) {
      console.warn('[File Importer] PDF processing error:', pdfErr);
      return {
        title,
        content: `# ${title}\n\n> 📄 **Document Imported:** ${file.name}\n\n## Notes\n\n`,
      };
    }
  }

  // 7. Generic fallback for other file formats
  try {
    const text = await file.text();
    // Only accept if text is largely printable characters, not binary
    const nonPrintableCount = (text.match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
    if (nonPrintableCount < text.length * 0.05 && text.trim().length > 10) {
      return { title, content: formatAsNotes(text, title) };
    }
  } catch {
    // ignore
  }

  return {
    title,
    content: `# ${title}\n\n> 📁 **Attached Document:** ${file.name} (${(file.size / 1024).toFixed(1)} KB)\n\n## Key Notes & Takeaways\n\n`,
  };
}

/**
 * Strips Unicode emojis, decorative icons, and AI bullet symbols from text.
 * Converts decorative bullets (✦, ➤, ✔, etc.) into clean standard markdown dashes (-).
 */
export function removeEmojisAndIcons(text: string): string {
  if (!text) return '';

  // 1. Convert decorative bullet symbols at start of lines into standard markdown list bullets
  let res = text.replace(/^[ \t]*[✦✧★☆➤➢➔➜✔✖✗✘◆◇■□●○►▸▼▾❯❮❖❍❏❐❑❒▪•][ \t]*/gm, '- ');

  // 2. Remove all Unicode emojis and pictographs
  const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{FE00}-\u{FE0F}\u{200D}]/gu;
  res = res.replace(EMOJI_REGEX, '');

  // 3. Remove lingering icon decorators in headings or text
  res = res.replace(/[🚀📚💡🎯✨📌📝🔥🧠⚡🤖🌟📖🔍✅❌📊🔑🏆🕒🌿💎💬🏷️✦✧★☆➤➢➔➜✔✖✗✘◆◇■□●○►▸▼▾❯❮❖❍❏❐❑❒]/g, '');

  // 4. Normalize multiple horizontal spaces
  res = res.replace(/[^\S\n]{2,}/g, ' ');

  return res;
}

/**
 * Removes social / AI hashtags while preserving Markdown headings (# Heading, ## Heading).
 * - Drops pure hashtag lines: "#mindset #habits #growth"
 * - Drops tag metadata lines: "Tags: #tag1, #tag2"
 * - Strips trailing hashtags: "Text content. #tag1 #tag2" -> "Text content."
 * - Converts inline hashtags: "Focus on #productivity" -> "Focus on productivity"
 */
export function removeHashtags(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const cleanedLines: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      cleanedLines.push('');
      continue;
    }

    // A. Discard lines that are solely hashtags
    if (/^(#[A-Za-z0-9_\u0080-\uFFFF-]+\s*)+$/.test(trimmed)) {
      continue;
    }

    // B. Discard tag label lines
    if (/^(tags|hashtags|topics|keywords):\s*(#[A-Za-z0-9_\u0080-\uFFFF-]+\s*,?\s*)+$/i.test(trimmed)) {
      continue;
    }

    // C. Remove trailing hashtags from line end
    let l = rawLine.replace(/(\s+#[A-Za-z0-9_\u0080-\uFFFF-]+)+$/g, '');

    // D. Convert inline hashtags in sentences (preserving Markdown headings with space after #)
    l = l.replace(/(^|[^#&A-Za-z0-9_])#([A-Za-z][A-Za-z0-9_-]*)/g, '$1$2');

    cleanedLines.push(l);
  }

  return cleanedLines.join('\n');
}

/**
 * Removes conversational AI chatbot introductions and closers
 * (e.g. "Certainly! Here is...", "Hope this helps!", "Let me know if you need anything else")
 */
export function removeAiChatter(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const filtered: string[] = [];

  const AI_OPENER_REGEX = /^(certainly|sure thing|sure|of course|here is|here are|here's|below is|following is|as requested|glad to help|here you go)\b.*[:.!]?$/i;
  const AI_CLOSER_REGEX = /\b(hope this helps|let me know if you need anything else|feel free to ask|hope you found this (helpful|useful)|let me know if you('d| would) like)\b.*[.!]?$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Only strip openers near the very start
    if (filtered.length < 3 && AI_OPENER_REGEX.test(line)) {
      continue;
    }
    // Only strip closers near the very end
    if (i >= lines.length - 4 && AI_CLOSER_REGEX.test(line)) {
      continue;
    }
    filtered.push(lines[i]);
  }

  return filtered.join('\n');
}

/**
 * Deduplicates paragraphs, sections, list items, and consecutive duplicate lines.
 */
export function deduplicateContentBlocks(blocks: string[], documentTitle?: string): string[] {
  const seenSignatures = new Set<string>();
  const normalizedTitle = documentTitle ? documentTitle.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const result: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const rawBlock = blocks[i].trim();
    if (!rawBlock) continue;

    // Preserved dividers
    if (rawBlock === '---' || rawBlock === '***') {
      result.push('---');
      continue;
    }

    // Split block into individual lines to check for list items and duplicate lines
    const lines = rawBlock.split('\n');
    const seenLineSignatures = new Set<string>();
    const cleanLines: string[] = [];

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx].trim();
      if (!line) continue;

      const isListItem = /^([-*•]|\d+[\.\)])\s+/.test(line);
      const lineSig = line.toLowerCase().replace(/^([-*•]|\d+[\.\)]|#{1,6})\s+/, '').replace(/[^a-z0-9]/g, '');

      // Deduplicate identical list items or repeated lines inside this block
      if (isListItem && lineSig && seenLineSignatures.has(lineSig)) {
        continue;
      }
      if (lineSig) seenLineSignatures.add(lineSig);
      cleanLines.push(line);
    }

    if (cleanLines.length === 0) continue;
    const cleanedBlock = cleanLines.join('\n');

    const blockSig = cleanedBlock
      .toLowerCase()
      .replace(/^#{1,6}\s+/, '')
      .replace(/^[*-•]\s+/gm, '')
      .replace(/[^a-z0-9]/g, '');

    if (i === 0 && normalizedTitle && blockSig === normalizedTitle) {
      continue;
    }
    if (blockSig.length > 8 && seenSignatures.has(blockSig)) {
      continue;
    }

    if (blockSig.length > 8) seenSignatures.add(blockSig);
    result.push(cleanedBlock);
  }

  return result;
}

/**
 * Transforms pasted text or HTML (from websites, PDFs, Word, emails, notes)
 * into clean, publication-ready Book format markdown with structured headings,
 * flowing paragraphs, and clean typography without icons, hashtags, or duplicate text.
 */
export function cleanAndFormatPastedText(
  plainText: string,
  htmlText?: string,
  fallbackTitle?: string
): { title: string; markdown: string } {
  let sourceText = plainText || '';

  // 1. If HTML is available, attempt to extract clean structured markdown from it
  if (htmlText && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');
      doc.querySelectorAll('script, style, noscript, svg, nav, footer, iframe, link').forEach((el) => el.remove());

      const elements = doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, hr');
      if (elements.length > 0) {
        const parts: string[] = [];
        elements.forEach((el) => {
          const tag = el.tagName.toLowerCase();
          const t = el.textContent?.trim() || '';
          if (!t && tag !== 'hr') return;

          if (tag === 'h1') parts.push(`# ${t}`);
          else if (tag === 'h2') parts.push(`## ${t}`);
          else if (tag === 'h3') parts.push(`### ${t}`);
          else if (tag === 'h4' || tag === 'h5' || tag === 'h6') parts.push(`#### ${t}`);
          else if (tag === 'p') parts.push(t);
          else if (tag === 'blockquote') parts.push(`> ${t}`);
          else if (tag === 'pre') parts.push(`\`\`\`\n${t}\n\`\`\``);
          else if (tag === 'hr') parts.push('---');
          else if (tag === 'ul' || tag === 'ol') {
            const listItems = Array.from(el.querySelectorAll('li')).map((li, idx) => {
              const liText = li.textContent?.trim() || '';
              return tag === 'ol' ? `${idx + 1}. ${liText}` : `- ${liText}`;
            });
            if (listItems.length > 0) parts.push(listItems.join('\n'));
          }
        });

        if (parts.length > 0) {
          sourceText = parts.join('\n\n');
        }
      }
    } catch {
      // fallback to plainText
    }
  }

  if (!sourceText.trim()) {
    return { title: fallbackTitle || 'Untitled Note', markdown: '' };
  }

  // 2. Sanitization Pipeline: Remove AI chatter, remove hashtags, and remove icons/emojis
  sourceText = removeAiChatter(sourceText);
  sourceText = removeHashtags(sourceText);
  sourceText = removeEmojisAndIcons(sourceText);

  // 3. Normalization of whitespace, word spacing, and punctuation
  let clean = sourceText
    .replace(/\r\n|\r/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/\u00A0/g, ' ') // convert non-breaking spaces
    // Rejoin hyphenated word breaks from PDF wraps: "devel-\n opment" -> "development"
    .replace(/(\b[A-Za-z]{2,})-\s*\n\s*([A-Za-z]{2,}\b)/g, '$1$2')
    // Rejoin mid-sentence lines where a line ends in a lowercase word/comma and next line begins with lowercase
    .replace(/([a-z0-9,;])\n([a-z])/g, '$1 $2')
    // Remove space before punctuation: "word , " -> "word, "
    .replace(/[^\S\n]+([,.:;?!])/g, '$1')
    // Ensure space after punctuation when followed immediately by a letter (avoiding URLs like https://)
    .replace(/([,;?!])([A-Za-z])/g, '$1 $2')
    .replace(/(\.)([A-Z])/g, '$1 $2')
    // Collapse multiple horizontal spaces to single space
    .replace(/[^\S\n]{2,}/g, ' ')
    // Normalize newlines to max 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Split into paragraphs / blocks
  const rawBlocks = clean.split(/\n{2,}/);
  const formattedBlocks: string[] = [];
  let extractedTitle = '';

  const titleCase = (str: string): string => {
    const minor = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'as']);
    return str
      .toLowerCase()
      .split(' ')
      .map((w, idx) => (idx === 0 || !minor.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  };

  for (let bIdx = 0; bIdx < rawBlocks.length; bIdx++) {
    const block = rawBlocks[bIdx].trim();
    if (!block) continue;

    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // If first block has a clear single-line title candidate, extract it
    if (bIdx === 0 && !extractedTitle) {
      const firstLine = lines[0];
      if (firstLine.startsWith('# ')) {
        extractedTitle = firstLine.replace(/^#+\s*/, '').trim();
        if (lines.length > 1) {
          formattedBlocks.push(lines.slice(1).join(' '));
        }
        continue;
      } else if (
        firstLine.length >= 3 &&
        firstLine.length < 75 &&
        !firstLine.endsWith('.') &&
        !firstLine.includes(':') &&
        (firstLine === firstLine.toUpperCase() || lines.length === 1)
      ) {
        extractedTitle = titleCase(firstLine);
        if (lines.length > 1) {
          formattedBlocks.push(lines.slice(1).join(' '));
        }
        continue;
      }
    }

    // Check if it's already markdown heading
    const isMarkdownHeading = /^#{1,4}\s+/.test(lines[0]);
    if (isMarkdownHeading) {
      formattedBlocks.push(lines.join('\n'));
      continue;
    }

    // Only convert to formal section heading (##) if it's an explicit chapter/section label
    // Avoid turning regular numbered list items (e.g. "1. First step") into huge headings!
    const isExplicitSectionHeading = /^(Chapter|Section|Part|Module|Unit|Lesson)\s+\d+[:\-—–.]?\s*(.*)$/i.exec(lines[0]);
    if (isExplicitSectionHeading && lines[0].length < 80) {
      const label = titleCase(lines[0].replace(/[.:;]$/, ''));
      const rest = lines.slice(1).join(' ').trim();
      formattedBlocks.push(`## ${label}`);
      if (rest) formattedBlocks.push(rest);
      continue;
    }

    // Check for short ALL-CAPS section banner (e.g. "OVERVIEW", "KEY PRINCIPLES")
    if (
      lines[0].length > 3 &&
      lines[0].length < 50 &&
      lines[0] === lines[0].toUpperCase() &&
      /^[A-Z\s&,—–-]+$/.test(lines[0]) &&
      !lines[0].includes(':') &&
      !lines[0].includes('.')
    ) {
      const heading = titleCase(lines[0]);
      const rest = lines.slice(1).join(' ').trim();
      formattedBlocks.push(`## ${heading}`);
      if (rest) formattedBlocks.push(rest);
      continue;
    }

    // Check if lines are a bulleted or numbered list
    const isListBlock = lines.every((l) => /^([•\-*–—▪\u2022]|\d+[\.\)])\s+/.test(l));
    if (isListBlock) {
      const isNumbered = /^\d+[\.\)]\s+/.test(lines[0]);
      const listItems = lines.map((l, i) => {
        const text = l.replace(/^([•\-*–—▪\u2022]|\d+[\.\)])\s+/, '').trim();
        return isNumbered ? `${i + 1}. ${text}` : `- ${text}`;
      });
      formattedBlocks.push(listItems.join('\n'));
      continue;
    }

    // Check for definition terms: "Cost: $15.50", "Packaging: Biodegradable pouch"
    const isDefinitionBlock = lines.every((l) => /^([A-Za-z\s]{2,25}):\s+(.+)$/.test(l));
    if (isDefinitionBlock) {
      const defItems = lines.map((l) => {
        const m = l.match(/^([A-Za-z\s]{2,25}):\s+(.+)$/);
        return m ? `**${titleCase(m[1].trim())}:** ${m[2].trim()}` : l;
      });
      formattedBlocks.push(defItems.join('\n\n'));
      continue;
    }

    // Standard formal paragraph: join hard-wrapped lines into a flowing, readable paragraph
    let para = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const defMatch = line.match(/^([A-Za-z\s]{2,25}):\s+(.+)$/);
      if (defMatch && line.length < 80 && lines.length > 1) {
        if (para) {
          formattedBlocks.push(para);
          para = '';
        }
        formattedBlocks.push(`**${titleCase(defMatch[1].trim())}:** ${defMatch[2].trim()}`);
        continue;
      }

      if (!para) {
        para = line;
      } else {
        if (para.endsWith('-')) {
          para = para.slice(0, -1) + line;
        } else {
          para += ' ' + line;
        }
      }
    }
    if (para) {
      formattedBlocks.push(para);
    }
  }

  const finalTitle = extractedTitle || fallbackTitle || 'Untitled Note';

  // 4. Run deduplication on all formatted blocks and lists
  const deduplicatedBlocks = deduplicateContentBlocks(formattedBlocks, finalTitle);
  const body = deduplicatedBlocks.join('\n\n').trim();

  let finalMarkdown = body;
  if (!finalMarkdown.startsWith('# ')) {
    finalMarkdown = `# ${finalTitle}\n\n${finalMarkdown}`;
  }

  return {
    title: finalTitle,
    markdown: finalMarkdown,
  };
}

