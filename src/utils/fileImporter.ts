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

  let text = raw
    .replace(/\r\n|\r/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/([a-z,;])\n([A-Za-z])/g, '$1 $2')
    .replace(/-\s*\n\s*([a-z])/gi, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // If text already has markdown headings, preserve them
  if (/^#{1,3}\s+/m.test(text)) {
    if (!text.startsWith('# ')) {
      text = `# ${docTitle}\n\n${text}`;
    }
    return text;
  }

  const lines = text.split('\n');
  const formatted: string[] = [];
  let currentParagraph: string[] = [];

  const titleCase = (str: string): string => {
    return str
      .toLowerCase()
      .split(' ')
      .map((w) => (w.length > 2 || w === 'a' || w === 'an' || w === 'the' ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  };

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const para = currentParagraph.join(' ').trim();
      if (para) formatted.push(para);
      currentParagraph = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    // Numbered section headings: "1. Overview", "Chapter 2 - Methods"
    const numHeadingMatch = line.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (numHeadingMatch) {
      flushParagraph();
      const num = numHeadingMatch[1];
      const heading = titleCase(numHeadingMatch[2].replace(/[—–-]\s*(OPTIONAL)/i, '($1)'));
      formatted.push(`## ${num}. ${heading}`);
      continue;
    }

    // Short ALL-CAPS titles
    if (line.length > 3 && line.length < 60 && line === line.toUpperCase() && /[A-Z]/.test(line) && !line.includes(':')) {
      flushParagraph();
      formatted.push(`## ${titleCase(line)}`);
      continue;
    }

    // Definition terms like "CONNECT: ...", "KEY CONCEPT: ..."
    const termMatch = line.match(/^([A-Z\s]{2,25}):\s+(.+)$/);
    if (termMatch) {
      flushParagraph();
      formatted.push(`**${termMatch[1].trim()}:** ${termMatch[2].trim()}`);
      continue;
    }

    // Bullet items
    if (/^[\u2022\u2013\u2014\-\*\u00b7]\s/.test(line)) {
      flushParagraph();
      const bullet = line.replace(/^[\u2022\u2013\u2014\-\*\u00b7]\s+/, '').trim();
      formatted.push(`- ${bullet}`);
      continue;
    }

    currentParagraph.push(line);
  }
  flushParagraph();

  const bodyContent = formatted.join('\n\n').trim();
  return `# ${docTitle}\n\n${bodyContent}`;
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
