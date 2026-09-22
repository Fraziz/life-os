'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Clock,
  Flame,
  Coffee,
  Zap,
  CheckSquare,
  Square,
  History,
  Target,
  Plus,
  X,
  ArrowRight,
  Sparkles,
  Volume2,
  VolumeX,
  Wand2,
  Send,
  CloudRain,
  Waves,
  Radio,
  BookOpen,
  BookMarked,
  Highlighter,
  Eraser,
  Lock,
  Check,
  Search,
  ExternalLink,
  FileText,
  Pin,
} from 'lucide-react';
import { useFocus } from '@/context/FocusContext';
import { useTasks } from '@/context/TaskContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useInbox } from '@/context/InboxContext';
import { useKnowledge } from '@/context/KnowledgeContext';
import {
  playSuccessChime,
  playSubtaskTick,
  playTimerCompleteFanfare,
  triggerDopamineBurst,
  startAmbientSound,
  stopAmbientSound,
  setAmbientVolume,
  type AmbientSoundType,
} from '@/utils/soundAndDopamine';
import { generateMicroBreakdown } from '@/utils/adhdBreakdown';
import type { Task, FocusModeType, KnowledgeDocument } from '@/types';
import styles from './page.module.css';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const HIGHLIGHT_COLORS = [
  { name: 'yellow', label: 'Yellow', bg: 'rgba(251, 191, 36, 0.35)', border: '#f59e0b', text: 'inherit' },
  { name: 'green', label: 'Green', bg: 'rgba(52, 211, 153, 0.35)', border: '#10b981', text: 'inherit' },
  { name: 'blue', label: 'Blue', bg: 'rgba(96, 165, 250, 0.35)', border: '#3b82f6', text: 'inherit' },
  { name: 'pink', label: 'Pink', bg: 'rgba(244, 114, 182, 0.35)', border: '#ec4899', text: 'inherit' },
  { name: 'purple', label: 'Purple', bg: 'rgba(192, 132, 252, 0.35)', border: '#a855f7', text: 'inherit' },
  { name: 'orange', label: 'Orange', bg: 'rgba(251, 146, 60, 0.35)', border: '#f97316', text: 'inherit' },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  yellow: HIGHLIGHT_COLORS[0],
  green: HIGHLIGHT_COLORS[1],
  blue: HIGHLIGHT_COLORS[2],
  pink: HIGHLIGHT_COLORS[3],
  purple: HIGHLIGHT_COLORS[4],
  orange: HIGHLIGHT_COLORS[5],
};

export default function FocusPage() {
  const {
    activeTask,
    activeDoc,
    activeTargetType,
    customTaskTitle,
    mode,
    timerDurationSeconds,
    secondsRemaining,
    secondsElapsed,
    isRunning,
    isZenMode,
    focusHistory,
    startTimer,
    pauseTimer,
    resetTimer,
    finishSession,
    selectFocusTask,
    selectFocusDoc,
    setTimerMode,
    toggleZenMode,
    clearFocusHistory,
    isLoaded,
  } = useFocus();

  const { docs, updateDoc, addDoc } = useKnowledge();
  const { tasks, toggleSubtask, breakdownTask } = useTasks();
  const { goals } = useGoals();
  const { projects } = useProjects();
  const { quickDump } = useInbox();

  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [targetTab, setTargetTab] = useState<'tasks' | 'knowledge'>('tasks');
  const [targetSearchQuery, setTargetSearchQuery] = useState('');

  const [focusViewMode, setFocusViewMode] = useState<'timer' | 'book'>('book');
  const [customMinInput, setCustomMinInput] = useState('30');
  const [finishNotes, setFinishNotes] = useState('');
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [markDoneOnFinish, setMarkDoneOnFinish] = useState(true);

  // Live Highlighter State in Focus Mode
  const [activeHighlightColor, setActiveHighlightColor] = useState('yellow');
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [floatingMenu, setFloatingMenu] = useState<{ x: number; y: number } | null>(null);
  const bookContainerRef = useRef<HTMLDivElement>(null);

  // ADHD Superpowers state
  const [ambientSound, setAmbientSound] = useState<AmbientSoundType>('off');
  const [ambientVol, setAmbientVol] = useState(0.35);
  const [parkingLotInput, setParkingLotInput] = useState('');
  const [parkedNotice, setParkedNotice] = useState(false);

  // Cleanup ambient sound on unmount
  useEffect(() => {
    return () => {
      stopAmbientSound();
    };
  }, []);

  // Escape key to exit Zen Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZenMode) {
        toggleZenMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode, toggleZenMode]);

  // Sync content into book container ref whenever activeDoc or focusViewMode changes
  const getRichHtml = (content: string) => {
    if (!content) return '';
    if (/<[a-z][^>]*>/i.test(content)) return content;
    let html = content
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');
    return `<p>${html}</p>`;
  };

  useEffect(() => {
    if (activeDoc && bookContainerRef.current) {
      bookContainerRef.current.innerHTML = getRichHtml(activeDoc.content || '');
    }
  }, [activeDoc, focusViewMode]);

  // Floating mouse selection toolbar handler
  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (
        sel &&
        !sel.isCollapsed &&
        sel.rangeCount > 0 &&
        bookContainerRef.current &&
        bookContainerRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)
      ) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setFloatingMenu({
          x: Math.max(10, rect.left + rect.width / 2 - 100),
          y: Math.max(10, rect.top - 48 + window.scrollY),
        });
      } else {
        setFloatingMenu(null);
      }
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const triggerSaveToast = () => {
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 2000);
  };

  const handleHighlightInFocus = (colorName: string) => {
    setActiveHighlightColor(colorName);
    const container = bookContainerRef.current;
    if (!container || !activeDoc) return;

    const sel = window.getSelection();
    const c = COLOR_MAP[colorName] || HIGHLIGHT_COLORS[0];

    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return;

    let cur: Node | null = range.commonAncestorContainer;
    while (cur && cur !== container) {
      if (cur.nodeName === 'MARK') {
        const markEl = cur as HTMLElement;
        markEl.style.background = c.bg;
        markEl.style.border = `1px solid ${c.border}`;
        markEl.style.color = c.text;
        const saved = container.innerHTML;
        updateDoc(activeDoc.id, { content: saved });
        triggerSaveToast();
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
      sel.removeAllRanges();
    } catch {
      try {
        document.execCommand('hiliteColor', false, c.bg);
      } catch {}
    }

    const saved = container.innerHTML;
    updateDoc(activeDoc.id, { content: saved });
    triggerSaveToast();
  };

  const handleRemoveHighlightInFocus = () => {
    const container = bookContainerRef.current;
    if (!container || !activeDoc) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return;

    let cur: Node | null = range.commonAncestorContainer;
    while (cur && cur !== container) {
      if (cur.nodeName === 'MARK') {
        const markEl = cur as HTMLElement;
        const parent = markEl.parentNode;
        while (markEl.firstChild) {
          parent?.insertBefore(markEl.firstChild, markEl);
        }
        parent?.removeChild(markEl);
        const saved = container.innerHTML;
        updateDoc(activeDoc.id, { content: saved });
        triggerSaveToast();
        return;
      }
      cur = cur.parentNode;
    }
  };

  const handleManualSave = () => {
    const container = bookContainerRef.current;
    if (container && activeDoc) {
      updateDoc(activeDoc.id, { content: container.innerHTML });
      triggerSaveToast();
    }
  };

  const handleAmbientToggle = (type: AmbientSoundType) => {
    if (ambientSound === type) {
      setAmbientSound('off');
      stopAmbientSound();
    } else {
      setAmbientSound(type);
      startAmbientSound(type, ambientVol);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setAmbientVol(v);
    setAmbientVolume(v);
  };

  // Live active task derived from TaskContext to ensure reactive subtask sync
  const liveActiveTask = activeTask ? tasks.find((t) => t.id === activeTask.id) || activeTask : null;

  const handleMagicBreakdown = () => {
    if (!liveActiveTask) return;
    const generated = generateMicroBreakdown(liveActiveTask.title, liveActiveTask.description);
    breakdownTask(liveActiveTask.id, generated);
    playSuccessChime();
    triggerDopamineBurst();
  };

  const handleSubtaskCheck = (e: React.MouseEvent, subtaskId: string) => {
    e.stopPropagation();
    if (!liveActiveTask) return;
    toggleSubtask(liveActiveTask.id, subtaskId);
    playSubtaskTick();
  };

  const handleParkDistraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parkingLotInput.trim()) return;
    quickDump(parkingLotInput.trim());
    setParkingLotInput('');
    setParkedNotice(true);
    setTimeout(() => setParkedNotice(false), 3000);
  };

  const handleCustomMinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const min = parseInt(customMinInput, 10);
    if (!isNaN(min) && min > 0) {
      setTimerMode('custom', min);
    }
  };

  const handleFinishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    finishSession(finishNotes, markDoneOnFinish);
    playTimerCompleteFanfare();
    triggerDopamineBurst();
    setFinishModalOpen(false);
    setFinishNotes('');
  };

  // Hierarchy Lookup
  const parentProject = liveActiveTask?.projectId
    ? projects.find((p) => p.id === liveActiveTask.projectId)
    : null;
  const parentGoal = parentProject?.goalId
    ? goals.find((g) => g.id === parentProject.goalId)
    : null;

  // Filter tasks & docs for target selector
  const filteredTasks = tasks
    .filter((t) => t.status !== 'done')
    .filter((t) => t.title.toLowerCase().includes(targetSearchQuery.toLowerCase()));

  const filteredDocs = docs
    .filter(
      (d) =>
        d.title.toLowerCase().includes(targetSearchQuery.toLowerCase()) ||
        d.tags.some((tag) => tag.toLowerCase().includes(targetSearchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

  return (
    <div className={`${styles.page} ${isZenMode ? styles.zenMode : ''}`}>
      {/* ── Zen Mode Top Exit Bar ── */}
      {isZenMode && (
        <div className={styles.zenTopBar}>
          <button
            type="button"
            className={styles.btnExitZen}
            onClick={toggleZenMode}
            title="Exit Zen Mode (or press Esc)"
          >
            ← Exit Zen Mode <span className={styles.escBadge}>Esc</span>
          </button>
        </div>
      )}

      {/* ── Top Header ── */}
      {!isZenMode && (
        <header className={styles.header}>
          <div className={styles.titleArea}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className={styles.title}>Focus Space</h1>
              {activeDoc && (
                <span className={styles.toastSaved}>
                  Book Reader Active
                </span>
              )}
            </div>
            <p className={styles.subtitle}>
              Hyperfocus timer, ADHD distraction parking lot, and in-session Book Reader with live highlights.
            </p>
          </div>

          <div className={styles.headerActions}>
            {/* View Mode Toggle when reading a Knowledge Book */}
            {activeDoc && (
              <div className={styles.targetTabGroup} style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`${styles.targetTab} ${focusViewMode === 'book' ? styles.targetTabActive : ''}`}
                  onClick={() => setFocusViewMode('book')}
                >
                  Book View
                </button>
                <button
                  type="button"
                  className={`${styles.targetTab} ${focusViewMode === 'timer' ? styles.targetTabActive : ''}`}
                  onClick={() => setFocusViewMode('timer')}
                >
                  Timer View
                </button>
              </div>
            )}

            <button
              className={styles.btnZen}
              onClick={toggleZenMode}
              title="Toggle Zen Mode (Distraction-Free)"
            >
              <span>Zen Mode</span>
            </button>
          </div>
        </header>
      )}

      {/* Main Focus Container */}
      <div className={activeDoc && focusViewMode === 'book' ? styles.focusContainerBook : styles.focusContainer}>
        {/* Left / Main Section */}
        <section className={styles.focusMain} style={{ width: '100%' }}>
          {/* If a Knowledge document is active AND we are in Book View */}
          {activeDoc && focusViewMode === 'book' ? (
            <div className={styles.focusBookWrapper}>
              {/* Sticky Reading & Control Bar */}
              <div className={styles.focusBookHeaderBar}>
                <div className={styles.focusBookHighlighterGroup}>
                  <span className={styles.focusBookTimerPill}>
                    {formatTimer(secondsRemaining)}
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', display: 'inline-flex', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}
                      onClick={isRunning ? pauseTimer : startTimer}
                      title={isRunning ? 'Pause Timer' : 'Start Timer'}
                    >
                      {isRunning ? 'Pause' : 'Start'}
                    </button>
                  </span>

                  <div className={styles.focusBookSwatches}>
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        className={`${styles.focusBookSwatch} ${activeHighlightColor === c.name ? styles.focusBookSwatchActive : ''}`}
                        style={{
                          background: c.bg,
                          borderColor: c.border,
                          '--swatch-border': c.border,
                        } as React.CSSProperties}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleHighlightInFocus(c.name)}
                        title={`Highlight selected text in ${c.label}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    className={styles.focusBookBtn}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleHighlightInFocus(activeHighlightColor)}
                    title="Highlight selection"
                  >
                    Highlight
                  </button>

                  <button
                    type="button"
                    className={styles.focusBookBtn}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleRemoveHighlightInFocus}
                    title="Clear highlight"
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    className={`${styles.focusBookBtn} ${styles.focusBookSaveBtn}`}
                    onClick={handleManualSave}
                    title="Save highlights to Knowledge Base"
                  >
                    Save Highlights
                  </button>

                  {showSaveToast && (
                    <span className={styles.toastSaved}>
                      Saved!
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className={styles.focusBookBtn}
                    onClick={() => setTaskPickerOpen(true)}
                    title="Switch focus target"
                  >
                    Switch Target
                  </button>
                  <Link
                    href={`/knowledge`}
                    className={styles.focusBookBtn}
                    title="Open in Knowledge base"
                  >
                    Knowledge
                  </Link>
                </div>
              </div>

              {/* Book Page Card */}
              <div className={styles.focusBookPageCard}>
                <div className={styles.focusBookTitle}>{activeDoc.title}</div>
                {activeDoc.tags && activeDoc.tags.length > 0 && (
                  <div className={styles.bookMeta}>
                    {activeDoc.tags.map((t) => (
                      <span key={t} className={styles.bookTag}>#{t}</span>
                    ))}
                  </div>
                )}
                <div className={styles.bookDivider} />

                <div
                  ref={bookContainerRef}
                  contentEditable={false}
                  className={styles.focusBookBody}
                  dangerouslySetInnerHTML={{ __html: getRichHtml(activeDoc.content || '') }}
                />

                <div className={styles.bookFooter}>
                  <span>Reading Target in Focus Mode · Sariling Mundo</span>
                  <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Standard Focus Timer Card */
            <div className={styles.focusCard}>
              {/* Mode Switcher Tabs */}
              <div className={styles.modeTabs}>
                <button
                  className={`${styles.modeTab} ${mode === 'pomodoro' ? styles.activeMode : ''}`}
                  onClick={() => setTimerMode('pomodoro')}
                >
                  Pomodoro
                </button>
                <button
                  className={`${styles.modeTab} ${mode === 'short_break' ? styles.activeMode : ''}`}
                  onClick={() => setTimerMode('short_break')}
                >
                  Short Break
                </button>
                <button
                  className={`${styles.modeTab} ${mode === 'long_break' ? styles.activeMode : ''}`}
                  onClick={() => setTimerMode('long_break')}
                >
                  Long Break
                </button>
                <button
                  className={`${styles.modeTab} ${mode === 'flow' ? styles.activeMode : ''}`}
                  onClick={() => setTimerMode('flow')}
                >
                  Flow Mode
                </button>
              </div>

              {/* Formal Digital Timer Display Card */}
              <div className={styles.timerDisplayCard}>
                <div className={styles.timerNumber}>
                  {mode === 'flow'
                    ? formatTimer(secondsElapsed)
                    : formatTimer(secondsRemaining)}
                </div>
                <div className={styles.timerMetaRow}>
                  <span className={styles.timerModeLabel}>
                    {mode === 'flow' ? 'FLOW' : mode.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className={styles.timerStatusDot}>•</span>
                  <span className={styles.timerStatusText}>
                    {isRunning ? 'ACTIVE' : 'READY'}
                  </span>
                </div>
              </div>

              {/* Current Task / Target Details */}
              <div className={styles.currentTaskArea}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className={styles.taskTagPill}>
                    {activeDoc ? 'READING TARGET' : 'CURRENT TARGET'}
                  </span>
                  {parentProject && (
                    <span style={{ fontSize: '11px', color: 'var(--color-accent-light)', background: 'var(--color-surface-2)', padding: '2px 8px', borderRadius: '4px' }}>
                      Project: {parentProject.title}
                    </span>
                  )}
                  {liveActiveTask?.estimatedDuration && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
                      Est: {liveActiveTask.estimatedDuration}m • Act: {Math.round((liveActiveTask.actualDuration || 0) + secondsElapsed / 60)}m
                    </span>
                  )}
                </div>

                <h2 className={styles.taskTitle} id="focus-task-title">
                  {activeDoc ? activeDoc.title : liveActiveTask ? liveActiveTask.title : customTaskTitle || 'Focus Session'}
                </h2>

                {activeDoc && (
                  <div style={{ margin: '8px 0' }}>
                    <button
                      type="button"
                      className={styles.focusBookBtn}
                      onClick={() => setFocusViewMode('book')}
                    >
                      Open Book Reader with Highlighter
                    </button>
                  </div>
                )}

                {/* Why It Matters */}
                {parentGoal?.why && (
                  <p className={styles.taskWhy}>
                    &ldquo;{parentGoal.why}&rdquo;
                  </p>
                )}
                {liveActiveTask?.description && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                    {liveActiveTask.description}
                  </p>
                )}
              </div>

              {/* Subtasks checklist (for tasks) */}
              {!activeDoc && (
                <div className={styles.subtasksBox}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Micro-Steps ({liveActiveTask?.subtasks?.filter((s) => s.completed).length || 0}/{liveActiveTask?.subtasks?.length || 0}):
                    </span>

                    {liveActiveTask && (
                      <button
                        className={styles.btnMagicBreakdown}
                        onClick={handleMagicBreakdown}
                        title="Break this task down into tiny 2-to-5 minute steps"
                      >
                        Break into 5-Min Steps
                      </button>
                    )}
                  </div>

                  {liveActiveTask?.subtasks && liveActiveTask.subtasks.length > 0 ? (
                    liveActiveTask.subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className={`${styles.subtaskRow} ${sub.completed ? styles.done : ''}`}
                      >
                        <button
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            color: sub.completed ? 'var(--color-success)' : 'var(--color-text-faint)',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                          onClick={(e) => handleSubtaskCheck(e, sub.id)}
                        >
                          {sub.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                        <span style={{ flex: 1, textAlign: 'left' }}>{sub.title}</span>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', margin: 0, padding: '4px 0', textAlign: 'left' }}>
                      Feeling stuck? Click <strong>Break into 5-Min Steps</strong> to break this into easy bite-sized actions.
                    </p>
                  )}
                </div>
              )}

              {/* Zen Mode Only Controls */}
              {isZenMode && (
                <div className={styles.controlsRow}>
                  {isRunning ? (
                    <button className={styles.btnPause} onClick={pauseTimer}>
                      Pause
                    </button>
                  ) : (
                    <button className={styles.btnStart} onClick={startTimer}>
                      {secondsElapsed > 0 ? 'Resume' : 'Start Focus'}
                    </button>
                  )}
                  <button className={styles.btnReset} onClick={resetTimer} title="Reset timer">
                    Reset
                  </button>
                  <button
                    className={styles.btnFinish}
                    onClick={() => setFinishModalOpen(true)}
                    title="Finish session and log actual time"
                  >
                    Finish Session
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Sidebar: Controls, Parking Lot, Ambient Soundscapes & History */}
        {!isZenMode && !(activeDoc && focusViewMode === 'book') && (
          <aside className={styles.sideSection}>
            {/* ── 1. Focus Controls (Right Side) ── */}
            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <span className={styles.sideCardTitle}>
                  Session Controls
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {isRunning ? (
                  <button className={styles.sideBtnPause} onClick={pauseTimer}>
                    Pause Session
                  </button>
                ) : (
                  <button className={styles.sideBtnStart} onClick={startTimer}>
                    {secondsElapsed > 0 ? 'Resume Focus' : 'Start Focus'}
                  </button>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button className={styles.sideActionBtn} onClick={resetTimer} title="Reset timer">
                    Reset
                  </button>
                  <button
                    className={styles.sideActionBtn}
                    onClick={() => setTaskPickerOpen(true)}
                    title="Switch focus target"
                  >
                    Switch Target
                  </button>
                </div>

                <button
                  className={styles.sideBtnFinish}
                  onClick={() => setFinishModalOpen(true)}
                  title="Finish session and log actual time"
                >
                  Finish & Log Session
                </button>
              </div>
            </div>

            {/* ── 2. Distraction Parking Lot (Right Side) ── */}
            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <span className={styles.sideCardTitle}>
                  Distraction Parking Lot
                </span>
              </div>

              <form onSubmit={handleParkDistraction} className={styles.sideParkingLotForm}>
                <input
                  type="text"
                  value={parkingLotInput}
                  onChange={(e) => setParkingLotInput(e.target.value)}
                  placeholder="Random thought? Park it here..."
                  className={styles.sideParkingLotInput}
                />
                <button type="submit" className={styles.sideBtnParkSubmit}>
                  Park ↵
                </button>
              </form>

              {parkedNotice && (
                <p style={{ fontSize: '11px', color: 'var(--color-success)', margin: '6px 0 0 0', fontWeight: 600 }}>
                  Saved to Brain Dump! Back to focusing!
                </p>
              )}
            </div>

            {/* ── 3. Ambient Soundscapes ── */}
            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <span className={styles.sideCardTitle}>
                  Ambient Soundscapes
                </span>
                {ambientSound !== 'off' && (
                  <button
                    type="button"
                    onClick={() => handleAmbientToggle('off')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-faint)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Mute
                  </button>
                )}
              </div>

              <div className={styles.ambientBtnGrid}>
                {[
                  { id: 'gamma40', label: '40Hz Gamma (Hyperfocus)', icon: '🧠' },
                  { id: 'alpha10', label: '10Hz Alpha (Flow State)', icon: '🧘' },
                  { id: 'pink',    label: 'Pink Noise (ADHD Block)', icon: '🛡️' },
                  { id: 'brown',   label: 'Deep Brown Noise', icon: '🎧' },
                  { id: 'rain',    label: 'Gentle Rain', icon: '🌧️' },
                  { id: 'thunder', label: 'Distant Thunder', icon: '⛈️' },
                  { id: 'waves',   label: 'Ocean Waves', icon: '🌊' },
                  { id: 'stream',  label: 'River Stream', icon: '💧' },
                  { id: 'forest',  label: 'Forest Birds', icon: '🌲' },
                  { id: 'fire',    label: 'Campfire', icon: '🔥' },
                  { id: 'wind',    label: 'Mountain Wind', icon: '🍃' },
                  { id: 'cafe',    label: 'Cozy Cafe', icon: '☕' },
                  { id: 'drone',   label: 'Space Drone', icon: '🌌' },
                ].map((s) => (
                  <button
                    key={s.id}
                    className={`${styles.ambientPill} ${ambientSound === s.id ? styles.activeAmbient : ''}`}
                    onClick={() => handleAmbientToggle(s.id as AmbientSoundType)}
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>

              {ambientSound !== 'off' && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-faint)', textTransform: 'uppercase' }}>Vol</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVol}
                    onChange={handleVolumeChange}
                    style={{ flex: 1, accentColor: 'var(--color-accent)' }}
                  />
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Modal: Target Picker (Tasks & Knowledge Books) ── */}
      {taskPickerOpen && (
        <div className={styles.modalOverlay} onClick={() => setTaskPickerOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Select Focus Target
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setTaskPickerOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs: Tasks vs Knowledge & Books */}
            <div className={styles.targetTabGroup}>
              <button
                type="button"
                className={`${styles.targetTab} ${targetTab === 'tasks' ? styles.targetTabActive : ''}`}
                onClick={() => setTargetTab('tasks')}
              >
                Tasks ({filteredTasks.length})
              </button>
              <button
                type="button"
                className={`${styles.targetTab} ${targetTab === 'knowledge' ? styles.targetTabActive : ''}`}
                onClick={() => setTargetTab('knowledge')}
              >
                Knowledge & Books ({filteredDocs.length})
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder={targetTab === 'tasks' ? 'Search tasks...' : 'Search books, notes, documents...'}
                value={targetSearchQuery}
                onChange={(e) => setTargetSearchQuery(e.target.value)}
                className={styles.targetSearchInput}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
              {targetTab === 'tasks' ? (
                filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--color-surface-2)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-lg)',
                        cursor: 'pointer',
                        border: activeTask?.id === task.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                      }}
                      onClick={() => {
                        selectFocusTask(task);
                        setFocusViewMode('timer');
                        setTaskPickerOpen(false);
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
                          {task.title}
                        </span>
                        {task.estimatedDuration && (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginLeft: '6px' }}>
                            • {task.estimatedDuration}m
                          </span>
                        )}
                      </div>
                      <button className={styles.btnReset} style={{ padding: '2px 8px', fontSize: '11px' }}>
                        Select Task
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', textAlign: 'center', padding: '16px 0' }}>
                    No pending tasks found.
                  </p>
                )
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px', fontSize: '12px', padding: '8px', background: 'rgba(124, 106, 255, 0.1)', border: '1px dashed var(--color-accent)' }}
                    onClick={() => {
                      const newDoc = addDoc({
                        title: 'Focus Note — ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        content: '# Focus Note\n\nStart typing your focus notes and thoughts here...',
                        status: 'active',
                        category: 'learning',
                        tags: ['focus-note'],
                      });
                      selectFocusDoc(newDoc);
                      setFocusViewMode('book');
                      setTaskPickerOpen(false);
                    }}
                  >
                    <Plus size={14} style={{ color: 'var(--color-accent-light)' }} /> + Create New Note / Book Target
                  </button>
                  {filteredDocs.length > 0 ? (
                    filteredDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className={`${styles.knowledgeTargetItem} ${activeDoc?.id === doc.id ? styles.knowledgeTargetActive : ''}`}
                        onClick={() => {
                          selectFocusDoc(doc);
                          setFocusViewMode('book');
                          setTaskPickerOpen(false);
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BookOpen size={14} style={{ color: 'var(--color-accent)' }} />
                            {doc.isPinned && <Pin size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />}
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                              {doc.title}
                            </span>
                          </div>
                          {doc.tags && doc.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                              {doc.tags.map((t) => (
                                <span key={t} style={{ fontSize: '10px', color: 'var(--color-text-faint)', background: 'var(--color-surface)', padding: '1px 6px', borderRadius: '4px' }}>
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button className={styles.btnReset} style={{ padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          Select Book Target
                        </button>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', textAlign: 'center', padding: '16px 0' }}>
                      No knowledge documents found.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Finish Session ── */}
      {finishModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setFinishModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Finish Focus Session
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setFinishModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
              Log {Math.max(1, Math.round(secondsElapsed / 60))} minutes of deep focus to {activeDoc ? `Reading: "${activeDoc.title}"` : activeTask ? `"${activeTask.title}"` : customTaskTitle}.
            </p>

            <form onSubmit={handleFinishSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                  Session Notes (Optional)
                </label>
                <textarea
                  value={finishNotes}
                  onChange={(e) => setFinishNotes(e.target.value)}
                  placeholder={activeDoc ? "What key insights or ideas did you highlight?" : "What did you accomplish during this focus block?"}
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3)',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-xs)',
                    minHeight: '80px',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>

              {liveActiveTask && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--color-text)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={markDoneOnFinish}
                    onChange={(e) => setMarkDoneOnFinish(e.target.checked)}
                  />
                  <span>Mark task &ldquo;{liveActiveTask.title}&rdquo; as completed (Done)</span>
                </label>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: 'var(--space-2)' }}>
                <button type="button" className={styles.btnReset} onClick={() => setFinishModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnFinish}>
                  Save & Log Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Mouse Selection Toolbar in Focus Book Mode */}
      {floatingMenu && activeDoc && (
        <div
          className={styles.floatingHighlightMenu}
          style={{ left: `${floatingMenu.x}px`, top: `${floatingMenu.y}px` }}
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              className={styles.floatingSwatch}
              style={{
                background: c.bg,
                borderColor: c.border,
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                handleHighlightInFocus(c.name);
                setFloatingMenu(null);
              }}
              title={`Highlight in ${c.label}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
