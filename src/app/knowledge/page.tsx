'use client';

import Link from 'next/link';
import React, { useState, useRef, useEffect } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { useGoals } from '@/context/GoalContext';
import { useDreams } from '@/context/DreamContext';
import { useProjects } from '@/context/ProjectContext';
import { useTasks } from '@/context/TaskContext';
import { extractTextFromFile } from '@/utils/fileImporter';
import type { KnowledgeDocument, DocumentStatus, DocumentCategory, DocumentReadStatus } from '@/types';
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
  Sparkles,
  Target,
  FolderKanban,
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
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Quote,
  Code,
  List,
  ListOrdered,
  Minus,
  AlertCircle,
  Wand2,
  Lightbulb,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
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
  HelpCircle,
  ExternalLink,
  ChevronLeft,
  Bot,
  Brain,
} from 'lucide-react';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';
import { useSettings } from '@/context/SettingsContext';
import { formatStudyNotesWithAI } from '@/utils/noteAutoFormatter';
import { summarizeDocumentWithAI, generateStudyQuizWithAI } from '@/utils/aiEngine';

// ── Color Highlight Palette ───────────────────────────────────────
const HIGHLIGHT_COLORS: { name: string; bg: string; border: string; text: string; label: string }[] = [
  { name: 'yellow',   bg: 'rgba(253, 224, 71,  0.55)', border: '#fbbf24', text: '#713f12', label: 'Yellow' },
  { name: 'lime',     bg: 'rgba(134, 239, 172, 0.55)', border: '#4ade80', text: '#14532d', label: 'Lime' },
  { name: 'cyan',     bg: 'rgba(103, 232, 249, 0.55)', border: '#22d3ee', text: '#164e63', label: 'Cyan' },
  { name: 'blue',     bg: 'rgba(147, 197, 253, 0.55)', border: '#60a5fa', text: '#1e3a5f', label: 'Blue' },
  { name: 'purple',   bg: 'rgba(196, 181, 253, 0.55)', border: '#a78bfa', text: '#3b0764', label: 'Purple' },
  { name: 'pink',     bg: 'rgba(249, 168, 212, 0.55)', border: '#f472b6', text: '#831843', label: 'Pink' },
  { name: 'orange',   bg: 'rgba(253, 186, 116, 0.55)', border: '#fb923c', text: '#7c2d12', label: 'Orange' },
  { name: 'red',      bg: 'rgba(252, 165, 165, 0.55)', border: '#f87171', text: '#7f1d1d', label: 'Red' },
  { name: 'mint',     bg: 'rgba(110, 231, 183, 0.55)', border: '#34d399', text: '#064e3b', label: 'Mint' },
  { name: 'lavender', bg: 'rgba(167, 139, 250, 0.55)', border: '#8b5cf6', text: '#2e1065', label: 'Lavender' },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {};
HIGHLIGHT_COLORS.forEach((c) => { COLOR_MAP[c.name] = { bg: c.bg, border: c.border, text: c.text }; });

// ── ADHD-Friendly Markdown & Document Renderer ───────────────────
function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (before other replacements)
  html = html.replace(/```([\s\S]*?)```/gm, '<pre><code>$1</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // ── ADHD Special Markers ──
  // Key Ideas: >>>text<<< — bright teal callout card
  html = html.replace(/>>>(.+?)<<</g, '<span class="key-idea"><span class="key-idea-icon">💡</span>$1</span>');

  // Important: !!text!! — vivid warning highlight
  html = html.replace(/!!(.+?)!!/g, '<span class="important-mark">⚡ $1</span>');

  // Colored highlights: =={colorname}text== (must come before generic ==text==)
  html = html.replace(/==\{([a-z]+)\}(.+?)==/g, (_, colorName, content) => {
    const c = COLOR_MAP[colorName];
    if (!c) return `<mark class="highlight-mark">${content}</mark>`;
    return `<mark style="background:${c.bg};border:1px solid ${c.border};color:${c.text};border-radius:3px;padding:1px 5px;font-weight:600;box-decoration-break:clone;-webkit-box-decoration-break:clone">${content}</mark>`;
  });

  // Generic highlight: ==text== — default yellow
  html = html.replace(/==(.+?)==/g, '<mark class="highlight-mark">$1</mark>');

  // Starred/Remember: ~~text~~ → strikethrough
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Checkboxes (before list items)
  html = html.replace(/^- \[x\] (.+)$/gm, '<div class="md-check done">✅ $1</div>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<div class="md-check">⬜ $1</div>');

  // Numbered list items (supports 1. and 1) formats)
  html = html.replace(/^(\d+)[\.\)]\s+(.+)$/gm, '<li class="ol-item"><span class="ol-num">$1.</span>$2</li>');
  html = html.replace(/(<li class="ol-item">[\s\S]*?<\/li>\n?)+/g, '<ol>$&</ol>');

  // Unordered list items (supports -, *, and literal • bullet characters)
  html = html.replace(/^([•\*\-])\s+(.+)$/gm, '<li>$2</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, '<ul>$&</ul>');

  // Blockquotes → key callout style
  html = html.replace(/^> (.+)$/gm, '<blockquote class="callout">$1</blockquote>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr/>');

  // Wrap double-newline separated blocks in <p>
  html = html.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim();
    if (/^<(h[1-6]|ul|ol|hr|div|pre|blockquote)/.test(trimmed)) return trimmed;

    // Process arrow flow (A -> B -> C or A → B → C)
    if ((trimmed.includes('→') || trimmed.includes('->')) && trimmed.length < 350) {
      const steps = trimmed.split(/→|->/).map((s) => s.trim().replace(/\.$/, '')).filter(Boolean);
      if (steps.length >= 2) {
        const stepHtml = steps.map((st) => `<span class="flow-step">${st}</span>`).join(' <span class="flow-arrow">&rarr;</span> ');
        return `<div class="process-flow">${stepHtml}</div>`;
      }
    }

    // Formula line
    if ((trimmed.includes('+') && trimmed.includes('=')) || /^Formula:\s*/i.test(trimmed)) {
      const clean = trimmed.replace(/^Formula:\s*/i, '');
      return `<div class="formula-box"><strong>Formula:</strong> <code>${clean}</code></div>`;
    }

    return trimmed ? `<p>${trimmed}</p>` : '';
  }).join('\n');

  return html;
}

// ── Live Rich Editor Toolbar (Google Docs / Word Style) ───────
// ── Live Rich Editor Toolbar (Senior Dev / Linear & Notion Style) ───────
function MarkdownToolbar({
  onFormat,
  onHighlight,
  onRemoveHighlight,
  activeColor,
  onSetActiveColor,
  onInsertTemplate,
  onAiFormat,
  isAiFormatting,
}: {
  onFormat: (cmd: string) => void;
  onHighlight: (colorName: string, forceApply?: boolean) => void;
  onRemoveHighlight: () => void;
  activeColor: string;
  onSetActiveColor: (colorName: string) => void;
  onInsertTemplate: () => void;
  onAiFormat: () => void;
  isAiFormatting: boolean;
}) {
  const activeColorDef = HIGHLIGHT_COLORS.find((c) => c.name === activeColor) ?? HIGHLIGHT_COLORS[0];

  return (
    <div className={styles.toolbarWrapper}>
      {/* Row 1: Formal Editor Commands */}
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
          className={styles.toolbarBtn}
          onClick={() => onFormat('h1')}
          title="Heading 1"
          style={{ fontWeight: 800 }}
        >
          H1
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('h2')}
          title="Heading 2"
          style={{ fontWeight: 700 }}
        >
          H2
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
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
          className={styles.toolbarBtn}
          onClick={() => onFormat('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('underline')}
          title="Underline (Ctrl+U)"
        >
          <Underline size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('strikethrough')}
          title="Strikethrough"
        >
          <Strikethrough size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('code')}
          title="Inline Code"
        >
          <Code size={12} />
        </button>

        <span className={styles.toolbarDivider} />

        {/* Text Alignment */}
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('alignLeft')}
          title="Align Left"
        >
          <AlignLeft size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('alignCenter')}
          title="Align Center"
        >
          <AlignCenter size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('alignRight')}
          title="Align Right"
        >
          <AlignRight size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('alignJustify')}
          title="Justify"
        >
          <AlignJustify size={12} />
        </button>

        <span className={styles.toolbarDivider} />

        {/* Lists & Blocks */}
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onFormat('list')}
          title="Bullet List"
        >
          <List size={12} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
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
          className={styles.toolbarBtn}
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

        <span className={styles.toolbarDivider} />

        {/* Formal Callouts */}
        <button
          type="button"
          className={`${styles.toolbarBtn} ${styles.toolbarImportant}`}
          onClick={() => onFormat('important')}
          title="Mark as Important requirement"
        >
          <AlertCircle size={12} style={{ marginRight: 3 }} /> Important
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${styles.toolbarKeyIdea}`}
          onClick={() => onFormat('key-idea')}
          title="Mark as Key Concept / Idea"
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

        {/* Template Action */}
        <button
          type="button"
          className={`${styles.toolbarBtn} ${styles.templateBtn}`}
          onClick={onInsertTemplate}
          title="Insert Executive Document Template"
        >
          <FileText size={11} style={{ marginRight: 3 }} /> Template
        </button>

        {/* AI Auto-Format in toolbar */}
        <button
          type="button"
          className={`${styles.toolbarBtn} ${styles.toolbarAiBtn}`}
          onClick={onAiFormat}
          disabled={isAiFormatting}
          title="AI Auto-Format and Structure Note"
        >
          {isAiFormatting ? <Loader2 size={11} className={styles.spin} /> : <Sparkles size={11} />}
          <span>{isAiFormatting ? 'Formatting...' : 'AI Format'}</span>
        </button>
      </div>
    </div>
  );
}


export default function KnowledgePage() {
  const { docs, isLoaded, addDoc, updateDoc, deleteDoc, togglePinDoc, resetToDefaultDocs } = useKnowledge();
  const { settings } = useSettings();
  const { goals }    = useGoals();
  const { dreams }   = useDreams();
  const { projects } = useProjects();
  const { tasks }    = useTasks();

  const [searchQ, setSearchQ]     = useState('');
  const [tagFilter, setTagFilter]  = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DocumentStatus>('all');
  const [copied, setCopied] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isAiFormatting, setIsAiFormatting] = useState(false);
  const [activeHighlightColor, setActiveHighlightColor] = useState('yellow');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const importFileRef = useRef<HTMLInputElement>(null);

  // Editor state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'edit' | 'preview' | 'book'>('book');
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
  const [aiQuizResult, setAiQuizResult] = useState<{ questions: { question: string; answer: string }[]; isAI: boolean } | null>(null);
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

  const editorRef = useRef<HTMLDivElement>(null);
  const bookEditorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const cachedSelectionRangeRef = useRef<Range | null>(null);
  const [floatingMenu, setFloatingMenu] = useState<{ x: number; y: number } | null>(null);

  // Floating highlight & format toolbar when selecting text (mouse drag, long-press, touch selection)
  useEffect(() => {
    let selectionTimeout: any = null;

    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setFloatingMenu(null);
        cachedSelectionRangeRef.current = null;
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

      const isInside =
        (editorEl && editorEl.contains(container)) ||
        (bookEl && bookEl.contains(container));

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

      setFloatingMenu({ x, y });
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
      
      const newDoc = addDoc({
        title: result.title || file.name,
        content: result.content || '',
        status: 'active',
        tags,
      });

      setSelectedId(newDoc.id);
      setIsCreating(false);
      setEditorMode('book');
      setMobileTab('editor');
      setAiSummaryResult(null);
      setAiQuizResult(null);
      setImportStatus(null);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Could not extract text from this file. Please make sure the file contains readable text.');
      setImportStatus(null);
    } finally {
      setIsImporting(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  // Default select first doc on initial load if none selected
  useEffect(() => {
    if (isLoaded && docs.length > 0 && !selectedId && !isCreating) {
      setSelectedId(docs[0].id);
    }
  }, [isLoaded, docs, selectedId, isCreating]);

  const selectedDoc = selectedId ? docs.find((d) => d.id === selectedId) ?? null : null;

  // Helper to convert content into rich HTML for live editing and book reading
  const getRichHtml = (content: string) => {
    if (!content) return '';
    // If content already has HTML tags (marked up, highlighted, formatted), return as-is.
    // This is critical — re-processing HTML through renderMarkdown strips <mark> and other tags.
    if (/<[a-z][^>]*>/i.test(content)) {
      return content;
    }
    // Plain markdown text — convert to HTML
    return renderMarkdown(content);
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
      }, 0);
    }
  }, [selectedDoc]);

  // Keep editor & book innerHTML in sync when mode or content changes
  // Only fire when not in the middle of an internal highlight save
  useEffect(() => {
    if (isInternalChange.current) return;
    const html = getRichHtml(fContent || '');
    if (editorMode === 'edit' && editorRef.current) {
      if (editorRef.current.innerHTML !== html) {
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
    setEditorMode('edit');
    setMobileTab('editor');
    setAiSummaryResult(null);
    setAiQuizResult(null);
  };

  const handleSave = () => {
    if (!fTitle.trim()) return;
    const tags = fTags.split(',').map((t) => t.trim()).filter(Boolean);
    const payload = {
      title: fTitle.trim(),
      content: fContent,
      status: fStatus,
      category: fCategory,
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
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Delete "${title}"?`)) {
      deleteDoc(id);
      if (selectedId === id) {
        setSelectedId(docs.find((d) => d.id !== id)?.id || null);
        setIsCreating(false);
      }
    }
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
            border-left: 3.5px solid #0d9488 !important;
            border-radius: 0 6px 6px 0;
            padding: 10px 14px;
            margin: 14px 0;
            font-weight: 600;
            color: #134e4a;
            page-break-inside: avoid;
          }
          blockquote.callout {
            background: #f8fafc;
            border-left: 3.5px solid #475569;
            border-radius: 0 6px 6px 0;
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

  // History management helper
  const updateContentWithHistory = (newContent: string) => {
    setFContent(newContent);
    setHistory((prev) => {
      const branch = prev.slice(0, historyIndex + 1);
      branch.push(newContent);
      return branch;
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setFContent(history[prevIdx]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setFContent(history[nextIdx]);
    }
  };

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

  // Insert Formal Document Template in Live Rich Editor
  const handleInsertTemplate = () => {
    const templateHtml = `
      <h2>1. Executive Summary</h2>
      <p>Brief high-level summary of this document, objectives, and main takeaways.</p>
      <hr />
      <h2>2. Core Objectives &amp; Scope</h2>
      <ul>
        <li><strong>Primary Goal</strong>: Specify the core ambition.</li>
        <li><strong>Key Success Metric</strong>: How success is measured.</li>
      </ul>
      <hr />
      <h2>3. Key Takeaways &amp; Strategic Insights</h2>
      <div class="key-idea" style="background:linear-gradient(135deg, rgba(6,182,212,0.12), rgba(99,102,241,0.08));border-left:3.5px solid #06b6d4;border-radius:0 6px 6px 0;padding:10px 14px;margin:12px 0;font-weight:600;">
        💡 <strong>Key Idea:</strong> Core principle or foundational insight
      </div>
      <p><span class="important-mark" style="background:rgba(244,63,94,0.15);color:#f43f5e;border:1px solid rgba(244,63,94,0.3);border-radius:4px;padding:2px 8px;font-weight:700;">⚡ Critical Requirement:</span> Must-know parameter or benchmark.</p>
      <hr />
      <h2>4. Action Items &amp; Execution Checklist</h2>
      <div class="md-check" style="display:flex;align-items:center;gap:8px;margin:6px 0;"><input type="checkbox" /> <span>Define initial project requirements</span></div>
      <div class="md-check" style="display:flex;align-items:center;gap:8px;margin:6px 0;"><input type="checkbox" /> <span>Execute primary development phase</span></div>
      <div class="md-check" style="display:flex;align-items:center;gap:8px;margin:6px 0;"><input type="checkbox" /> <span>Review progress and finalize documentation</span></div>
      <hr />
      <h2>5. Working Annotations &amp; Notes</h2>
      <p>Highlight key words using the top color palette swatches: <mark class="highlight-mark" style="background:rgba(253,224,71,0.55);border:1px solid #fbbf24;color:#713f12;border-radius:3px;padding:1px 5px;font-weight:600;">Yellow for key notes</mark>, <mark class="highlight-mark" style="background:rgba(103,232,249,0.55);border:1px solid #22d3ee;color:#164e63;border-radius:3px;padding:1px 5px;font-weight:600;">Cyan for definitions</mark>.</p>
    `;

    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, templateHtml);
      setFContent(editorRef.current.innerHTML);
    }
  };

  // Live WYSIWYG formatting commands (Google Docs / Word style)
  const handleFormat = (cmd: string) => {
    if (editorMode === 'book') return; // Book mode is locked for reading
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    if (cmd === 'undo') {
      document.execCommand('undo');
    } else if (cmd === 'redo') {
      document.execCommand('redo');
    } else if (cmd === 'bold') {
      document.execCommand('bold');
    } else if (cmd === 'italic') {
      document.execCommand('italic');
    } else if (cmd === 'underline') {
      document.execCommand('underline');
    } else if (cmd === 'h1') {
      document.execCommand('formatBlock', false, '<h1>');
    } else if (cmd === 'h2') {
      document.execCommand('formatBlock', false, '<h2>');
    } else if (cmd === 'h3') {
      document.execCommand('formatBlock', false, '<h3>');
    } else if (cmd === 'quote') {
      document.execCommand('formatBlock', false, '<blockquote>');
    } else if (cmd === 'list') {
      document.execCommand('insertUnorderedList');
    } else if (cmd === 'numbered') {
      document.execCommand('insertOrderedList');
    } else if (cmd === 'divider') {
      document.execCommand('insertHorizontalRule');
    } else if (cmd === 'code') {
      const sel = window.getSelection();
      const txt = (sel && !sel.isCollapsed) ? sel.toString() : 'code';
      document.execCommand('insertHTML', false, `<code>${txt}</code>&nbsp;`);
    } else if (cmd === 'task') {
      document.execCommand('insertHTML', false, '<div class="md-check" style="display:flex;align-items:center;gap:8px;margin:6px 0;"><input type="checkbox" /> <span>Task item</span></div><p></p>');
    } else if (cmd === 'important') {
      const sel = window.getSelection();
      const text = (sel && !sel.isCollapsed) ? sel.toString() : 'Important concept';
      document.execCommand('insertHTML', false, `<span class="important-mark" style="background:rgba(244,63,94,0.15);color:#f43f5e;border:1px solid rgba(244,63,94,0.3);border-radius:4px;padding:2px 8px;font-weight:700;">⚡ ${text}</span>&nbsp;`);
    } else if (cmd === 'key-idea') {
      const sel = window.getSelection();
      const text = (sel && !sel.isCollapsed) ? sel.toString() : 'Core principle / key concept';
      document.execCommand('insertHTML', false, `<div class="key-idea" style="background:linear-gradient(135deg, rgba(6,182,212,0.12), rgba(99,102,241,0.08));border-left:3.5px solid #06b6d4;border-radius:0 6px 6px 0;padding:10px 14px;margin:12px 0;font-weight:600;color:var(--color-text);">💡 <strong>Key Idea:</strong> ${text}</div><p></p>`);
    } else if (cmd === 'strikethrough') {
      document.execCommand('strikeThrough');
    } else if (cmd === 'alignLeft') {
      document.execCommand('justifyLeft');
    } else if (cmd === 'alignCenter') {
      document.execCommand('justifyCenter');
    } else if (cmd === 'alignRight') {
      document.execCommand('justifyRight');
    } else if (cmd === 'alignJustify') {
      document.execCommand('justifyFull');
    }

    if (editor) {
      setFContent(editor.innerHTML);
      if (selectedDoc) {
        updateDoc(selectedDoc.id, { content: editor.innerHTML });
      }
    }
  };

  // Live Color Highlighter (works in both Live Editor and Book View)
  const handleHighlight = (colorName: string, forceApply = false) => {
    setActiveHighlightColor(colorName);
    const editor = editorMode === 'book' ? bookEditorRef.current : editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    const c = COLOR_MAP[colorName] || HIGHLIGHT_COLORS[0];

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
      // In book mode, never insert dummy text or push content
      if (forceApply && editorMode !== 'book') {
        editor.focus();
        document.execCommand('insertHTML', false, `<mark class="highlight-mark" style="background:${c.bg};border:1px solid ${c.border};color:${c.text};border-radius:3px;padding:1px 5px;font-weight:600;">highlighted text</mark>&nbsp;`);
        setFContent(editor.innerHTML);
        if (selectedDoc) {
          updateDoc(selectedDoc.id, { content: editor.innerHTML });
        }
      }
      return;
    }

    // Ensure selection is inside the editor/book container
    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }

    // If selection is already inside an existing highlight mark, update its color directly
    let cur: Node | null = range.commonAncestorContainer;
    while (cur && cur !== editor) {
      if (cur.nodeName === 'MARK') {
        const markEl = cur as HTMLElement;
        markEl.style.background = c.bg;
        markEl.style.border = `1px solid ${c.border}`;
        markEl.style.color = c.text;
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
    mark.style.border = `1px solid ${c.border}`;
    mark.style.color = c.text;
    mark.style.borderRadius = '3px';
    mark.style.padding = '1px 5px';
    mark.style.fontWeight = '600';
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
    isInternalChange.current = false;
    if (selectedDoc) {
      updateDoc(selectedDoc.id, { content: saved });
    }
  };

  // Remove highlight on selection in Editor or Book Mode
  const handleRemoveHighlight = () => {
    const editor = editorMode === 'book' ? bookEditorRef.current : editorRef.current;
    if (!editor) return;

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
      
      // If common ancestor or parent is MARK
      let cur: Node | null = container;
      while (cur && cur !== editor) {
        if (cur.nodeName === 'MARK') {
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
      const marks = editor.querySelectorAll('mark');
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
    isInternalChange.current = false;
    if (selectedDoc) {
      updateDoc(selectedDoc.id, { content: saved });
    }
  };

  // AI Auto-Format and Structure Note (supports both Editor and Book Mode)
  const handleAiFormat = async () => {
    const activeEditor = editorMode === 'book' ? bookEditorRef.current : editorRef.current;
    const raw = (activeEditor ? activeEditor.innerHTML : fContent) || '';
    if (!raw.trim() || raw.trim().length < 5) {
      alert('Please write or paste some notes first to format.');
      return;
    }

    setIsAiFormatting(true);
    try {
      const result = await formatStudyNotesWithAI(raw, fTitle || 'Study Document', settings);
      if (editorRef.current) {
        editorRef.current.innerHTML = result.formattedHtml;
      }
      if (bookEditorRef.current) {
        bookEditorRef.current.innerHTML = result.formattedHtml;
      }
      setFContent(result.formattedHtml);

      if (selectedDoc) {
        updateDoc(selectedDoc.id, { content: result.formattedHtml });
      }
    } catch (err) {
      console.error('AI formatting failed:', err);
    } finally {
      setIsAiFormatting(false);
    }
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
      <div class="key-idea" style="background:linear-gradient(135deg, rgba(99,102,241,0.12), rgba(6,182,212,0.08));border-left:3.5px solid #6366f1;border-radius:0 6px 6px 0;padding:12px 16px;margin:14px 0;">
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

  // AI Active Recall Study Quiz Generator
  const handleGenerateQuiz = async () => {
    const raw = (editorMode === 'book' ? bookEditorRef.current?.innerHTML : editorRef.current?.innerHTML) || fContent || selectedDoc?.content || '';
    if (!raw.trim() || raw.trim().length < 5) {
      alert('Please add some content to this document before generating study questions.');
      return;
    }
    setIsGeneratingQuiz(true);
    setRevealedQuizAnswers({});
    try {
      const res = await generateStudyQuizWithAI(fTitle || 'Document', raw, settings);
      setAiQuizResult(res);
    } catch (err) {
      console.error('Quiz generation error:', err);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const toggleQuizAnswer = (idx: number) => {
    setRevealedQuizAnswers((prev) => ({ ...prev, [idx]: !prev[idx] }));
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

  // Filter & sort docs list (pinned items always at the top)
  const q = searchQ.toLowerCase();
  const filteredDocs = docs
    .filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (tagFilter && !d.tags.some((t) => t.toLowerCase().includes(tagFilter.toLowerCase()))) return false;
      if (q && !d.title.toLowerCase().includes(q) && !d.content.toLowerCase().includes(q) && !d.tags.join(' ').toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

  const allTags = Array.from(new Set(docs.flatMap((d) => d.tags))).sort();
  const hasEditor = isCreating || selectedDoc;

  // Connected entity labels for metadata bar
  const linkedDream = dreams.find((d) => d.id === fDreamId);
  const linkedGoal = goals.find((g) => g.id === fGoalId);
  const linkedProject = projects.find((p) => p.id === fProjectId);
  const linkedTask = tasks.find((t) => t.id === fTaskId);

  if (!isLoaded) {
    return <div className={styles.page}><p style={{ color: 'var(--color-text-muted)' }}>Loading Knowledge Base...</p></div>;
  }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Personal Knowledge Base</h1>
          <p className={styles.subtitle}>
            <em style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '12px' }}>
              &ldquo;If you write down a problem clearly and specifically, you have already solved half of it.&rdquo;
            </em>
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
          <button
            className={styles.btnSecondary}
            onClick={() => importFileRef.current?.click()}
            disabled={isImporting}
            title="Import PDF or text document and extract text automatically"
          >
            {isImporting ? (importStatus || 'Importing...') : 'Import File'}
          </button>
          <button className={styles.btnCreate} onClick={handleNewDoc}>
            + New Document
          </button>
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

          <div className={styles.filterRow}>
            <div className={styles.statusChips}>
              {(['all', 'active', 'draft', 'archived'] as const).map((s) => (
                <button
                  key={s}
                  className={`${styles.statusChip} ${statusFilter === s ? styles.statusChipActive : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {allTags.length > 0 && (
              <select className={styles.tagDropdown} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                <option value="">All Tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>

          {/* Documents Linear List */}
          <div className={styles.docList}>
            {filteredDocs.length === 0 ? (
              <div className={styles.emptyList}>
                <FileText size={24} style={{ color: 'var(--color-text-faint)', marginBottom: '6px' }} />
                <p>No documents found</p>
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isActive = doc.id === selectedId;
                const statusColor = doc.status === 'active' ? '#22d3a5' : doc.status === 'draft' ? '#7c6fff' : '#64748b';

                return (
                  <div
                    key={doc.id}
                    className={`${styles.docRow} ${isActive ? styles.docRowActive : ''}`}
                    style={{ borderLeft: `3px solid ${isActive ? statusColor : 'transparent'}` }}
                    onClick={() => {
                      setSelectedId(doc.id);
                      setIsCreating(false);
                      setMobileTab('editor');
                      setAiSummaryResult(null);
                      setAiQuizResult(null);
                    }}
                  >
                    <div className={styles.docRowContent}>
                      <div className={styles.docRowTitleRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                          {doc.isPinned && <Pin size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />}
                          <span className={styles.docRowTitle}>{doc.title}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            className={styles.deleteBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinDoc(doc.id);
                            }}
                            title={doc.isPinned ? "Unpin document" : "Pin document to top"}
                            style={{ color: doc.isPinned ? '#f59e0b' : 'var(--color-text-faint)' }}
                          >
                            <Pin size={12} />
                          </button>
                          <button
                            className={styles.deleteBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(doc.id, doc.title);
                            }}
                            title="Delete Document"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className={styles.docRowMeta}>
                        <span className={styles.statusIndicator} style={{ color: statusColor }}>
                          {doc.status}
                        </span>
                        {doc.readStatus === 'completed' ? (
                          <span className={styles.tagPill} style={{ background: 'rgba(34, 211, 165, 0.15)', color: '#22d3a5' }}>
                            ✅ Done
                          </span>
                        ) : (doc.readProgress != null && doc.readProgress > 0) ? (
                          <span className={styles.tagPill} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                            📖 {doc.readProgress}%
                          </span>
                        ) : null}
                        {doc.category && (
                          <span className={styles.tagPill} style={{ background: 'rgba(124, 106, 255, 0.15)', color: 'var(--color-accent-light)' }}>
                            {doc.category}
                          </span>
                        )}
                        {doc.tags.slice(0, 1).map((t) => (
                          <span key={t} className={styles.tagPill}>{t}</span>
                        ))}
                        <Link
                          href={`/focus?docId=${doc.id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: '10px', color: 'var(--color-accent-light)', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600, marginLeft: 'auto' }}
                          title="Study in Focus Mode"
                        >
                          <BookOpen size={10} /> Study
                        </Link>
                      </div>

                      {/* Mini Progress Bar */}
                      {doc.readProgress != null && doc.readProgress > 0 && (
                        <div style={{ width: '100%', height: '3px', background: 'var(--color-surface-2)', borderRadius: '99px', overflow: 'hidden', marginTop: '6px' }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, doc.readProgress))}%`,
                              height: '100%',
                              background: doc.readProgress === 100
                                ? '#22d3a5'
                                : 'linear-gradient(90deg, var(--color-accent) 0%, #38bdf8 100%)',
                              borderRadius: '99px'
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
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
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
              {/* Document Action Header */}
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

                  <div className={styles.segmentedControl}>
                    <button
                      className={`${styles.segmentBtn} ${editorMode === 'edit' ? styles.segmentBtnActive : ''}`}
                      onClick={() => setEditorMode('edit')}
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    <button
                      className={`${styles.segmentBtn} ${editorMode === 'preview' ? styles.segmentBtnActive : ''}`}
                      onClick={() => setEditorMode('preview')}
                    >
                      <Eye size={12} /> Preview
                    </button>
                    <button
                      className={`${styles.segmentBtn} ${editorMode === 'book' ? styles.segmentBtnActive : ''}`}
                      onClick={() => setEditorMode('book')}
                      title="Book reading mode — clean, distraction-free"
                    >
                      <BookMarked size={12} /> Book
                    </button>
                  </div>

                  <button
                    className={`${styles.propertiesToggleBtn} ${showMetaSettings ? styles.propertiesToggleBtnActive : ''}`}
                    onClick={() => setShowMetaSettings(!showMetaSettings)}
                  >
                    <Link2 size={12} /> Properties {showMetaSettings ? '▴' : '▾'}
                  </button>
                </div>

                <div className={styles.canvasActionsRight}>
                  {selectedDoc && (
                    <span className={styles.lastSavedText}>
                      <Clock size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                      Saved {new Date(selectedDoc.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}

                  {/* AI Knowledge Tools Suite (Works in all modes: Book, Edit, Preview) */}
                  <button
                    type="button"
                    className={`${styles.headerBtn} ${styles.headerAiBtn}`}
                    onClick={() => setAiModalOpen(true)}
                    title="AI Note Tools: Auto-Format, Executive Summary, Study Quiz"
                  >
                    <Sparkles size={13} className={styles.aiSparkleIcon} />
                    <span>AI Tools</span>
                  </button>

                  {/* Direct Ask AI Assistant button */}
                  <button
                    type="button"
                    className={styles.headerBtn}
                    onClick={handleOpenAiChatForDoc}
                    title="Ask AI Assistant about this document"
                  >
                    <Bot size={13} />
                    <span>Ask AI</span>
                  </button>

                  {/* Export PDF Button */}
                  <button
                    type="button"
                    className={styles.headerBtn}
                    onClick={handleExportPdf}
                    title="Export as Formal PDF Document"
                  >
                    <Printer size={12} /> PDF
                  </button>

                  {/* Copy Text Button */}
                  <button
                    type="button"
                    className={styles.headerBtn}
                    onClick={handleCopyText}
                    title="Copy Document Text"
                  >
                    {copied ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>

                  {selectedDoc && (
                    <EntityFiles
                      variant="button"
                      className={styles.headerBtn}
                      entityType="knowledge"
                      entityId={selectedDoc.id}
                      title={selectedDoc.title}
                    />
                  )}
                  <button className={styles.btnSave} onClick={handleSave}>
                    <Save size={13} /> Save
                  </button>
                </div>
              </div>

              {/* Collapsible Linear Properties Bar */}
              {showMetaSettings && (
                <div className={styles.propertiesBar}>
                  <div className={styles.propItem}>
                    <label className={styles.propLabel}>Status</label>
                    <select
                      className={styles.propSelect}
                      value={fStatus}
                      onChange={(e) => setFStatus(e.target.value as DocumentStatus)}
                    >
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  <div className={styles.propItem}>
                    <label className={styles.propLabel}>Category</label>
                    <select
                      className={styles.propSelect}
                      value={fCategory}
                      onChange={(e) => setFCategory(e.target.value as DocumentCategory)}
                    >
                      <option value="general">General</option>
                      <option value="learning">🧠 Learning &amp; Study</option>
                      <option value="guides">📖 Guides &amp; Manuals</option>
                      <option value="ideas">💡 Ideas &amp; Insights</option>
                      <option value="reference">📚 Reference</option>
                    </select>
                  </div>

                  <div className={styles.propItem}>
                    <label className={styles.propLabel}>Reading Status</label>
                    <select
                      className={styles.propSelect}
                      value={fReadStatus}
                      onChange={(e) => {
                        const next = e.target.value as DocumentReadStatus;
                        setFReadStatus(next);
                        if (next === 'completed') setFReadProgress(100);
                      }}
                    >
                      <option value="to-read">⏳ To Read</option>
                      <option value="reading">📖 Currently Reading</option>
                      <option value="completed">✅ Completed</option>
                    </select>
                  </div>

                  <div className={styles.propItem}>
                    <label className={styles.propLabel}>Reading Progress ({fReadProgress}%)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={fReadProgress}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setFReadProgress(val);
                          if (val === 100) setFReadStatus('completed');
                          else if (val > 0 && fReadStatus === 'to-read') setFReadStatus('reading');
                        }}
                        style={{ flex: 1, accentColor: 'var(--color-accent)' }}
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={fReadProgress}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                          setFReadProgress(val);
                          if (val === 100) setFReadStatus('completed');
                          else if (val > 0 && fReadStatus === 'to-read') setFReadStatus('reading');
                        }}
                        style={{ width: '48px', textAlign: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', fontSize: '12px', padding: '2px 4px' }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>%</span>
                    </div>
                  </div>

                  <div className={styles.propItem}>
                    <label className={styles.propLabel}>Page Tracker (Optional)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Page</span>
                      <input
                        type="number"
                        min="0"
                        value={fCurrentPage ?? ''}
                        placeholder="Current"
                        onChange={(e) => {
                          const cur = e.target.value ? parseInt(e.target.value) : undefined;
                          setFCurrentPage(cur);
                          if (cur && fTotalPages && fTotalPages > 0) {
                            setFReadProgress(Math.min(100, Math.round((cur / fTotalPages) * 100)));
                          }
                        }}
                        style={{ width: '60px', textAlign: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', fontSize: '12px', padding: '2px 4px' }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>of</span>
                      <input
                        type="number"
                        min="1"
                        value={fTotalPages ?? ''}
                        placeholder="Total"
                        onChange={(e) => {
                          const tot = e.target.value ? parseInt(e.target.value) : undefined;
                          setFTotalPages(tot);
                          if (fCurrentPage && tot && tot > 0) {
                            setFReadProgress(Math.min(100, Math.round((fCurrentPage / tot) * 100)));
                          }
                        }}
                        style={{ width: '60px', textAlign: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', fontSize: '12px', padding: '2px 4px' }}
                      />
                    </div>
                  </div>

                  <div className={styles.propItem}>
                    <label className={styles.propLabel}>Pin</label>
                    <button
                      type="button"
                      className={styles.propSelect}
                      onClick={() => setFIsPinned(!fIsPinned)}
                      style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Pin size={12} style={{ color: fIsPinned ? '#f59e0b' : 'inherit' }} />
                      <span>{fIsPinned ? 'Pinned 📌' : 'Unpinned'}</span>
                    </button>
                  </div>

                  <div className={styles.propItem}>
                    <label className={styles.propLabel}>Tags</label>
                    <input
                      type="text"
                      className={styles.propInput}
                      value={fTags}
                      onChange={(e) => setFTags(e.target.value)}
                      placeholder="design, tech..."
                    />
                  </div>

                  <div className={styles.propItem}>
                    <label className={styles.propLabel}>Connected Goal</label>
                    <select
                      className={styles.propSelect}
                      value={fGoalId}
                      onChange={(e) => setFGoalId(e.target.value)}
                    >
                      <option value="">None</option>
                      {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                    </select>
                  </div>

                  <div className={styles.propItem}>
                    <label className={styles.propLabel}>Connected Project</label>
                    <select
                      className={styles.propSelect}
                      value={fProjectId}
                      onChange={(e) => setFProjectId(e.target.value)}
                    >
                      <option value="">None</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Connected Metadata Badges (Formal Linear Bar) */}
              {(linkedDream || linkedGoal || linkedProject || linkedTask) && !showMetaSettings && (
                <div className={styles.linkedBadgesBar}>
                  {linkedDream && (
                    <span className={styles.linkedBadge}>
                      <Sparkles size={11} /> Dream: {linkedDream.title}
                    </span>
                  )}
                  {linkedGoal && (
                    <span className={styles.linkedBadge}>
                      <Target size={11} /> Goal: {linkedGoal.title}
                    </span>
                  )}
                  {linkedProject && (
                    <span className={styles.linkedBadge}>
                      <FolderKanban size={11} /> Project: {linkedProject.title}
                    </span>
                  )}
                  {linkedTask && (
                    <span className={styles.linkedBadge}>
                      <CheckSquare size={11} /> Task: {linkedTask.title}
                    </span>
                  )}
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
                  onInsertTemplate={handleInsertTemplate}
                  onAiFormat={handleAiFormat}
                  isAiFormatting={isAiFormatting}
                />
              )}

              {/* Live WYSIWYG Rich Editor Canvas (Google Docs / Word Style) */}
              {editorMode === 'edit' ? (
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className={styles.richEditor}
                  data-placeholder="Start typing your notes here... Select any text and click a color swatch to highlight it live in color!"
                  dangerouslySetInnerHTML={{ __html: getRichHtml(selectedDoc?.content || fContent || '') }}
                  onInput={() => {
                    if (editorRef.current && !isInternalChange.current) {
                      setFContent(editorRef.current.innerHTML);
                    }
                  }}
                  onBlur={() => {
                    if (editorRef.current) {
                      setFContent(editorRef.current.innerHTML);
                    }
                  }}
                />
              ) : editorMode === 'preview' ? (
                <div
                  className={styles.previewCanvas}
                  dangerouslySetInnerHTML={{
                    __html: fContent
                      ? getRichHtml(fContent)
                      : '<p style="color:var(--color-text-faint)">No content to preview.</p>',
                  }}
                />
              ) : (
                /* ── Book Mode with Live Highlighter (Locked / Read-Only) ── */
                <div className={styles.bookWrapper}>
                  {/* Sticky Book Highlighter Bar */}
                  <div className={styles.bookHighlighterBar}>
                    <div className={styles.bookHighlighterGroup}>
                      <span className={styles.bookLockBadge} title="Book Mode is locked for reading. Edits are disabled, highlighting is enabled.">
                        <Lock size={12} /> Locked · Read Only
                      </span>
                      <div className={styles.bookHighlighterDivider} />
                      <span className={styles.bookHighlighterLabel}>
                        <Highlighter size={12} style={{ color: 'var(--color-accent)' }} /> Highlighter
                      </span>
                      <div className={styles.bookSwatches}>
                        {HIGHLIGHT_COLORS.slice(0, 5).map((c) => (
                          <button
                            key={c.name}
                            type="button"
                            className={`${styles.bookSwatch} ${activeHighlightColor === c.name ? styles.bookSwatchActive : ''}`}
                            style={{
                              background: c.bg,
                              borderColor: c.border,
                              '--swatch-border': c.border,
                            } as React.CSSProperties}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleHighlight(c.name, false)}
                            title={`Highlight selected text: ${c.label}`}
                            aria-label={`Highlight ${c.label}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className={styles.bookHighlighterGroup}>
                      <button
                        type="button"
                        className={styles.bookBtnSmall}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleHighlight(activeHighlightColor, false)}
                        title="Highlight selected text"
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR_MAP[activeHighlightColor]?.border || '#fbbf24', display: 'inline-block' }} />
                        Highlight Selection
                      </button>
                      <button
                        type="button"
                        className={styles.bookBtnSmall}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleRemoveHighlight}
                        title="Remove highlight from selection"
                      >
                        <Eraser size={12} /> Clear
                      </button>
                    </div>
                  </div>

                  <div className={styles.bookPage}>
                    <div className={styles.bookTitle}>{fTitle || 'Untitled'}</div>
                    {fTags && (
                      <div className={styles.bookMeta}>
                        {fTags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                          <span key={t} className={styles.bookTag}>{t}</span>
                        ))}
                      </div>
                    )}
                    <div className={styles.bookDivider} />
                    <div
                      ref={bookEditorRef}
                      contentEditable={false}
                      className={styles.bookContent}
                      dangerouslySetInnerHTML={{ __html: getRichHtml(selectedDoc?.content || fContent || '') }}
                    />
                    <div className={styles.bookFooter}>
                      <span>Sariling Mundo · Knowledge Base</span>
                      <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating Selection Highlight Toolbar — colors only, clean */}
      {floatingMenu && (
        <div
          data-floating-toolbar="true"
          className={styles.floatingHighlightMenu}
          style={{ left: `${floatingMenu.x}px`, top: `${floatingMenu.y}px` }}
          onPointerDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
        >
          {HIGHLIGHT_COLORS.slice(0, 8).map((c) => (
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
                handleHighlight(c.name, false);
                setFloatingMenu(null);
              }}
              title={`Highlight ${c.label}`}
              aria-label={`Highlight ${c.label}`}
            />
          ))}
          {/* Eraser — remove highlight */}
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
              handleRemoveHighlight();
              setFloatingMenu(null);
            }}
            title="Remove highlight"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── AI Knowledge Suite Modal ── */}
      {aiModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setAiModalOpen(false)}>
          <div className={styles.aiModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.aiModalHeader}>
              <div className={styles.aiModalTitleGroup}>
                <span className={styles.aiModalBadge}>
                  <Sparkles size={13} /> AI Knowledge Suite
                </span>
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
                <Wand2 size={13} />
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
                <FileText size={13} />
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
                <Brain size={13} />
                <span>Study Quiz</span>
              </button>
              <button
                type="button"
                className={`${styles.aiModalTab} ${aiModalTab === 'ask' ? styles.aiModalTabActive : ''}`}
                onClick={() => setAiModalTab('ask')}
              >
                <Bot size={13} />
                <span>Ask AI</span>
              </button>
            </div>

            <div className={styles.aiModalBody}>
              {/* TAB 1: Format */}
              {aiModalTab === 'format' && (
                <div className={styles.aiToolCard}>
                  <div className={styles.aiToolHeader}>
                    <Wand2 size={20} className={styles.aiToolIcon} />
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
                        await handleAiFormat();
                        setAiModalOpen(false);
                      }}
                      disabled={isAiFormatting}
                    >
                      {isAiFormatting ? <Loader2 size={14} className={styles.spin} /> : <Sparkles size={14} />}
                      <span>{isAiFormatting ? 'Formatting Document...' : 'Run Auto-Format'}</span>
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
                          {insertedSummarySuccess ? <Check size={14} /> : <Plus size={14} />}
                          <span>{insertedSummarySuccess ? 'Inserted at Top!' : 'Insert into Document'}</span>
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={handleCopySummary}
                        >
                          {copiedSummary ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={handleGenerateSummary}
                        >
                          <RotateCcw size={14} />
                          <span>Regenerate</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.aiEmptyState}>
                      <p className={styles.aiToolDesc}>Generate an executive TL;DR, core insights, and next actions for this note.</p>
                      <button
                        type="button"
                        className={styles.btnPrimaryGradient}
                        onClick={handleGenerateSummary}
                      >
                        <Sparkles size={14} /> Generate Executive Summary
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
                        Active recall strengthens memory retention. Tap any question to reveal its answer!
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
                              </div>
                            ) : (
                              <div className={styles.quizTapPrompt}>
                                <span>Tap card to reveal answer ▾</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={handleGenerateQuiz}
                        >
                          <RotateCcw size={13} /> Regenerate Questions
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.aiEmptyState}>
                      <p className={styles.aiToolDesc}>Generate 3 to 4 flashcard-style testing questions from this document.</p>
                      <button
                        type="button"
                        className={styles.btnPrimaryGradient}
                        onClick={handleGenerateQuiz}
                      >
                        <Brain size={14} /> Generate Study Questions
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Ask AI Assistant */}
              {aiModalTab === 'ask' && (
                <div className={styles.aiToolCard}>
                  <div className={styles.aiToolHeader}>
                    <Bot size={22} className={styles.aiToolIcon} />
                    <div>
                      <h3 className={styles.aiToolHeading}>Discuss with AI Assistant</h3>
                      <p className={styles.aiToolDesc}>
                        Opens the floating chat assistant with <strong>&ldquo;{fTitle || 'this document'}&rdquo;</strong> pre-loaded into live context. Ask questions, clarify difficult concepts, or generate action plans connected to your goals.
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
                      <Bot size={14} /> Open AI Assistant Chat
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
