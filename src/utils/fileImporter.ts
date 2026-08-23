/**
 * Extracts clean text from PDF, Text, Markdown, and document files.
 * Works entirely client-side in the browser.
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

  // Match text in Tj, TJ, or parenthesis blocks
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

  if (matches.length > 0) {
    return cleanExtractedText(matches.join(' '));
  }

  // Fallback: extract plain ascii strings
  const asciiMatches = text.match(/[A-Za-z0-9 ,.!?;:'"()\-]{4,}/g);
  return asciiMatches ? cleanExtractedText(asciiMatches.join(' ')) : '';
}

/**
 * Clean and structure extracted text into readable markdown paragraphs
 */
export function cleanExtractedText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\([()\\])/g, '$1') // unescape pdf characters
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Main import function: takes a File object, extracts text and returns title + markdown content
 */
export async function extractTextFromFile(file: File): Promise<{ title: string; content: string }> {
  const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
  const title = baseName.charAt(0).toUpperCase() + baseName.slice(1);

  // 1. Plain text / Markdown / CSV / JSON
  if (
    file.type.includes('text') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.md') ||
    file.name.endsWith('.csv') ||
    file.name.endsWith('.json') ||
    file.name.endsWith('.html')
  ) {
    const text = await file.text();
    return {
      title,
      content: text.trim(),
    };
  }

  // 2. PDF Document
  if (file.type.includes('pdf') || file.name.endsWith('.pdf')) {
    try {
      const buffer = await file.arrayBuffer();
      const pdfjs = await loadPdfJs();

      if (pdfjs) {
        const loadingTask = pdfjs.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        const pageTexts: string[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tokenized = await page.getTextContent();
          const pageStr = tokenized.items
            .map((item: any) => item.str || '')
            .join(' ');
          if (pageStr.trim()) {
            pageTexts.push(`### Page ${i}\n\n${pageStr.trim()}`);
          }
        }

        const fullContent = pageTexts.join('\n\n---\n\n');
        return {
          title,
          content: fullContent || extractRawPdfText(buffer),
        };
      }

      // If PDF.js couldn't be loaded (e.g. offline), use internal stream extractor
      const extracted = extractRawPdfText(buffer);
      return {
        title,
        content: extracted || `[Imported PDF Document: ${file.name}]\n\n(No readable text streams detected in this PDF.)`,
      };
    } catch (err) {
      console.warn('PDF extraction error, falling back:', err);
      const buffer = await file.arrayBuffer();
      const extracted = extractRawPdfText(buffer);
      return {
        title,
        content: extracted || `[Imported PDF Document: ${file.name}]`,
      };
    }
  }

  // 3. Other files (attempt text decoding)
  try {
    const text = await file.text();
    return {
      title,
      content: text.trim(),
    };
  } catch {
    return {
      title,
      content: `[Attached file: ${file.name} — Size: ${(file.size / 1024).toFixed(1)} KB]`,
    };
  }
}
