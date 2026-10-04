import { executeOptionalAICall } from './aiEngine';
import { removeEmojisAndIcons, removeHashtags, removeAiChatter } from './fileImporter';
import type { UserSettings } from '@/types';

/**
 * Capitalizes string nicely in Title Case for formal headings
 */
function toTitleCase(str: string): string {
  const minorWords = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'as']);
  return str
    .toLowerCase()
    .split(' ')
    .map((w, idx) => {
      if (idx === 0 || !minorWords.has(w)) {
        return w.charAt(0).toUpperCase() + w.slice(1);
      }
      return w;
    })
    .join(' ');
}

/**
 * Intelligent Document & Note Formatter
 * Breaks walls of messy/unorganized text into clean, formal, beautifully spaced book/executive documents.
 */
export function formatNotesLocally(rawText: string, docTitle = 'Document'): string {
  if (!rawText || rawText.trim().length === 0) {
    return `<p>Start typing or pasting your notes here...</p>`;
  }

  // 1. Initial cleanup of dirty HTML, AI chatter, hashtags, icons, and spam markers
  let text = removeAiChatter(rawText);
  text = removeHashtags(text);
  text = removeEmojisAndIcons(text);

  text = text
    .replace(/(💡\s*(Core Takeaway|Key Idea):\s*)+/gi, '')
    .replace(/(⚡\s*(Must-Know Rule|Important):\s*)+/gi, '')
    .replace(/<div class="key-idea"[^>]*>([\s\S]*?)<\/div>/gi, (_, inner) => inner.replace(/<[^>]+>/g, ' ').trim() + '\n\n')
    .replace(/<div class="process-flow"[^>]*>([\s\S]*?)<\/div>/gi, (_, inner) => inner.replace(/<[^>]+>/g, ' ').trim() + '\n\n')
    .replace(/<div class="formula-box"[^>]*>([\s\S]*?)<\/div>/gi, (_, inner) => inner.replace(/<[^>]+>/g, ' ').trim() + '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|\u00A0/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r\n|\r/g, '\n');

  // 2. Normalize word and punctuation spacing
  text = text
    // Rejoin hyphenated line wrap words: "inter-\n esting" -> "interesting"
    .replace(/(\b[A-Za-z]{2,})-\s*\n\s*([a-z]{2,}\b)/g, '$1$2')
    // Rejoin mid-sentence lines
    .replace(/([a-z0-9,;])\n([a-z])/g, '$1 $2')
    // Remove space before punctuation: "word , " -> "word, "
    .replace(/[^\S\n]+([,.:;?!])/g, '$1')
    // Ensure space after punctuation before letters (skip URLs)
    .replace(/([,;?!])([A-Za-z])/g, '$1 $2')
    .replace(/(\.)([A-Z])/g, '$1 $2')
    // Collapse multiple horizontal spaces
    .replace(/[^\S\n]{2,}/g, ' ')
    // Normalize newlines to max 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const rawBlocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const outputBlocks: string[] = [];

  for (let bIndex = 0; bIndex < rawBlocks.length; bIndex++) {
    const block = rawBlocks[bIndex];
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);

    // If block has multiple lines that are a list
    if (lines.length > 1) {
      const isList = lines.every((l) => /^([•\-*–—▪\u2022]|\d+[\.\)])\s+/.test(l));
      if (isList) {
        const isNum = /^\d+[\.\)]\s+/.test(lines[0]);
        const tag = isNum ? 'ol' : 'ul';
        const listItems = lines.map((l, idx) => {
          const cleanItem = l.replace(/^([•\-*–—▪\u2022]|\d+[\.\)])\s*/, '').trim();
          return isNum ? `<li class="ol-item"><span class="ol-num">${idx + 1}.</span>${cleanItem}</li>` : `<li>${cleanItem}</li>`;
        }).join('');
        outputBlocks.push(`<${tag}>${listItems}</${tag}>`);
        continue;
      }
    }

    const singleLine = block.replace(/\s+/g, ' ').trim();

    // Check if it's an explicit chapter or section heading
    const chapterMatch = singleLine.match(/^(Chapter|Section|Part|Module|Unit|Lesson)\s+\d+[:\-—–.]?\s*(.*)$/i);
    if (chapterMatch && singleLine.length < 80) {
      outputBlocks.push(`<h2>${toTitleCase(singleLine.replace(/[.:;]$/, ''))}</h2>`);
      continue;
    }

    // Standalone ALL-CAPS Major Heading: "THE GOLDEN RULE"
    if (
      singleLine.length > 3 &&
      singleLine.length < 50 &&
      singleLine === singleLine.toUpperCase() &&
      /^[A-Z\s&,—–-]+$/.test(singleLine) &&
      !singleLine.includes(':') &&
      !singleLine.includes('.')
    ) {
      outputBlocks.push(`<h2>${toTitleCase(singleLine)}</h2>`);
      continue;
    }

    // Blockquote
    if (singleLine.startsWith('>')) {
      const quoteText = singleLine.replace(/^>\s*/, '').trim();
      outputBlocks.push(`<blockquote class="callout">${quoteText}</blockquote>`);
      continue;
    }

    // Definition / Term Line: "Term: Description"
    const termMatch = singleLine.match(/^([A-Za-z\s]{2,24}):\s*(.+)$/);
    if (termMatch && termMatch[1].length < 30) {
      const term = toTitleCase(termMatch[1].trim());
      const desc = termMatch[2].trim();
      outputBlocks.push(`<p><strong>${term}:</strong> ${desc}</p>`);
      continue;
    }

    // Single bullet line
    if (/^[•\-*–—▪\u2022]\s+/.test(singleLine)) {
      const cleanItem = singleLine.replace(/^[•\-*–—▪\u2022]\s*/, '').trim();
      outputBlocks.push(`<ul><li>${cleanItem}</li></ul>`);
      continue;
    }

    // Single numbered item
    const singleNumMatch = singleLine.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (singleNumMatch) {
      const num = singleNumMatch[1];
      const cleanItem = singleNumMatch[2].trim();
      outputBlocks.push(`<ol><li class="ol-item"><span class="ol-num">${num}.</span>${cleanItem}</li></ol>`);
      continue;
    }

    // Standard Clean Paragraph
    outputBlocks.push(`<p>${singleLine}</p>`);
  }

  return outputBlocks.join('\n');
}

/**
 * Main AI Note Formatter
 */
export async function formatStudyNotesWithAI(
  rawContent: string,
  docTitle: string,
  userSettings?: UserSettings
): Promise<{ formattedHtml: string; isAI: boolean }> {
  const aiSettings = userSettings?.aiSettings;

  if (aiSettings?.apiKey && aiSettings?.provider) {
    try {
      const systemPrompt = `You are an expert editorial designer and document typographer.
Your job is to format the given raw notes into a formal, calm, publication-grade document designed for distraction-free reading.

Formatting Rules:
1. UNIFORM FONT HIERARCHY: Maintain the exact same comfortable body font size across all paragraphs, list items, quotes, and definitions.
2. QUIET HEADINGS: Use understated <h2> headings in Title Case (e.g. <h2>1. Core Principles</h2>) only for major sections. Do NOT make every numbered point a heading.
3. LISTS: Format sub-points, steps, and examples into clean <ul><li>...</li></ul> or <ol><li>...</li></ol> lists.
4. DEFINITIONS: Format key terms cleanly as <p><strong>Term:</strong> Explanation...</p>.
5. QUOTES: Format quotes as <blockquote class="callout">“...”</blockquote>.
6. NO DECORATIVE GADGETS: Do NOT output process-flow chips, formula boxes, emoji badges, or gradient callout blocks. Keep it dignified, formal, and book-like.
7. WORD SPACING & PUNCTUATION: Fix broken hyphenated words, eliminate accidental line wraps, and ensure clean, consistent spacing around commas and periods.
8. NEVER wrap your answer in markdown code fences (\`\`\`html or \`\`\`). Return ONLY the pure semantic HTML body.
9. Preserve 100% of the original meaning faithfully without emojis or hashtags.`;

      const prompt = `Document Title: "${docTitle}"\n\nRaw Notes to Format:\n${rawContent}`;
      const result = await executeOptionalAICall(prompt, systemPrompt, aiSettings, { plainLanguage: false });

      let cleanHtml = result.text.trim();
      cleanHtml = cleanHtml.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
      cleanHtml = removeAiChatter(cleanHtml);
      cleanHtml = removeHashtags(cleanHtml);
      cleanHtml = removeEmojisAndIcons(cleanHtml);

      if (cleanHtml.length > 20) {
        return { formattedHtml: cleanHtml, isAI: true };
      }
    } catch (err) {
      console.warn('Cloud AI note formatting error, falling back to local clean formatter:', err);
    }
  }

  const localFormatted = formatNotesLocally(rawContent, docTitle);
  return { formattedHtml: localFormatted, isAI: false };
}
