import { executeOptionalAICall } from './aiEngine';
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

  // 1. Initial cleanup of dirty HTML/spam markers
  let text = rawText
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
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r\n|\r/g, '\n');

  // 2. Intelligent Boundary Splitting for Clumped Text Walls & Headings
  // Split before numbered section headings: " 7. CONNECT & LOVE", "24.Daily Learning", " 1. WHAT ENTREPRENEURSHIP..."
  text = text.replace(/([.!?\w])\s*(\b\d{1,3}\.\s*[A-Za-z])/g, '$1\n\n$2');
  
  // Split before keyword/definition terms: " CONNECT:", " A simple formula:"
  text = text.replace(/([.!?])\s+([A-Z\s]{2,24}:)/g, '$1\n\n$2');
  text = text.replace(/([.!?])\s+(For example:\s*|Examples:\s*|Example:\s*)/gi, '$1\n\n$2');
  text = text.replace(/([.!?])\s+(A simple formula:\s*|Formula:\s*)/gi, '$1\n\n$2');

  // Normalize spaces
  text = text
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/([a-z,;])\n([A-Za-z])/g, '$1 $2') // rejoin mid-sentence accidental line-wraps
    .replace(/-\s*\n\s*([a-z])/gi, '$1')         // rejoin hyphenated broken words
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const rawBlocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const outputBlocks: string[] = [];

  for (let bIndex = 0; bIndex < rawBlocks.length; bIndex++) {
    const block = rawBlocks[bIndex];
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);

    // If block has multiple lines that look like a list or sub-steps (e.g. under "For example:")
    if (lines.length > 1) {
      let isProcessed = false;
      const firstLine = lines[0];

      // Check if first line is a header/prompt like "For example:" or "Entrepreneurship is the ability to:"
      if (/^(For example|Examples|Example|Steps|Key takeaways|Key principles):\s*$/i.test(firstLine)) {
        outputBlocks.push(`<p><strong>${firstLine}</strong></p>`);
        const listItems = lines.slice(1).map((l) => `<li>${l.replace(/^[-*•]\s*/, '')}</li>`).join('');
        outputBlocks.push(`<ul>${listItems}</ul>`);
        isProcessed = true;
      } else if (lines.every((l) => /^[-*•]\s+/.test(l) || /^\d+\.\s+/.test(l))) {
        // All lines are explicit bullets
        const isNum = /^\d+\./.test(lines[0]);
        const tag = isNum ? 'ol' : 'ul';
        const listItems = lines.map((l) => `<li>${l.replace(/^[-*•]\s*|^\d+\.\s*/, '')}</li>`).join('');
        outputBlocks.push(`<${tag}>${listItems}</${tag}>`);
        isProcessed = true;
      }

      if (isProcessed) continue;
    }

    const singleLine = block.replace(/\s+/g, ' ').trim();

    // 1. Numbered Heading: "1. WHAT ENTREPRENEURSHIP REALLY IS" or "24.Daily Learning System"
    const numHeadingMatch = singleLine.match(/^(\d{1,3})\.\s*([A-Za-z0-9\s&,—–-]{3,70})$/);
    if (numHeadingMatch) {
      const num = numHeadingMatch[1];
      const title = toTitleCase(numHeadingMatch[2].replace(/[—–-]\s*(OPTIONAL)/i, '($1)'));
      outputBlocks.push(`<h2>${num}. ${title}</h2>`);
      continue;
    }

    // Numbered Heading with trailing sentence: "8. CHAOS, TOGETHER & CREATE Follow the instructions..."
    const numHeadingWithTextMatch = singleLine.match(/^(\d{1,3})\.\s*([A-Z\s&,—–-]{3,40})\s+([A-Z][a-z].+)$/);
    if (numHeadingWithTextMatch) {
      const num = numHeadingWithTextMatch[1];
      const title = toTitleCase(numHeadingWithTextMatch[2]);
      const rest = numHeadingWithTextMatch[3];
      outputBlocks.push(`<h2>${num}. ${title}</h2>`);
      outputBlocks.push(`<p>${rest}</p>`);
      continue;
    }

    // 2. Standalone ALL-CAPS Major Heading: "THE GOLDEN RULE"
    if (
      singleLine.length > 3 &&
      singleLine.length < 55 &&
      singleLine === singleLine.toUpperCase() &&
      /[A-Z]/.test(singleLine) &&
      !singleLine.includes(':') &&
      !singleLine.includes('.')
    ) {
      outputBlocks.push(`<h2>${toTitleCase(singleLine)}</h2>`);
      continue;
    }

    // 3. Blockquote: Starts with > or surrounded by quote marks
    if (singleLine.startsWith('>')) {
      const quoteText = singleLine.replace(/^>\s*/, '').trim();
      outputBlocks.push(`<blockquote class="callout">${quoteText}</blockquote>`);
      continue;
    }

    // 4. Process Flow: Contains arrows (→, ->, -->)
    if ((singleLine.includes('→') || singleLine.includes('->') || singleLine.includes('-->')) && singleLine.length < 350) {
      const steps = singleLine
        .split(/→|->|-->/)
        .map((s) => s.trim().replace(/\.$/, ''))
        .filter(Boolean);

      if (steps.length >= 2) {
        const stepHtml = steps
          .map((st) => `<span class="flow-step">${st}</span>`)
          .join(' <span class="flow-arrow">&rarr;</span> ');
        outputBlocks.push(`<div class="process-flow">${stepHtml}</div>`);
        continue;
      }
    }

    // 5. Formula / Equation Line: (e.g. "Problem + Customer + Solution + Value + Distribution = Business")
    if (
      (singleLine.includes('+') && singleLine.includes('=')) ||
      /^A simple formula:\s*/i.test(singleLine) ||
      /^Formula:\s*/i.test(singleLine)
    ) {
      const cleanFormula = singleLine.replace(/^(A simple formula:\s*|Formula:\s*)/i, '').trim();
      outputBlocks.push(`<div class="formula-box"><strong>Formula:</strong> <code>${cleanFormula}</code></div>`);
      continue;
    }

    // 6. Definition / Term Line: "CONNECT: The card player answers..."
    const termMatch = singleLine.match(/^([A-Z\s]{2,24}):\s*(.+)$/);
    if (termMatch) {
      const term = termMatch[1].trim();
      const desc = termMatch[2].trim();
      outputBlocks.push(`<p><strong>${term}:</strong> ${desc}</p>`);
      continue;
    }

    // 7. Example Line with bullet separator
    const exampleMatch = singleLine.match(/^(Example|Examples):\s*(.+)$/i);
    if (exampleMatch) {
      const label = exampleMatch[1];
      const content = exampleMatch[2];
      if (content.includes('•')) {
        const items = content.split('•').map((it) => it.replace(/\s*\.\s*$/, '').trim()).filter(Boolean);
        outputBlocks.push(`<p><strong>${label}:</strong></p>`);
        outputBlocks.push(`<ul>${items.map((it) => `<li>${it}</li>`).join('')}</ul>`);
        continue;
      }
      outputBlocks.push(`<p><strong>${label}:</strong> ${content}</p>`);
      continue;
    }

    // 8. Bullet items block
    if (singleLine.includes('•') && singleLine.length < 280) {
      const items = singleLine.split('•').map((it) => it.trim()).filter(Boolean);
      outputBlocks.push(`<ul>${items.map((it) => `<li>${it}</li>`).join('')}</ul>`);
      continue;
    }

    // 9. Standard Clean Paragraph
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
      const systemPrompt = `You are a world-class executive document designer and note architect.
Your job is to format the given raw notes into a formal, beautifully organized, magazine-grade HTML document.

Formatting Rules:
1. Fix all clumping, messy linebreaks, and awkward formatting.
2. Structure sections using clean <h2> headings in Title Case (e.g. <h2>1. What Entrepreneurship Really Is</h2>, <h2>2. How A Business Works</h2>).
3. Align all body text, lists, and paragraphs to the LEFT with formal line spacing.
4. Format quotes/mantras as <blockquote class="callout">“...”</blockquote>.
5. Format business formulas or equations as: <div class="formula-box"><strong>Formula:</strong> <code>Problem + Customer + Solution = Business</code></div>.
6. Format step sequences or chains (A → B → C) as: <div class="process-flow"><span class="flow-step">Step 1</span> <span class="flow-arrow">&rarr;</span> <span class="flow-step">Step 2</span></div>.
7. Format examples, sub-points, and instructions into clean bulleted <ul><li>...</li></ul> or numbered <ol><li>...</li></ol> lists.
8. Format definitions as <p><strong>TERM:</strong> Description...</p>.
9. Mark critical takeaways with <div class="key-idea">💡 <strong>Key Idea:</strong> ...</div> or <span class="important-mark">⚡ Important</span>.
10. NEVER wrap your answer in markdown code fences (\`\`\`html or \`\`\`). Return ONLY the pure HTML body.
11. Preserve 100% of the original meaning and content faithfully.`;

      const prompt = `Document Title: "${docTitle}"\n\nRaw Notes to Format:\n${rawContent}`;
      const result = await executeOptionalAICall(prompt, systemPrompt, aiSettings);

      let cleanHtml = result.text.trim();
      cleanHtml = cleanHtml.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();

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
