'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { useGoals } from '@/context/GoalContext';
import { useDreams } from '@/context/DreamContext';
import { useProjects } from '@/context/ProjectContext';
import { useTasks } from '@/context/TaskContext';
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
} from 'lucide-react';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';

// ── Simple Markdown Renderer ──────────────────────────────
function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Checkboxes (before list items)
  html = html.replace(/^- \[x\] (.+)$/gm, '<div class="md-check done">&check; $1</div>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<div class="md-check">&square; $1</div>');

  // Unordered list items
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, '<ul>$&</ul>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr/>');

  // Wrap double-newline separated blocks in <p>
  html = html.split(/\n{2,}/).map((block) => {
    if (/^<(h[1-6]|ul|hr|div)/.test(block.trim())) return block;
    return block.trim() ? `<p>${block.trim()}</p>` : '';
  }).join('\n');

  return html;
}

// ── Markdown Toolbar ─────────────────────────────────────
function MarkdownToolbar({ onInsert }: { onInsert: (before: string, after?: string) => void }) {
  const tools = [
    { label: 'H1', before: '# ', after: '' },
    { label: 'H2', before: '## ', after: '' },
    { label: 'H3', before: '### ', after: '' },
    { label: 'B',  before: '**', after: '**' },
    { label: 'I',  before: '*', after: '*' },
    { label: '—',  before: '\n---\n', after: '' },
    { label: 'List', before: '- ', after: '' },
    { label: 'Task', before: '- [ ] ', after: '' },
  ];
  return (
    <div className={styles.toolbar}>
      {tools.map((t) => (
        <button
          key={t.label}
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onInsert(t.before, t.after)}
          title={`Insert ${t.label}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function KnowledgePage() {
  const { docs, isLoaded, addDoc, updateDoc, deleteDoc, resetToDefaultDocs } = useKnowledge();
  const { goals }    = useGoals();
  const { dreams }   = useDreams();
  const { projects } = useProjects();
  const { tasks }    = useTasks();

  const [searchQ, setSearchQ]     = useState('');
  const [tagFilter, setTagFilter]  = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DocumentStatus>('all');

  // Editor state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Default select first doc on initial load if none selected
  useEffect(() => {
    if (isLoaded && docs.length > 0 && !selectedId && !isCreating) {
      setSelectedId(docs[0].id);
    }
  }, [isLoaded, docs, selectedId, isCreating]);

  const selectedDoc = selectedId ? docs.find((d) => d.id === selectedId) ?? null : null;

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
    }
  }, [selectedDoc]);

  const clearEditor = () => {
    setFTitle('');
    setFContent('');
    setFStatus('active');
    setFTags('');
    setFDreamId('');
    setFGoalId('');
    setFProjectId('');
    setFTaskId('');
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

  // Toolbar insert helpers
  const handleInsert = (before: string, after = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const selected = fContent.slice(start, end);
    const newContent = fContent.slice(0, start) + before + selected + after + fContent.slice(end);
    setFContent(newContent);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
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
        <div style={{ display: 'flex', gap: '8px' }}>
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
                Select a document or create a new entry
              </p>
              <button className={styles.btnCreate} style={{ marginTop: '12px' }} onClick={handleNewDoc}>
                <Plus size={15} /> New Document
              </button>
            </div>
          ) : (
            <div className={styles.editorWrapper}>
              {/* Document Action Header */}
              <div className={styles.canvasHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    className={styles.modeToggle}
                    style={editorMode === 'edit' ? { color: 'var(--color-accent)', fontWeight: 700 } : {}}
                    onClick={() => setEditorMode('edit')}
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <span style={{ color: 'var(--color-border)' }}>|</span>
                  <button
                    className={styles.modeToggle}
                    style={editorMode === 'preview' ? { color: 'var(--color-accent)', fontWeight: 700 } : {}}
                    onClick={() => setEditorMode('preview')}
                  >
                    <Eye size={13} /> Preview
                  </button>
                  <span style={{ color: 'var(--color-border)' }}>|</span>
                  <button
                    className={styles.modeToggle}
                    style={showMetaSettings ? { color: 'var(--color-accent)', fontWeight: 700 } : {}}
                    onClick={() => setShowMetaSettings(!showMetaSettings)}
                  >
                    <Link2 size={13} /> Properties {showMetaSettings ? '▴' : '▾'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedDoc && (
                    <span className={styles.lastSavedText}>
                      <Clock size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                      Saved {new Date(selectedDoc.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
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
                <MarkdownToolbar onInsert={handleInsert} />
              )}

              {/* Writing Canvas */}
              {editorMode === 'edit' ? (
                <textarea
                  ref={textareaRef}
                  className={styles.writingArea}
                  value={fContent}
                  onChange={(e) => setFContent(e.target.value)}
                  placeholder={`# Title\n\nStart writing formal document notes, concepts, and specifications here...\n\nMarkdown supported: **Bold**, *Italic*, # Headings, - Lists, - [ ] Checkboxes.`}
                />
              ) : (
                <div
                  className={styles.previewCanvas}
                  dangerouslySetInnerHTML={{
                    __html: fContent
                      ? renderMarkdown(fContent)
                      : '<p style="color:var(--color-text-faint)">No document content to preview.</p>',
                  }}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
