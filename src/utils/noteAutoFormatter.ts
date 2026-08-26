import { executeOptionalAICall } from './aiEngine';
import type { UserSettings } from '@/types';

/**
 * Clean & Format Document Content into Professional, Readable Study Notes.
 * - Strips all recursive/repeating artifacts (like duplicate "💡 Core Takeaway:")
 * - Promotes real section titles (e.g. "7. CONNECT & LOVE", "THE GOLDEN RULE") into clean <h2> / <h3>
 * - Converts term definitions (e.g. "CONNECT: ...", "DRAW PILE: ...") into bold labels <strong>TERM:</strong>
 * - Cleans up broken sentence wraps, extra spacing, and page number noise
 * - Never injects fake hardcoded boilerplate sections
 */
export function formatNotesLocally(rawText: string, docTitle = 'Document'): string {
  if (!rawText || rawText.trim().length === 0) {
    return `<p>Start typing or pasting your notes here...</p>`;
  }

  // 1. Clean up HTML and recursive duplicate icons/tags
  let text = rawText
    // Remove repeated takeaway spam
    .replace(/(💡\s*(Core Takeaway|Key Idea):\s*)+/gi, '')
    .replace(/(⚡\s*(Must-Know Rule|Important):\s*)+/gi, '')
    .replace(/<div class="key-idea"[^>]*>[\s\S]*?<\/div>/gi, (match) => {
      return match.replace(/<[^>]+>/g, ' ').trim() + '\n\n';
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '') // remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  // 2. Fix broken spacing, mid-sentence line breaks, and page header noise
  text = text
    .replace(/\r\n|\r/g, '\n')
    .replace(/PAGE\s+\d+/gi, '')                    // remove page numbers like "PAGE 2"
    .replace(/[^\S\n]{2,}/g, ' ')                  // collapse spaces
    .replace(/([a-z,;])\n([A-Za-z])/g, '$1 $2')   // rejoin mid-sentence broken lines
    .replace(/-\s*\n\s*([a-z])/gi, '$1')           // rejoin hyphenated words
    .replace(/\n{3,}/g, '\n\n');                   // normalize line breaks

  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const formattedBlocks: string[] = [];

  const titleCase = (str: string): string => {
    return str
      .toLowerCase()
      .split(' ')
      .map((w) => (w.length > 2 || w === 'a' || w === 'an' || w === 'the' ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Check for Section / Rule Headings like "7. CONNECT & LOVE", "13. THE CARD PILES", "THE GOLDEN RULE"
    const isNumberedHeading = /^(\d+)[\.\)]\s+(.+)$/.test(line);
    const isAllCapsHeading = line.length > 3 && line.length < 60 && line === line.toUpperCase() && /[A-Z]/.test(line) && !line.includes(':');
    const isRuleHeading = /^(RULE|SECTION|CHAPTER|PART)\s+\d+/i.test(line);

    if (isNumberedHeading) {
      const match = line.match(/^(\d+)[\.\)]\s+(.+)$/);
      if (match) {
        const num = match[1];
        const headingText = titleCase(match[2].replace(/[—–-]\s*(OPTIONAL)/i, '($1)'));
        formattedBlocks.push(`<h2>${num}. ${headingText}</h2>`);
        continue;
      }
    }

    if (isAllCapsHeading || isRuleHeading) {
      const headingText = titleCase(line);
      formattedBlocks.push(`<h2>${headingText}</h2>`);
      continue;
    }

    // Check for Definition / Term blocks like "CONNECT: ...", "DRAW PILE: ...", "LOVE: ...", "TIE: ..."
    const termMatch = line.match(/^([A-Z\s]{2,25}):\s+(.+)$/);
    if (termMatch) {
      const term = termMatch[1].trim();
      const desc = termMatch[2].trim();
      formattedBlocks.push(`<p><strong>${term}:</strong> ${desc}</p>`);
      continue;
    }

    // Bullet items
    if (/^[\u2022\u2013\u2014\-\*]\s/.test(line)) {
      const bullet = line.replace(/^[\u2022\u2013\u2014\-\*]\s+/, '').trim();
      formattedBlocks.push(`<ul><li>${bullet}</li></ul>`);
      continue;
    }

    // Standard Clean Paragraph
    formattedBlocks.push(`<p>${line}</p>`);
  }

  // Merge adjacent <ul> tags into a single clean <ul>
  let finalHtml = formattedBlocks.join('\n');
  finalHtml = finalHtml.replace(/<\/ul>\s*<ul>/g, '\n');

  return finalHtml;
}

/**
 * Main AI Note Formatter
 * Uses Cloud Gemini if configured, or uses the clean local structure organizer.
 */
export async function formatStudyNotesWithAI(
  rawContent: string,
  docTitle: string,
  userSettings?: UserSettings
): Promise<{ formattedHtml: string; isAI: boolean }> {
  const aiSettings = userSettings?.aiSettings;

  if (aiSettings?.apiKey && aiSettings?.provider) {
    try {
      const systemPrompt = `You are a professional document and study note editor.
Your job is to format the user's text into clean, formal, perfectly spaced HTML.
Rules:
1. Fix all spacing errors, broken sentence wraps, and messy formatting.
2. Promote numbered sections or titles into <h2> headings with clean Title Case (e.g. <h2>7. Connect & Love</h2>).
3. Format definitions as <p><strong>TERM:</strong> Description...</p>.
4. Format lists with clean <ul><li>...</li></ul>.
5. NEVER invent fake summary sections or repeat emoji headers like "Core Takeaway".
6. Preserve all original content and meaning accurately.
7. Return ONLY the clean HTML string without any markdown code block wrappers.`;

      const prompt = `Document Title: "${docTitle}"\n\nContent to Format:\n${rawContent}`;
      const result = await executeOptionalAICall(prompt, systemPrompt, aiSettings);

      let cleanHtml = result.text.trim();
      cleanHtml = cleanHtml.replace(/^```html/i, '').replace(/```$/i, '').trim();

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
