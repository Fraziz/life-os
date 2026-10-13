'use client';

import { useEffect } from 'react';

/**
 * Trims sentence punctuation from the end of a candidate URL
 */
function cleanCandidateUrl(raw: string): string | null {
  if (!raw) return null;

  let url = raw.trim();

  // Strip wrapping quotes or brackets
  if ((url.startsWith('(') && url.endsWith(')')) ||
      (url.startsWith('[') && url.endsWith(']')) ||
      (url.startsWith('"') && url.endsWith('"')) ||
      (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1);
  }

  // Strip trailing punctuation
  while (url.length > 0) {
    const last = url.slice(-1);
    if ([',', '.', ';', '!', '?', '"', "'", '`', '>', '}', ')', ']'].includes(last)) {
      // Allow balanced closing parenthesis/bracket
      if (last === ')') {
        const opens = (url.match(/\(/g) || []).length;
        const closes = (url.match(/\)/g) || []).length;
        if (closes > opens) {
          url = url.slice(0, -1);
          continue;
        }
      } else if (last === ']') {
        const opens = (url.match(/\[/g) || []).length;
        const closes = (url.match(/\]/g) || []).length;
        if (closes > opens) {
          url = url.slice(0, -1);
          continue;
        }
      } else {
        url = url.slice(0, -1);
        continue;
      }
    }
    break;
  }

  // Check valid web URL pattern
  if (/^https?:\/\/[^\s<]+$/i.test(url)) {
    return url;
  }

  if (/^www\.[^\s<]+\.[^\s<]+$/i.test(url)) {
    return `https://${url}`;
  }

  return null;
}

/**
 * Extracts the word token at a mouse coordinate (x, y) from the DOM.
 */
function getUrlAtCoordinates(x: number, y: number): string | null {
  let range: Range | null = null;

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else if ('caretPositionFromPoint' in document) {
    const pos = (document as unknown as { caretPositionFromPoint: (x: number, y: number) => { offsetNode: Node; offset: number } | null }).caretPositionFromPoint(x, y);
    if (pos && pos.offsetNode) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }

  if (!range || !range.startContainer || range.startContainer.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  const textNode = range.startContainer as Text;
  const text = textNode.textContent || '';
  const offset = range.startOffset;

  if (offset < 0 || offset > text.length) return null;

  // Walk left to find start of word
  let start = offset;
  while (start > 0 && !/\s/.test(text[start - 1])) {
    start--;
  }

  // Walk right to find end of word
  let end = offset;
  while (end < text.length && !/\s/.test(text[end])) {
    end++;
  }

  if (start >= end) return null;

  const candidate = text.slice(start, end);
  return cleanCandidateUrl(candidate);
}

/**
 * Global Link Click & Hover Delegator
 * 
 * Ensures that ANY URL anywhere in the entire system is automatically clickable,
 * even if it was rendered in plain text without an <a> tag.
 */
export function useGlobalLinkDetector() {
  useEffect(() => {
    let hoveredElementWithPointer: HTMLElement | null = null;
    let originalCursor = '';

    // Handle hover to show pointer cursor when mouse is over a URL in plain text
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore inputs, links, buttons
      if (['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.isContentEditable ||
          target.closest('a, button, input, textarea, [contenteditable="true"]')) {
        if (hoveredElementWithPointer) {
          hoveredElementWithPointer.style.cursor = originalCursor;
          hoveredElementWithPointer = null;
        }
        return;
      }

      const url = getUrlAtCoordinates(e.clientX, e.clientY);
      if (url) {
        if (!hoveredElementWithPointer) {
          hoveredElementWithPointer = target;
          originalCursor = target.style.cursor;
          target.style.cursor = 'pointer';
        }
      } else if (hoveredElementWithPointer) {
        hoveredElementWithPointer.style.cursor = originalCursor;
        hoveredElementWithPointer = null;
      }
    };

    // Handle click on plain text URL anywhere in the system
    const handleClick = (e: MouseEvent) => {
      // Don't intercept if right click or Alt key
      if (e.button !== 0 || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // If user is inside an editable surface or clicking an interactive element, do nothing
      if (['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.isContentEditable ||
          target.closest('a, button, input, textarea, select, [contenteditable="true"]')) {
        return;
      }

      // If user was dragging to highlight/select text, don't trigger click navigation
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        return;
      }

      const url = getUrlAtCoordinates(e.clientX, e.clientY);
      if (url) {
        e.preventDefault();
        e.stopPropagation();
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('click', handleClick, { capture: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClick, { capture: true });
      if (hoveredElementWithPointer) {
        hoveredElementWithPointer.style.cursor = originalCursor;
      }
    };
  }, []);
}
