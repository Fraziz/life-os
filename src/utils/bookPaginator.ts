/**
 * Intelligent Book Paginator for Life OS
 * Splits Markdown or extracted text documents into discrete, beautifully proportioned
 * book pages that mimic reading a physical book or e-reader (Kindle/Apple Books).
 *
 * - Targets ~280 words per page (standard physical trade book density).
 * - Respects natural chapter boundaries (# and ## headings start fresh pages when appropriate).
 * - Respects explicit dividers (--- or <!-- pagebreak -->).
 * - Never breaks code blocks, tables, or list items mid-way.
 * - Tracks running chapter titles for header placement.
 */

export interface BookPage {
  pageNumber: number;
  content: string;
  chapterTitle?: string;
  wordCount: number;
}

function countWords(str: string): number {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Splits raw markdown into semantic blocks (paragraphs, headers, code blocks, tables, dividers).
 */
function parseIntoSemanticBlocks(rawContent: string): { type: string; text: string; words: number; headerTitle?: string }[] {
  const lines = rawContent.split(/\r?\n/);
  const blocks: { type: string; text: string; words: number; headerTitle?: string }[] = [];

  let currentBlockLines: string[] = [];
  let inCodeBlock = false;
  let inTable = false;

  const flushCurrent = (type = 'paragraph') => {
    if (currentBlockLines.length === 0) return;
    const text = currentBlockLines.join('\n').trim();
    if (text) {
      blocks.push({
        type,
        text,
        words: countWords(text),
      });
    }
    currentBlockLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block fences
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        currentBlockLines.push(line);
        flushCurrent('code');
        inCodeBlock = false;
        continue;
      } else {
        flushCurrent();
        inCodeBlock = true;
        currentBlockLines.push(line);
        continue;
      }
    }

    if (inCodeBlock) {
      currentBlockLines.push(line);
      continue;
    }

    // Explicit Page Break / Dividers
    if (trimmed === '---' || trimmed === '***' || trimmed === '___' || trimmed === '<!-- pagebreak -->' || trimmed === '\f') {
      flushCurrent();
      blocks.push({
        type: 'divider',
        text: '---',
        words: 0,
      });
      continue;
    }

    // Markdown Headings
    if (/^#{1,3}\s+/.test(trimmed)) {
      flushCurrent();
      const headerTitle = trimmed.replace(/^#{1,3}\s+/, '').replace(/[*_#`]/g, '').trim();
      blocks.push({
        type: 'heading',
        text: trimmed,
        words: countWords(trimmed),
        headerTitle,
      });
      continue;
    }

    // Table rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable) {
        flushCurrent();
        inTable = true;
      }
      currentBlockLines.push(line);
      continue;
    } else if (inTable) {
      flushCurrent('table');
      inTable = false;
    }

    // Blank line indicates paragraph boundary
    if (!trimmed) {
      if (currentBlockLines.length > 0) {
        flushCurrent();
      }
      continue;
    }

    currentBlockLines.push(line);
  }

  flushCurrent(inTable ? 'table' : inCodeBlock ? 'code' : 'paragraph');
  return blocks;
}

/**
 * Paginates markdown content into pages.
 * @param rawContent Full markdown or plain text of the book
 * @param targetWordsPerPage Default target word count per page (~280 words)
 */
export function paginateBook(rawContent: string, targetWordsPerPage: number = 280): BookPage[] {
  if (!rawContent || !rawContent.trim()) {
    return [
      {
        pageNumber: 1,
        content: '',
        chapterTitle: 'Empty Book',
        wordCount: 0,
      },
    ];
  }

  const blocks = parseIntoSemanticBlocks(rawContent);
  if (blocks.length === 0) {
    return [
      {
        pageNumber: 1,
        content: rawContent,
        chapterTitle: 'Cover',
        wordCount: countWords(rawContent),
      },
    ];
  }

  const pages: BookPage[] = [];
  let currentPageBlocks: string[] = [];
  let currentPageWords = 0;
  let currentChapterTitle: string | undefined = undefined;
  let pageChapterTitle: string | undefined = undefined;

  const finalizePage = () => {
    if (currentPageBlocks.length === 0) return;
    pages.push({
      pageNumber: pages.length + 1,
      content: currentPageBlocks.join('\n\n').trim(),
      chapterTitle: pageChapterTitle || currentChapterTitle,
      wordCount: currentPageWords,
    });
    currentPageBlocks = [];
    currentPageWords = 0;
    pageChapterTitle = undefined;
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Explicit divider signals an immediate page turn
    if (block.type === 'divider') {
      finalizePage();
      continue;
    }

    // If it's a major heading (H1 / H2)
    if (block.type === 'heading') {
      currentChapterTitle = block.headerTitle;

      // If we already have a healthy chunk of reading on this page (> 80 words),
      // give the new chapter/section a fresh clean page like real books do!
      if (currentPageWords >= 80) {
        finalizePage();
      }

      if (!pageChapterTitle) {
        pageChapterTitle = block.headerTitle;
      }
      currentPageBlocks.push(block.text);
      currentPageWords += block.words;
      continue;
    }

    // Very large unbroken paragraphs: split by sentences if single paragraph exceeds 350 words
    if (block.words > 350 && block.type === 'paragraph') {
      const sentences = block.text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [block.text];
      let subBuffer: string[] = [];
      let subWords = 0;

      for (const sentence of sentences) {
        const sWords = countWords(sentence);
        if (currentPageWords + subWords + sWords > targetWordsPerPage && (currentPageWords + subWords) >= 120) {
          if (subBuffer.length > 0) {
            currentPageBlocks.push(subBuffer.join(' '));
            currentPageWords += subWords;
            subBuffer = [];
            subWords = 0;
          }
          finalizePage();
        }
        subBuffer.push(sentence.trim());
        subWords += sWords;
      }

      if (subBuffer.length > 0) {
        currentPageBlocks.push(subBuffer.join(' '));
        currentPageWords += subWords;
      }
      continue;
    }

    // Normal block: check if adding it exceeds page target
    if (currentPageWords > 0 && currentPageWords + block.words > targetWordsPerPage && currentPageWords >= 160) {
      finalizePage();
    }

    currentPageBlocks.push(block.text);
    currentPageWords += block.words;
  }

  // Push final page
  finalizePage();

  return pages.length > 0
    ? pages
    : [
        {
          pageNumber: 1,
          content: rawContent,
          chapterTitle: 'Cover',
          wordCount: countWords(rawContent),
        },
      ];
}
