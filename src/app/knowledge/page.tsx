'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState, useRef, useEffect } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { useFocus } from '@/context/FocusContext';
import { useGoals } from '@/context/GoalContext';
import { useDreams } from '@/context/DreamContext';
import { useProjects } from '@/context/ProjectContext';
import { useTasks } from '@/context/TaskContext';
import { extractTextFromFile, cleanAndFormatPastedText } from '@/utils/fileImporter';
import type { KnowledgeDocument, DocumentStatus, DocumentCategory, DocumentReadStatus, QuizQuestionItem, ReadingLogItem } from '@/types';
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  Tag,
  Link2,
  RotateCcw,
  Save,
  Eye,
  FileText,
  Clock,
  CloudSun,
  Target,
  Folder,
  CheckSquare,
  Printer,
  Download,
  Copy,
  Check,
  FileCode,
  UploadCloud,
  FileUp,
  Loader2,
  BookMarked,
  Sparkles,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Quote,
  Code,
  ClipboardPaste,
  List,
  ListOrdered,
  Minus,
  AlertCircle,
  Lightbulb,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Indent,
  Outdent,
  RemoveFormatting,
  Strikethrough,
  Subscript,
  Superscript,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Eraser,
  Lock,
  Pin,
  PinOff,
  Star,
  HelpCircle,
  ExternalLink,
  ChevronLeft,
  Table,
  Play,
  Pause,
  Timer,
  History,
  ArrowDown,
  ArrowUp,
  SlidersHorizontal,
  Minimize2,
  Video,
  Bell,
} from 'lucide-react';
import styles from './page.module.css';
import LinkPreviewCard from '@/components/ui/LinkPreviewCard';
import EntityFiles from '@/components/files/EntityFiles';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { useSettings } from '@/context/SettingsContext';
import { useStudySession } from '@/context/StudySessionContext';
import { formatStudyNotesWithAI } from '@/utils/noteAutoFormatter';
import { summarizeDocumentWithAI, generateStudyQuizWithAI } from '@/utils/aiEngine';
import { formatDocumentWithAI, formatDocumentLocally, type FormatResult } from '@/utils/smartDocumentFormatter';
import { parseYouTubeUrl, isStandaloneYouTubeUrl } from '@/utils/youtube';
import {
  generateVideoBlockHtml,
  transformVideoLessonsInHtml,
  isDocVideoLesson,
  extractVideoLessonData,
  extractVideoLessonNotes,
} from '@/utils/videoLesson';
import AddVideoLessonModal from '@/components/study/AddVideoLessonModal';
import FocusViewWorkspace from '@/components/study/FocusViewWorkspace';
import StudySessionCard from '@/components/study/StudySessionCard';

// ── Color Highlight Palette (Literal Translucent Highlighter Marker) ──
const HIGHLIGHT_COLORS: { name: string; bg: string; border: string; text: string; label: string }[] = [
  { name: 'yellow',   bg: 'rgba(253, 224, 71,  0.42)', border: '#fbbf24', text: 'inherit', label: 'Yellow' },
  { name: 'lime',     bg: 'rgba(134, 239, 172, 0.42)', border: '#4ade80', text: 'inherit', label: 'Lime' },
  { name: 'cyan',     bg: 'rgba(103, 232, 249, 0.42)', border: '#22d3ee', text: 'inherit', label: 'Cyan' },
  { name: 'blue',     bg: 'rgba(147, 197, 253, 0.42)', border: '#60a5fa', text: 'inherit', label: 'Blue' },
  { name: 'purple',   bg: 'rgba(196, 181, 253, 0.42)', border: '#a78bfa', text: 'inherit', label: 'Purple' },
  { name: 'pink',     bg: 'rgba(249, 168, 212, 0.42)', border: '#f472b6', text: 'inherit', label: 'Pink' },
  { name: 'orange',   bg: 'rgba(253, 186, 116, 0.42)', border: '#fb923c', text: 'inherit', label: 'Orange' },
  { name: 'red',      bg: 'rgba(252, 165, 165, 0.42)', border: '#f87171', text: 'inherit', label: 'Red' },
  { name: 'mint',     bg: 'rgba(110, 231, 183, 0.42)', border: '#34d399', text: 'inherit', label: 'Mint' },
  { name: 'lavender', bg: 'rgba(167, 139, 250, 0.42)', border: '#8b5cf6', text: 'inherit', label: 'Lavender' },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {};
HIGHLIGHT_COLORS.forEach((c) => { COLOR_MAP[c.name] = { bg: c.bg, border: c.border, text: c.text }; });

// ── Font Colors Palette (Text Colors) ──────────────────────────────
const FONT_COLORS: { name: string; label: string; color: string; border: string }[] = [
  { name: 'default', label: 'Default', color: 'inherit', border: 'var(--color-border)' },
  { name: 'white', label: 'Pure White', color: '#ffffff', border: '#e2e8f0' },
  { name: 'emerald', label: 'Emerald Green', color: '#10b981', border: '#059669' },
  { name: 'lime', label: 'Bright Lime', color: '#84cc16', border: '#65a30d' },
  { name: 'amber', label: 'Amber Gold', color: '#f59e0b', border: '#d97706' },
  { name: 'orange', label: 'Coral Orange', color: '#f97316', border: '#ea580c' },
  { name: 'rose', label: 'Rose Red', color: '#ef4444', border: '#dc2626' },
  { name: 'pink', label: 'Neon Pink', color: '#ec4899', border: '#db2777' },
  { name: 'purple', label: 'Royal Purple', color: '#a855f7', border: '#9333ea' },
  { name: 'cyan', label: 'Vibrant Cyan', color: '#06b6d4', border: '#0891b2' },
  { name: 'blue', label: 'Sky Blue', color: '#3b82f6', border: '#2563eb' },
];

// ── Markdown Table Parser ──────────────────────────────────────────
function renderMarkdownTables(text: string): string {
  // Regex matches a full markdown table block with header, separator, and data rows
  const tableRegex = /((?:^[ \t]*\|.+?\|[ \t]*\r?\n)+(?:^[ \t]*\|[ \t]*:?[-]+:?[ \t]*(?:\|[ \t]*:?[-]+:?[ \t]*)*\|[ \t]*\r?\n)(?:^[ \t]*\|.+?\|[ \t]*(?:\r?\n|$))+)/gm;

  return text.replace(tableRegex, (match) => {
    const lines = match.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return match;

    const parseRow = (line: string): string[] => {
      let trimmed = line;
      if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
      if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
      return trimmed.split('|').map((c) => c.trim());
    };

    const headerCells = parseRow(lines[0]);
    const alignCells = parseRow(lines[1]);
    const alignments = alignCells.map((a) => {
      if (a.startsWith(':') && a.endsWith(':')) return 'center';
      if (a.endsWith(':')) return 'right';
      return 'left';
    });

    const bodyLines = lines.slice(2);
    let theadHtml = '<thead><tr>';
    headerCells.forEach((h, idx) => {
      const align = alignments[idx] || 'left';
      theadHtml += `<th style="text-align:${align}">${h}</th>`;
    });
    theadHtml += '</tr></thead>';

    let tbodyHtml = '<tbody>';
    bodyLines.forEach((rowLine) => {
      const cells = parseRow(rowLine);
      tbodyHtml += '<tr>';
      headerCells.forEach((_, idx) => {
        const val = cells[idx] || '';
        const align = alignments[idx] || 'left';
        tbodyHtml += `<td style="text-align:${align}">${val}</td>`;
      });
      tbodyHtml += '</tr>';
    });
    tbodyHtml += '</tbody>';

    return `\n\n<div class="table-container"><table class="doc-table">${theadHtml}${tbodyHtml}</table></div>\n\n`;
  });
}

// ── Formal Document & Markdown Renderer (Word & Book Ready) ───────
function renderMarkdown(md: string): string {
  if (!md) return '';

  // 1. Extract and preserve Code Blocks
  const codeBlocks: string[] = [];
  let html = md.replace(/```([\s\S]*?)```/gm, (_, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
    return `<!--CODE_BLOCK_${idx}-->`;
  });

  // 2. Extract and preserve pre-existing HTML tables (<table...</table>)
  const htmlTables: string[] = [];
  html = html.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
    const idx = htmlTables.length;
    let formatted = tableHtml;
    if (!formatted.includes('class="doc-table"')) {
      formatted = formatted.replace(/<table/i, '<table class="doc-table"');
    }
    htmlTables.push(`<div class="table-container">${formatted}</div>`);
    return `<!--HTML_TABLE_${idx}-->`;
  });

  // 3. Render Markdown Tables (| Header | Header | ...)
  html = renderMarkdownTables(html);

  // 4. Extract and preserve existing HTML links (<a ...</a>)
  const htmlLinks: string[] = [];
  html = html.replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, linkText) => {
    const idx = htmlLinks.length;
    htmlLinks.push(`<a href="${href}" target="_blank" rel="noopener noreferrer" class="doc-link" data-preview-url="${href}">${linkText}</a>`);
    return `<!--HTML_LINK_${idx}-->`;
  });

  // 5. Convert Markdown Links: [Link Text](https://example.com)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+|\/[^\s\)]+)\)/g, (_, label, url) => {
    const idx = htmlLinks.length;
    htmlLinks.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="doc-link" data-preview-url="${url}">${label}</a>`);
    return `<!--HTML_LINK_${idx}-->`;
  });

  // 6. Autolink standalone raw URLs (https://..., http://..., or www....)
  html = html.replace(/(^|[^"'>=\/\w])(https?:\/\/[^\s<]+|www\.[^\s<]+)/g, (match, prefix, rawUrl) => {
    let url = rawUrl;
    let trailing = '';
    const punctMatch = url.match(/[.,;:!?)"']+$/);
    if (punctMatch) {
      trailing = punctMatch[0];
      url = url.slice(0, -trailing.length);
    }
    if (!url.includes('.') || url.endsWith('.')) return match;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const idx = htmlLinks.length;
    htmlLinks.push(`<a href="${href}" target="_blank" rel="noopener noreferrer" class="doc-link" data-preview-url="${href}">${url}</a>`);
    return `${prefix}<!--HTML_LINK_${idx}-->${trailing}`;
  });

  // 7. Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Clean up any stray video timestamp chip tags or buttons
  html = html
    .replace(/<button[^>]*class=["'][^"']*video-timestamp-chip[^"']*["'][^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<span[^>]*class=["'][^"']*video-timestamp-chip[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/\[00:00\]/g, '')
    .replace(/(?:--\s*){3,}/g, '');

  // 8. Key Ideas & Callouts
  html = html.replace(/>>>(.+?)<<</g, '<blockquote class="callout">$1</blockquote>');
  html = html.replace(/!!(.+?)!!/g, '<strong style="color:var(--color-accent-light)">$1</strong>');

  // 9. Colored highlights: =={colorname}text==
  html = html.replace(/==\{([a-z]+)\}(.+?)==/g, (_, colorName, content) => {
    const c = COLOR_MAP[colorName];
    if (!c) return `<mark class="highlight-mark">${content}</mark>`;
    return `<mark style="background:${c.bg};border:1px solid ${c.border};color:${c.text};border-radius:3px;padding:1px 5px;font-weight:600;box-decoration-break:clone;-webkit-box-decoration-break:clone">${content}</mark>`;
  });

  // 10. Generic highlight: ==text==
  html = html.replace(/==(.+?)==/g, '<mark class="highlight-mark">$1</mark>');

  // 11. Strikethrough: ~~text~~
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // 12. Headings
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 13. Bold & italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // 14. Inline arrows
  html = html.replace(/\s*->\s*/g, ' &rarr; ');

  // 15. Checkboxes (before list items)
  html = html.replace(/^- \[x\] (.+)$/gm, '<div class="md-check done">&#10003; $1</div>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<div class="md-check">&#9633; $1</div>');

  // 16. Numbered list items
  html = html.replace(/^(\d+)[\.\)]\s+(.+)$/gm, '<li class="ol-item"><span class="ol-num">$1.</span>$2</li>');
  html = html.replace(/(<li class="ol-item">[\s\S]*?<\/li>\n?)+/g, '<ol>$&</ol>');

  // 17. Unordered list items
  html = html.replace(/^([•\*\-])\s+(.+)$/gm, '<li>$2</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, '<ul>$&</ul>');

  // 18. Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote class="callout">$1</blockquote>');

  // 19. Horizontal rule
  html = html.replace(/^---$/gm, '<hr/>');

  // 20. Restore Code blocks, Tables, and Links
  html = html.replace(/<!--CODE_BLOCK_(\d+)-->/g, (_, idx) => codeBlocks[Number(idx)] || '');
  html = html.replace(/<!--HTML_TABLE_(\d+)-->/g, (_, idx) => htmlTables[Number(idx)] || '');
  html = html.replace(/<!--HTML_LINK_(\d+)-->/g, (_, idx) => htmlLinks[Number(idx)] || '');

  // 21. Wrap double-newline separated blocks in <p>
  html = html.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^<(h[1-6]|ul|ol|hr|div|pre|blockquote|table)/.test(trimmed)) return trimmed;
    if (trimmed.startsWith('<div class="table-container"')) return trimmed;
    return `<p>${trimmed}</p>`;
  }).filter(Boolean).join('\n');

  return html;
}

// ── Live Rich Editor Toolbar (Microsoft Word Style) ───────
function MarkdownToolbar({
  onFormat,
  onHighlight,
  onRemoveHighlight,
  activeColor,
  onSetActiveColor,
  onAutoFormat,
  isAutoFormatting,
  onApplyFontColor,
  activeFontColor,
  activeFormats,
  onAddVideo,
}: {
  onFormat: (cmd: string, value?: string) => void;
  onHighlight: (colorName: string, forceApply?: boolean) => void;
  onRemoveHighlight: () => void;
  activeColor: string;
  onSetActiveColor: (colorName: string) => void;
  onAutoFormat: () => void;
  isAutoFormatting: boolean;
  onApplyFontColor?: (color: string) => void;
  activeFontColor?: string;
  onAddVideo?: () => void;
  activeFormats?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    code?: boolean;
    h1?: boolean;
    h2?: boolean;
    h3?: boolean;
    alignLeft?: boolean;
    alignCenter?: boolean;
    alignRight?: boolean;
    alignJustify?: boolean;
    list?: boolean;
    numbered?: boolean;
    quote?: boolean;
    link?: boolean;
    important?: boolean;
    keyIdea?: boolean;
    lineSpacing?: string;
  };
}) {
  return (
    <div className={styles.toolbarWrapper}>
      <div className={styles.toolbar}>
        {/* Undo / Redo */}
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('undo')}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('redo')}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={12} />
        </button>

        <span className={styles.toolbarDivider} />

        {/* Headings */}
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.h1 ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('h1')}
          title="Heading 1"
          style={{ fontWeight: 800 }}
        >
          H1
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.h2 ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('h2')}
          title="Heading 2"
          style={{ fontWeight: 700 }}
        >
          H2
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.h3 ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('h3')}
          title="Heading 3"
          style={{ fontWeight: 600 }}
        >
          H3
        </button>

        <span className={styles.toolbarDivider} />

        {/* Inline formatting */}
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.bold ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold size={12} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.italic ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic size={12} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.underline ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('underline')}
          title="Underline (Ctrl+U)"
        >
          <Underline size={12} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.strikethrough ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('strikethrough')}
          title="Strikethrough"
        >
          <Strikethrough size={12} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.code ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('code')}
          title="Inline Code"
        >
          <Code size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('removeFormat')}
          title="Clear Formatting (Ctrl+Space)"
        >
          <RemoveFormatting size={12} />
        </button>

        <span className={styles.toolbarDivider} />

        {/* Text Alignment */}
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.alignLeft ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('alignLeft')}
          title="Align Left"
        >
          <AlignLeft size={12} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.alignCenter ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('alignCenter')}
          title="Align Center"
        >
          <AlignCenter size={12} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.alignRight ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('alignRight')}
          title="Align Right"
        >
          <AlignRight size={12} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.alignJustify ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('alignJustify')}
          title="Justify"
        >
          <AlignJustify size={12} />
        </button>

        <span className={styles.toolbarDivider} />

        {/* Indentation & Line Spacing */}
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('outdent')}
          title="Decrease Indent (Shift+Tab)"
        >
          <Outdent size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('indent')}
          title="Increase Indent (Tab)"
        >
          <Indent size={12} />
        </button>

        <select
          className={styles.toolbarSelect}
          value={activeFormats?.lineSpacing || '1.15'}
          onChange={(e) => onFormat('lineSpacing', e.target.value)}
          title="Line Spacing (Single, 1.15, 1.5, Double)"
        >
          <option value="1">1.0 Single</option>
          <option value="1.15">1.15 Normal</option>
          <option value="1.5">1.5 Lines</option>
          <option value="2">2.0 Double</option>
        </select>

        <span className={styles.toolbarDivider} />

        {/* Lists & Blocks */}
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.list ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('list')}
          title="Bullet List"
        >
          <List size={12} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.numbered ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('numbered')}
          title="Numbered List"
        >
          <ListOrdered size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('task')}
          title="Checklist Task"
        >
          <CheckSquare size={12} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.quote ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('quote')}
          title="Blockquote"
        >
          <Quote size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('divider')}
          title="Horizontal Rule"
        >
          <Minus size={12} />
        </button>

        {/* Table & Hyperlink (Microsoft Word Style) */}
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('table')}
          title="Insert Table (Microsoft Word Style)"
        >
          <Table size={12} style={{ marginRight: 3 }} /> Table
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeFormats?.link ? styles.toolbarBtnActive : ''}`}
          onClick={() => onFormat('link')}
          title="Insert / Edit Hyperlink (Ctrl+K)"
        >
          <Link2 size={12} style={{ marginRight: 3 }} /> Link
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={onAddVideo}
          title="Add YouTube Video Lesson"
        >
          <Video size={12} style={{ marginRight: 3, color: 'var(--color-accent-light)' }} /> Video Lesson
        </button>

        <span className={styles.toolbarDivider} />

        {/* Formal Callouts */}
        <button
          type="button"
          className={`${styles.toolbarBtn} ${styles.toolbarImportant} ${activeFormats?.important ? styles.toolbarImportantActive : ''}`}
          onClick={() => onFormat('important')}
          title="Toggle Important Callout (Educational Book Style)"
        >
          <AlertCircle size={12} style={{ marginRight: 3 }} /> Important
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${styles.toolbarKeyIdea} ${activeFormats?.keyIdea ? styles.toolbarKeyIdeaActive : ''}`}
          onClick={() => onFormat('key-idea')}
          title="Toggle Key Idea Callout (Core Concept / Lesson)"
        >
          <Lightbulb size={12} style={{ marginRight: 3 }} /> Key Idea
        </button>

        <span className={styles.toolbarDivider} />

        {/* Executive Compact Highlighter */}
        <div className={styles.inlineHighlightGroup} title="Select text and click a color to highlight">
          <Highlighter size={12} className={styles.highlighterIcon} />
          {[
            { name: 'yellow', bg: '#fef08a', border: '#eab308', label: 'Yellow' },
            { name: 'mint',   bg: '#bbf7d0', border: '#22c55e', label: 'Green' },
            { name: 'cyan',   bg: '#bae6fd', border: '#0284c7', label: 'Blue' },
            { name: 'purple', bg: '#e9d5ff', border: '#a855f7', label: 'Purple' },
          ].map((c) => (
            <button
              key={c.name}
              type="button"
              className={`${styles.compactSwatch} ${activeColor === c.name ? styles.compactSwatchActive : ''}`}
              style={{
                background: c.bg,
                borderColor: c.border,
                color: c.border,
              }}
              onClick={() => {
                onSetActiveColor(c.name);
                onHighlight(c.name, true);
              }}
              title={`Highlight: ${c.label}`}
              aria-label={`Highlight ${c.label}`}
            />
          ))}
          <button
            type="button"
            className={styles.clearHighlightBtn}
            onClick={onRemoveHighlight}
            title="Remove highlight from selected text"
            aria-label="Remove highlight"
          >
            <Eraser size={12} />
          </button>
        </div>

        {/* Executive Compact Font Color Picker */}
        <div className={styles.inlineHighlightGroup} title="Select text and click a color to change font color">
          <Type size={12} className={styles.highlighterIcon} />
          {FONT_COLORS.slice(1, 8).map((fc) => (
            <button
              key={fc.name}
              type="button"
              className={`${styles.compactSwatch} ${activeFontColor === fc.color ? styles.compactSwatchActive : ''}`}
              style={{
                background: fc.color,
                borderColor: fc.border,
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '8px',
                fontWeight: 800,
              }}
              onClick={() => onApplyFontColor?.(fc.color)}
              title={`Font Color: ${fc.label}`}
              aria-label={`Font Color ${fc.label}`}
            >
              A
            </button>
          ))}
          <button
            type="button"
            className={styles.clearHighlightBtn}
            onClick={() => onApplyFontColor?.('inherit')}
            title="Reset font color to default"
            aria-label="Reset font color"
          >
            <RotateCcw size={11} />
          </button>
        </div>

        {/* Single Unified Auto Format Button (Manual Activation Only) */}
        <button
          type="button"
          className={`${styles.toolbarBtn} ${styles.toolbarAutoFormatBtn}`}
          onClick={onAutoFormat}
          disabled={isAutoFormatting}
          title="Smart Auto Format: analyze structure and format into a professional book or study guide (manual click only)"
          style={{ marginLeft: 'auto' }}
        >
          {isAutoFormatting ? (
            <Loader2 size={11} className={styles.spin} />
          ) : (
            <Sparkles size={11} style={{ color: 'var(--color-accent-light)' }} />
          )}
          <span>{isAutoFormatting ? 'Analyzing...' : 'Auto Format'}</span>
        </button>
      </div>
    </div>
  );
}


export default function KnowledgePage() {
  const router = useRouter();
  const { selectFocusDoc } = useFocus();
  const { docs, isLoaded, addDoc, updateDoc, deleteDoc, restoreDoc, togglePinDoc, toggleDocReminder, resetToDefaultDocs } = useKnowledge();
  const { settings } = useSettings();
  const { goals }    = useGoals();
  const { dreams }   = useDreams();
  const { projects } = useProjects();
  const { tasks }    = useTasks();

  const [searchQ, setSearchQ]     = useState('');
  const [deleteDialogDoc, setDeleteDialogDoc] = useState<{ id: string; title: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | DocumentStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'documents' | 'videos'>('all');
  const [copied, setCopied] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isAiFormatting, setIsAiFormatting] = useState(false);
  const [activeHighlightColor, setActiveHighlightColor] = useState('yellow');
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActionMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsActionMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActionMenuOpen]);
  
  // Dedicated history stack for robust Ctrl+Z (Undo) and Ctrl+Y (Redo)
  const historyStackRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isNavigatingHistoryRef = useRef<boolean>(false);
  const typingHistoryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const performUndoRef = useRef<() => void>(() => {});
  const performRedoRef = useRef<() => void>(() => {});

  // Microsoft Word-Style Live Active Formatting & Link Popover
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    code: false,
    h1: false,
    h2: false,
    h3: false,
    alignLeft: true,
    alignCenter: false,
    alignRight: false,
    alignJustify: false,
    list: false,
    numbered: false,
    quote: false,
    link: false,
    important: false,
    keyIdea: false,
    lineSpacing: '1.15',
  });
  const [linkPopover, setLinkPopover] = useState<{
    x: number;
    y: number;
    url: string;
    targetEl: HTMLAnchorElement;
  } | null>(null);

  // Reading tools companion (typography, highlights, timer)
  const [isCompanionOpen, setIsCompanionOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('life_os_reading_tools_open');
      if (saved !== null) {
        setIsCompanionOpen(saved === 'true');
      } else if (typeof window !== 'undefined' && window.innerWidth >= 1100) {
        setIsCompanionOpen(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggleCompanion = () => {
    setIsCompanionOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('life_os_reading_tools_open', String(next));
      } catch {}
      return next;
    });
  };

  const importFileRef = useRef<HTMLInputElement>(null);
  const hasHandledInitialUrlDoc = useRef(false);

  // Featured book on Today Dashboard
  const [featuredBookId, setFeaturedBookId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('life_os_featured_book_id');
      if (saved) setFeaturedBookId(saved);
    } catch {
      // ignore
    }

    const onBookChanged = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) setFeaturedBookId(custom.detail);
    };
    window.addEventListener('life_os_featured_book_changed', onBookChanged);
    return () => window.removeEventListener('life_os_featured_book_changed', onBookChanged);
  }, []);

  const handleSetFeaturedOnDashboard = (docId: string) => {
    setFeaturedBookId(docId);
    try {
      localStorage.setItem('life_os_featured_book_id', docId);
      window.dispatchEvent(new CustomEvent('life_os_featured_book_changed', { detail: docId }));
      updateDoc(docId, { readStatus: 'reading' });
    } catch {
      // ignore
    }
  };

  const handleToggleFeaturedOnDashboard = (docId: string) => {
    if (featuredBookId === docId) {
      setFeaturedBookId(null);
      try {
        localStorage.removeItem('life_os_featured_book_id');
        window.dispatchEvent(new CustomEvent('life_os_featured_book_changed', { detail: '' }));
      } catch {
        // ignore
      }
    } else {
      handleSetFeaturedOnDashboard(docId);
    }
  };

  // Editor state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedDoc = selectedId ? docs.find((d) => d.id === selectedId) ?? null : null;
  const [editorMode, setEditorMode] = useState<'edit' | 'preview' | 'book' | 'word' | 'quiz'>('book');
  const [isCreating, setIsCreating] = useState(false);
  const [showMetaSettings, setShowMetaSettings] = useState(false);

  // Mobile responsive view tab: 'list' (shows document search/list) vs 'editor' (shows canvas/book/editor)
  const [mobileTab, setMobileTab] = useState<'list' | 'editor'>('list');

  // AI Knowledge Suite state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalTab, setAiModalTab] = useState<'format' | 'summary' | 'quiz' | 'ask'>('format');
  const [aiSummaryResult, setAiSummaryResult] = useState<{ summary: string; keyPoints: string[]; actionItems: string[]; isAI: boolean } | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [insertedSummarySuccess, setInsertedSummarySuccess] = useState(false);
  const [aiQuizResult, setAiQuizResult] = useState<{ questions: QuizQuestionItem[]; isAI: boolean } | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [revealedQuizAnswers, setRevealedQuizAnswers] = useState<Record<number, boolean>>({});

  // Form fields
  const [fTitle, setFTitle]           = useState('');
  const [fContent, setFContent]       = useState('');
  const [fStatus, setFStatus]         = useState<DocumentStatus>('active');
  const [fCategory, setFCategory]     = useState<DocumentCategory>('general');
  const [fIsPinned, setFIsPinned]     = useState(false);
  const [fReadStatus, setFReadStatus] = useState<DocumentReadStatus>('reading');
  const [fReadProgress, setFReadProgress] = useState<number>(0);
  const [fCurrentPage, setFCurrentPage] = useState<number | undefined>(undefined);
  const [fTotalPages, setFTotalPages]   = useState<number | undefined>(undefined);
  const [fTags, setFTags]             = useState('');
  const [fDreamId, setFDreamId]       = useState('');
  const [fGoalId, setFGoalId]         = useState('');
  const [fProjectId, setFProjectId]   = useState('');
  const [fTaskId, setFTaskId]         = useState('');

  const isCurrentVideo = Boolean(selectedDoc ? isDocVideoLesson(selectedDoc) : isDocVideoLesson({ content: fContent, title: fTitle }));

  const editorRef = useRef<HTMLDivElement>(null);
  const bookEditorRef = useRef<HTMLDivElement>(null);
  const wordEditorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const cachedSelectionRangeRef = useRef<Range | null>(null);
  const [floatingMenu, setFloatingMenu] = useState<{ x: number; y: number; targetMark?: HTMLElement | null } | null>(null);

  // Smart Paste as Book states
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteModalText, setPasteModalText] = useState('');
  const [pasteToast, setPasteToast] = useState<string | null>(null);

  // Reading mode typography settings (font family, font size & reader text color)
  const [readingFont, setReadingFont] = useState<'sans' | 'serif'>('sans');
  const [readingFontSize, setReadingFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [readingTextColor, setReadingTextColor] = useState<string>('default');
  const [annotationTab, setAnnotationTab] = useState<'highlight' | 'fontColor'>('highlight');
  const [activeFontColor, setActiveFontColor] = useState<string>('#ffffff');

  const changeReadingFont = (font: 'sans' | 'serif') => {
    setReadingFont(font);
    if (typeof window !== 'undefined') localStorage.setItem('lifeos_reading_font', font);
  };

  const changeReadingFontSize = (size: 'sm' | 'md' | 'lg') => {
    setReadingFontSize(size);
    if (typeof window !== 'undefined') localStorage.setItem('lifeos_reading_font_size', size);
  };

  const changeReadingTextColor = (colorVal: string) => {
    setReadingTextColor(colorVal);
    if (typeof window !== 'undefined') localStorage.setItem('lifeos_reading_text_color', colorVal);
  };

  // ── Smooth Auto-Scroll State & Effect ─────────────────────────────
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(30); // pixels per second
  const scrollAccRef = useRef<number>(0);
  const lastScrollTimeRef = useRef<number | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);

  // ── Study Session & Video Lessons Integration ──────────
  const {
    setAssociatedBook,
    stopwatchSeconds,
    mode: studyMode,
    pomoSecondsLeft,
    pomoDuration,
    saveActiveStopwatchSession,
  } = useStudySession();

  // Video Lessons & Expanded Focus View states
  const [activeFocusLesson, setActiveFocusLesson] = useState<{
    videoId: string;
    url?: string;
    lessonTitle: string;
    startTime: number;
    bookId?: string;
    bookTitle?: string;
  } | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoModalMode, setVideoModalMode] = useState<'insert' | 'create' | 'edit'>('insert');

  const handleOpenVideoLessonModal = (mode: 'insert' | 'create' | 'edit' = 'insert') => {
    setVideoModalMode(mode);
    setEditingVideoBlockTarget(null);
    setVideoModalOpen(true);
  };
  const [editingVideoBlockTarget, setEditingVideoBlockTarget] = useState<{
    element?: HTMLElement | null;
    initialUrl: string;
    initialTitle: string;
    docId?: string;
  } | null>(null);

  const handleEditCurrentVideoLesson = () => {
    if (!selectedDoc) return;
    const videoData = extractVideoLessonData(selectedDoc.content || '');
    setEditingVideoBlockTarget({
      initialUrl: videoData?.url || '',
      initialTitle: selectedDoc.title || videoData?.title || '',
      docId: selectedDoc.id,
    });
    setVideoModalMode('edit');
    setVideoModalOpen(true);
  };
  const [detectedPastedYouTube, setDetectedPastedYouTube] = useState<{
    parsed: NonNullable<ReturnType<typeof parseYouTubeUrl>>;
    rawUrl: string;
  } | null>(null);

  // Sync active book with study session
  useEffect(() => {
    if (selectedDoc) {
      setAssociatedBook(selectedDoc.id, selectedDoc.title);
    } else {
      setAssociatedBook(null, null);
    }
  }, [selectedDoc?.id, selectedDoc?.title, setAssociatedBook]);

  // Reading Logs & Manual Log state
  const [readingLogsModalOpen, setReadingLogsModalOpen] = useState(false);
  const [manualReadMinutes, setManualReadMinutes] = useState('20');
  const [manualReadTime, setManualReadTime] = useState('');

  // Reset autoscroll on doc switch
  useEffect(() => {
    setIsAutoScrolling(false);
  }, [selectedId]);
  // Guard against any typing or deletion keystrokes in locked Book/Word modes
  const handleLockedKeyDown = (e: React.KeyboardEvent) => {
    // Allow copy, select-all, search
    if (e.ctrlKey || e.metaKey) return;
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter' || (e.key.length === 1 && !e.altKey)) {
      e.preventDefault();
    }
  };

  // Smooth Auto-Scroll requestAnimationFrame loop
  useEffect(() => {
    if (!isAutoScrolling) {
      if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
      lastScrollTimeRef.current = null;
      scrollAccRef.current = 0;
      return;
    }

    const step = (now: number) => {
      if (lastScrollTimeRef.current === null) {
        lastScrollTimeRef.current = now;
      }
      const dt = (now - lastScrollTimeRef.current) / 1000;
      lastScrollTimeRef.current = now;

      scrollAccRef.current += autoScrollSpeed * dt;
      if (scrollAccRef.current >= 1) {
        const px = Math.floor(scrollAccRef.current);
        scrollAccRef.current -= px;

        const scrollContainer = (document.querySelector(`.${styles.editorCanvas}`) ||
                                 document.querySelector(`.${styles.bookWrapper}`) ||
                                 document.querySelector(`.${styles.wordDocumentWrapper}`)) as HTMLElement | null;

        if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight + 10) {
          scrollContainer.scrollTop += px;
          if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 4) {
            setIsAutoScrolling(false);
            return;
          }
        } else {
          window.scrollBy({ top: px, behavior: 'instant' as ScrollBehavior });
          if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 6) {
            setIsAutoScrolling(false);
            return;
          }
        }
      }

      autoScrollRafRef.current = requestAnimationFrame(step);
    };

    autoScrollRafRef.current = requestAnimationFrame(step);

    const container = document.querySelector(`.${styles.editorCanvas}`);
    const handleUserInterrupt = () => {
      setIsAutoScrolling(false);
    };
    if (container) {
      container.addEventListener('wheel', handleUserInterrupt, { passive: true });
      container.addEventListener('touchmove', handleUserInterrupt, { passive: true });
    }

    return () => {
      if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
      if (container) {
        container.removeEventListener('wheel', handleUserInterrupt);
        container.removeEventListener('touchmove', handleUserInterrupt);
      }
    };
  }, [isAutoScrolling, autoScrollSpeed]);

  // Video Lesson Block Actions Handler (delegated click for Focus View, Move Up, Move Down, Edit, Delete)
  const handleCommonDocumentClick = (e: React.MouseEvent<HTMLDivElement>): boolean => {
    const target = e.target as HTMLElement;

    // Instant removal of stray timestamp chips or stuck buttons in edit mode
    const chip = target.closest('.video-timestamp-chip, [data-timestamp]') as HTMLElement | null;
    if (chip && editorMode === 'edit') {
      e.preventDefault();
      e.stopPropagation();
      chip.remove();
      const editor = editorRef.current;
      if (editor) {
        setFContent(editor.innerHTML);
        if (selectedDoc) updateDoc(selectedDoc.id, { content: editor.innerHTML });
      }
      return true;
    }

    // 1. Focus View action button -> Navigate to Focus Space
    const focusBtn = target.closest('[data-action="focus-view"]') as HTMLElement | null;
    if (focusBtn) {
      e.preventDefault();
      e.stopPropagation();
      const card = focusBtn.closest('.video-lesson-block') as HTMLElement | null;
      const videoId = focusBtn.getAttribute('data-video-id') || card?.getAttribute('data-video-id') || '';
      const lessonTitle = focusBtn.getAttribute('data-title') || card?.getAttribute('data-title') || 'Video Lesson';
      const start = Number(focusBtn.getAttribute('data-start') || card?.getAttribute('data-start') || '0');

      const targetDoc = selectedDoc || (videoId ? docs.find((d) => d.content?.includes(videoId)) : null);
      if (targetDoc) {
        selectFocusDoc(targetDoc);
      }
      router.push('/focus');
      return true;
    }

    // 1b. Pop-out Video action button -> Floating companion window (bypasses all iframe restrictions)
    const popoutBtn = target.closest('[data-action="popout-video"]') as HTMLElement | null;
    if (popoutBtn) {
      e.preventDefault();
      e.stopPropagation();
      const card = popoutBtn.closest('.video-lesson-block') as HTMLElement | null;
      const targetUrl = popoutBtn.getAttribute('data-url') || card?.getAttribute('data-url') || '';
      if (targetUrl) {
        const width = 880;
        const height = 580;
        const left = Math.max(0, typeof window !== 'undefined' ? window.screen.width - width - 40 : 0);
        const top = 60;
        window.open(
          targetUrl,
          'LifeOSVideoPlayer',
          `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=no`
        );
      }
      return true;
    }

    // 2. Move Up action button (Edit mode)
    const moveUpBtn = target.closest('[data-action="move-up-video"]') as HTMLElement | null;
    if (moveUpBtn && editorMode === 'edit') {
      e.preventDefault();
      e.stopPropagation();
      const card = moveUpBtn.closest('.video-lesson-block') as HTMLElement | null;
      const editor = editorRef.current;
      if (card && editor && card.previousElementSibling) {
        card.parentNode?.insertBefore(card, card.previousElementSibling);
        setFContent(editor.innerHTML);
        if (selectedDoc) updateDoc(selectedDoc.id, { content: editor.innerHTML });
      }
      return true;
    }

    // 3. Move Down action button (Edit mode)
    const moveDownBtn = target.closest('[data-action="move-down-video"]') as HTMLElement | null;
    if (moveDownBtn && editorMode === 'edit') {
      e.preventDefault();
      e.stopPropagation();
      const card = moveDownBtn.closest('.video-lesson-block') as HTMLElement | null;
      const editor = editorRef.current;
      if (card && editor && card.nextElementSibling) {
        card.parentNode?.insertBefore(card.nextElementSibling, card);
        setFContent(editor.innerHTML);
        if (selectedDoc) updateDoc(selectedDoc.id, { content: editor.innerHTML });
      }
      return true;
    }

    // 4. Edit Video action button (Only change link and name)
    const editBtn = target.closest('[data-action="edit-video"]') as HTMLElement | null;
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      const card = editBtn.closest('.video-lesson-block') as HTMLElement | null;
      const videoData = selectedDoc ? extractVideoLessonData(selectedDoc.content || '') : null;
      const videoId = editBtn.getAttribute('data-video-id') || card?.getAttribute('data-video-id') || videoData?.videoId || '';
      const url = editBtn.getAttribute('data-url') || card?.getAttribute('data-url') || videoData?.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');
      const title = editBtn.getAttribute('data-title') || card?.getAttribute('data-title') || videoData?.title || selectedDoc?.title || fTitle || '';
      setEditingVideoBlockTarget({
        element: card,
        initialUrl: url,
        initialTitle: title,
        docId: selectedDoc?.id,
      });
      setVideoModalMode('edit');
      setVideoModalOpen(true);
      return true;
    }

    // 5. Delete Video action button (Edit mode)
    const deleteBtn = target.closest('[data-action="delete-video"]') as HTMLElement | null;
    if (deleteBtn && editorMode === 'edit') {
      e.preventDefault();
      e.stopPropagation();
      const card = deleteBtn.closest('.video-lesson-block') as HTMLElement | null;
      const editor = editorRef.current;
      if (card && editor) {
        card.remove();
        setFContent(editor.innerHTML);
        if (selectedDoc) updateDoc(selectedDoc.id, { content: editor.innerHTML });
      }
      return true;
    }

    return false;
  };

  // Insert or update video lesson block inside document OR create dedicated Video Lesson
  const handleInsertVideoLesson = ({
    videoId,
    url,
    title,
    startTime,
  }: {
    videoId: string;
    url: string;
    title: string;
    startTime: number;
  }) => {
    if (videoModalMode === 'create') {
      const lessonTitle = title.trim() || 'Video Lesson';
      const blockHtml = generateVideoBlockHtml({
        videoId,
        url,
        title: lessonTitle,
        startTime,
        isEditMode: false,
      });
      const newDoc = addDoc({
        title: lessonTitle,
        content: `${blockHtml}\n\n## Practice & Study Notes\n- Key chords, tabs, and insights...\n`,
        status: 'active',
        category: 'learning',
        tags: ['video-lesson'],
        docType: 'video-lesson',
        isPinned: false,
        readStatus: 'reading',
        readProgress: 0,
      });
      setSelectedId(newDoc.id);
      setIsCreating(false);
      setTypeFilter('videos');
      setEditorMode('book');
      setMobileTab('editor');
      setPasteToast('New Video Lesson created & saved!');
      setTimeout(() => setPasteToast(null), 3000);
      return;
    }

    if (videoModalMode === 'edit' || editingVideoBlockTarget?.docId) {
      const targetDocId = editingVideoBlockTarget?.docId || selectedDoc?.id;
      const targetDoc = targetDocId ? docs.find((d) => d.id === targetDocId) || selectedDoc : selectedDoc;

      if (targetDoc) {
        const lessonTitle = title.trim() || targetDoc.title || 'Video Lesson';
        const notes = extractVideoLessonNotes(targetDoc.content || '');
        const newBlockHtml = generateVideoBlockHtml({
          videoId,
          url,
          title: lessonTitle,
          startTime,
          isEditMode: false,
        });
        const updatedContent = `${newBlockHtml}\n\n${notes}`;

        updateDoc(targetDoc.id, {
          title: lessonTitle,
          content: updatedContent,
          docType: 'video-lesson',
        });
        setFTitle(lessonTitle);
        setFContent(updatedContent);
        setEditorMode('book');
        setEditingVideoBlockTarget(null);
        setPasteToast('Video link & lesson name updated!');
        setTimeout(() => setPasteToast(null), 2500);
        return;
      }
    }

    const isEdit = editorMode === 'edit';
    const blockHtml = generateVideoBlockHtml({
      videoId,
      url,
      title,
      startTime,
      isEditMode: isEdit,
    });
    const editor = editorRef.current;

    if (editingVideoBlockTarget?.element && editor?.contains(editingVideoBlockTarget.element)) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = blockHtml;
      const newEl = wrapper.firstElementChild;
      if (newEl) {
        editingVideoBlockTarget.element.replaceWith(newEl);
      }
      setEditingVideoBlockTarget(null);
    } else if (editor && isEdit) {
      editor.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
        document.execCommand('insertHTML', false, `${blockHtml}<p><br/></p>`);
      } else {
        editor.innerHTML = `${editor.innerHTML}\n${blockHtml}<p><br/></p>`;
      }
    } else {
      const current = selectedDoc?.content || fContent || '';
      const updated = `${current}\n\n${blockHtml}\n\n`;
      setFContent(updated);
      if (selectedDoc) updateDoc(selectedDoc.id, { content: updated, docType: 'video-lesson' });
    }

    if (editor && isEdit) {
      const cleaned = transformVideoLessonsInHtml(editor.innerHTML, true);
      editor.innerHTML = cleaned;
      setFContent(cleaned);
      pushHistorySnapshot(cleaned);
      if (selectedDoc) updateDoc(selectedDoc.id, { content: cleaned, docType: 'video-lesson' });
    }
  };

  // Convert pasted YouTube URL to embedded Video Lesson block
  const handleConvertPastedToVideo = () => {
    if (!detectedPastedYouTube || !editorRef.current) return;
    const { parsed, rawUrl } = detectedPastedYouTube;
    const editor = editorRef.current;

    const blockHtml = generateVideoBlockHtml({
      videoId: parsed.videoId,
      url: parsed.originalUrl,
      title: 'Video Lesson',
      startTime: parsed.startTime,
      isEditMode: true,
    });

    const anchors = Array.from(editor.querySelectorAll('a'));
    const targetAnchor = anchors.reverse().find(
      (a) => a.href.includes(parsed.videoId) || a.textContent?.includes(rawUrl)
    );

    if (targetAnchor) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `${blockHtml}<p><br/></p>`;
      targetAnchor.replaceWith(wrapper.firstElementChild!);
    } else {
      document.execCommand('insertHTML', false, `${blockHtml}<p><br/></p>`);
    }

    setFContent(editor.innerHTML);
    pushHistorySnapshot(editor.innerHTML);
    if (selectedDoc) updateDoc(selectedDoc.id, { content: editor.innerHTML });
    setDetectedPastedYouTube(null);
  };

  // Add manual reading log
  const handleAddManualReadingLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    const mins = parseInt(manualReadMinutes, 10) || 20;
    const timeStr = manualReadTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logItem: ReadingLogItem = {
      id: `read_${Date.now()}`,
      startedAt: new Date().toISOString(),
      durationMinutes: mins,
      timeOfDay: timeStr,
      notes: `Manual log: ${selectedDoc.title}`,
    };
    const currentLogs = selectedDoc.readingLogs || [];
    const nextLogs = [logItem, ...currentLogs].slice(0, 50);
    const total = (selectedDoc.totalReadMinutes || 0) + mins;

    updateDoc(selectedDoc.id, {
      readingLogs: nextLogs,
      totalReadMinutes: total,
      lastReadAt: new Date().toISOString(),
      preferredReadingTime: timeStr,
    });

    setPasteToast(`Recorded ${mins} min read at ${timeStr}!`);
    setTimeout(() => setPasteToast(null), 3000);
    setManualReadTime('');
  };

  // Ensure all links in document are clickable & clicking a highlight mark or font-span opens the format toolbar
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Check if clicked video lesson action buttons first
    if (handleCommonDocumentClick(e)) return;

    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        window.open(anchor.href, '_blank', 'noopener,noreferrer');
        return;
      }
      e.preventDefault();
      const rect = anchor.getBoundingClientRect();
      setLinkPopover({
        x: rect.left,
        y: rect.bottom + 6,
        url: anchor.href,
        targetEl: anchor,
      });
      return;
    }

    const clickedMark = target.closest('mark, .font-color-span') as HTMLElement | null;
    if (clickedMark) {
      const rect = clickedMark.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      x = Math.max(130, Math.min(window.innerWidth - 130, x));
      let y = rect.top - 46;
      if (y < 60) {
        y = rect.bottom + 12;
      }
      setFloatingMenu({ x, y, targetMark: clickedMark });
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedF = localStorage.getItem('lifeos_reading_font');
      if (savedF === 'serif' || savedF === 'sans') setReadingFont(savedF);
      const savedS = localStorage.getItem('lifeos_reading_font_size');
      if (savedS === 'sm' || savedS === 'md' || savedS === 'lg') setReadingFontSize(savedS);
      const savedC = localStorage.getItem('lifeos_reading_text_color');
      if (savedC) setReadingTextColor(savedC);
    }
  }, []);

  // Floating highlight & format toolbar when selecting text (mouse drag, long-press, touch selection)
  useEffect(() => {
    let selectionTimeout: any = null;

    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) {
        setFloatingMenu(null);
        cachedSelectionRangeRef.current = null;
        return;
      }

      if (sel.isCollapsed) {
        return;
      }

      const text = sel.toString().trim();
      if (text.length === 0) {
        setFloatingMenu(null);
        cachedSelectionRangeRef.current = null;
        return;
      }

      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const editorEl = editorRef.current;
      const bookEl = bookEditorRef.current;
      const wordEl = wordEditorRef.current;

      const isInside =
        (editorEl && editorEl.contains(container)) ||
        (bookEl && bookEl.contains(container)) ||
        (wordEl && wordEl.contains(container));

      if (!isInside) {
        setFloatingMenu(null);
        cachedSelectionRangeRef.current = null;
        return;
      }

      try {
        cachedSelectionRangeRef.current = range.cloneRange();
      } catch {
        cachedSelectionRangeRef.current = range;
      }

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setFloatingMenu(null);
        return;
      }

      let x = rect.left + rect.width / 2;
      x = Math.max(130, Math.min(window.innerWidth - 130, x));

      // In mobile viewports or top of screen, display below selection to prevent clipping
      let y = rect.top - 46;
      if (y < 60) {
        y = rect.bottom + 12;
      }

      // Check if selection is inside an existing mark or font-span
      let targetMark: HTMLElement | null = null;
      let node: Node | null = container;
      while (node && node !== editorEl && node !== bookEl && node !== wordEl) {
        if (node.nodeName === 'MARK' || (node.nodeName === 'SPAN' && (node as HTMLElement).classList.contains('font-color-span'))) {
          targetMark = node as HTMLElement;
          break;
        }
        node = node.parentNode;
      }

      setFloatingMenu({ x, y, targetMark });
    };

    const debouncedSelection = () => {
      if (selectionTimeout) clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(handleSelection, 40);
    };

    const handlePointerDown = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.closest?.('[data-floating-toolbar]')) {
        return;
      }
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setFloatingMenu(null);
          cachedSelectionRangeRef.current = null;
        }
      }, 70);
    };

    document.addEventListener('selectionchange', debouncedSelection);
    document.addEventListener('mouseup', debouncedSelection);
    document.addEventListener('touchend', debouncedSelection);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      if (selectionTimeout) clearTimeout(selectionTimeout);
      document.removeEventListener('selectionchange', debouncedSelection);
      document.removeEventListener('mouseup', debouncedSelection);
      document.removeEventListener('touchend', debouncedSelection);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  // Automatically import and extract text from uploaded PDF or Document
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsImporting(true);
    setImportStatus(`Extracting text from ${file.name}...`);
    try {
      const result = await extractTextFromFile(file);
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const tags = isPdf ? ['pdf', 'imported'] : ['imported', 'notes'];
      
      const docTitle = result.title || file.name;
      const docContent = result.content || '';

      const newDoc = addDoc({
        title: docTitle,
        content: docContent,
        status: 'active',
        tags,
      });

      setFTitle(docTitle);
      setFContent(docContent);
      setSelectedId(newDoc.id);
      setIsCreating(false);
      setEditorMode('book');
      setMobileTab('editor');
      setAiSummaryResult(null);
      setAiQuizResult(null);
      setImportStatus(null);
      setPasteToast(`Imported "${docTitle}" successfully into Book mode!`);
      setTimeout(() => setPasteToast(null), 3500);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Could not extract text from this file. Please make sure the file contains readable text.');
      setImportStatus(null);
    } finally {
      setIsImporting(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  // Helper to format raw text and create/display as Book
  const applyPastedTextAsBook = (rawText: string) => {
    if (!rawText.trim()) return;
    const formatted = cleanAndFormatPastedText(rawText);
    const newDoc = addDoc({
      title: formatted.title,
      content: formatted.markdown,
      status: 'active',
      tags: ['book', 'notes'],
    });

    setFTitle(formatted.title);
    setFContent(formatted.markdown);
    setSelectedId(newDoc.id);
    setIsCreating(false);
    setEditorMode('book');
    setMobileTab('editor');
    setPasteToast(`Formatted "${formatted.title}" into Book layout!`);
    setTimeout(() => setPasteToast(null), 3500);
  };

  // Click "Paste to Book" from header or empty canvas
  const handlePasteAsBookDoc = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim().length > 0) {
          applyPastedTextAsBook(clipText);
          return;
        }
      }
    } catch {
      // clipboard read permission denied or unavailable
    }
    setPasteModalText('');
    setPasteModalOpen(true);
  };

  // Append or insert pasted text into the currently active Book
  const handlePasteIntoCurrentBook = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim().length > 0) {
          appendPastedTextToCurrentBook(clipText);
          return;
        }
      }
    } catch {
      // clipboard read permission denied
    }
    setPasteModalText('');
    setPasteModalOpen(true);
  };

  const appendPastedTextToCurrentBook = (rawText: string) => {
    if (!rawText.trim()) return;
    const formatted = cleanAndFormatPastedText(rawText, undefined, fTitle || selectedDoc?.title);
    const existing = fContent || selectedDoc?.content || '';
    const updatedContent = existing.trim()
      ? `${existing.trim()}\n\n---\n\n${formatted.markdown.replace(/^#\s+.+\n+/, '')}`
      : formatted.markdown;

    if (selectedDoc) {
      updateDoc(selectedDoc.id, {
        content: updatedContent,
        title: (!fTitle || fTitle === 'Untitled') ? formatted.title : fTitle,
      });
    }

    setFContent(updatedContent);
    if ((!fTitle || fTitle === 'Untitled') && formatted.title) {
      setFTitle(formatted.title);
    }
    setEditorMode('book');
    setPasteToast('Pasted & styled into clean Book layout!');
    setTimeout(() => setPasteToast(null), 3500);
  };

  // Format existing text in active document into clean Book format
  const handleFormatCurrentAsBook = () => {
    const textToClean = fContent || editorRef.current?.innerText || '';
    if (!textToClean.trim()) return;

    const formatted = cleanAndFormatPastedText(textToClean, undefined, fTitle || selectedDoc?.title);
    const cleanHtml = renderMarkdown(formatted.markdown);

    setFTitle(formatted.title);
    setFContent(formatted.markdown);
    if (editorRef.current) editorRef.current.innerHTML = cleanHtml;
    if (bookEditorRef.current) bookEditorRef.current.innerHTML = cleanHtml;

    if (selectedDoc) {
      updateDoc(selectedDoc.id, {
        title: formatted.title,
        content: formatted.markdown,
      });
    }
    setEditorMode('book');
    setPasteToast('Formatted into formal, clean publication layout!');
    setTimeout(() => setPasteToast(null), 3500);
  };

  // Paste inside the contentEditable rich editor: preserves exact text formatting while
  // automatically detecting and converting URLs and Markdown links into clickable hyperlinks.
  const handleSmartPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rawText = e.clipboardData.getData('text/plain');
    if (!rawText) return;

    // Automatically put space after numbering: e.g. "1.hha" -> "1. hha"
    const plainText = rawText.replace(/(^|[\s\n])(\d+)[\.\)]([A-Za-z\u00C0-\u024F\u1E00-\u1EFF])/g, '$1$2. $3');

    // Standalone YouTube URL detection: offer to insert as video block while preserving normal text & links
    const trimmed = plainText.trim();
    const parsedYt = parseYouTubeUrl(trimmed);
    if (parsedYt && !/\s/.test(trimmed)) {
      const defaultLinkHtml = `<a href="${parsedYt.watchUrl}" target="_blank" rel="noopener noreferrer" class="doc-link" data-preview-url="${parsedYt.watchUrl}">${trimmed}</a>`;
      document.execCommand('insertHTML', false, defaultLinkHtml);
      if (editorRef.current) {
        setFContent(editorRef.current.innerHTML);
        pushHistorySnapshot(editorRef.current.innerHTML);
        if (selectedDoc) updateDoc(selectedDoc.id, { content: editorRef.current.innerHTML });
      }
      setDetectedPastedYouTube({ parsed: parsedYt, rawUrl: trimmed });
      return;
    }

    // Check if plainText contains URLs or Markdown links
    const hasUrls = /(https?:\/\/[^\s<]+|www\.[^\s<]+|\[[^\]]+\]\([^\)]+\))/.test(plainText);

    if (hasUrls) {
      let html = plainText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Convert Markdown links: [label](url)
      html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+|www\.[^\s\)]+)\)/g, (_, label, url) => {
        const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="doc-link" data-preview-url="${href}">${label}</a>`;
      });

      // Convert standalone URLs
      html = html.replace(/(^|[\s(>])(https?:\/\/[^\s<]+|www\.[^\s<]+)/g, (match, prefix, rawUrl) => {
        let url = rawUrl;
        let trailing = '';
        const punctMatch = url.match(/[.,;:!?)"']+$/);
        if (punctMatch) {
          trailing = punctMatch[0];
          url = url.slice(0, -trailing.length);
        }
        if (!url.includes('.') || url.endsWith('.')) return match;
        const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        return `${prefix}<a href="${href}" target="_blank" rel="noopener noreferrer" class="doc-link" data-preview-url="${href}">${url}</a>${trailing}`;
      });

      // Convert line breaks to preserve spacing
      html = html.replace(/\r?\n/g, '<br/>');

      document.execCommand('insertHTML', false, html);
    } else {
      document.execCommand('insertText', false, plainText);
    }

    if (editorRef.current) {
      setFContent(editorRef.current.innerHTML);
      pushHistorySnapshot(editorRef.current.innerHTML);
    }
    updateActiveFormats();
  };

  // Global shortcut handler for paste in Book mode and Undo/Redo in Edit mode or Document deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (!isCtrlOrMeta) return;

      const key = e.key.toLowerCase();

      // Paste in Book Mode
      if (key === 'v' && editorMode === 'book') {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.getAttribute('contenteditable') === 'true') {
          return;
        }
        e.preventDefault();
        handlePasteIntoCurrentBook();
        return;
      }

      // Ctrl+Z and Ctrl+Y in Edit Mode (Text Editor)
      if (editorMode === 'edit') {
        const activeEl = document.activeElement;
        // Don't intercept if user is typing in title input or modal inputs
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl !== editorRef.current) {
          return;
        }

        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            performRedoRef.current();
          } else {
            performUndoRef.current();
          }
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          performRedoRef.current();
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorMode, selectedDoc, fTitle, fContent]);


  // Select doc from URL param on initial mount, or fallback to first doc
  useEffect(() => {
    if (!isLoaded || docs.length === 0) return;
    if (!hasHandledInitialUrlDoc.current) {
      hasHandledInitialUrlDoc.current = true;
      try {
        const params = new URLSearchParams(window.location.search);
        const urlDocId = params.get('docId');
        if (urlDocId && docs.some((d) => d.id === urlDocId)) {
          setSelectedId(urlDocId);
          setEditorMode('book');
          setMobileTab('editor');
          return;
        }
      } catch {
        // ignore
      }
      setSelectedId((prev) => prev || docs[0].id);
    }
  }, [isLoaded, docs]);

  // Also listen for URL changes via popstate (browser back/forward)
  useEffect(() => {
    const handleUrlDoc = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlDocId = params.get('docId');
        if (urlDocId && docs.some((d) => d.id === urlDocId)) {
          setSelectedId(urlDocId);
          setEditorMode('book');
          setMobileTab('editor');
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('popstate', handleUrlDoc);
    return () => window.removeEventListener('popstate', handleUrlDoc);
  }, [docs]);

  // Helper to switch documents and update browser URL without locking state
  const handleSelectDoc = (docId: string) => {
    setSelectedId(docId);
    setIsCreating(false);
    setMobileTab('editor');
    setAiSummaryResult(null);
    setAiQuizResult(null);
    const canvasEl = document.querySelector(`.${styles.editorCanvas}`);
    if (canvasEl) {
      canvasEl.scrollTop = 0;
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('docId', docId);
      window.history.replaceState(null, '', url.toString());
    } catch {
      // ignore
    }
  };

  // Helper to convert content into rich HTML for live editing, Word doc, and book reading
  const getRichHtml = (content: string, isEdit = (editorMode === 'edit')) => {
    if (!content) return '';
    const html = renderMarkdown(content);
    return transformVideoLessonsInHtml(html, isEdit);
  };

  // Load doc into editor
  useEffect(() => {
    if (selectedDoc) {
      setFTitle(selectedDoc.title);
      setFContent(selectedDoc.content);
      setFStatus(selectedDoc.status);
      setFCategory(selectedDoc.category || 'general');
      setFIsPinned(selectedDoc.isPinned || false);
      setFReadStatus(selectedDoc.readStatus || 'reading');
      setFReadProgress(selectedDoc.readProgress ?? 0);
      setFCurrentPage(selectedDoc.currentPage);
      setFTotalPages(selectedDoc.totalPages);
      setFTags(selectedDoc.tags.join(', '));
      setFDreamId(selectedDoc.linkedDreamId || '');
      setFGoalId(selectedDoc.linkedGoalId || '');
      setFProjectId(selectedDoc.linkedProjectId || '');
      setFTaskId(selectedDoc.linkedTaskId || '');
      // When opening a document on first click, show clean, structured Book view
      setEditorMode('book');

      // Populate rich editor and book view with HTML
      setTimeout(() => {
        const html = getRichHtml(selectedDoc.content || '');
        isInternalChange.current = true;
        if (editorRef.current) {
          editorRef.current.innerHTML = html;
        }
        if (bookEditorRef.current) {
          bookEditorRef.current.innerHTML = html;
        }
        isInternalChange.current = false;
        historyStackRef.current = [html];
        historyIndexRef.current = 0;
      }, 0);
    }
  }, [selectedDoc]);

  // Keep editor & book innerHTML in sync when mode or content changes
  // Only fire when not in the middle of an internal highlight save or active user typing
  useEffect(() => {
    if (isInternalChange.current) return;
    const html = getRichHtml(fContent || '');
    if (editorMode === 'edit' && editorRef.current) {
      const isFocused = typeof document !== 'undefined' && (document.activeElement === editorRef.current || editorRef.current.contains(document.activeElement));
      if (!isFocused && editorRef.current.innerHTML !== html) {
        isInternalChange.current = true;
        editorRef.current.innerHTML = html;
        isInternalChange.current = false;
      }
    } else if (editorMode === 'book' && bookEditorRef.current) {
      if (bookEditorRef.current.innerHTML !== html) {
        isInternalChange.current = true;
        bookEditorRef.current.innerHTML = html;
        isInternalChange.current = false;
      }
    }
  }, [editorMode, fContent]);

  // Load saved active recall quiz from selected document
  useEffect(() => {
    if (selectedDoc?.studyQuiz && selectedDoc.studyQuiz.length > 0) {
      setAiQuizResult({ questions: selectedDoc.studyQuiz, isAI: true });
    } else {
      setAiQuizResult(null);
    }
    setRevealedQuizAnswers({});
  }, [selectedDoc?.id, selectedDoc?.studyQuiz]);

  // Auto-generate quiz when switching to quiz mode if no quiz exists yet
  useEffect(() => {
    if (editorMode === 'quiz' && selectedDoc && (!selectedDoc.studyQuiz || selectedDoc.studyQuiz.length === 0) && !isGeneratingQuiz) {
      const raw = selectedDoc.content || fContent || '';
      if (raw.trim().length >= 10) {
        void handleGenerateQuiz(selectedDoc);
      }
    }
  }, [editorMode, selectedDoc?.id, selectedDoc?.studyQuiz]);

  const clearEditor = () => {
    setFTitle('');
    setFContent('');
    setFStatus('active');
    setFCategory('general');
    setFIsPinned(false);
    setFReadStatus('reading');
    setFReadProgress(0);
    setFCurrentPage(undefined);
    setFTotalPages(undefined);
    setFTags('');
    setFDreamId('');
    setFGoalId('');
    setFProjectId('');
    setFTaskId('');
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  };

  const handleNewDoc = () => {
    setSelectedId(null);
    setIsCreating(true);
    clearEditor();
    historyStackRef.current = [''];
    historyIndexRef.current = 0;
    setEditorMode('edit');
    setMobileTab('editor');
    setAiSummaryResult(null);
    setAiQuizResult(null);
    const canvasEl = document.querySelector(`.${styles.editorCanvas}`);
    if (canvasEl) canvasEl.scrollTop = 0;
  };

  const handleSave = () => {
    const rawTags = fTags.split(',').map((t) => t.trim()).filter(Boolean);
    const isVideo = isDocVideoLesson({ content: fContent, tags: rawTags, docType: selectedDoc?.docType });
    const fallbackTitle = isVideo ? 'Untitled Video Lesson' : 'Untitled Document';
    const finalTitle = fTitle.trim() || fallbackTitle;
    const tags = isVideo && !rawTags.includes('video-lesson') ? [...rawTags, 'video-lesson'] : rawTags;

    const payload = {
      title: finalTitle,
      content: fContent,
      status: fStatus,
      category: fCategory,
      docType: isVideo ? ('video-lesson' as const) : ('document' as const),
      isPinned: fIsPinned,
      readStatus: fReadStatus,
      readProgress: fReadProgress,
      currentPage: fCurrentPage,
      totalPages: fTotalPages,
      tags,
      linkedDreamId: fDreamId || undefined,
      linkedGoalId: fGoalId || undefined,
      linkedProjectId: fProjectId || undefined,
      linkedTaskId: fTaskId || undefined,
    };
    if (isCreating) {
      const created = addDoc(payload);
      setSelectedId(created.id);
      setIsCreating(false);
    } else if (selectedDoc) {
      updateDoc(selectedDoc.id, payload);
    }
    setFTitle(finalTitle);
    setPasteToast('Saved successfully!');
    setTimeout(() => setPasteToast(null), 2500);
  };

  const handleDelete = (id: string, title: string) => {
    setDeleteDialogDoc({ id, title });
  };

  const handleArchiveDoc = (id: string) => {
    updateDoc(id, { status: 'archived' });
    setDeleteDialogDoc(null);
    if (selectedId === id) {
      setSelectedId(docs.find((d) => d.id !== id)?.id || null);
      setIsCreating(false);
    }
  };

  const handlePermanentDelete = (id: string) => {
    deleteDoc(id);
    setDeleteDialogDoc(null);
    if (selectedId === id) {
      setSelectedId(docs.find((d) => d.id !== id)?.id || null);
      setIsCreating(false);
    }
  };

  const handleRestoreDoc = (id: string) => {
    updateDoc(id, { status: 'active' });
  };

  // Export as Formal Printable PDF
  const handleExportPdf = () => {
    if (!fTitle) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export as PDF.');
      return;
    }
    const renderedHtml = getRichHtml(fContent || '');
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const tagsHtml = fTags ? fTags.split(',').map((t) => `<span class="badge">${t.trim()}</span>`).join(' ') : '';
    const linkedHtml = [
      linkedDream ? `Dream: ${linkedDream.title}` : '',
      linkedGoal ? `Goal: ${linkedGoal.title}` : '',
      linkedProject ? `Project: ${linkedProject.title}` : '',
    ].filter(Boolean).join(' &bull; ');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${fTitle} — Formal Document</title>
        <style>
          @page {
            size: A4;
            margin: 20mm 16mm;
            @bottom-right {
              content: counter(page);
              font-size: 9pt;
              color: #64748b;
            }
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #0f172a;
            line-height: 1.7;
            margin: 0;
            padding: 0;
            font-size: 11pt;
          }
          
          /* ── Formal Executive Letterhead ── */
          .executive-header {
            border-bottom: 2px solid #1e293b;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .header-top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8.5pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #475569;
            margin-bottom: 12px;
          }
          .doc-classification {
            background: #0f172a;
            color: #ffffff;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 8pt;
            letter-spacing: 1px;
          }
          h1.doc-title {
            font-size: 24pt;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
            margin: 0 0 12px 0;
            line-height: 1.2;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 8px 16px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 14px;
            font-size: 9pt;
            margin-top: 10px;
          }
          .meta-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .meta-label {
            font-size: 7.5pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
          }
          .meta-value {
            font-weight: 600;
            color: #1e293b;
          }
          .badge {
            background: #e2e8f0;
            color: #334155;
            padding: 2px 7px;
            border-radius: 3px;
            font-size: 8pt;
            font-weight: 600;
            display: inline-block;
            margin-right: 4px;
          }

          /* ── Document Body Content ── */
          .content {
            font-size: 10.5pt;
            line-height: 1.75;
          }
          h1 {
            font-size: 18pt;
            color: #0f172a;
            margin: 22px 0 10px 0;
            padding-bottom: 4px;
            border-bottom: 1.5px solid #cbd5e1;
            page-break-after: avoid;
          }
          h2 {
            font-size: 14pt;
            font-weight: 700;
            color: #1e293b;
            margin: 20px 0 8px 0;
            padding-bottom: 4px;
            border-bottom: 1px solid #e2e8f0;
            page-break-after: avoid;
          }
          h3 {
            font-size: 12pt;
            font-weight: 700;
            color: #334155;
            margin: 16px 0 6px 0;
            page-break-after: avoid;
          }
          h4 {
            font-size: 10.5pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin: 12px 0 4px 0;
          }
          p {
            margin: 0 0 12px 0;
          }
          ul, ol {
            margin: 0 0 12px 0;
            padding-left: 20px;
          }
          li {
            margin-bottom: 4px;
          }
          .ol-item {
            display: flex;
            gap: 8px;
          }
          .ol-num {
            font-weight: 700;
            color: #0f172a;
          }
          
          /* ── Formal ADHD Callouts & Markers ── */
          mark.highlight-mark {
            background: rgba(253, 224, 71, 0.45) !important;
            border-radius: 2px;
            padding: 1px 4px;
            font-weight: 600;
          }
          .important-mark {
            display: inline-block;
            background: rgba(244, 63, 94, 0.12) !important;
            color: #be123c !important;
            border: 1px solid rgba(244, 63, 94, 0.35);
            border-radius: 4px;
            padding: 2px 7px;
            font-weight: 700;
            font-size: 9.5pt;
          }
          .key-idea {
            display: block;
            background: #f0fdfa !important;
            border: 1px solid #0d9488 !important;
            border-radius: 6px;
            padding: 10px 14px;
            margin: 14px 0;
            font-weight: 600;
            color: #134e4a;
            page-break-inside: avoid;
          }
          blockquote.callout {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 10px 14px;
            margin: 14px 0;
            color: #334155;
            font-style: italic;
            page-break-inside: avoid;
          }
          .md-check {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 4px 0;
            font-size: 10pt;
          }
          .md-check.done {
            color: #94a3b8;
            text-decoration: line-through;
          }
          pre {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 9pt;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            page-break-inside: avoid;
          }
          .inline-code {
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 9pt;
            font-family: monospace;
          }
          hr {
            border: 0;
            border-top: 1px solid #cbd5e1;
            margin: 20px 0;
          }

          /* ── Formal Footer ── */
          .executive-footer {
            margin-top: 40px;
            padding-top: 12px;
            border-top: 1px solid #cbd5e1;
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
        </style>
      </head>
      <body>
        <div class="executive-header">
          <div class="header-top-bar">
            <span>Sariling Mundo &bull; Formal Knowledge Asset</span>
            <span class="doc-classification">Official Record</span>
          </div>
          <h1 class="doc-title">${fTitle}</h1>
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Date Generated</span>
              <span class="meta-value">${dateStr}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Status</span>
              <span class="meta-value">${fStatus.toUpperCase()}</span>
            </div>
            ${linkedHtml ? `
              <div class="meta-item" style="grid-column: span 2;">
                <span class="meta-label">Connected Context</span>
                <span class="meta-value">${linkedHtml}</span>
              </div>
            ` : ''}
          </div>
          ${tagsHtml ? `<div style="margin-top: 10px;">${tagsHtml}</div>` : ''}
        </div>
        <div class="content">
          ${renderedHtml}
        </div>
        <div class="executive-footer">
          <span>Sariling Mundo Formal Documentation System</span>
          <span>Confidential &bull; Personal Executive Record</span>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 250);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Robust Undo/Redo history management for Ctrl+Z and Ctrl+Y
  const pushHistorySnapshot = (html: string) => {
    if (isNavigatingHistoryRef.current) return;
    if (typeof html !== 'string') return;
    const stack = historyStackRef.current;
    const curIdx = historyIndexRef.current;
    if (curIdx >= 0 && stack[curIdx] === html) return;

    const nextStack = stack.slice(0, curIdx + 1);
    nextStack.push(html);
    if (nextStack.length > 100) nextStack.shift();
    historyStackRef.current = nextStack;
    historyIndexRef.current = nextStack.length - 1;
  };

  const performUndo = () => {
    const editor = editorRef.current;
    if (!editor) return;

    // Snapshot current unsaved DOM if needed
    const curHtml = editor.innerHTML;
    if (historyIndexRef.current >= 0 && historyStackRef.current[historyIndexRef.current] !== curHtml) {
      pushHistorySnapshot(curHtml);
    }

    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const targetHtml = historyStackRef.current[historyIndexRef.current];
      isNavigatingHistoryRef.current = true;
      isInternalChange.current = true;
      editor.innerHTML = targetHtml;
      setFContent(targetHtml);
      if (selectedDoc) updateDoc(selectedDoc.id, { content: targetHtml });
      isInternalChange.current = false;
      isNavigatingHistoryRef.current = false;
      updateActiveFormats();
      // Position cursor at end for smooth typing
      const sel = window.getSelection();
      if (sel) {
        try {
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch {}
      }
    } else {
      document.execCommand('undo');
      if (editor) setFContent(editor.innerHTML);
      updateActiveFormats();
    }
  };

  const performRedo = () => {
    const editor = editorRef.current;
    if (!editor) return;

    if (historyIndexRef.current < historyStackRef.current.length - 1) {
      historyIndexRef.current += 1;
      const targetHtml = historyStackRef.current[historyIndexRef.current];
      isNavigatingHistoryRef.current = true;
      isInternalChange.current = true;
      editor.innerHTML = targetHtml;
      setFContent(targetHtml);
      if (selectedDoc) updateDoc(selectedDoc.id, { content: targetHtml });
      isInternalChange.current = false;
      isNavigatingHistoryRef.current = false;
      updateActiveFormats();
      // Position cursor at end for smooth typing
      const sel = window.getSelection();
      if (sel) {
        try {
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch {}
      }
    } else {
      document.execCommand('redo');
      if (editor) setFContent(editor.innerHTML);
      updateActiveFormats();
    }
  };

  performUndoRef.current = performUndo;
  performRedoRef.current = performRedo;

  // Backwards compatibility aliases
  const handleUndo = performUndo;
  const handleRedo = performRedo;

  // Copy plain text to clipboard
  const handleCopyText = async () => {
    if (!fContent) return;
    // Extract readable text from HTML if it contains tags
    const temp = document.createElement('div');
    temp.innerHTML = fContent;
    const plain = temp.innerText || temp.textContent || fContent;
    await navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Query active formatting from current cursor / selection (Microsoft Word behavior)
  const updateActiveFormats = () => {
    if (editorMode !== 'edit') return;
    try {
      const isBold = typeof document !== 'undefined' ? document.queryCommandState('bold') : false;
      const isItalic = typeof document !== 'undefined' ? document.queryCommandState('italic') : false;
      const isUnderline = typeof document !== 'undefined' ? document.queryCommandState('underline') : false;
      const isStrike = typeof document !== 'undefined' ? document.queryCommandState('strikeThrough') : false;
      const isList = typeof document !== 'undefined' ? document.queryCommandState('insertUnorderedList') : false;
      const isNumbered = typeof document !== 'undefined' ? document.queryCommandState('insertOrderedList') : false;
      const isCenter = typeof document !== 'undefined' ? document.queryCommandState('justifyCenter') : false;
      const isRight = typeof document !== 'undefined' ? document.queryCommandState('justifyRight') : false;
      const isJustify = typeof document !== 'undefined' ? document.queryCommandState('justifyFull') : false;
      const isLeft = (typeof document !== 'undefined' ? document.queryCommandState('justifyLeft') : false) || (!isCenter && !isRight && !isJustify);

      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      let isH1 = false;
      let isH2 = false;
      let isH3 = false;
      let isQuote = false;
      let isCode = false;
      let isLink = false;
      let isImportant = false;
      let isKeyIdea = false;
      let curLineSpacing = '1.15';

      if (sel && sel.anchorNode && editorRef.current) {
        let node: Node | null = sel.anchorNode;
        while (node && node !== editorRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName?.toLowerCase();
            if (tag === 'h1') isH1 = true;
            if (tag === 'h2') isH2 = true;
            if (tag === 'h3') isH3 = true;
            if (tag === 'blockquote') isQuote = true;
            if (tag === 'code') isCode = true;
            if (tag === 'a') isLink = true;
            if (el.classList.contains('callout-important')) isImportant = true;
            if (el.classList.contains('callout-key-idea')) isKeyIdea = true;
            if (el.style?.lineHeight) curLineSpacing = el.style.lineHeight;
          }
          node = node.parentNode;
        }
      }

      setActiveFormats({
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        strikethrough: isStrike,
        code: isCode,
        h1: isH1,
        h2: isH2,
        h3: isH3,
        alignLeft: isLeft,
        alignCenter: isCenter,
        alignRight: isRight,
        alignJustify: isJustify,
        list: isList,
        numbered: isNumbered,
        quote: isQuote,
        link: isLink,
        important: isImportant,
        keyIdea: isKeyIdea,
        lineSpacing: curLineSpacing,
      });
    } catch {
      // non-fatal
    }
  };

  // Keep selection format synced when user moves cursor or selects text
  useEffect(() => {
    if (editorMode !== 'edit') return;
    const handleSelectionChange = () => {
      updateActiveFormats();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [editorMode]);

  // Automatic Clickable Hyperlinks on typing (Space or Enter after typing URL)
  const checkAndAutoLinkBeforeCaret = () => {
    try {
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed || !sel.anchorNode) return;
      const node = sel.anchorNode;
      if (node.nodeType !== Node.TEXT_NODE) return;

      // Do not auto-link if already inside an anchor
      if (node.parentElement?.closest('a')) return;

      const text = node.textContent || '';
      const caretOffset = sel.anchorOffset;
      const textBefore = text.slice(0, caretOffset);

      // Match URL ending right before caret or trailing space
      const urlMatch = textBefore.match(/(https?:\/\/[^\s]+|www\.[^\s]+)[\s]?$/);
      if (!urlMatch) return;

      let rawUrl = urlMatch[1];
      let trailingPunct = '';
      const punctMatch = rawUrl.match(/[.,;:!?)"']+$/);
      if (punctMatch) {
        trailingPunct = punctMatch[0];
        rawUrl = rawUrl.slice(0, -trailingPunct.length);
      }

      if (!rawUrl.includes('.') || rawUrl.endsWith('.') || rawUrl.length < 5) return;

      const href = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      const urlIndex = textBefore.indexOf(rawUrl);
      if (urlIndex === -1) return;

      const beforeUrl = text.slice(0, urlIndex);
      const afterUrl = text.slice(urlIndex + rawUrl.length);

      const parent = node.parentNode;
      if (!parent) return;

      const linkEl = document.createElement('a');
      linkEl.href = href;
      linkEl.target = '_blank';
      linkEl.rel = 'noopener noreferrer';
      linkEl.className = 'doc-link';
      linkEl.setAttribute('data-preview-url', href);
      linkEl.textContent = rawUrl;

      const afterNode = document.createTextNode(afterUrl);

      parent.insertBefore(linkEl, node.nextSibling);
      parent.insertBefore(afterNode, linkEl.nextSibling);
      node.textContent = beforeUrl;

      const range = document.createRange();
      range.setStart(afterNode, Math.min(afterUrl.length, 1));
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);

      if (editorRef.current) {
        setFContent(editorRef.current.innerHTML);
      }
    } catch {
      // non-fatal
    }
  };

  // Automatically puts space after numbering (e.g. "1.hha" -> "1. hha")
  const fixNumberingSpaceBeforeCaret = () => {
    try {
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed || !sel.anchorNode) return;
      const node = sel.anchorNode;
      if (node.nodeType !== Node.TEXT_NODE) return;

      const text = node.textContent || '';
      const offset = sel.anchorOffset;

      // Regex matching any number immediately followed by dot/paren and a letter
      const numMatch = text.match(/(^|[\s\u00A0])(\d+)([\.\)])([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF])/);
      if (!numMatch || numMatch.index === undefined) return;

      const fixed = text.replace(
        /(^|[\s\u00A0])(\d+)([\.\)])([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF])/g,
        '$1$2$3 $4'
      );

      if (fixed !== text) {
        const textBefore = text.slice(0, offset);
        const fixedBefore = textBefore.replace(
          /(^|[\s\u00A0])(\d+)([\.\)])([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF])/g,
          '$1$2$3 $4'
        );
        const newOffset = Math.min(fixed.length, fixedBefore.length);

        node.textContent = fixed;
        const range = document.createRange();
        range.setStart(node, newOffset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);

        if (editorRef.current) {
          setFContent(editorRef.current.innerHTML);
        }
      }
    } catch {
      // non-fatal
    }
  };

  // Educational Book Callout Toggle: Important and Key Idea
  const toggleCallout = (type: 'important' | 'key-idea') => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    let calloutEl: HTMLElement | null = null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.classList.contains('callout-block') || el.classList.contains('callout-important') || el.classList.contains('callout-key-idea')) {
          calloutEl = el;
          break;
        }
      }
      node = node.parentNode;
    }

    const targetClass = type === 'important' ? 'callout-important' : 'callout-key-idea';
    const targetBadge = type === 'important' ? 'IMPORTANT' : 'KEY IDEA';

    if (calloutEl) {
      // Toggle off back to normal paragraph
      if (calloutEl.classList.contains(targetClass)) {
        const bodyEl = calloutEl.querySelector('.callout-body');
        const bodyHtml = bodyEl ? bodyEl.innerHTML : calloutEl.innerHTML;
        const p = document.createElement('p');
        p.innerHTML = bodyHtml.trim() || '<br>';
        calloutEl.replaceWith(p);
      } else {
        // Switch between Important and Key Idea
        calloutEl.classList.remove('callout-important', 'callout-key-idea');
        calloutEl.classList.add('callout-block', targetClass);
        const badgeEl = calloutEl.querySelector('.callout-badge');
        if (badgeEl) {
          badgeEl.textContent = targetBadge;
        } else {
          const newBadge = document.createElement('div');
          newBadge.className = 'callout-badge';
          newBadge.textContent = targetBadge;
          calloutEl.insertBefore(newBadge, calloutEl.firstChild);
        }
      }
    } else {
      let contentHtml = '';
      if (!sel.isCollapsed) {
        const div = document.createElement('div');
        div.appendChild(sel.getRangeAt(0).cloneContents());
        contentHtml = div.innerHTML;
      } else {
        let block: Node | null = sel.anchorNode;
        while (block && block !== editor && !/^(P|H[1-6]|DIV|BLOCKQUOTE)$/i.test(block.nodeName)) {
          block = block.parentNode;
        }
        if (block && block !== editor) {
          contentHtml = (block as HTMLElement).innerHTML;
          const calloutHtml = `
            <div class="callout-block ${targetClass}">
              <div class="callout-badge">${targetBadge}</div>
              <div class="callout-body"><p>${contentHtml || 'Add text here...'}</p></div>
            </div>
          `;
          const wrapper = document.createElement('div');
          wrapper.innerHTML = calloutHtml.trim();
          const newEl = wrapper.firstElementChild!;
          (block as HTMLElement).replaceWith(newEl);
          updateActiveFormats();
          if (editor) {
            setFContent(editor.innerHTML);
            if (selectedDoc) updateDoc(selectedDoc.id, { content: editor.innerHTML });
          }
          return;
        } else {
          contentHtml = 'Add text here...';
        }
      }

      const calloutHtml = `
        <div class="callout-block ${targetClass}">
          <div class="callout-badge">${targetBadge}</div>
          <div class="callout-body"><p>${contentHtml}</p></div>
        </div>
        <p></p>
      `;
      document.execCommand('insertHTML', false, calloutHtml);
    }

    updateActiveFormats();
    if (editor) {
      setFContent(editor.innerHTML);
      if (selectedDoc) {
        updateDoc(selectedDoc.id, { content: editor.innerHTML });
      }
    }
  };

  // Live WYSIWYG formatting commands (Microsoft Word style)
  const handleFormat = (cmd: string, value?: string) => {
    if (editorMode === 'book') return; // Book mode is locked for reading
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    if (cmd === 'undo') {
      performUndo();
      return;
    } else if (cmd === 'redo') {
      performRedo();
      return;
    } else if (cmd === 'bold') {
      document.execCommand('bold');
    } else if (cmd === 'italic') {
      document.execCommand('italic');
    } else if (cmd === 'underline') {
      document.execCommand('underline');
    } else if (cmd === 'strikethrough') {
      document.execCommand('strikeThrough');
    } else if (cmd === 'code') {
      const sel = window.getSelection();
      const txt = (sel && !sel.isCollapsed) ? sel.toString() : 'code';
      document.execCommand('insertHTML', false, `<code class="inline-code">${txt}</code>&nbsp;`);
    } else if (cmd === 'removeFormat') {
      document.execCommand('removeFormat');
      document.execCommand('formatBlock', false, '<p>');
    } else if (cmd === 'h1' || cmd === 'h2' || cmd === 'h3') {
      const sel = window.getSelection();
      let isSame = false;
      if (sel && sel.anchorNode) {
        let el = sel.anchorNode as HTMLElement | null;
        while (el && el !== editor) {
          if (el.nodeName?.toLowerCase() === cmd) {
            isSame = true;
            break;
          }
          el = el.parentElement;
        }
      }
      if (isSame) {
        document.execCommand('formatBlock', false, '<p>');
      } else {
        document.execCommand('formatBlock', false, `<${cmd}>`);
      }
    } else if (cmd === 'quote') {
      document.execCommand('formatBlock', false, '<blockquote>');
    } else if (cmd === 'list') {
      document.execCommand('insertUnorderedList');
    } else if (cmd === 'numbered') {
      document.execCommand('insertOrderedList');
    } else if (cmd === 'indent') {
      document.execCommand('indent');
    } else if (cmd === 'outdent') {
      document.execCommand('outdent');
    } else if (cmd === 'lineSpacing' && value) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        while (node && node !== editor && !/^(P|H[1-6]|DIV|LI|BLOCKQUOTE)$/i.test(node.nodeName)) {
          node = node.parentNode;
        }
        if (node && node !== editor) {
          (node as HTMLElement).style.lineHeight = value;
        }
      }
    } else if (cmd === 'alignLeft') {
      document.execCommand('justifyLeft');
    } else if (cmd === 'alignCenter') {
      document.execCommand('justifyCenter');
    } else if (cmd === 'alignRight') {
      document.execCommand('justifyRight');
    } else if (cmd === 'alignJustify') {
      document.execCommand('justifyFull');
    } else if (cmd === 'divider') {
      document.execCommand('insertHorizontalRule');
    } else if (cmd === 'task') {
      document.execCommand('insertHTML', false, '<div class="md-check" style="display:flex;align-items:center;gap:8px;margin:6px 0;"><input type="checkbox" /> <span>Task item</span></div><p></p>');
    } else if (cmd === 'table') {
      const tableHtml = `
        <div class="table-container">
          <table class="doc-table">
            <thead>
              <tr>
                <th>Column 1</th>
                <th>Column 2</th>
                <th>Column 3</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Data 1</td>
                <td>Data 2</td>
                <td>Data 3</td>
              </tr>
              <tr>
                <td>Data 4</td>
                <td>Data 5</td>
                <td>Data 6</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p></p>
      `;
      document.execCommand('insertHTML', false, tableHtml);
    } else if (cmd === 'link') {
      const sel = window.getSelection();
      let initialUrl = '';
      let initialText = '';
      let existingAnchor: HTMLAnchorElement | null = null;
      if (sel && sel.anchorNode) {
        let el = sel.anchorNode as HTMLElement | null;
        while (el && el !== editor) {
          if (el.nodeName === 'A') {
            existingAnchor = el as HTMLAnchorElement;
            break;
          }
          el = el.parentElement;
        }
      }
      if (existingAnchor) {
        initialUrl = existingAnchor.href;
        initialText = existingAnchor.textContent || '';
      } else if (sel && !sel.isCollapsed) {
        initialText = sel.toString();
        if (/^https?:\/\//i.test(initialText) || /^www\./i.test(initialText)) {
          initialUrl = initialText;
        }
      }
      const url = prompt('Enter link URL (e.g. https://example.com or www.google.com):', initialUrl || 'https://');
      if (url && url.trim() && url !== 'https://') {
        const cleanUrl = url.trim();
        const href = /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl}`;
        if (existingAnchor) {
          existingAnchor.href = href;
          existingAnchor.setAttribute('data-preview-url', href);
        } else {
          const displayText = initialText || cleanUrl;
          document.execCommand('insertHTML', false, `<a href="${href}" target="_blank" rel="noopener noreferrer" class="doc-link" data-preview-url="${href}">${displayText}</a>&nbsp;`);
        }
      }
    } else if (cmd === 'important') {
      toggleCallout('important');
      return;
    } else if (cmd === 'key-idea') {
      toggleCallout('key-idea');
      return;
    }

    updateActiveFormats();
    if (editor) {
      setFContent(editor.innerHTML);
      pushHistorySnapshot(editor.innerHTML);
      if (selectedDoc) {
        updateDoc(selectedDoc.id, { content: editor.innerHTML });
      }
    }
  };

  // Live Color Highlighter (works in Live Editor, Book View, and Word Mode)
  const handleHighlight = (colorName: string, forceApply = false, explicitMark?: HTMLElement | null) => {
    setActiveHighlightColor(colorName);
    const editor = (editorMode === 'book' ? bookEditorRef.current : (editorMode === 'word' ? wordEditorRef.current : editorRef.current)) || bookEditorRef.current || wordEditorRef.current || editorRef.current;
    if (!editor) return;

    const c = COLOR_MAP[colorName] || HIGHLIGHT_COLORS[0];

    // 1. Direct explicit mark update (literal highlight, zero spacing change)
    if (explicitMark && editor.contains(explicitMark)) {
      explicitMark.style.background = c.bg;
      explicitMark.style.border = 'none';
      explicitMark.style.padding = '0 1px';
      explicitMark.style.margin = '0';
      explicitMark.style.fontWeight = 'inherit';
      if (!explicitMark.style.color) {
        explicitMark.style.color = 'inherit';
      }
      const saved = editor.innerHTML;
      isInternalChange.current = true;
      setFContent(saved);
      isInternalChange.current = false;
      if (selectedDoc) {
        updateDoc(selectedDoc.id, { content: saved });
      }
      return;
    }

    const sel = window.getSelection();

    let range: Range | null = null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      range = sel.getRangeAt(0);
    } else if (cachedSelectionRangeRef.current) {
      range = cachedSelectionRangeRef.current;
      try {
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch {}
    }

    // If nothing selected
    if (!range || range.collapsed) {
      // In book or word reading modes, never insert dummy text to keep document layout fixed
      if (forceApply && editorMode === 'edit') {
        editor.focus();
        document.execCommand('insertHTML', false, `<mark class="highlight-mark" style="background:${c.bg};color:inherit;border:none;padding:0 1px;margin:0;border-radius:2px;font-weight:inherit;">highlighted text</mark>&nbsp;`);
        setFContent(editor.innerHTML);
        if (selectedDoc) {
          updateDoc(selectedDoc.id, { content: editor.innerHTML });
        }
      }
      return;
    }

    // Ensure selection is inside the editor/book/word container
    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }

    // If selection is already inside an existing highlight mark, update its color directly with zero spacing change
    let cur: Node | null = range.commonAncestorContainer;
    while (cur && cur !== editor) {
      if (cur.nodeName === 'MARK') {
        const markEl = cur as HTMLElement;
        markEl.style.background = c.bg;
        markEl.style.border = 'none';
        markEl.style.padding = '0';
        markEl.style.margin = '0';
        markEl.style.borderRadius = '0';
        markEl.style.fontWeight = 'inherit';
        markEl.style.fontStyle = 'inherit';
        markEl.style.letterSpacing = 'inherit';
        markEl.style.lineHeight = 'inherit';
        markEl.style.verticalAlign = 'baseline';
        markEl.style.display = 'inline';
        if (!markEl.style.color) {
          markEl.style.color = 'inherit';
        }
        const saved = editor.innerHTML;
        isInternalChange.current = true;
        setFContent(saved);
        isInternalChange.current = false;
        if (selectedDoc) {
          updateDoc(selectedDoc.id, { content: saved });
        }
        return;
      }
      cur = cur.parentNode;
    }

    const mark = document.createElement('mark');
    mark.className = 'highlight-mark';
    mark.style.background = c.bg;
    mark.style.color = 'inherit';
    mark.style.border = 'none';
    mark.style.padding = '0';
    mark.style.margin = '0';
    mark.style.borderRadius = '0';
    mark.style.fontWeight = 'inherit';
    mark.style.fontStyle = 'inherit';
    mark.style.letterSpacing = 'inherit';
    mark.style.lineHeight = 'inherit';
    mark.style.verticalAlign = 'baseline';
    mark.style.display = 'inline';
    mark.style.boxDecorationBreak = 'clone';
    (mark.style as any).webkitBoxDecorationBreak = 'clone';

    try {
      const frag = range.extractContents();
      // Remove any nested marks in extracted content
      const innerMarks = frag.querySelectorAll ? frag.querySelectorAll('mark') : [];
      innerMarks.forEach((m: Element) => {
        const parent = m.parentNode;
        while (m.firstChild) {
          parent?.insertBefore(m.firstChild, m);
        }
        parent?.removeChild(m);
      });
      mark.appendChild(frag);
      range.insertNode(mark);
      if (sel) {
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(mark);
        sel.addRange(newRange);
        cachedSelectionRangeRef.current = newRange;
      }
    } catch {
      try {
        document.execCommand('hiliteColor', false, c.bg);
      } catch {}
    }

    // Save directly from DOM to persist highlight
    const saved = editor.innerHTML;
    isInternalChange.current = true;
    setFContent(saved);
    pushHistorySnapshot(saved);
    isInternalChange.current = false;
    if (selectedDoc) {
      updateDoc(selectedDoc.id, { content: saved });
    }
  };

  // Remove highlight on selection in Editor, Book, or Word Mode
  const handleRemoveHighlight = (explicitMark?: HTMLElement | null) => {
    const editor = (editorMode === 'book' ? bookEditorRef.current : (editorMode === 'word' ? wordEditorRef.current : editorRef.current)) || bookEditorRef.current || wordEditorRef.current || editorRef.current;
    if (!editor) return;

    // 1. Direct explicit mark removal
    if (explicitMark && editor.contains(explicitMark)) {
      const parent = explicitMark.parentNode;
      while (explicitMark.firstChild) {
        parent?.insertBefore(explicitMark.firstChild, explicitMark);
      }
      parent?.removeChild(explicitMark);
      const saved = editor.innerHTML;
      isInternalChange.current = true;
      setFContent(saved);
      isInternalChange.current = false;
      if (selectedDoc) {
        updateDoc(selectedDoc.id, { content: saved });
      }
      return;
    }

    const sel = window.getSelection();
    let range: Range | null = null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      range = sel.getRangeAt(0);
    } else if (cachedSelectionRangeRef.current) {
      range = cachedSelectionRangeRef.current;
    }
    if (!range) return;

    try {
      const container = range.commonAncestorContainer;
      
      // If common ancestor or parent is MARK or font-color-span
      let cur: Node | null = container;
      while (cur && cur !== editor) {
        if (cur.nodeName === 'MARK' || (cur.nodeName === 'SPAN' && (cur as HTMLElement).classList.contains('font-color-span'))) {
          const parent = cur.parentNode;
          while (cur.firstChild) {
            parent?.insertBefore(cur.firstChild, cur);
          }
          parent?.removeChild(cur);
          break;
        }
        cur = cur.parentNode;
      }

      // Also unwrap any marks within the selection range
      const marks = editor.querySelectorAll('mark, .font-color-span');
      marks.forEach((m) => {
        if (sel && sel.containsNode && sel.containsNode(m, true)) {
          const parent = m.parentNode;
          while (m.firstChild) {
            parent?.insertBefore(m.firstChild, m);
          }
          parent?.removeChild(m);
        }
      });
    } catch {
      // Fallback
    }

    const saved = editor.innerHTML;
    isInternalChange.current = true;
    setFContent(saved);
    pushHistorySnapshot(saved);
    isInternalChange.current = false;
    if (selectedDoc) {
      updateDoc(selectedDoc.id, { content: saved });
    }
  };

  // Live Font Color Styler (works in Live Editor, Book View, and Word Mode)
  const handleApplyFontColor = (fontColor: string, explicitTarget?: HTMLElement | null) => {
    setActiveFontColor(fontColor);
    const editor = (editorMode === 'book' ? bookEditorRef.current : (editorMode === 'word' ? wordEditorRef.current : editorRef.current)) || bookEditorRef.current || wordEditorRef.current || editorRef.current;
    if (!editor) return;

    // 1. Direct explicit target (e.g. mark or font span)
    if (explicitTarget && editor.contains(explicitTarget)) {
      if (fontColor === 'inherit') {
        explicitTarget.style.color = '';
      } else {
        explicitTarget.style.color = fontColor;
      }
      explicitTarget.style.fontWeight = 'inherit';
      const saved = editor.innerHTML;
      isInternalChange.current = true;
      setFContent(saved);
      isInternalChange.current = false;
      if (selectedDoc) {
        updateDoc(selectedDoc.id, { content: saved });
      }
      return;
    }

    const sel = window.getSelection();
    let range: Range | null = null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      range = sel.getRangeAt(0);
    } else if (cachedSelectionRangeRef.current) {
      range = cachedSelectionRangeRef.current;
      try {
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch {}
    }

    if (!range || range.collapsed || !editor.contains(range.commonAncestorContainer)) return;

    // 2. Check if inside existing mark or font-span
    let cur: Node | null = range.commonAncestorContainer;
    while (cur && cur !== editor) {
      if (cur.nodeName === 'MARK' || (cur.nodeName === 'SPAN' && (cur as HTMLElement).style.color)) {
        const el = cur as HTMLElement;
        if (fontColor === 'inherit') {
          el.style.color = '';
        } else {
          el.style.color = fontColor;
        }
        el.style.fontWeight = 'inherit';
        const saved = editor.innerHTML;
        isInternalChange.current = true;
        setFContent(saved);
        isInternalChange.current = false;
        if (selectedDoc) {
          updateDoc(selectedDoc.id, { content: saved });
        }
        return;
      }
      cur = cur.parentNode;
    }

    // 3. Wrap selection in span with zero spacing change
    if (fontColor !== 'inherit') {
      const span = document.createElement('span');
      span.className = 'font-color-span';
      span.style.color = fontColor;
      span.style.fontWeight = 'inherit';
      span.style.padding = '0';
      span.style.margin = '0';
      span.style.border = 'none';
      try {
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
        if (sel) {
          sel.removeAllRanges();
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          sel.addRange(newRange);
          cachedSelectionRangeRef.current = newRange;
        }
      } catch {
        try {
          document.execCommand('foreColor', false, fontColor);
        } catch {}
      }
    } else {
      try {
        document.execCommand('removeFormat', false, undefined);
      } catch {}
    }

    const saved = editor.innerHTML;
    isInternalChange.current = true;
    setFContent(saved);
    pushHistorySnapshot(saved);
    isInternalChange.current = false;
    if (selectedDoc) {
      updateDoc(selectedDoc.id, { content: saved });
    }
  };

  // Editor Interaction Handlers (Click for Link Popover, Keyboard Shortcuts, Tab/Shift+Tab)
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (handleCommonDocumentClick(e)) return;

    const target = e.target as HTMLElement;
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (anchor && anchor.href) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        window.open(anchor.href, '_blank', 'noopener,noreferrer');
        return;
      }
      const rect = anchor.getBoundingClientRect();
      setLinkPopover({
        x: rect.left,
        y: rect.bottom + 6,
        url: anchor.href,
        targetEl: anchor,
      });
      return;
    }
    if (linkPopover && !(e.target as HTMLElement).closest(`.${styles.linkPopover}`)) {
      setLinkPopover(null);
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          performRedo();
        } else {
          performUndo();
        }
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        performRedo();
        return;
      }
      if (key === 'b') {
        e.preventDefault();
        document.execCommand('bold');
        updateActiveFormats();
        if (editorRef.current) pushHistorySnapshot(editorRef.current.innerHTML);
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        document.execCommand('italic');
        updateActiveFormats();
        if (editorRef.current) pushHistorySnapshot(editorRef.current.innerHTML);
        return;
      }
      if (key === 'u') {
        e.preventDefault();
        document.execCommand('underline');
        updateActiveFormats();
        if (editorRef.current) pushHistorySnapshot(editorRef.current.innerHTML);
        return;
      }
      if (key === 'k') {
        e.preventDefault();
        handleFormat('link');
        return;
      }
      if (key === 'x') {
        // Cut - snapshot immediately before cut so Ctrl+Z brings cut text back
        if (editorRef.current) {
          pushHistorySnapshot(editorRef.current.innerHTML);
        }
      }
    }

    // Backspace / Delete - Snapshot immediately before deletion occurs so Ctrl+Z brings deleted text back
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (editorRef.current) {
        pushHistorySnapshot(editorRef.current.innerHTML);
      }

      // Handle deletion of non-editable widgets, chips, or buttons
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);

        if (!range.collapsed) {
          const fragment = range.cloneContents();
          if (fragment.querySelector('.video-timestamp-chip, button, [contenteditable="false"]')) {
            e.preventDefault();
            range.deleteContents();
            if (editorRef.current) {
              setFContent(editorRef.current.innerHTML);
              if (selectedDoc) updateDoc(selectedDoc.id, { content: editorRef.current.innerHTML });
            }
            return;
          }
        } else {
          const node = sel.anchorNode;
          const offset = sel.anchorOffset;

          if (e.key === 'Backspace') {
            let targetNode: Node | null = null;
            if (node?.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element;
              if (offset > 0) {
                targetNode = el.childNodes[offset - 1] || null;
              }
            } else if (node?.nodeType === Node.TEXT_NODE && offset === 0) {
              targetNode = node.previousSibling;
            }

            if (targetNode instanceof HTMLElement) {
              if (
                targetNode.classList.contains('video-timestamp-chip') ||
                targetNode.tagName === 'BUTTON' ||
                targetNode.getAttribute('contenteditable') === 'false' ||
                targetNode.classList.contains('inline-code')
              ) {
                e.preventDefault();
                targetNode.remove();
                if (editorRef.current) {
                  setFContent(editorRef.current.innerHTML);
                  if (selectedDoc) updateDoc(selectedDoc.id, { content: editorRef.current.innerHTML });
                }
                return;
              }
            }
          } else if (e.key === 'Delete') {
            let targetNode: Node | null = null;
            if (node?.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element;
              targetNode = el.childNodes[offset] || null;
            } else if (node?.nodeType === Node.TEXT_NODE) {
              const text = node.textContent || '';
              if (offset >= text.length) {
                targetNode = node.nextSibling;
              }
            }

            if (targetNode instanceof HTMLElement) {
              if (
                targetNode.classList.contains('video-timestamp-chip') ||
                targetNode.tagName === 'BUTTON' ||
                targetNode.getAttribute('contenteditable') === 'false' ||
                targetNode.classList.contains('inline-code')
              ) {
                e.preventDefault();
                targetNode.remove();
                if (editorRef.current) {
                  setFContent(editorRef.current.innerHTML);
                  if (selectedDoc) updateDoc(selectedDoc.id, { content: editorRef.current.innerHTML });
                }
                return;
              }
            }
          }
        }
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        document.execCommand('outdent');
      } else {
        document.execCommand('indent');
      }
      updateActiveFormats();
      if (editorRef.current) {
        setFContent(editorRef.current.innerHTML);
        pushHistorySnapshot(editorRef.current.innerHTML);
      }
      return;
    }

    // Auto-spacing when typing numbering like 1.hha -> automatically type space + letter: 1. hha
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]$/.test(e.key)) {
      try {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed && sel.anchorNode && sel.anchorNode.nodeType === Node.TEXT_NODE) {
          const text = sel.anchorNode.textContent || '';
          const before = text.slice(0, sel.anchorOffset);
          if (/(?:^|[\s\u00A0])\d+[\.\)]$/.test(before)) {
            e.preventDefault();
            document.execCommand('insertText', false, ' ' + e.key);
            if (editorRef.current) {
              setFContent(editorRef.current.innerHTML);
            }
            updateActiveFormats();
            return;
          }
        }
      } catch {
        // ignore
      }
    }

    if (e.key === ' ' || e.key === 'Enter') {
      fixNumberingSpaceBeforeCaret();
      if (editorRef.current) {
        pushHistorySnapshot(editorRef.current.innerHTML);
      }
      setTimeout(() => {
        fixNumberingSpaceBeforeCaret();
        checkAndAutoLinkBeforeCaret();
        updateActiveFormats();
      }, 0);
    }
  };

  const handleEditorKeyUp = () => {
    fixNumberingSpaceBeforeCaret();
    updateActiveFormats();
  };

  const handleEditorMouseUp = () => {
    updateActiveFormats();
  };

  // ── Smart Auto Format (Manual Activation Only & Side-by-Side Preview) ──
  const [formatPreviewModalOpen, setFormatPreviewModalOpen] = useState(false);
  const [pendingFormatResult, setPendingFormatResult] = useState<FormatResult | null>(null);
  const [originalTextForReview, setOriginalTextForReview] = useState('');
  const [isAutoFormatting, setIsAutoFormatting] = useState(false);
  const previousContentBeforeFormatRef = useRef<string | null>(null);
  const previousTitleBeforeFormatRef = useRef<string | null>(null);

  const handleTriggerAutoFormat = async () => {
    const raw = (editorRef.current ? editorRef.current.innerText : fContent) || fContent || '';
    if (!raw.trim() || raw.trim().length < 5) {
      alert('Please write or paste some text first before clicking Auto Format.');
      return;
    }

    setIsAutoFormatting(true);
    try {
      const result = await formatDocumentWithAI(raw, fTitle || 'Document', settings);
      setOriginalTextForReview(raw);
      setPendingFormatResult(result);
      setFormatPreviewModalOpen(true);
    } catch (err) {
      console.error('Auto format analysis failed:', err);
      const localRes = formatDocumentLocally(raw, fTitle || 'Document');
      setOriginalTextForReview(raw);
      setPendingFormatResult(localRes);
      setFormatPreviewModalOpen(true);
    } finally {
      setIsAutoFormatting(false);
    }
  };

  const handleApplyAutoFormat = () => {
    if (!pendingFormatResult) return;

    // Save previous state for Undo
    previousContentBeforeFormatRef.current = fContent;
    previousTitleBeforeFormatRef.current = fTitle;

    const formattedMd = pendingFormatResult.formattedMarkdown;
    const formattedHtml = renderMarkdown(formattedMd);

    setFContent(formattedMd);
    if ((!fTitle || fTitle === 'Untitled' || fTitle === 'Untitled Document') && pendingFormatResult.title) {
      setFTitle(pendingFormatResult.title);
    }

    if (editorRef.current) {
      editorRef.current.innerHTML = formattedHtml;
    }
    if (bookEditorRef.current) {
      bookEditorRef.current.innerHTML = formattedHtml;
    }

    if (selectedDoc) {
      updateDoc(selectedDoc.id, {
        content: formattedMd,
        title: (!fTitle || fTitle === 'Untitled') && pendingFormatResult.title ? pendingFormatResult.title : fTitle,
      });
    }

    setFormatPreviewModalOpen(false);
    setPasteToast('Document formatted into clean Book layout! Click Undo to revert.');
    setTimeout(() => setPasteToast(null), 5000);
  };

  const handleUndoAutoFormat = () => {
    if (previousContentBeforeFormatRef.current === null) return;
    const prevContent = previousContentBeforeFormatRef.current;
    const prevTitle = previousTitleBeforeFormatRef.current || fTitle;

    setFContent(prevContent);
    setFTitle(prevTitle);

    const prevHtml = getRichHtml(prevContent);
    if (editorRef.current) editorRef.current.innerHTML = prevHtml;
    if (bookEditorRef.current) bookEditorRef.current.innerHTML = prevHtml;

    if (selectedDoc) {
      updateDoc(selectedDoc.id, {
        content: prevContent,
        title: prevTitle,
      });
    }

    previousContentBeforeFormatRef.current = null;
    previousTitleBeforeFormatRef.current = null;
    setPasteToast('Reverted formatting back to original version.');
    setTimeout(() => setPasteToast(null), 3000);
  };

  // AI Executive Summary Generator
  const handleGenerateSummary = async () => {
    const raw = (editorMode === 'book' ? bookEditorRef.current?.innerHTML : editorRef.current?.innerHTML) || fContent || selectedDoc?.content || '';
    if (!raw.trim() || raw.trim().length < 5) {
      alert('Please add some content to this document before generating an executive summary.');
      return;
    }
    setIsGeneratingSummary(true);
    setInsertedSummarySuccess(false);
    try {
      const res = await summarizeDocumentWithAI(fTitle || 'Document', raw, settings);
      setAiSummaryResult(res);
    } catch (err) {
      console.error('Summary generation error:', err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Copy Executive Summary to Clipboard
  const handleCopySummary = async () => {
    if (!aiSummaryResult) return;
    const text = `## Executive Summary: ${fTitle || 'Document'}\n\n${aiSummaryResult.summary}\n\n### Key Takeaways:\n${aiSummaryResult.keyPoints.map((p) => `• ${p}`).join('\n')}\n\n### Next Steps:\n${aiSummaryResult.actionItems.map((a) => `• ${a}`).join('\n')}`;
    await navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Insert Executive Summary at Top of Document
  const handleInsertSummaryIntoDoc = () => {
    if (!aiSummaryResult) return;
    const summaryHtml = `
      <div class="key-idea" style="background:linear-gradient(135deg, rgba(99,102,241,0.12), rgba(6,182,212,0.08));border:1px solid rgba(99,102,241,0.25);border-radius:6px;padding:12px 16px;margin:14px 0;">
        <p style="margin:0 0 6px 0;font-weight:700;">💡 Executive Summary: ${aiSummaryResult.summary}</p>
        <p style="margin:0;font-size:12px;color:var(--color-text-muted);"><strong>Core Takeaways:</strong> ${aiSummaryResult.keyPoints.join(' &bull; ')}</p>
      </div>
      <hr />
    `;
    const newHtml = summaryHtml + (fContent || '');
    setFContent(newHtml);
    if (editorRef.current) {
      editorRef.current.innerHTML = newHtml;
    }
    if (bookEditorRef.current) {
      bookEditorRef.current.innerHTML = newHtml;
    }
    if (selectedDoc) {
      updateDoc(selectedDoc.id, { content: newHtml });
    }
    setInsertedSummarySuccess(true);
    setTimeout(() => setInsertedSummarySuccess(false), 2500);
  };

  // AI Active Recall Study Quiz Generator (Auto-saved to document for persistent study & review)
  const handleGenerateQuiz = async (docToUse?: KnowledgeDocument) => {
    const targetDoc = docToUse || selectedDoc;
    if (!targetDoc) return;
    const raw = (editorMode === 'book' ? bookEditorRef.current?.innerHTML : editorRef.current?.innerHTML) || fContent || targetDoc.content || '';
    if (!raw.trim() || raw.trim().length < 5) {
      alert('Please add some content to this document before generating study questions.');
      return;
    }
    setIsGeneratingQuiz(true);
    setRevealedQuizAnswers({});
    try {
      const res = await generateStudyQuizWithAI(fTitle || targetDoc.title || 'Document', raw, settings);
      setAiQuizResult(res);
      // Auto-save quiz persistently to the document!
      updateDoc(targetDoc.id, {
        studyQuiz: res.questions,
        lastReviewedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Quiz generation error:', err);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const toggleQuizAnswer = (idx: number) => {
    setRevealedQuizAnswers((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleToggleMastery = (qIndex: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedDoc || !aiQuizResult) return;
    const currentQuiz = aiQuizResult.questions.map((q, idx) => {
      if (idx === qIndex) {
        return { ...q, userMastered: !q.userMastered };
      }
      return q;
    });
    setAiQuizResult({ ...aiQuizResult, questions: currentQuiz });
    updateDoc(selectedDoc.id, {
      studyQuiz: currentQuiz,
      lastReviewedAt: new Date().toISOString(),
    });
  };

  const handleResetQuizMastery = () => {
    if (!selectedDoc || !aiQuizResult) return;
    const currentQuiz = aiQuizResult.questions.map((q) => ({
      ...q,
      userMastered: false,
    }));
    setAiQuizResult({ ...aiQuizResult, questions: currentQuiz });
    setRevealedQuizAnswers({});
    updateDoc(selectedDoc.id, {
      studyQuiz: currentQuiz,
    });
  };

  // Open Global AI Chat Assistant with this document preloaded
  const handleOpenAiChatForDoc = () => {
    if (selectedDoc) {
      window.dispatchEvent(
        new CustomEvent('open-ai-chat-with-context', {
          detail: {
            activeDoc: selectedDoc,
            initialMessage: `I am studying "${selectedDoc.title}". Can you give me an executive overview of this note?`,
          },
        })
      );
    }
    window.dispatchEvent(new CustomEvent('open-ai-chat'));
  };

  // Study Material Type Counts
  const allMaterialsCount = docs.length;
  const booksCount = docs.filter((d) => !isDocVideoLesson(d)).length;
  const videoLessonsCount = docs.filter((d) => isDocVideoLesson(d)).length;

  // Filter & sort docs list (pinned items always at the top)
  const q = searchQ.toLowerCase();
  const filteredDocs = docs
    .filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      const isVideo = isDocVideoLesson(d);
      if (typeFilter === 'documents' && isVideo) return false;
      if (typeFilter === 'videos' && !isVideo) return false;
      if (q && !d.title.toLowerCase().includes(q) && !d.content.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });


  const hasEditor = isCreating || selectedDoc;

  // Connected entity labels for metadata bar
  const linkedDream = dreams.find((d) => d.id === fDreamId);
  const linkedGoal = goals.find((g) => g.id === fGoalId);
  const linkedProject = projects.find((p) => p.id === fProjectId);
  const linkedTask = tasks.find((t) => t.id === fTaskId);

  // Formal Right-Hand Reader Companion Panel (Like Focus Space)
  const renderReaderCompanion = (isWord: boolean = true) => (
    <aside className={styles.readerRightCompanion}>
      {/* Top Header Bar with Minimize button */}
      <div className={styles.companionPanelTopBar}>
        <div className={styles.companionPanelTopBarLeft}>
          <SlidersHorizontal size={13} style={{ color: 'var(--color-accent-light)' }} />
          <span className={styles.companionPanelTopBarTitle}>Reading Tools</span>
        </div>
        <button
          type="button"
          className={styles.companionMinimizeBtn}
          onClick={() => {
            setIsCompanionOpen(false);
            try {
              localStorage.setItem('life_os_reading_tools_open', 'false');
            } catch {}
          }}
          title="Minimize Reading Tools panel"
        >
          <Minimize2 size={12} />
          <span>Minimize</span>
        </button>
      </div>

      {/* Card 1: Redesigned Study Session Timer (Pomodoro | Stopwatch | Local Time | Progress Ring) */}
      <StudySessionCard
        onOpenReadingLogs={() => setReadingLogsModalOpen(true)}
      />

      {/* Card 2: Smooth Auto-Scroll Controller */}
      <div className={styles.companionCard}>
        <div className={styles.companionCardHeader}>
          <span className={styles.companionCardTitle}>
            <Play size={12} style={{ color: 'var(--color-accent-light)' }} /> Auto-Scroll
          </span>
          <span className={styles.companionCardBadge}>
            {(autoScrollSpeed / 30).toFixed(1)}x speed
          </span>
        </div>

        <div className={styles.companionScrollRow}>
          <button
            type="button"
            className={`${styles.companionAutoScrollBtn} ${isAutoScrolling ? styles.companionAutoScrollActive : ''}`}
            onClick={() => setIsAutoScrolling(!isAutoScrolling)}
            title={isAutoScrolling ? 'Pause Auto-Scroll' : 'Start Smooth Auto-Scroll'}
          >
            {isAutoScrolling ? <Pause size={13} style={{ color: 'var(--color-accent)' }} /> : <Play size={13} />}
            <span>{isAutoScrolling ? 'Pause' : 'Auto Scroll'}</span>
          </button>

          <div className={styles.companionSpeedBox} title="Adjust scroll speed">
            <button
              type="button"
              className={styles.companionSpeedBtn}
              onClick={() => setAutoScrollSpeed((prev) => Math.max(10, prev - 10))}
              title="Slower"
            >
              -
            </button>
            <span className={styles.companionSpeedValue}>
              {(autoScrollSpeed / 30).toFixed(1)}x
            </span>
            <button
              type="button"
              className={styles.companionSpeedBtn}
              onClick={() => setAutoScrollSpeed((prev) => Math.min(150, prev + 10))}
              title="Faster"
            >
              +
            </button>
          </div>

          <button
            type="button"
            className={styles.companionScrollTopBtn}
            onClick={() => {
              const el = document.querySelector(`.${styles.editorCanvas}`) as HTMLElement | null;
              if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
              else window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            title="Scroll to Top"
          >
            <ArrowUp size={13} />
          </button>
        </div>
      </div>

      {/* Card 3: Typography & Reading View (Works in Book & Word Mode) */}
      <div className={styles.companionCard}>
        <div className={styles.companionCardHeader}>
          <span className={styles.companionCardTitle}>
            <Type size={12} style={{ color: 'var(--color-accent-light)' }} /> Typography
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className={styles.companionPillTabs} title="Font Family">
            <button
              type="button"
              className={`${styles.companionPillBtn} ${readingFont === 'sans' ? styles.companionPillBtnActive : ''}`}
              onClick={() => changeReadingFont('sans')}
            >
              Sans-Serif
            </button>
            <button
              type="button"
              className={`${styles.companionPillBtn} ${readingFont === 'serif' ? styles.companionPillBtnActive : ''}`}
              onClick={() => changeReadingFont('serif')}
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Serif Book
            </button>
          </div>

          <div className={styles.companionPillTabs} title="Font Size Scale">
            <button
              type="button"
              className={`${styles.companionPillBtn} ${readingFontSize === 'sm' ? styles.companionPillBtnActive : ''}`}
              onClick={() => changeReadingFontSize('sm')}
            >
              A- (15px)
            </button>
            <button
              type="button"
              className={`${styles.companionPillBtn} ${readingFontSize === 'md' ? styles.companionPillBtnActive : ''}`}
              onClick={() => changeReadingFontSize('md')}
            >
              A (17px)
            </button>
            <button
              type="button"
              className={`${styles.companionPillBtn} ${readingFontSize === 'lg' ? styles.companionPillBtnActive : ''}`}
              onClick={() => changeReadingFontSize('lg')}
            >
              A+ (19px)
            </button>
          </div>

          <div className={styles.companionPillTabs} title="Reader Text Color Theme">
            {[
              { id: 'default', label: 'Default' },
              { id: '#ffffff', label: 'White' },
              { id: '#fef08a', label: 'Sepia' },
              { id: '#6ee7b7', label: 'Mint' },
              { id: '#67e8f9', label: 'Cyan' },
            ].map((tc) => (
              <button
                key={tc.id}
                type="button"
                className={`${styles.companionPillBtn} ${readingTextColor === tc.id ? styles.companionPillBtnActive : ''}`}
                onClick={() => changeReadingTextColor(tc.id)}
                style={{
                  color: tc.id !== 'default' ? tc.id : undefined,
                  fontWeight: readingTextColor === tc.id ? 700 : 500,
                }}
              >
                {tc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Card 4: Highlighters & Font Colors (Works in Book & Word Mode) */}
      <div className={styles.companionCard}>
        <div className={styles.companionCardHeader}>
          <div className={styles.companionAnnotateTabs}>
            <button
              type="button"
              className={`${styles.companionAnnotateTab} ${annotationTab === 'highlight' ? styles.companionAnnotateTabActive : ''}`}
              onClick={() => setAnnotationTab('highlight')}
            >
              Highlight (BG)
            </button>
            <button
              type="button"
              className={`${styles.companionAnnotateTab} ${annotationTab === 'fontColor' ? styles.companionAnnotateTabActive : ''}`}
              onClick={() => setAnnotationTab('fontColor')}
            >
              Font Color (Text)
            </button>
          </div>
          <span style={{ fontSize: '10px', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <Lock size={9} /> Locked Spacing
          </span>
        </div>

        {annotationTab === 'highlight' ? (
          <>
            <div className={styles.companionSwatchesGrid} title="Select color to highlight marked text">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`${styles.companionSwatchCircle} ${activeHighlightColor === c.name ? styles.companionSwatchActive : ''}`}
                  style={{
                    background: c.bg,
                    borderColor: c.border,
                    '--swatch-border': c.border,
                  } as React.CSSProperties}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleHighlight(c.name, false)}
                  title={`Highlight: ${c.label}`}
                  aria-label={`Highlight ${c.label}`}
                />
              ))}
            </div>

            <button
              type="button"
              className={styles.companionEraserBtn}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleRemoveHighlight()}
              title="Clear highlight from selected text"
            >
              <Eraser size={12} />
              <span>Clear Highlight</span>
            </button>
          </>
        ) : (
          <>
            <div className={styles.companionSwatchesGrid} title="Select text and click color to change font color">
              {FONT_COLORS.map((fc) => (
                <button
                  key={fc.name}
                  type="button"
                  className={`${styles.companionSwatchCircle} ${activeFontColor === fc.color ? styles.companionSwatchActive : ''}`}
                  style={{
                    background: fc.color === 'inherit' ? 'var(--color-surface-2)' : fc.color,
                    borderColor: fc.border,
                    color: fc.name === 'white' ? '#0f172a' : fc.color === 'inherit' ? 'var(--color-text)' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 800,
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleApplyFontColor(fc.color)}
                  title={`Font Color: ${fc.label}`}
                  aria-label={`Font Color ${fc.label}`}
                >
                  A
                </button>
              ))}
            </div>

            <button
              type="button"
              className={styles.companionEraserBtn}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleApplyFontColor('inherit')}
              title="Reset font color to default"
            >
              <RotateCcw size={12} />
              <span>Reset Font Color</span>
            </button>
          </>
        )}
      </div>

      {/* Card 5: Delete / Archive / Restore Document */}
      {selectedDoc && (
        <div className={styles.companionCard} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {selectedDoc.status === 'archived' && (
            <button
              type="button"
              onClick={() => handleRestoreDoc(selectedDoc.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '7px', padding: '8px 12px', borderRadius: '8px',
                border: '1px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.06)',
                color: '#10b981', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              title="Restore document to Active"
            >
              <RotateCcw size={12} />
              <span>Restore to Active</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleDelete(selectedDoc.id, selectedDoc.title)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '7px', padding: '8px 12px', borderRadius: '8px',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: 'var(--color-text-muted)', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            title="Archive or delete this document"
          >
            <Trash2 size={12} />
            <span>Archive / Delete</span>
          </button>
        </div>
      )}
    </aside>
  );

  if (!isLoaded) {
    return <PageSkeleton variant="knowledge" cardsCount={5} showMetrics={false} showControls={true} />;
  }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Study &amp; Books</h1>
          <p className={styles.subtitle}>
            {filteredDocs.length} {filteredDocs.length === 1 ? 'study guide or book' : 'study guides & books'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            ref={importFileRef}
            style={{ display: 'none' }}
            accept=".pdf,.txt,.md,.doc,.docx,.csv,.json,.html"
            onChange={handleImportFile}
          />
          <div className={styles.actionMenuWrapper} ref={actionMenuRef}>
            <button
              type="button"
              className={`${styles.btnPlusMenu} ${isActionMenuOpen ? styles.btnPlusMenuActive : ''}`}
              onClick={() => setIsActionMenuOpen((prev) => !prev)}
              title="Create & Tools Menu"
              aria-label="Create new document or tools"
              aria-expanded={isActionMenuOpen}
              aria-haspopup="true"
            >
              <Plus size={18} className={`${styles.plusIcon} ${isActionMenuOpen ? styles.plusIconRotated : ''}`} />
            </button>

            {isActionMenuOpen && (
              <div className={styles.actionMenuDropdown} role="menu">
                <button
                  type="button"
                  className={styles.actionMenuItem}
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    handleNewDoc();
                  }}
                  role="menuitem"
                >
                  <div className={styles.actionMenuIconBox} style={{ color: 'var(--color-accent)', background: 'var(--color-surface-2)' }}>
                    <Plus size={15} />
                  </div>
                  <div className={styles.actionMenuText}>
                    <span className={styles.actionMenuLabel}>New Document</span>
                    <span className={styles.actionMenuHint}>Create blank study document or book</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.actionMenuItem}
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    handleOpenVideoLessonModal('create');
                  }}
                  role="menuitem"
                >
                  <div className={styles.actionMenuIconBox} style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)' }}>
                    <Video size={15} />
                  </div>
                  <div className={styles.actionMenuText}>
                    <span className={styles.actionMenuLabel}>New Video Lesson</span>
                    <span className={styles.actionMenuHint}>YouTube video with interactive timestamp notes</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.actionMenuItem}
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    importFileRef.current?.click();
                  }}
                  disabled={isImporting}
                  role="menuitem"
                >
                  <div className={styles.actionMenuIconBox} style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
                    <FileUp size={15} />
                  </div>
                  <div className={styles.actionMenuText}>
                    <span className={styles.actionMenuLabel}>{isImporting ? (importStatus || 'Importing...') : 'Import File'}</span>
                    <span className={styles.actionMenuHint}>PDF, Word (.docx), Markdown, or Text files</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.actionMenuItem}
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    handlePasteAsBookDoc();
                  }}
                  role="menuitem"
                >
                  <div className={styles.actionMenuIconBox} style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}>
                    <ClipboardPaste size={15} />
                  </div>
                  <div className={styles.actionMenuText}>
                    <span className={styles.actionMenuLabel}>Paste Text</span>
                    <span className={styles.actionMenuHint}>Paste copied text and format as book note</span>
                  </div>
                </button>

                <div className={styles.actionMenuDivider} />

                <button
                  type="button"
                  className={`${styles.actionMenuItem} ${isCompanionOpen ? styles.actionMenuItemActive : ''}`}
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    if (!selectedId && filteredDocs.length > 0) {
                      handleSelectDoc(filteredDocs[0].id);
                    }
                    if (editorMode !== 'book' && editorMode !== 'word') {
                      setEditorMode('book');
                    }
                    setMobileTab('editor');
                    handleToggleCompanion();
                  }}
                  role="menuitem"
                >
                  <div className={styles.actionMenuIconBox} style={{ color: isCompanionOpen ? 'var(--color-accent-light)' : 'var(--color-text-muted)', background: 'var(--color-surface-2)' }}>
                    <SlidersHorizontal size={15} />
                  </div>
                  <div className={styles.actionMenuText}>
                    <span className={styles.actionMenuLabel}>Reading Tools</span>
                    <span className={styles.actionMenuHint}>{isCompanionOpen ? 'Hide typography, highlights & timer' : 'Show typography, highlights & study timer'}</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile View Switcher (Notes List vs Document Reader/Editor) ── */}
      <div className={styles.mobileViewSwitcher}>
        <button
          type="button"
          className={`${styles.mobileTabBtn} ${mobileTab === 'list' ? styles.mobileTabBtnActive : ''}`}
          onClick={() => setMobileTab('list')}
        >
          <List size={13} />
          <span>Documents ({filteredDocs.length})</span>
        </button>
        <button
          type="button"
          className={`${styles.mobileTabBtn} ${mobileTab === 'editor' ? styles.mobileTabBtnActive : ''}`}
          onClick={() => setMobileTab('editor')}
          disabled={!hasEditor}
        >
          <BookOpen size={13} />
          <span>{editorMode === 'book' ? 'Reader' : 'Editor'}</span>
        </button>
      </div>

      {/* ── Workbench Layout (No nested boxes) ── */}
      <div className={styles.workbench}>
        {/* ── Left: Document List (Clean Linear Rows) ── */}
        <aside className={`${styles.sidebar} ${mobileTab !== 'list' ? styles.sidebarHiddenMobile : ''}`}>

          {/* Search & Tag Filter */}
          <div className={styles.searchBar}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Filter documents..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            {searchQ && (
              <button className={styles.clearBtn} onClick={() => setSearchQ('')}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Material Type Navigation: All | Books & Docs | Video Lessons */}
          <div className={styles.materialTypeTabs} role="tablist" aria-label="Filter by material type">
            <button
              type="button"
              className={`${styles.materialTypeTab} ${typeFilter === 'all' ? styles.materialTypeTabActive : ''}`}
              onClick={() => setTypeFilter('all')}
              title="All study materials"
            >
              <span>All ({allMaterialsCount})</span>
            </button>
            <button
              type="button"
              className={`${styles.materialTypeTab} ${typeFilter === 'documents' ? styles.materialTypeTabActive : ''}`}
              onClick={() => setTypeFilter('documents')}
              title="Books and written notes"
            >
              <BookOpen size={11} />
              <span>Books ({booksCount})</span>
            </button>
            <button
              type="button"
              className={`${styles.materialTypeTab} ${typeFilter === 'videos' ? styles.materialTypeTabActive : ''}`}
              onClick={() => setTypeFilter('videos')}
              title="Dedicated video lessons"
            >
              <Video size={11} />
              <span>Video Lessons ({videoLessonsCount})</span>
            </button>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.statusChips}>
              {(['all', 'active', 'archived'] as const).map((s) => (
                <button
                  key={s}
                  className={`${styles.statusChip} ${statusFilter === s ? styles.statusChipActive : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Documents Linear List */}
          <div className={styles.docList}>
            {filteredDocs.length === 0 ? (
              <div className={styles.emptyList}>
                {typeFilter === 'videos' ? (
                  <>
                    <Video size={24} style={{ color: 'var(--color-text-faint)', marginBottom: '6px' }} />
                    <p>No video lessons found</p>
                    <button
                      type="button"
                      className={styles.emptyAddBtn}
                      onClick={() => handleOpenVideoLessonModal('create')}
                    >
                      <Video size={13} /> + New Video Lesson
                    </button>
                  </>
                ) : (
                  <>
                    <FileText size={24} style={{ color: 'var(--color-text-faint)', marginBottom: '6px' }} />
                    <p>No documents found</p>
                    <button
                      type="button"
                      className={styles.emptyAddBtn}
                      onClick={handleNewDoc}
                    >
                      <Plus size={13} /> + New Document
                    </button>
                  </>
                )}
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isActive = doc.id === selectedId;
                const isFeatured = featuredBookId === doc.id;
                const isVideo = isDocVideoLesson(doc);
                const statusDotColor = doc.status === 'active' ? '#10b981' : '#94a3b8';

                return (
                  <div
                    key={doc.id}
                    className={`${styles.docRow} ${isActive ? styles.docRowActive : ''}`}
                    onClick={() => handleSelectDoc(doc.id)}
                  >
                    <div className={styles.docRowContent}>
                      <div className={styles.docRowTitleRow}>
                        <div className={styles.docRowTitleWrap}>
                          {doc.isPinned && <Pin size={11} className={styles.pinnedIcon} />}
                          {isVideo ? (
                            <span className={styles.videoLessonRowBadge} title="Video Lesson">
                              <Video size={11} />
                            </span>
                          ) : (
                            <span className={styles.bookRowBadge} title="Book / Document">
                              <BookOpen size={11} />
                            </span>
                          )}
                          <span className={styles.docRowTitle}>{doc.title}</span>
                        </div>
                        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={`${styles.rowActionBtn} ${isFeatured ? styles.rowActionBtnActive : ''}`}
                            onClick={() => handleToggleFeaturedOnDashboard(doc.id)}
                            title={isFeatured ? "Remove from Today's Reading" : "Feature on Today Dashboard"}
                          >
                            <Star size={11} fill={isFeatured ? "currentColor" : "none"} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.rowActionBtn} ${doc.isReminder ? styles.rowActionBtnActive : ''}`}
                            onClick={() => toggleDocReminder(doc.id)}
                            title={doc.isReminder ? "Remove reminder (clears from Today)" : "Set Reminder (Show on Today)"}
                            style={doc.isReminder ? { color: 'var(--color-warning, #f59e0b)' } : undefined}
                          >
                            <Bell size={11} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.rowActionBtn} ${doc.isPinned ? styles.rowActionBtnActive : ''}`}
                            onClick={() => togglePinDoc(doc.id)}
                            title={doc.isPinned ? "Unpin document" : "Pin document to top"}
                          >
                            <Pin size={11} />
                          </button>
                          {doc.status === 'archived' && (
                            <button
                              type="button"
                              className={styles.rowActionBtn}
                              onClick={(e) => { e.stopPropagation(); handleRestoreDoc(doc.id); }}
                              title="Restore to Active"
                              style={{ color: '#10b981' }}
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${styles.rowActionBtn} ${styles.rowActionBtnDelete}`}
                            onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, doc.title); }}
                            title="Archive or delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      <div className={styles.docRowMeta}>
                        <span className={styles.statusBadge}>
                          <span className={styles.statusDot} style={{ background: statusDotColor }} />
                          <span className={styles.statusText}>{doc.status}</span>
                        </span>
                        {doc.readStatus === 'completed' ? (
                          <span className={styles.metaPillDone}>Done</span>
                        ) : (doc.readProgress != null && doc.readProgress > 0) ? (
                          <span className={styles.metaPillProgress}>{doc.readProgress}%</span>
                        ) : null}

                        <div className={styles.metaRightActions}>
                          {isFeatured && (
                            <span
                              className={styles.todayPill}
                              title="Featured on Today Dashboard"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFeaturedOnDashboard(doc.id);
                              }}
                            >
                              ★ Today
                            </span>
                          )}
                          <Link
                            href={`/focus?docId=${doc.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={styles.studyLink}
                            title="Study in Focus Mode"
                          >
                            <span>Study</span>
                            <ExternalLink size={9} />
                          </Link>
                        </div>
                      </div>

                      {/* Mini Progress Bar */}
                      {doc.readProgress != null && doc.readProgress > 0 && (
                        <div className={styles.progressBarTrack}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width: `${Math.min(100, Math.max(0, doc.readProgress))}%`,
                              background: doc.readProgress === 100 ? '#10b981' : 'var(--color-accent)',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Right: Clean Editorial Document Canvas ── */}
        <main className={`${styles.editorCanvas} ${mobileTab !== 'editor' ? styles.canvasHiddenMobile : ''}`}>
          {!hasEditor ? (
            <div className={styles.canvasEmpty}>
              <BookOpen size={44} style={{ color: 'var(--color-text-faint)', marginBottom: '12px' }} />
              <p style={{ fontSize: '15px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Select a document, create a new entry, or import a PDF
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  className={styles.btnSecondary}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={handlePasteAsBookDoc}
                  title="Paste text from clipboard and auto-format into clean Book design"
                >
                  <ClipboardPaste size={14} /> Paste Book Text
                </button>
                <button
                  className={styles.btnSecondary}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => importFileRef.current?.click()}
                  disabled={isImporting}
                >
                  <FileUp size={14} /> Import PDF / File
                </button>
                <button className={styles.btnCreate} onClick={handleNewDoc}>
                  <Plus size={15} /> New Document
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.editorWrapper}>
              {/* Document Action Header (Clean Minimalist Topbar) */}
              <div className={styles.canvasHeader}>
                <div className={styles.canvasHeaderLeft}>
                  {/* Mobile Back Button to Notes List */}
                  <button
                    type="button"
                    className={styles.mobileBackBtn}
                    onClick={() => setMobileTab('list')}
                    title="Back to all documents list"
                  >
                    <ChevronLeft size={16} />
                    <span>Notes</span>
                  </button>

                  {isCurrentVideo ? (
                    <div className={styles.segmentedControl}>
                      <button
                        type="button"
                        className={`${styles.segmentBtn} ${styles.segmentBtnActive}`}
                        onClick={() => setEditorMode('book')}
                        title="Video Lesson Studio"
                      >
                        <Video size={12} />
                        <span>Video Lesson</span>
                      </button>
                      <button
                        type="button"
                        className={styles.segmentBtn}
                        onClick={handleEditCurrentVideoLesson}
                        title="Edit video link and lesson name"
                      >
                        <Edit2 size={12} />
                        <span>Edit Link &amp; Name</span>
                      </button>
                    </div>
                  ) : (
                    <div className={styles.segmentedControl}>
                      <button
                        type="button"
                        className={`${styles.segmentBtn} ${(editorMode === 'book' || editorMode === 'word') ? styles.segmentBtnActive : ''}`}
                        onClick={() => setEditorMode('book')}
                        title="Book reading mode — Formal document layout"
                      >
                        <BookOpen size={12} />
                        <span>Book</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentBtn} ${editorMode === 'edit' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setEditorMode('edit')}
                        title="Edit note"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentBtn} ${editorMode === 'preview' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setEditorMode('preview')}
                        title="Preview rendered markdown"
                      >
                        <Eye size={12} /> Preview
                      </button>
                    </div>
                  )}


                </div>

                <div className={styles.canvasActionsRight}>
                  {selectedDoc && (
                    <span className={styles.lastSavedText}>
                      Saved {new Date(selectedDoc.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}

                  {selectedDoc && (
                    <button
                      type="button"
                      className={`${styles.headerGhostBtn} ${selectedDoc.isReminder ? styles.headerReminderBtnActive : ''}`}
                      onClick={() => toggleDocReminder(selectedDoc.id)}
                      title={selectedDoc.isReminder ? "Remove reminder (clears from Today)" : "Set Reminder (Show on Today)"}
                      style={selectedDoc.isReminder ? { color: 'var(--color-warning, #f59e0b)', borderColor: 'rgba(245, 158, 11, 0.4)' } : undefined}
                    >
                      <Bell size={13} style={selectedDoc.isReminder ? { color: 'var(--color-warning, #f59e0b)' } : undefined} />
                      <span>Reminder</span>
                    </button>
                  )}

                  {!isCurrentVideo && (
                    <>
                      {/* AI Knowledge Tools */}
                      <button
                        type="button"
                        className={styles.headerGhostBtn}
                        onClick={() => setAiModalOpen(true)}
                        title="AI Tools: Auto-Format, Summary, Study Quiz, Ask AI"
                      >
                        <Sparkles size={13} style={{ color: 'var(--color-accent-light)' }} />
                        <span>AI</span>
                      </button>

                      {/* Export PDF Button */}
                      <button
                        type="button"
                        className={styles.headerGhostBtn}
                        onClick={handleExportPdf}
                        title="Export as PDF"
                      >
                        <Printer size={13} />
                      </button>

                      {/* Copy Text Button */}
                      <button
                        type="button"
                        className={styles.headerGhostBtn}
                        onClick={handleCopyText}
                        title="Copy Document Text"
                      >
                        {copied ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
                      </button>

                      {selectedDoc && (
                        <EntityFiles
                          variant="button"
                          className={styles.headerGhostBtn}
                          entityType="knowledge"
                          entityId={selectedDoc.id}
                          title={selectedDoc.title}
                        />
                      )}
                    </>
                  )}

                  {editorMode === 'edit' && (
                    <button className={styles.btnSave} onClick={handleSave} title="Save changes">
                      <Save size={13} /> Save
                    </button>
                  )}
                </div>
              </div>



              {/* Connected Metadata Badges (Formal Linear Bar) */}
              {(linkedDream || linkedGoal || linkedProject || linkedTask) && (
                <div className={styles.linkedBadgesBar}>
                  {linkedDream && (
                    <span className={styles.linkedBadge}>
                      <CloudSun size={11} /> Dream: {linkedDream.title}
                    </span>
                  )}
                  {linkedGoal && (
                    <span className={styles.linkedBadge}>
                      <Target size={11} /> Goal: {linkedGoal.title}
                    </span>
                  )}
                  {linkedProject && (
                    <span className={styles.linkedBadge}>
                      <Folder size={11} /> Project: {linkedProject.title}
                    </span>
                  )}
                  {linkedTask && (
                    <span className={styles.linkedBadge}>
                      <CheckSquare size={11} /> Task: {linkedTask.title}
                    </span>
                  )}
                </div>
              )}

              {/* Reading Progress Strip — shown after Finish in Focus Space */}
              {selectedDoc && selectedDoc.readProgress != null && selectedDoc.readProgress > 0 && (
                <div className={styles.docReadProgressStrip}>
                  <div className={styles.docReadProgressLeft}>
                    {selectedDoc.readStatus === 'completed' ? (
                      <span className={styles.docReadStatusBadge} style={{ color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        Finished
                      </span>
                    ) : (
                      <span className={styles.docReadStatusBadge}>
                        Reading
                      </span>
                    )}
                    <span className={styles.docReadProgressPct}>
                      {selectedDoc.readProgress}% read
                    </span>
                    {selectedDoc.lastReviewedAt && (
                      <span className={styles.docReadLastDate}>
                        Last session {new Date(selectedDoc.lastReviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {selectedDoc && selectedDoc.readProgress != null && selectedDoc.readProgress > 0 && (
                <div className={styles.docReadProgressBarTrack}>
                  <div
                    className={styles.docReadProgressBarFill}
                    style={{
                      width: `${Math.min(100, selectedDoc.readProgress)}%`,
                      background: selectedDoc.readProgress >= 100 ? '#10b981' : 'var(--color-accent)',
                    }}
                  />
                </div>
              )}

              {/* Document Title (hidden in Book Mode to keep reading view locked & clean) */}
              {editorMode !== 'book' && (
                <input
                  type="text"
                  className={styles.docTitle}
                  placeholder="Untitled Document"
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                />
              )}

              {editorMode === 'edit' && (
                <MarkdownToolbar
                  onFormat={handleFormat}
                  onHighlight={handleHighlight}
                  onRemoveHighlight={handleRemoveHighlight}
                  activeColor={activeHighlightColor}
                  onSetActiveColor={setActiveHighlightColor}
                  onApplyFontColor={handleApplyFontColor}
                  activeFontColor={activeFontColor}
                  onAutoFormat={handleTriggerAutoFormat}
                  isAutoFormatting={isAutoFormatting}
                  activeFormats={activeFormats}
                  onAddVideo={() => {
                    setEditingVideoBlockTarget(null);
                    setVideoModalOpen(true);
                  }}
                />
              )}

              {/* Live WYSIWYG Rich Editor Canvas (Microsoft Word Style) */}
              {editorMode === 'edit' ? (
                <>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className={styles.richEditor}
                    data-placeholder="Start typing your notes here... Select any text and click a color swatch to highlight it live in color!"
                    dangerouslySetInnerHTML={{ __html: getRichHtml(selectedDoc?.content || fContent || '') }}
                    onPaste={handleSmartPaste}
                    onClick={handleEditorClick}
                    onKeyDown={handleEditorKeyDown}
                    onKeyUp={handleEditorKeyUp}
                    onMouseUp={handleEditorMouseUp}
                    onInput={() => {
                      if (editorRef.current && !isInternalChange.current) {
                        fixNumberingSpaceBeforeCaret();
                        setFContent(editorRef.current.innerHTML);
                        if (typingHistoryTimerRef.current) {
                          clearTimeout(typingHistoryTimerRef.current);
                        }
                        typingHistoryTimerRef.current = setTimeout(() => {
                          if (editorRef.current) {
                            pushHistorySnapshot(editorRef.current.innerHTML);
                          }
                        }, 500);
                      }
                    }}
                    onBlur={() => {
                      if (editorRef.current) {
                        setFContent(editorRef.current.innerHTML);
                      }
                    }}
                  />
                </>
              ) : editorMode === 'preview' ? (
                <div
                  className={styles.previewCanvas}
                  dangerouslySetInnerHTML={{
                    __html: fContent
                      ? getRichHtml(fContent)
                      : '<p style="color:var(--color-text-faint)">No content to preview.</p>',
                  }}
                />
              ) : (editorMode === 'book' || editorMode === 'word') ? (
                /* ── Formal Microsoft Word Document / Video Studio Layout with Right Companion ── */
                <div className={isCompanionOpen ? styles.readerTwoColumnLayout : styles.readerTwoColumnLayoutCollapsed}>
                  <div className={styles.readerMainContent}>
                    {isCurrentVideo ? (
                      /* ── Executive Video Lesson Studio Layout (Wide Theater Canvas) ── */
                      <div className={styles.videoLessonStudioSheet}>
                        <div
                          ref={(el) => {
                            (bookEditorRef as any).current = el;
                            (wordEditorRef as any).current = el;
                          }}
                          contentEditable={false}
                          onClick={handleContentClick}
                          onKeyDown={handleLockedKeyDown}
                          className={`${styles.wordDocumentBody} ${styles.videoLessonStudioBody}`}
                          style={{
                            color: readingTextColor !== 'default' ? readingTextColor : undefined,
                          }}
                          dangerouslySetInnerHTML={{ __html: getRichHtml(selectedDoc?.content || fContent || '') }}
                        />
                      </div>
                    ) : (
                      /* ── Formal Microsoft Word Paper Sheet (Books & Standard Documents) ── */
                      <div className={styles.wordDocumentSheet}>
                        <div className={styles.wordDocumentHeader}>
                          <div className={styles.wordDocumentTitle}>{fTitle || 'Untitled Document'}</div>
                          <div className={styles.wordDocumentMetaRow}>
                            <div className={styles.wordDocumentBadges}>
                              <span className={styles.wordDocumentBadge}>
                                <FileText size={11} /> Microsoft Word / PDF Style
                              </span>
                              <span className={styles.wordDocumentBadge} style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Lock size={10} /> Locked (Read-Only)
                              </span>
                              <span className={styles.wordDocumentBadge}>
                                Author: Sariling Mundo
                              </span>
                              {fCategory && (
                                <span className={styles.wordDocumentBadge}>
                                  Category: {fCategory}
                                </span>
                              )}
                            </div>
                            <div>
                              {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                          </div>
                        </div>

                        <div
                          ref={(el) => {
                            (bookEditorRef as any).current = el;
                            (wordEditorRef as any).current = el;
                          }}
                          contentEditable={false}
                          onClick={handleContentClick}
                          onKeyDown={handleLockedKeyDown}
                          className={`${styles.wordDocumentBody} ${readingFont === 'serif' ? styles.bookPageSerif : ''} ${styles['fontSize_' + readingFontSize]}`}
                          style={{
                            color: readingTextColor !== 'default' ? readingTextColor : undefined,
                          }}
                          dangerouslySetInnerHTML={{ __html: getRichHtml(selectedDoc?.content || fContent || '') }}
                        />

                        <div className={styles.wordDocumentFooter}>
                          <span>Page 1 of 1 • Sariling Mundo Official Document</span>
                          <span>Confidential &amp; Personal Knowledge Asset</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Formal Right Companion Panel (Shown on demand when toggled) */}
                  {isCompanionOpen && renderReaderCompanion(true)}
                </div>
              ) : (
                /* ── Study & Review Quiz Mode (Active Recall Hub) ── */
                <div className={styles.quizStudyCanvas}>
                  <div className={styles.quizStudyHeader}>
                    <div className={styles.quizStudyTitleRow}>
                      <div>
                        <h2 className={styles.quizStudyTitle}>Study &amp; Review Quiz</h2>
                        <p className={styles.quizStudySubtitle}>
                          Active recall flashcards for <strong>&ldquo;{selectedDoc?.title || fTitle || 'this note'}&rdquo;</strong>. Tap cards to reveal answers and test your retention!
                        </p>
                      </div>
                    </div>

                    <div className={styles.quizStudyActions}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => handleGenerateQuiz()}
                        disabled={isGeneratingQuiz}
                        title="Regenerate questions using AI"
                      >
                        {isGeneratingQuiz && <Loader2 size={13} className={styles.spin} />}
                        <span>{isGeneratingQuiz ? 'Generating...' : 'Regenerate Questions'}</span>
                      </button>

                      {aiQuizResult && aiQuizResult.questions.some((q) => q.userMastered) && (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={handleResetQuizMastery}
                          title="Reset mastery status to study again"
                        >
                          <RotateCcw size={13} />
                          <span>Reset Progress</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {aiQuizResult && aiQuizResult.questions.length > 0 && (
                    <div className={styles.quizProgressBox}>
                      {(() => {
                        const qs = aiQuizResult.questions;
                        const mastered = qs.filter((q) => q.userMastered).length;
                        const pct = Math.round((mastered / qs.length) * 100);
                        return (
                          <>
                            <div className={styles.quizProgressMeta}>
                              <span>Active Recall Mastery</span>
                              <span className={styles.quizProgressCount}>
                                {mastered} / {qs.length} Mastered ({pct}%)
                              </span>
                            </div>
                            <div className={styles.quizProgressBarTrack}>
                              <div
                                className={styles.quizProgressBarFill}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {isGeneratingQuiz ? (
                    <div className={styles.aiLoadingState} style={{ padding: '48px 20px', textAlign: 'center' }}>
                      <Loader2 size={28} className={styles.spin} style={{ color: 'var(--color-accent)', margin: '0 auto 12px' }} />
                      <p style={{ fontSize: '0.92rem', color: 'var(--color-text-muted)' }}>
                        AI is reading your document and generating high-yield study questions...
                      </p>
                    </div>
                  ) : aiQuizResult && aiQuizResult.questions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {aiQuizResult.questions.map((q, idx) => {
                        const isRevealed = revealedQuizAnswers[idx];
                        const isMastered = q.userMastered;
                        return (
                          <div
                            key={idx}
                            className={`${styles.studyCard} ${isMastered ? styles.studyCardMastered : ''}`}
                            onClick={() => toggleQuizAnswer(idx)}
                          >
                            <div className={styles.studyCardHeader}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                                <span className={styles.quizNumber}>Q{idx + 1}</span>
                                <span className={styles.studyCardQuestion}>{q.question}</span>
                              </div>
                              {isMastered && (
                                <span className={styles.studyMasteredBadge}>
                                  ✓ Mastered
                                </span>
                              )}
                            </div>

                            {isRevealed ? (
                              <div className={styles.studyAnswerBox} onClick={(e) => e.stopPropagation()}>
                                <strong style={{ color: 'var(--color-accent-light)', display: 'block', marginBottom: 4 }}>
                                  Answer &amp; Key Insight:
                                </strong>
                                {q.answer}

                                <div className={styles.studyAnswerControls}>
                                  <button
                                    type="button"
                                    className={`${styles.studyFeedbackBtn} ${isMastered ? styles.studyFeedbackMastered : styles.studyFeedbackLearning}`}
                                    onClick={(e) => handleToggleMastery(idx, e)}
                                    title={isMastered ? 'Mark as still learning' : 'Mark as mastered'}
                                  >
                                    {isMastered ? '✓ Mastered' : 'Mark as Mastered'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={styles.quizTapPrompt}>
                                <span>Tap card to reveal answer ▾</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.aiEmptyState} style={{ padding: '48px 20px', textAlign: 'center' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--color-text)' }}>
                        No Study Questions Generated Yet
                      </h3>
                      <p className={styles.aiToolDesc} style={{ maxWidth: 440, margin: '0 auto 18px', lineHeight: 1.5 }}>
                        Lock this note into your long-term memory. Click below to automatically create flashcard-style active recall questions.
                      </p>
                      <button
                        type="button"
                        className={styles.btnPrimaryGradient}
                        onClick={() => handleGenerateQuiz()}
                      >
                        Auto-Create Study Quiz
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Rich Executive Link Preview Popover */}
      {linkPopover && (
        <div
          style={{
            position: 'fixed',
            top: `${Math.min(typeof window !== 'undefined' ? window.innerHeight - 300 : 300, Math.max(12, linkPopover.y))}px`,
            left: `${Math.min(typeof window !== 'undefined' ? window.innerWidth - 345 : 345, Math.max(12, linkPopover.x))}px`,
            zIndex: 1000,
            pointerEvents: 'auto',
          }}
        >
          <LinkPreviewCard
            url={linkPopover.url}
            onClose={() => setLinkPopover(null)}
            onEdit={
              editorMode === 'edit'
                ? () => {
                    const newUrl = prompt('Edit link destination:', linkPopover.url);
                    if (newUrl && newUrl.trim()) {
                      const clean = newUrl.trim();
                      const href = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
                      linkPopover.targetEl.href = href;
                      linkPopover.targetEl.setAttribute('data-preview-url', href);
                      setLinkPopover((prev) => prev ? { ...prev, url: href } : null);
                      if (editorRef.current) setFContent(editorRef.current.innerHTML);
                    }
                  }
                : undefined
            }
            onUnlink={
              editorMode === 'edit'
                ? () => {
                    const parent = linkPopover.targetEl.parentNode;
                    while (linkPopover.targetEl.firstChild) {
                      parent?.insertBefore(linkPopover.targetEl.firstChild, linkPopover.targetEl);
                    }
                    parent?.removeChild(linkPopover.targetEl);
                    setLinkPopover(null);
                    if (editorRef.current) setFContent(editorRef.current.innerHTML);
                  }
                : undefined
            }
          />
        </div>
      )}

      {/* Floating Selection Highlight Toolbar — highlight colors & font colors */}
      {floatingMenu && (
        <div
          data-floating-toolbar="true"
          className={styles.floatingHighlightMenu}
          style={{ left: `${floatingMenu.x}px`, top: `${floatingMenu.y}px` }}
          onPointerDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
        >
          {HIGHLIGHT_COLORS.slice(0, 6).map((c) => (
            <button
              key={c.name}
              type="button"
              className={styles.floatingSwatch}
              style={{
                background: c.bg,
                borderColor: c.border,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleHighlight(c.name, false, floatingMenu.targetMark);
                setFloatingMenu(null);
              }}
              title={`Highlight: ${c.label}`}
              aria-label={`Highlight ${c.label}`}
            />
          ))}

          <div className={styles.floatingDivider} />

          {/* Font Color Swatches */}
          {FONT_COLORS.slice(1, 8).map((fc) => (
            <button
              key={fc.name}
              type="button"
              className={styles.floatingFontSwatch}
              style={{
                backgroundColor: fc.color,
                borderColor: fc.border,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleApplyFontColor(fc.color, floatingMenu.targetMark);
                setFloatingMenu(null);
              }}
              title={`Font Color: ${fc.label}`}
              aria-label={`Font Color ${fc.label}`}
            >
              A
            </button>
          ))}

          <div className={styles.floatingDivider} />

          {/* Eraser — remove highlight or font color */}
          <button
            type="button"
            className={styles.floatingEraserBtn}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRemoveHighlight(floatingMenu.targetMark);
              setFloatingMenu(null);
            }}
            title="Remove Highlight / Clear"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── AI Knowledge Suite Modal ── */}
      {/* AI Knowledge Tools Suite Modal */}
      {aiModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setAiModalOpen(false)}>
          <div className={styles.aiModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.aiModalHeader}>
              <div className={styles.aiModalTitleGroup}>
                <span className={styles.aiModalBadge}>AI Knowledge Suite</span>
                <h2 className={styles.aiModalTitle}>{fTitle || 'Untitled Document'}</h2>
              </div>
              <button
                type="button"
                className={styles.aiModalCloseBtn}
                onClick={() => setAiModalOpen(false)}
                aria-label="Close AI tools"
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.aiModalTabs}>
              <button
                type="button"
                className={`${styles.aiModalTab} ${aiModalTab === 'format' ? styles.aiModalTabActive : ''}`}
                onClick={() => setAiModalTab('format')}
              >
                <span>Auto-Format</span>
              </button>
              <button
                type="button"
                className={`${styles.aiModalTab} ${aiModalTab === 'summary' ? styles.aiModalTabActive : ''}`}
                onClick={() => {
                  setAiModalTab('summary');
                  if (!aiSummaryResult && !isGeneratingSummary) {
                    handleGenerateSummary();
                  }
                }}
              >
                <span>Summary</span>
              </button>
              <button
                type="button"
                className={`${styles.aiModalTab} ${aiModalTab === 'quiz' ? styles.aiModalTabActive : ''}`}
                onClick={() => {
                  setAiModalTab('quiz');
                  if (!aiQuizResult && !isGeneratingQuiz) {
                    handleGenerateQuiz();
                  }
                }}
              >
                <span>Study Quiz</span>
              </button>
              <button
                type="button"
                className={`${styles.aiModalTab} ${aiModalTab === 'ask' ? styles.aiModalTabActive : ''}`}
                onClick={() => setAiModalTab('ask')}
              >
                <span>Ask AI</span>
              </button>
            </div>

            <div className={styles.aiModalBody}>
              {/* TAB 1: Format */}
              {aiModalTab === 'format' && (
                <div className={styles.aiToolCard}>
                  <div className={styles.aiToolHeader}>
                    <div>
                      <h3 className={styles.aiToolHeading}>Intelligent Note Formatting</h3>
                      <p className={styles.aiToolDesc}>
                        Automatically fixes clumsy formatting, creates clean section headings, organizes lists, highlights key definitions, and optimizes spacing for reading and study.
                      </p>
                    </div>
                  </div>
                  <div className={styles.aiActionRow}>
                    <button
                      type="button"
                      className={styles.btnPrimaryGradient}
                      onClick={async () => {
                        setAiModalOpen(false);
                        await handleTriggerAutoFormat();
                      }}
                      disabled={isAutoFormatting}
                    >
                      {isAutoFormatting && <Loader2 size={14} className={styles.spin} />}
                      <span>{isAutoFormatting ? 'Formatting Document...' : 'Run Auto-Format'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: Summary */}
              {aiModalTab === 'summary' && (
                <div className={styles.aiToolCard}>
                  {isGeneratingSummary ? (
                    <div className={styles.aiLoadingState}>
                      <Loader2 size={24} className={styles.spin} />
                      <p>Generating executive summary & key takeaways...</p>
                    </div>
                  ) : aiSummaryResult ? (
                    <div className={styles.aiSummaryContent}>
                      <div className={styles.aiSummarySection}>
                        <div className={styles.aiSectionLabel}>Executive Summary</div>
                        <p className={styles.aiSummaryText}>{aiSummaryResult.summary}</p>
                      </div>

                      <div className={styles.aiSummarySection}>
                        <div className={styles.aiSectionLabel}>Core Takeaways</div>
                        <ul className={styles.aiBulletList}>
                          {aiSummaryResult.keyPoints.map((pt, idx) => (
                            <li key={idx}>{pt}</li>
                          ))}
                        </ul>
                      </div>

                      {aiSummaryResult.actionItems && aiSummaryResult.actionItems.length > 0 && (
                        <div className={styles.aiSummarySection}>
                          <div className={styles.aiSectionLabel}>Actionable Next Steps</div>
                          <ul className={styles.aiBulletList}>
                            {aiSummaryResult.actionItems.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className={styles.aiActionButtons}>
                        <button
                          type="button"
                          className={styles.btnPrimaryGradient}
                          onClick={handleInsertSummaryIntoDoc}
                        >
                          <span>{insertedSummarySuccess ? 'Inserted at Top' : 'Insert into Document'}</span>
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={handleCopySummary}
                        >
                          <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={handleGenerateSummary}
                        >
                          <span>Regenerate</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.aiEmptyState}>
                      <p className={styles.aiToolDesc}>Generate an executive summary, core insights, and next actions for this note.</p>
                      <button
                        type="button"
                        className={styles.btnPrimaryGradient}
                        onClick={handleGenerateSummary}
                      >
                        Generate Executive Summary
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Study Quiz */}
              {aiModalTab === 'quiz' && (
                <div className={styles.aiToolCard}>
                  {isGeneratingQuiz ? (
                    <div className={styles.aiLoadingState}>
                      <Loader2 size={24} className={styles.spin} />
                      <p>Generating active recall questions from your notes...</p>
                    </div>
                  ) : aiQuizResult ? (
                    <div className={styles.aiQuizList}>
                      <p className={styles.aiToolDesc}>
                        Active recall strengthens memory retention. Tap any question to reveal its answer.
                      </p>
                      {aiQuizResult.questions.map((q, idx) => {
                        const isRevealed = revealedQuizAnswers[idx];
                        return (
                          <div
                            key={idx}
                            className={styles.quizCard}
                            onClick={() => toggleQuizAnswer(idx)}
                          >
                            <div className={styles.quizQuestionRow}>
                              <span className={styles.quizNumber}>Q{idx + 1}</span>
                              <span className={styles.quizQuestion}>{q.question}</span>
                            </div>
                            {isRevealed ? (
                              <div className={styles.quizAnswer}>
                                <strong>Answer:</strong> {q.answer}
                                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className={`${styles.studyFeedbackBtn} ${q.userMastered ? styles.studyFeedbackMastered : styles.studyFeedbackLearning}`}
                                    onClick={(e) => handleToggleMastery(idx, e)}
                                  >
                                    {q.userMastered ? '✓ Mastered' : 'Mark as Mastered'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={styles.quizTapPrompt}>
                                <span>Tap card to reveal answer</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => handleGenerateQuiz()}
                        >
                          <span>Regenerate Questions</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.aiEmptyState}>
                      <p className={styles.aiToolDesc}>Generate 3 to 4 flashcard-style testing questions from this document.</p>
                      <button
                        type="button"
                        className={styles.btnPrimaryGradient}
                        onClick={() => handleGenerateQuiz()}
                      >
                        Generate Study Questions
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Ask AI Assistant */}
              {aiModalTab === 'ask' && (
                <div className={styles.aiToolCard}>
                  <div className={styles.aiToolHeader}>
                    <div>
                      <h3 className={styles.aiToolHeading}>Discuss with AI Assistant</h3>
                      <p className={styles.aiToolDesc}>
                        Opens the assistant chat with <strong>&ldquo;{fTitle || 'this document'}&rdquo;</strong> pre-loaded into live context. Ask questions, clarify difficult concepts, or generate action plans connected to your goals.
                      </p>
                    </div>
                  </div>
                  <div className={styles.aiActionRow}>
                    <button
                      type="button"
                      className={styles.btnPrimaryGradient}
                      onClick={() => {
                        setAiModalOpen(false);
                        handleOpenAiChatForDoc();
                      }}
                    >
                      Open AI Assistant Chat
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Smart Paste into Book Modal (fallback when clipboard API is restricted or for manual pasting) */}
      {pasteModalOpen && (
        <div className={styles.pasteModalOverlay} onClick={() => setPasteModalOpen(false)}>
          <div className={styles.pasteModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pasteModalHeader}>
              <div className={styles.pasteModalTitle}>
                <BookMarked size={20} style={{ color: 'var(--color-accent)' }} />
                <span>Paste & Format as Book</span>
              </div>
              <button
                type="button"
                className={styles.docActionBtn}
                onClick={() => setPasteModalOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Paste raw text from a website, PDF, or document. It will automatically clean line breaks, reconstruct headings, format lists, and apply the elegant Book design.
            </p>
            <textarea
              className={styles.pasteModalTextarea}
              placeholder="Paste your text here (Ctrl+V)..."
              value={pasteModalText}
              onChange={(e) => setPasteModalText(e.target.value)}
              autoFocus
            />
            <div className={styles.pasteModalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setPasteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={!pasteModalText.trim()}
                onClick={() => {
                  const txt = pasteModalText;
                  setPasteModalOpen(false);
                  setPasteModalText('');
                  if (editorMode === 'book' && selectedDoc) {
                    appendPastedTextToCurrentBook(txt);
                  } else {
                    applyPastedTextAsBook(txt);
                  }
                }}
              >
                <BookMarked size={14} /> Format & Open as Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reading Schedule & Session Logs Modal ── */}
      {readingLogsModalOpen && (
        <div className={styles.readingModalOverlay} onClick={() => setReadingLogsModalOpen(false)}>
          <div className={styles.readingModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.readingModalHeader}>
              <h2 className={styles.readingModalTitle}>
                <Clock size={20} style={{ color: 'var(--color-accent)' }} />
                Reading Schedule &amp; Time Log
              </h2>
              <button
                type="button"
                className={styles.docActionBtn}
                onClick={() => setReadingLogsModalOpen(false)}
                aria-label="Close reading schedule"
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Track what time you read and view your reading habit consistency for <strong>&ldquo;{selectedDoc?.title || fTitle || 'this book'}&rdquo;</strong>.
            </p>

            <div className={styles.readingStatsGrid}>
              <div className={styles.readingStatCard}>
                <span className={styles.readingStatLabel}>Current Study Session</span>
                <span className={styles.readingStatValue}>
                  {studyMode === 'pomodoro'
                    ? `${Math.floor((pomoDuration - pomoSecondsLeft) / 60)}m ${(pomoDuration - pomoSecondsLeft) % 60}s elapsed`
                    : `${Math.floor(stopwatchSeconds / 60)}m ${stopwatchSeconds % 60}s`}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {studyMode === 'pomodoro' ? 'Pomodoro Active' : 'Stopwatch Tracker'}
                </span>
              </div>
              <div className={styles.readingStatCard}>
                <span className={styles.readingStatLabel}>Total Time Read</span>
                <span className={styles.readingStatValue}>
                  {selectedDoc?.totalReadMinutes || 0} mins
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {selectedDoc?.preferredReadingTime ? `Usual time: ${selectedDoc.preferredReadingTime}` : 'Recorded across sessions'}
                </span>
              </div>
            </div>

            {studyMode === 'stopwatch' && stopwatchSeconds >= 30 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={saveActiveStopwatchSession}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={13} />
                  <span>Save Current Session ({Math.round(stopwatchSeconds / 60)}m)</span>
                </button>
              </div>
            )}

            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '12px 0 8px', color: 'var(--color-text)' }}>
                Past Reading Sessions
              </h3>
              {(!selectedDoc?.readingLogs || selectedDoc.readingLogs.length === 0) ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
                  No past sessions recorded yet. Keep reading in Book or Word mode to automatically track your time!
                </p>
              ) : (
                <div className={styles.readingLogsList}>
                  {selectedDoc.readingLogs.map((log) => (
                    <div key={log.id} className={styles.readingLogItem}>
                      <div>
                        <strong>{new Date(log.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>
                        {' · '}
                        <span>{log.timeOfDay || new Date(log.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>
                        {log.durationMinutes} min{log.durationMinutes === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleAddManualReadingLog} style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '12px' }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text)' }}>
                Log a Past Reading Time Manually
              </h4>
              <div className={styles.manualLogForm}>
                <input
                  type="text"
                  className={styles.manualLogInput}
                  placeholder="Time used to read (e.g. 9:00 PM)"
                  value={manualReadTime}
                  onChange={(e) => setManualReadTime(e.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  max="480"
                  className={styles.manualLogInput}
                  placeholder="Duration (mins)"
                  value={manualReadMinutes}
                  onChange={(e) => setManualReadMinutes(e.target.value)}
                  style={{ maxWidth: '100px' }}
                />
                <button type="submit" className={styles.btnSecondary}>
                  Add Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Smart Auto Format: Side-by-Side Review & Preview Modal ── */}
      {formatPreviewModalOpen && pendingFormatResult && (
        <div className={styles.formatReviewOverlay} onClick={() => setFormatPreviewModalOpen(false)}>
          <div className={styles.formatReviewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.formatReviewHeader}>
              <div className={styles.formatReviewTitleRow}>
                <Sparkles size={20} style={{ color: 'var(--color-accent)' }} />
                <div>
                  <h3 className={styles.formatReviewTitle}>Smart Auto Format Review</h3>
                  <p className={styles.formatReviewSubtitle}>
                    Review original text vs. formatted publication book style. Click <strong>Apply</strong> to confirm or <strong>Cancel</strong> to keep original text unchanged.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={styles.docActionBtn}
                onClick={() => setFormatPreviewModalOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Structure & Improvements Summary Bar */}
            <div className={styles.formatReviewStatsBar}>
              <span className={styles.formatReviewStatItem}>
                📚 <strong>{pendingFormatResult.stats.headingsCount}</strong> Headings Structured
              </span>
              <span>•</span>
              <span className={styles.formatReviewStatItem}>
                📑 <strong>{pendingFormatResult.stats.paragraphsCount}</strong> Clean Paragraphs
              </span>
              <span>•</span>
              <span className={styles.formatReviewStatItem}>
                🔢 <strong>{pendingFormatResult.stats.listsCount}</strong> Normalized Lists
              </span>
              {pendingFormatResult.stats.fixedNumberingCount > 0 && (
                <>
                  <span>•</span>
                  <span className={styles.formatReviewStatItem} style={{ color: '#10b981' }}>
                    ✓ Fixed {pendingFormatResult.stats.fixedNumberingCount} Duplicate Numbers
                  </span>
                </>
              )}
              <span>•</span>
              <span className={styles.formatReviewStatItem} style={{ color: '#10b981' }}>
                🔒 100% Original Wording Preserved
              </span>
            </div>

            {/* Side-by-Side Split Grid */}
            <div className={styles.formatReviewSplitGrid}>
              {/* Left Column: Original Text */}
              <div className={styles.formatReviewColumn}>
                <div className={styles.formatReviewColHeader}>
                  <span>Original Document (Unchanged)</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>Raw text / input</span>
                </div>
                <div className={styles.formatReviewOriginalBox}>
                  {originalTextForReview || '(Empty content)'}
                </div>
              </div>

              {/* Right Column: Formatted Book Version */}
              <div className={styles.formatReviewColumn}>
                <div className={styles.formatReviewColHeader}>
                  <span>Formatted Book Style (Preview)</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-accent-light)' }}>Publication layout</span>
                </div>
                <div className={styles.formatReviewPreviewBox}>
                  <div
                    className={styles.wordDocumentBody}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(pendingFormatResult.formattedMarkdown) }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className={styles.formatReviewActions}>
              <button
                type="button"
                className={styles.formatReviewCancelBtn}
                onClick={() => setFormatPreviewModalOpen(false)}
              >
                Cancel (Keep Original)
              </button>
              <button
                type="button"
                className={styles.formatReviewApplyBtn}
                onClick={handleApplyAutoFormat}
              >
                <Check size={16} strokeWidth={2.5} color="#ffffff" />
                <span>Apply Formatting to Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification for Smart Paste & Book Operations */}
      {pasteToast && (
        <div className={styles.pasteToast} role="status" aria-live="polite">
          <span>{pasteToast}</span>
          {previousContentBeforeFormatRef.current !== null && (
            <button
              type="button"
              className={styles.toastUndoBtn}
              onClick={handleUndoAutoFormat}
              title="Undo formatting and revert to original"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Archive / Delete Dialog */}
      {deleteDialogDoc && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setDeleteDialogDoc(null)}
        >
          <div
            style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: '14px', padding: '24px 28px', width: '340px', maxWidth: '90vw',
              boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
              Archive or Delete?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              &ldquo;{deleteDialogDoc.title}&rdquo;
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => handleArchiveDoc(deleteDialogDoc.id)}
                style={{
                  padding: '11px 16px', borderRadius: '8px', border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-2)', color: 'var(--color-text)',
                  fontSize: '13px', cursor: 'pointer', fontWeight: 500, textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}
              >
                <RotateCcw size={14} style={{ opacity: 0.7 }} />
                <span>
                  <strong>Archive</strong>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                    Move to Archived — can restore later
                  </span>
                </span>
              </button>
              <button
                onClick={() => handlePermanentDelete(deleteDialogDoc.id)}
                style={{
                  padding: '11px 16px', borderRadius: '8px',
                  border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.06)',
                  color: '#ef4444', fontSize: '13px', cursor: 'pointer', fontWeight: 500, textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}
              >
                <Trash2 size={14} />
                <span>
                  <strong>Delete permanently</strong>
                  <span style={{ display: 'block', fontSize: '11px', color: 'rgba(239,68,68,0.7)', fontWeight: 400 }}>
                    Cannot be undone
                  </span>
                </span>
              </button>
              <button
                onClick={() => setDeleteDialogDoc(null)}
                style={{
                  padding: '9px 16px', borderRadius: '8px', border: 'none',
                  background: 'transparent', color: 'var(--color-text-muted)',
                  fontSize: '13px', cursor: 'pointer', marginTop: '2px',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Focus View Workspace */}
      {activeFocusLesson && (
        <FocusViewWorkspace
          videoId={activeFocusLesson.videoId}
          url={activeFocusLesson.url}
          lessonTitle={activeFocusLesson.lessonTitle}
          startTime={activeFocusLesson.startTime}
          bookId={activeFocusLesson.bookId || selectedDoc?.id}
          bookTitle={activeFocusLesson.bookTitle || selectedDoc?.title || fTitle}
          onClose={() => setActiveFocusLesson(null)}
          onOpenReadingLogs={() => setReadingLogsModalOpen(true)}
        />
      )}

      {/* Add / Edit Video Lesson Modal */}
      <AddVideoLessonModal
        isOpen={videoModalOpen}
        onClose={() => {
          setVideoModalOpen(false);
          setEditingVideoBlockTarget(null);
        }}
        onInsert={handleInsertVideoLesson}
        initialUrl={editingVideoBlockTarget?.initialUrl}
        initialTitle={editingVideoBlockTarget?.initialTitle}
        mode={videoModalMode}
      />

      {/* Floating Prompt on Pasting Standalone YouTube URL */}
      {detectedPastedYouTube && (
        <div className={styles.youtubePasteToast} role="alert">
          <span>YouTube video link detected. Embed as a Video Lesson?</span>
          <div className={styles.youtubePasteToastActions}>
            <button
              type="button"
              className={styles.toastInsertVideoBtn}
              onClick={handleConvertPastedToVideo}
            >
              Insert Video Lesson
            </button>
            <button
              type="button"
              className={styles.toastDismissBtn}
              onClick={() => setDetectedPastedYouTube(null)}
            >
              Keep as Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
