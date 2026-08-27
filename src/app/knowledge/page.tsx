'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { useGoals } from '@/context/GoalContext';
import { useDreams } from '@/context/DreamContext';
import { useProjects } from '@/context/ProjectContext';
import { useTasks } from '@/context/TaskContext';
import { extractTextFromFile } from '@/utils/fileImporter';
import type { KnowledgeDocument, DocumentStatus } from '@/types';
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
} from 'lucide-react';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';
import { useSettings } from '@/context/SettingsContext';
import { formatStudyNotesWithAI } from '@/utils/noteAutoFormatter';

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

  // Numbered list items
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ol-item"><span class="ol-num">$1.</span>$2</li>');
  html = html.replace(/(<li class="ol-item">[\s\S]*?<\/li>\n?)+/g, '<ol>$&</ol>');

  // Unordered list items
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
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

        {/* AI & Template Actions */}
        <button
          type="button"
          className={`${styles.toolbarBtn} ${styles.aiFormatBtn}`}
          onClick={onAiFormat}
          disabled={isAiFormatting}
          title="Auto-format and organize notes"
        >
          {isAiFormatting ? <Loader2 size={11} className={styles.spin} /> : <Wand2 size={11} />}
          <span>{isAiFormatting ? 'Formatting...' : 'AI Format'}</span>
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${styles.templateBtn}`}
          onClick={onInsertTemplate}
          title="Insert Executive Document Template"
        >
          <FileText size={11} style={{ marginRight: 3 }} /> Template
        </button>
      </div>

      {/* Row 2: Formal Color Highlight Palette */}
      <div className={styles.colorPaletteRow}>
        <span className={styles.colorPaletteLabel}>Highlight</span>
        <div className={styles.colorSwatches}>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              className={`${styles.colorSwatch} ${activeColor === c.name ? styles.colorSwatchActive : ''}`}
              style={{
                background: c.bg,
                borderColor: c.border,
                '--swatch-border': c.border,
              } as React.CSSProperties}
              onClick={() => {
                onSetActiveColor(c.name);
                onHighlight(c.name, false);
              }}
              title={`Highlight: ${c.label}`}
              aria-label={`Highlight ${c.label}`}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <button
            type="button"
            className={styles.clearHighlightBtn}
            onClick={onRemoveHighlight}
            title="Remove highlight from selected text"
          >
            <Eraser size={12} style={{ marginRight: 4 }} /> Clear
          </button>
          <button
            type="button"
            className={styles.applyHighlightBtn}
            style={{ background: activeColorDef.bg, borderColor: activeColorDef.border, color: activeColorDef.text }}
            onClick={() => onHighlight(activeColor, true)}
            title={`Apply ${activeColorDef.label} highlight to selected text`}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeColorDef.border, display: 'inline-block', marginRight: 5 }} />
            Apply {activeColorDef.label}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function KnowledgePage() {
  const { docs, isLoaded, addDoc, updateDoc, deleteDoc, resetToDefaultDocs } = useKnowledge();
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
  const [editorMode, setEditorMode] = useState<'edit' | 'preview' | 'book'>('edit');
  const [isCreating, setIsCreating] = useState(false);
  const [showMetaSettings, setShowMetaSettings] = useState(false);

  // Form fields
  const [fTitle, setFTitle]           = useState('');
  const [fContent, setFContent]       = useState('');
  const [fStatus, setFStatus]         = useState<DocumentStatus>('active');
  const [fTags, setFTags]             = useState('');
  const [fDreamId, setFDreamId]       = useState('');
  const [fGoalId, setFGoalId]         = useState('');
  const [fProjectId, setFProjectId]   = useState('');
  const [fTaskId, setFTaskId]         = useState('');

  const editorRef = useRef<HTMLDivElement>(null);
  const bookEditorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

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
      setEditorMode('preview');
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

  // Helper to convert content into rich HTML for live editing
  const getRichHtml = (content: string) => {
    if (!content) return '';
    // If it already looks like HTML (has tags), return it directly
    if (/<(p|h[1-6]|ul|ol|li|div|blockquote|mark|span|strong|em|table|hr)[^>]*>/i.test(content)) {
      return content;
    }
    // Otherwise convert markdown to HTML
    return renderMarkdown(content);
  };

  // Load doc into editor
  useEffect(() => {
    if (selectedDoc) {
      setFTitle(selectedDoc.title);
      setFContent(selectedDoc.content);
      setFStatus(selectedDoc.status);
      setFTags(selectedDoc.tags.join(', '));
      setFDreamId(selectedDoc.linkedDreamId || '');
      setFGoalId(selectedDoc.linkedGoalId || '');
      setFProjectId(selectedDoc.linkedProjectId || '');
      setFTaskId(selectedDoc.linkedTaskId || '');
      setEditorMode('edit');

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
  useEffect(() => {
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
  };

  const handleSave = () => {
    if (!fTitle.trim()) return;
    const tags = fTags.split(',').map((t) => t.trim()).filter(Boolean);
    const payload = {
      title: fTitle.trim(),
      content: fContent,
      status: fStatus,
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
            <span>Life OS &bull; Formal Knowledge Asset</span>
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
          <span>Life OS Formal Documentation System</span>
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

    if (editorRef.current) {
      setFContent(editorRef.current.innerHTML);
    }
  };

  // Live Color Highlighter (works in both Live Editor and Book View)
  const handleHighlight = (colorName: string, forceApply = false) => {
    setActiveHighlightColor(colorName);
    const editor = editorMode === 'book' ? bookEditorRef.current : editorRef.current;
    if (!editor) return;
    editor.focus();

    const sel = window.getSelection();
    const c = COLOR_MAP[colorName] || HIGHLIGHT_COLORS[0];

    // If nothing selected and forceApply clicked
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      if (forceApply) {
        document.execCommand('insertHTML', false, `<mark class="highlight-mark" style="background:${c.bg};border:1px solid ${c.border};color:${c.text};border-radius:3px;padding:1px 5px;font-weight:600;">highlighted text</mark>&nbsp;`);
        setFContent(editor.innerHTML);
        if (selectedDoc) {
          updateDoc(selectedDoc.id, { content: editor.innerHTML });
        }
      }
      return;
    }

    const range = sel.getRangeAt(0);
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
      mark.appendChild(frag);
      range.insertNode(mark);
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(mark);
      sel.addRange(newRange);
    } catch {
      document.execCommand('hiliteColor', false, c.bg);
    }

    setFContent(editor.innerHTML);
    if (selectedDoc) {
      updateDoc(selectedDoc.id, { content: editor.innerHTML });
    }
  };

  // Remove highlight on selection in Editor or Book Mode
  const handleRemoveHighlight = () => {
    const editor = editorMode === 'book' ? bookEditorRef.current : editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    try {
      const range = sel.getRangeAt(0);
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
        if (sel.containsNode(m, true)) {
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

    try {
      document.execCommand('hiliteColor', false, 'transparent');
      document.execCommand('removeFormat');
    } catch {}

    setFContent(editor.innerHTML);
    if (selectedDoc) {
      updateDoc(selectedDoc.id, { content: editor.innerHTML });
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

  // Filter docs list
  const q = searchQ.toLowerCase();
  const filteredDocs = docs.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (tagFilter && !d.tags.some((t) => t.toLowerCase().includes(tagFilter.toLowerCase()))) return false;
    if (q && !d.title.toLowerCase().includes(q) && !d.content.toLowerCase().includes(q) && !d.tags.join(' ').toLowerCase().includes(q)) return false;
    return true;
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
            Formal reference notes, research, game designs, and documents connected directly to your life domains.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="file"
            ref={importFileRef}
            style={{ display: 'none' }}
            accept=".pdf,.txt,.md,.doc,.docx,.csv,.json,.html"
            onChange={handleImportFile}
          />
          <button
            className={styles.btnSecondary}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => importFileRef.current?.click()}
            disabled={isImporting}
            title="Import PDF or text document and extract text automatically"
          >
            {isImporting ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
            {isImporting ? (importStatus || 'Importing...') : 'Import PDF / File'}
          </button>
          <button className={styles.btnCreate} onClick={handleNewDoc}>
            <Plus size={16} /> New Document
          </button>
        </div>
      </header>

      {/* ── Workbench Layout (No nested boxes) ── */}
      <div className={styles.workbench}>
        {/* ── Left: Document List (Clean Linear Rows) ── */}
        <aside className={styles.sidebar}>
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
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
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
                    }}
                  >
                    <div className={styles.docRowContent}>
                      <div className={styles.docRowTitleRow}>
                        <span className={styles.docRowTitle}>{doc.title}</span>
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

                      <div className={styles.docRowMeta}>
                        <span className={styles.statusIndicator} style={{ color: statusColor }}>
                          {doc.status}
                        </span>
                        {doc.tags.slice(0, 2).map((t) => (
                          <span key={t} className={styles.tagPill}>{t}</span>
                        ))}
                        <span className={styles.dateStamp}>
                          {new Date(doc.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Right: Clean Editorial Document Canvas ── */}
        <main className={styles.editorCanvas}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    className={`${styles.modeToggle} ${editorMode === 'edit' ? styles.modeToggleActive : ''}`}
                    onClick={() => setEditorMode('edit')}
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <span style={{ color: 'var(--color-border)' }}>|</span>
                  <button
                    className={`${styles.modeToggle} ${editorMode === 'preview' ? styles.modeToggleActive : ''}`}
                    onClick={() => setEditorMode('preview')}
                  >
                    <Eye size={13} /> Preview
                  </button>
                  <span style={{ color: 'var(--color-border)' }}>|</span>
                  <button
                    className={`${styles.modeToggle} ${editorMode === 'book' ? styles.modeToggleActive : ''}`}
                    onClick={() => setEditorMode('book')}
                    title="Book reading mode — clean, distraction-free"
                  >
                    <BookMarked size={13} /> Book
                  </button>
                  <span style={{ color: 'var(--color-border)' }}>|</span>
                  <button
                    className={`${styles.modeToggle} ${showMetaSettings ? styles.modeToggleActive : ''}`}
                    onClick={() => setShowMetaSettings(!showMetaSettings)}
                  >
                    <Link2 size={13} /> Properties {showMetaSettings ? '▴' : '▾'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {selectedDoc && (
                    <span className={styles.lastSavedText}>
                      <Clock size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                      Saved {new Date(selectedDoc.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  
                  {/* AI Format Button in Header */}
                  <button
                    type="button"
                    className={`${styles.btnSecondary} ${styles.aiFormatBtn}`}
                    onClick={handleAiFormat}
                    disabled={isAiFormatting}
                    title="AI Auto-Correct Spacing & Organize into Formal Study Notes"
                  >
                    {isAiFormatting ? <Loader2 size={12} className={styles.spin} /> : <Sparkles size={12} />}
                    {isAiFormatting ? 'Formatting...' : 'AI Format'}
                  </button>

                  {/* Export PDF Button */}
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={handleExportPdf}
                    title="Export as Formal PDF Document"
                  >
                    <Printer size={12} /> PDF
                  </button>

                  {/* Copy Text Button */}
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={handleCopyText}
                    title="Copy Document Text"
                  >
                    {copied ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>

                  {selectedDoc && (
                    <EntityFiles variant="button" entityType="knowledge" entityId={selectedDoc.id} title={selectedDoc.title} />
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

              {/* Document Title (Formal Distraction-Free Typography) */}
              <input
                type="text"
                className={styles.docTitle}
                placeholder="Untitled Document"
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
              />

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
                /* ── Book Mode with Live Highlighter ── */
                <div className={styles.bookWrapper}>
                  {/* Sticky Book Highlighter Bar */}
                  <div className={styles.bookHighlighterBar}>
                    <div className={styles.bookHighlighterGroup}>
                      <span className={styles.bookHighlighterLabel}>
                        <Highlighter size={13} style={{ color: 'var(--color-accent)' }} /> Highlighter
                      </span>
                      <div className={styles.bookSwatches}>
                        {HIGHLIGHT_COLORS.map((c) => (
                          <button
                            key={c.name}
                            type="button"
                            className={`${styles.bookSwatch} ${activeHighlightColor === c.name ? styles.bookSwatchActive : ''}`}
                            style={{
                              background: c.bg,
                              borderColor: c.border,
                              '--swatch-border': c.border,
                            } as React.CSSProperties}
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
                        onClick={() => handleHighlight(activeHighlightColor, true)}
                        title="Apply active highlight"
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR_MAP[activeHighlightColor]?.border || '#fbbf24', display: 'inline-block' }} />
                        Highlight
                      </button>
                      <button
                        type="button"
                        className={styles.bookBtnSmall}
                        onClick={handleRemoveHighlight}
                        title="Remove highlight from selection"
                      >
                        <Eraser size={12} /> Clear
                      </button>
                      <button
                        type="button"
                        className={`${styles.bookBtnSmall} ${styles.aiFormatBtn}`}
                        onClick={handleAiFormat}
                        disabled={isAiFormatting}
                        title="AI Organize & Format Document"
                      >
                        {isAiFormatting ? <Loader2 size={11} className={styles.spin} /> : <Wand2 size={11} />}
                        <span>AI Format</span>
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
                      contentEditable
                      suppressContentEditableWarning
                      className={styles.bookContent}
                      data-placeholder="Start typing or select text to highlight..."
                      onInput={() => {
                        if (bookEditorRef.current && !isInternalChange.current) {
                          setFContent(bookEditorRef.current.innerHTML);
                          if (selectedDoc) {
                            updateDoc(selectedDoc.id, { content: bookEditorRef.current.innerHTML });
                          }
                        }
                      }}
                      onBlur={() => {
                        if (bookEditorRef.current) {
                          setFContent(bookEditorRef.current.innerHTML);
                          if (selectedDoc) {
                            updateDoc(selectedDoc.id, { content: bookEditorRef.current.innerHTML });
                          }
                        }
                      }}
                    />
                    <div className={styles.bookFooter}>
                      <span>Life OS · Knowledge Base</span>
                      <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
                    </div>
                  </div>

                  {/* ADHD Legend */}
                  <div className={styles.adhdLegend}>
                    <span className={styles.legendTitle}>Color Guide</span>
                    <span className={styles.legendItem}><mark className={styles.legendHighlight}>==highlight==</mark> Remember this</span>
                    <span className={styles.legendItem}><span className={styles.legendImportant}>⚡ !!important!!</span> Must know</span>
                    <span className={styles.legendItem}><span className={styles.legendKeyIdea}>💡 &gt;&gt;&gt;key idea&lt;&lt;&lt;</span> Core concept</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
