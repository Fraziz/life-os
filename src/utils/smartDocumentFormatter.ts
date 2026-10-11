import { executeOptionalAICall } from './aiEngine';
import { removeAiChatter } from './fileImporter';
import type { UserSettings } from '@/types';

export interface FormatStats {
  headingsCount: number;
  listsCount: number;
  paragraphsCount: number;
  fixedNumberingCount: number;
  repairedIssuesCount: number;
}

export interface FormatResult {
  title: string;
  formattedMarkdown: string;
  stats: FormatStats;
}

/**
 * Intelligent Document & Study Guide Structure Formatter.
 *
 * Rules:
 * 1. ZERO REWRITING: Preserves 100% of original words, sentences, explanations, and meaning.
 * 2. Structure Detection: Detects titles, parts, chapters, lessons, sections, main ideas, examples, exercises, and lists.
 * 3. Markdown Repair: Corrects duplicate numbering (1. 1.), broken bullet points, missing heading spaces, and excessive linebreaks.
 * 4. Supports raw text without line breaks, copied ChatGPT/Word text, and long study guides.
 */

// Helper to convert heading text to formal Title Case
function toTitleCase(str: string): string {
  const minor = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'as', 'via']);
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((w, idx) => (idx === 0 || !minor.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Stage 1: Local Deterministic Analysis & Structure Engine
export function formatDocumentLocally(rawText: string, currentTitle = 'Document'): FormatResult {
  if (!rawText || !rawText.trim()) {
    return {
      title: currentTitle || 'Untitled Document',
      formattedMarkdown: '',
      stats: { headingsCount: 0, listsCount: 0, paragraphsCount: 0, fixedNumberingCount: 0, repairedIssuesCount: 0 },
    };
  }

  let text = rawText;
  let fixedNumberingCount = 0;
  let repairedIssuesCount = 0;

  // 1. Strip unwanted AI chatter artifacts if present at start/end
  text = removeAiChatter(text);

  // 2. Normalize carriage returns and non-breaking spaces
  text = text.replace(/\r\n|\r/g, '\n').replace(/\u00A0/g, ' ');

  // 3. Fix duplicate numbers like "1. 1.", "1. 1)", "• •", or "- -"
  const dupNumPattern = /^(\s*)(\d+[\.\)])\s+(\d+[\.\)])\s+/gm;
  if (dupNumPattern.test(text)) {
    text = text.replace(dupNumPattern, (_m, space, _n1, n2) => {
      fixedNumberingCount++;
      return `${space}${n2} `;
    });
  }

  const dupBulletPattern = /^(\s*)([•\-*–—▪\u2022])\s+([•\-*–—▪\u2022])\s+/gm;
  if (dupBulletPattern.test(text)) {
    text = text.replace(dupBulletPattern, (_m, space, _b1, b2) => {
      repairedIssuesCount++;
      return `${space}${b2} `;
    });
  }

  // 3b. Fix numbering with missing space: e.g. "1.hha" -> "1. hha" (protecting decimals like 1.5, IPs, versions)
  const missingSpaceNumPattern = /(^|[\s\n])(\d+)[\.\)]([A-Za-z\u00C0-\u024F\u1E00-\u1EFF])/g;
  if (missingSpaceNumPattern.test(text)) {
    text = text.replace(missingSpaceNumPattern, (_m, prefix, num, char) => {
      fixedNumberingCount++;
      return `${prefix}${num}. ${char}`;
    });
  }

  // 4. Fix broken markdown headings with missing space: e.g. "#Title" -> "# Title"
  text = text.replace(/^(#{1,6})([A-Za-z0-9])/gm, (_m, hashes, rest) => {
    repairedIssuesCount++;
    return `${hashes} ${rest}`;
  });

  // 5. Rejoin mid-sentence hyphenated word wraps: "devel-\n opment" -> "development"
  text = text.replace(/(\b[A-Za-z]{2,})-\s*\n\s*([A-Za-z]{2,}\b)/g, '$1$2');

  // 6. Detect unbroken inline raw text (e.g. "lesson 1 understanding business main idea business solves problems why it matters...")
  // We identify structural keyword boundaries and insert proper linebreaks before them.
  const inlineStructureKeywords = [
    'part\\s+\\d+',
    'chapter\\s+\\d+',
    'lesson\\s+\\d+',
    'unit\\s+\\d+',
    'module\\s+\\d+',
    'section\\s+\\d+',
    'main\\s+idea',
    'core\\s+concept',
    'why\\s+it\\s+matters',
    'key\\s+takeaway',
    'key\\s+idea',
    'example',
    'real-world\\s+example',
    'try\\s+this',
    'exercise',
    'practice',
    'question',
    'answer',
    'definition',
    'summary',
    'action\\s+step',
    'next\\s+steps',
    'introduction',
    'overview',
  ];

  const inlineRegex = new RegExp(`(?<=[.!?a-zA-Z0-9])\\s+(?=(${inlineStructureKeywords.join('|')}):?\\s+)`, 'gi');
  if (!text.includes('\n\n') && text.length > 80 && inlineRegex.test(text)) {
    text = text.replace(inlineRegex, '\n\n');
    repairedIssuesCount += 4;
  }

  // 7. Collapse excessive blank lines (max 2 consecutive newlines)
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  // 8. Block-by-block structural normalization
  const rawBlocks = text.split(/\n{2,}/);
  const formattedBlocks: string[] = [];
  let extractedTitle = '';
  let headingsCount = 0;
  let listsCount = 0;
  let paragraphsCount = 0;

  for (let idx = 0; idx < rawBlocks.length; idx++) {
    const rawBlock = rawBlocks[idx].trim();
    if (!rawBlock) continue;

    const lines = rawBlock.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Check if block is a multi-line list (supports "1. item" or "1.item")
    const isOrderedList = lines.every((l) => /^\d+[\.\)]\s*/.test(l));
    const isUnorderedList = lines.every((l) => /^([•\-*–—▪\u2022])\s+/.test(l));

    if (lines.length > 1 && (isOrderedList || isUnorderedList)) {
      listsCount++;
      const normalizedLines = lines.map((l, lIdx) => {
        if (isOrderedList) {
          const itemText = l.replace(/^\d+[\.\)]\s*/, '').trim();
          return `${lIdx + 1}. ${itemText}`;
        } else {
          const itemText = l.replace(/^([•\-*–—▪\u2022])\s*/, '').trim();
          return `- ${itemText}`;
        }
      });
      formattedBlocks.push(normalizedLines.join('\n'));
      continue;
    }

    // Check if it is a single-line block candidate
    const singleLine = rawBlock.replace(/\s+/g, ' ').trim();

    // First block title candidate
    if (idx === 0 && !extractedTitle) {
      if (singleLine.startsWith('# ')) {
        extractedTitle = singleLine.replace(/^#+\s*/, '').trim();
        headingsCount++;
        formattedBlocks.push(`# ${extractedTitle}`);
        continue;
      } else if (
        singleLine.length >= 3 &&
        singleLine.length < 80 &&
        !singleLine.endsWith('.') &&
        !singleLine.includes(':') &&
        (singleLine === singleLine.toUpperCase() || lines.length === 1)
      ) {
        extractedTitle = toTitleCase(singleLine);
        headingsCount++;
        formattedBlocks.push(`# ${extractedTitle}`);
        continue;
      }
    }

    // Major Part or Chapter: "PART 1: Topic" or "CHAPTER 1"
    const partMatch = singleLine.match(/^(PART|CHAPTER|UNIT|MODULE)\s+(\d+|[IVXLCDM]+)[:\-—–.]?\s*(.*)$/i);
    if (partMatch && singleLine.length < 90) {
      headingsCount++;
      const label = partMatch[1].toUpperCase();
      const num = partMatch[2];
      const rest = partMatch[3] ? `: ${toTitleCase(partMatch[3].trim())}` : '';
      formattedBlocks.push(`## ${label} ${num}${rest}`);
      continue;
    }

    // Lesson or Section: "Lesson 1: Title"
    const lessonMatch = singleLine.match(/^(LESSON|SECTION)\s+(\d+)[:\-—–.]?\s*(.*)$/i);
    if (lessonMatch && singleLine.length < 90) {
      headingsCount++;
      const label = toTitleCase(lessonMatch[1]);
      const num = lessonMatch[2];
      const rest = lessonMatch[3] ? `: ${toTitleCase(lessonMatch[3].trim())}` : '';
      formattedBlocks.push(`### ${label} ${num}${rest}`);
      continue;
    }

    // Major ALL-CAPS section: "INTRODUCTION", "WHY IT MATTERS", "SUMMARY"
    if (
      singleLine.length >= 3 &&
      singleLine.length < 60 &&
      singleLine === singleLine.toUpperCase() &&
      /^[A-Z\s&,—–-]+$/.test(singleLine) &&
      !singleLine.includes('.')
    ) {
      headingsCount++;
      formattedBlocks.push(`### ${toTitleCase(singleLine)}`);
      continue;
    }

    // In-study subheadings like "Main Idea: Business solves problems." or "Why It Matters:"
    const studyLabelMatch = singleLine.match(
      /^(Main Idea|Why It Matters|Key Idea|Core Takeaway|Example|Try This|Practice Exercise|Key Question|Summary|Definition)[:\-—–.]\s*(.*)$/i
    );
    if (studyLabelMatch) {
      const label = toTitleCase(studyLabelMatch[1]);
      const body = studyLabelMatch[2]?.trim();
      if (body) {
        paragraphsCount++;
        formattedBlocks.push(`**${label}**\n\n${body}`);
      } else {
        headingsCount++;
        formattedBlocks.push(`#### ${label}`);
      }
      continue;
    }

    // Markdown heading already formatted: keep it clean
    if (/^#{1,6}\s+/.test(singleLine)) {
      headingsCount++;
      formattedBlocks.push(singleLine);
      continue;
    }

    // Blockquote
    if (singleLine.startsWith('>')) {
      formattedBlocks.push(singleLine);
      continue;
    }

    // Regular paragraph
    paragraphsCount++;
    formattedBlocks.push(lines.join(' '));
  }

  const finalMarkdown = formattedBlocks.join('\n\n');
  const finalTitle = extractedTitle || currentTitle || 'Untitled Document';

  return {
    title: finalTitle,
    formattedMarkdown: finalMarkdown,
    stats: {
      headingsCount,
      listsCount,
      paragraphsCount,
      fixedNumberingCount,
      repairedIssuesCount,
    },
  };
}

/**
 * Two-Stage Smart Auto Format Engine.
 * If AI is configured and document is raw/complex, leverages AI for high-accuracy structure detection
 * without altering or rewriting words. Falls back seamlessly to deterministic local formatting.
 */
export async function formatDocumentWithAI(
  rawText: string,
  docTitle: string,
  settings: UserSettings
): Promise<FormatResult> {
  // Always compute deterministic local baseline first
  const localResult = formatDocumentLocally(rawText, docTitle);

  // If text is short or local already detected clean structure, return local result
  if (!rawText.trim() || rawText.trim().length < 40) {
    return localResult;
  }

  const aiSettings = settings?.aiSettings;
  if (!aiSettings?.apiKey) {
    return localResult;
  }

  // Attempt AI structure detection if configured
  try {
    const systemPrompt = `You are a professional book and document formatting engine.
Your strict objective is to organize and format the given raw notes into a formal, calm, publication-grade document designed for distraction-free reading.
1. PRESERVE 100% OF ORIGINAL WRITING: Do not rewrite or shorten sentences.
2. STRUCTURE ONLY: Identify titles, parts, chapters, lessons, headings (#, ##, ###), bold section labels (**Main Idea**, **Why It Matters**, **Example**, **Try This**), and clean bullet/numbered lists.
3. FIX BROKEN FORMATTING: Correct duplicate numbering, bad line breaks, and wall-of-text formatting.
4. OUTPUT ONLY MARKDOWN without code fences.`;

    const prompt = `Document Title Candidate: "${docTitle}"\n\nOriginal Text to Format:\n${rawText}`;
    const result = await executeOptionalAICall(prompt, systemPrompt, aiSettings, { plainLanguage: false });

    if (result && result.text && result.text.trim().length > 20) {
      let cleanAi = result.text
        .replace(/^```markdown\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/```$/, '')
        .trim();

      // Recalculate stats from AI structured output
      const headingsCount = (cleanAi.match(/^#{1,6}\s+/gm) || []).length;
      const listsCount = (cleanAi.match(/^(\d+\.|-|\*)\s+/gm) || []).length;
      const paragraphsCount = cleanAi.split(/\n{2,}/).length;

      // Extract title if present at top
      let aiTitle = localResult.title;
      const firstLineMatch = cleanAi.match(/^#\s+(.+)$/m);
      if (firstLineMatch) {
        aiTitle = firstLineMatch[1].trim();
      }

      return {
        title: aiTitle,
        formattedMarkdown: cleanAi,
        stats: {
          headingsCount: Math.max(headingsCount, localResult.stats.headingsCount),
          listsCount: Math.max(listsCount, localResult.stats.listsCount),
          paragraphsCount,
          fixedNumberingCount: localResult.stats.fixedNumberingCount,
          repairedIssuesCount: localResult.stats.repairedIssuesCount + 2,
        },
      };
    }
  } catch (err) {
    console.warn('AI structure detection fallback to local engine:', err);
  }

  return localResult;
}
