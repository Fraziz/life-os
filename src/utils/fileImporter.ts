/**
 * Extracts clean text from PDF, Text, Markdown, and document files.
 * Works entirely client-side in the browser.
 * Auto-formats extracted content into clean Knowledge Base notes.
 */

// Dynamically load PDF.js from CDN if available
async function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      resolve(lib);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

/**
 * Fallback raw text stream extractor from PDF ArrayBuffer
 */
function extractRawPdfText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('latin1').decode(bytes);
  const matches: string[] = [];

  const streamRegex = /\(([^)]+)\)\s*Tj|\[([^\]]+)\]\s*TJ/g;
  let match;
  while ((match = streamRegex.exec(text)) !== null) {
    if (match[1]) {
      matches.push(match[1]);
    } else if (match[2]) {
      const sub = match[2].replace(/\(([^)]+)\)/g, '$1 ');
      matches.push(sub);
    }
  }

  if (matches.length > 0) return matches.join(' ');

  const asciiMatches = text.match(/[A-Za-z0-9 ,.!?;:'"()\-]{4,}/g);
  return asciiMatches ? asciiMatches.join(' ') : '';
}

/**
 * Smart formatter: turns raw extracted text into an automatic formal executive document.
 * - Detects likely headings (ALL-CAPS or short title-case lines)
 * - Numbered section structure (1. Executive Summary, 2. Core Concepts, 3. Key Insights, etc.)
 * - Formats list items, cleans whitespace and removes PDF junk artifacts
 * - Adds a formal executive header, structured takeaways, and action items
 */
export function formatAsNotes(raw: string, docTitle: string): string {
  if (!raw || raw.trim().length < 5) return `# ${docTitle}\n\n> Formal Document Record\n\n`;

  let text = raw
    .replace(/\r\n|\r/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([a-z,;])\n([A-Za-z])/g, '$1 $2')
    .replace(/- \n/g, '')
    .trim();

  const lines = text.split('\n');
  const formatted: string[] = [];
  let currentParagraph: string[] = [];

  const isLikelyHeading = (line: string): boolean => {
    const t = line.trim();
    if (!t || t.length > 80) return false;
    if (t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
    if (t.length < 60 && !/[.!?,;]$/.test(t) && /^[A-Z]/.test(t)) return true;
    return false;
  };

  const isListItem = (line: string): boolean =>
    /^[\u2022\u2013\u2014\-\*\u00b7]\s/.test(line.trim()) || /^\d+[.)]\s/.test(line.trim());

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const para = currentParagraph.join(' ').trim();
      if (para) formatted.push(para);
      currentParagraph = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); continue; }

    if (isLikelyHeading(line)) {
      flushParagraph();
      const level = line.length < 30 ? '###' : '####';
      const txt = line.charAt(0).toUpperCase() + line.slice(1).toLowerCase();
      formatted.push(`${level} ${txt}`);
      continue;
    }

    if (isListItem(line)) {
      flushParagraph();
      const bullet = line.replace(/^[\u2022\u2013\u2014\-\*\u00b7]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
      formatted.push(`- ${bullet}`);
      continue;
    }

    currentParagraph.push(line);
  }
  flushParagraph();

  // Extract first paragraph for executive summary if available
  const firstPara = formatted.find((p) => !p.startsWith('#') && !p.startsWith('-')) || 'Comprehensive reference document and working notes.';
  const bodyItems = formatted.filter((p) => p !== firstPara);
  const bodyContent = bodyItems.join('\n\n').trim();

  return `# ${docTitle}

> **DOCUMENT TYPE**: Formal Executive Record & Knowledge Asset  
> **CLASSIFICATION**: Official / Standard Operating Knowledge  
> **READING FORMAT**: Formatted for Executive Review & Book Mode

---

## 1. Executive Summary
${firstPara}

---

## 2. Core Content & Structured Findings

${bodyContent || '*Detailed reference content from source document.*'}

---

## 3. Key Takeaways & Strategic Insights
- >>>Main strategic principle or core takeaway from this document<<<
- !!Crucial rule, metric, or requirement to keep in mind!!
- ==Key definition or important fact for reference==

---

## 4. Action Items & Execution Checklist
- [ ] Review core findings and extract actionable next steps
- [ ] Apply highlighted principles to relevant active projects
- [ ] Annotate additional observations using the color highlight palette

---

## 5. Working Annotations & Research Notes
*Personal working notes and colored highlights:*
- =={yellow}Yellow for primary takeaways==
- =={cyan}Cyan for technical concepts and terms==
- =={purple}Purple for strategic ideas==
`;
}

/**
 * Clean extracted text helper
 */
export function cleanExtractedText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\([()\\])/g, '$1')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Main import function — extracts text and auto-formats as clean notes
 */
export async function extractTextFromFile(file: File): Promise<{ title: string; content: string }> {
  const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
  const title = baseName.charAt(0).toUpperCase() + baseName.slice(1);

  // 1. Markdown — keep as-is
  if (file.name.endsWith('.md')) {
    const text = await file.text();
    return { title, content: text.trim() };
  }

  // 2. Plain text / CSV / JSON / HTML
  if (
    file.type.includes('text') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.csv') ||
    file.name.endsWith('.json') ||
    file.name.endsWith('.html')
  ) {
    const text = await file.text();
    return { title, content: formatAsNotes(text, title) };
  }

  // 3. PDF
  if (file.type.includes('pdf') || file.name.endsWith('.pdf')) {
    try {
      const buffer = await file.arrayBuffer();
      const pdfjs = await loadPdfJs();

      if (pdfjs) {
        const pdf = await pdfjs.getDocument({ data: buffer }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          const str = tc.items.map((item: any) => item.str || '').join(' ').trim();
          if (str) pages.push(str);
        }
        const raw = pages.join('\n\n');
        return {
          title,
          content: raw
            ? formatAsNotes(raw, title)
            : `# ${title}\n\n> Could not extract text from this PDF.\n\n## My Notes\n\n`,
        };
      }

      const raw = extractRawPdfText(buffer);
      return {
        title,
        content: raw
          ? formatAsNotes(raw, title)
          : `# ${title}\n\n> No readable text in this PDF.\n\n## My Notes\n\n`,
      };
    } catch (err) {
      console.warn('PDF extraction error:', err);
      try {
        const buffer = await file.arrayBuffer();
        const raw = extractRawPdfText(buffer);
        return {
          title,
          content: raw
            ? formatAsNotes(raw, title)
            : `# ${title}\n\n## My Notes\n\n`,
        };
      } catch {
        return { title, content: `# ${title}\n\n## My Notes\n\n` };
      }
    }
  }

  // 4. Other files
  try {
    const text = await file.text();
    return { title, content: formatAsNotes(text, title) };
  } catch {
    return {
      title,
      content: `# ${title}\n\n> [File: ${file.name} — ${(file.size / 1024).toFixed(1)} KB]\n\n## My Notes\n\n`,
    };
  }
}
