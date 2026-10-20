/**
 * textCleaner.ts
 *
 * Automatically removes AI / ChatGPT markdown formatting artifacts:
 * - Markdown header hashtags (`#`, `##`, `###`, etc.)
 * - Bold and italic asterisks (`**bold**`, `*italic*`, `***both***`)
 * - Underscore formatting (`__bold__`, `_italic_`)
 * - Code fences and inline backticks (``` and `)
 * - Strikethrough (`~~text~~`)
 * - Blockquote markers (`> `)
 * - Markdown links and images (`[text](url)` -> `text`, `![alt](url)` -> `alt`)
 * - Asterisk bullet points (`* Item` -> `- Item`)
 * - Excessive blank lines
 *
 * Preserves normal words, valid abbreviations, numbers, and punctuation.
 */

/**
 * Checks whether a given string contains common AI markdown formatting.
 */
export function hasMarkdownFormatting(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return (
    text.includes('**') ||
    text.includes('```') ||
    text.includes('~~') ||
    /(^|[\n\r]|\s{2,})#{1,6}\s+/.test(text) ||
    /^[ \t]*#{1,6}[ \t]+/m.test(text) ||
    /\[([^\]]+)\]\(([^)]+)\)/.test(text) ||
    /^[ \t]*>[ \t]?/m.test(text) ||
    /(^|[^\w*])\*([^*\n]+)\*([^\w*]|$)/.test(text)
  );
}

/**
 * Strips AI / ChatGPT markdown formatting artifacts from text.
 */
export function cleanMarkdownText(input: string): string {
  if (!input || typeof input !== 'string') return '';

  let text = input;

  // 1. Remove code blocks ```lang ... ``` -> keep interior content
  text = text.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, '$1');

  // 2. Remove inline code backticks `code` -> code
  text = text.replace(/`([^`\n]+)`/g, '$1');

  // 3. Remove Markdown headers:
  // Both at line starts (^# Title) and inline (e.g. "Text. ## 1. Subheading")
  text = text.replace(/^[ \t]*#{1,6}[ \t]+/gm, '');
  text = text.replace(/(^|[\n\r]|\s+)#{1,6}\s+/g, '$1');

  // 4. Remove bold & italic markdown with asterisks or underscores:
  // ***bold italic*** or ___bold italic___
  text = text.replace(/\*{3}([\s\S]*?)\*{3}/g, '$1');
  text = text.replace(/_{3}([\s\S]*?)_{3}/g, '$1');

  // **bold** or __bold__
  text = text.replace(/\*{2}([\s\S]*?)\*{2}/g, '$1');
  text = text.replace(/_{2}([\s\S]*?)_{2}/g, '$1');

  // *italic* (carefully match without breaking lone asterisks or math like 3 * 4)
  text = text.replace(/(^|[^\w*])\*([^*\n]+?)\*([^\w*]|$)/g, '$1$2$3');
  text = text.replace(/(^|[^\w_])_([^_\n]+?)_([^\w_]|$)/g, '$1$2$3');

  // Any remaining stray double asterisks
  text = text.replace(/\*\*/g, '');

  // 5. Remove strikethrough ~~text~~ -> text
  text = text.replace(/~~([\s\S]*?)~~/g, '$1');

  // 6. Remove blockquote markers '> text' -> 'text'
  text = text.replace(/^[ \t]*>[ \t]?/gm, '');

  // 7. Remove horizontal rules: lines with 3 or more -, *, or _
  text = text.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '');

  // 8. Convert markdown links [Label](url) -> Label (or url if label is empty)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const trimmedLabel = String(label).trim();
    return trimmedLabel || String(url).trim();
  });

  // 9. Markdown image syntax ![alt](url) -> alt
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1');

  // 10. Normalize bullet points: change "* Item" to "- Item"
  text = text.replace(/^[ \t]*\*[ \t]+/gm, '- ');

  // 11. Collapse 3+ consecutive newlines to maximum 2 newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Universal paste event handler for inputs or textareas.
 * Automatically cleans pasted AI text when markdown formatting is detected.
 */
export function handleCleanPasteEvent(
  e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  onChangeValue: (newVal: string) => void
) {
  const clipboardText = e.clipboardData?.getData('text/plain');
  if (!clipboardText) return;

  if (hasMarkdownFormatting(clipboardText)) {
    e.preventDefault();
    const cleaned = cleanMarkdownText(clipboardText);

    const target = e.currentTarget;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const currentVal = target.value ?? '';
    const nextVal = currentVal.substring(0, start) + cleaned + currentVal.substring(end);

    onChangeValue(nextVal);

    // Reposition cursor right after the inserted clean text
    const newCursorPos = start + cleaned.length;
    requestAnimationFrame(() => {
      try {
        target.selectionStart = newCursorPos;
        target.selectionEnd = newCursorPos;
      } catch {}
    });
  }
}
