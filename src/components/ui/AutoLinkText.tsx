'use client';

import React from 'react';
import styles from './AutoLinkText.module.css';

interface AutoLinkTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Trims trailing punctuation from a matched URL (e.g. "https://site.com." -> "https://site.com" + ".")
 * while preserving balanced parentheses for Wikipedia-style links.
 */
function trimTrailingPunctuation(url: string): { cleanUrl: string; trailing: string } {
  let cleanUrl = url;
  let trailing = '';

  while (cleanUrl.length > 0) {
    const lastChar = cleanUrl.slice(-1);

    // Common sentence-ending punctuation
    if ([',', '.', ';', '!', '?', '"', "'", '`', '>', '}'].includes(lastChar)) {
      trailing = lastChar + trailing;
      cleanUrl = cleanUrl.slice(0, -1);
      continue;
    }

    // Check closing parenthesis: only strip if there is an unmatched closing paren
    if (lastChar === ')') {
      const openCount = (cleanUrl.match(/\(/g) || []).length;
      const closeCount = (cleanUrl.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        trailing = ')' + trailing;
        cleanUrl = cleanUrl.slice(0, -1);
        continue;
      }
    }

    // Check closing bracket: only strip if unmatched
    if (lastChar === ']') {
      const openCount = (cleanUrl.match(/\[/g) || []).length;
      const closeCount = (cleanUrl.match(/\]/g) || []).length;
      if (closeCount > openCount) {
        trailing = ']' + trailing;
        cleanUrl = cleanUrl.slice(0, -1);
        continue;
      }
    }

    break;
  }

  return { cleanUrl, trailing };
}

/**
 * Parses raw text and converts any web URLs (http, https, www.) into safe,
 * clickable links with target="_blank" and rel="noopener noreferrer".
 */
export function parseTextWithLinks(text: string): React.ReactNode[] {
  if (!text) return [];

  const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const matchIndex = match.index;
    const rawUrl = match[0];

    // Push pre-match text
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    const { cleanUrl, trailing } = trimTrailingPunctuation(rawUrl);
    const href = cleanUrl.toLowerCase().startsWith('www.') ? `https://${cleanUrl}` : cleanUrl;

    parts.push(
      <a
        key={`autolink-${matchIndex}-${cleanUrl}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.autoLink}
        onClick={(e) => e.stopPropagation()}
        title={`Open ${cleanUrl} in a new tab`}
      >
        {cleanUrl}
      </a>
    );

    if (trailing) {
      parts.push(trailing);
    }

    lastIndex = matchIndex + rawUrl.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * AutoLinkText Component
 * 
 * Automatically detects web URLs inside plain text and turns them into
 * styled, clickable links opening safely in a new tab.
 */
export default function AutoLinkText({ text, className, style }: AutoLinkTextProps) {
  if (!text) return null;

  // Handle multi-line strings gracefully
  const lines = text.split('\n');

  return (
    <span className={`${styles.container} ${className || ''}`} style={style}>
      {lines.map((line, idx) => (
        <React.Fragment key={`line-${idx}`}>
          {idx > 0 && <br />}
          {parseTextWithLinks(line)}
        </React.Fragment>
      ))}
    </span>
  );
}
