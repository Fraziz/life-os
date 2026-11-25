'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Square,
  Clock,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  LayoutGrid,
  LayoutList,
  X,
} from 'lucide-react';
import MasonryGrid from '@/components/ui/MasonryGrid';
import { playSuccessChime } from '@/utils/soundAndDopamine';
import styles from './DailyRoutineRoadmap.module.css';

export interface RoutineBlock {
  id: string;
  timeRange: string;
  title: string;
  subLabel?: string;
  steps: string[];
  /** Start and end minutes from midnight (0-1440) for highlighting the active block. */
  startMinute?: number;
  endMinute?: number;
}

interface DailyProgressState {
  date: string;
  completedStepKeys: string[];
  completedBlockIds: string[];
}

const ROUTINE_STORAGE_KEY = 'life_os_daily_routine_blocks_v1';
const PROGRESS_STORAGE_KEY = 'life_os_daily_routine_progress_v1';

export const DEFAULT_DAILY_ROUTINE: RoutineBlock[] = [
  {
    id: 'routine-1',
    timeRange: '7:00 – 8:00 AM',
    title: 'Morning reset',
    startMinute: 7 * 60,
    endMinute: 8 * 60,
    steps: [
      'Wake up and make your bed',
      'Brush teeth, wash face',
      'Drink water and eat breakfast',
      'Avoid scrolling on your phone',
    ],
  },
  {
    id: 'routine-2',
    timeRange: '8:00 – 9:00 AM',
    title: 'Exercise',
    startMinute: 8 * 60,
    endMinute: 9 * 60,
    steps: [
      'Push-ups, squats, pull-ups or walking',
      'Stretch',
      'Build strength consistently',
    ],
  },
  {
    id: 'routine-3',
    timeRange: '9:00 – 10:00 AM',
    title: 'English practice',
    startMinute: 9 * 60,
    endMinute: 10 * 60,
    steps: [
      'Read one short passage',
      'Learn 3 useful expressions',
      'Speak out loud for 5–10 minutes',
      'Explain something in your own words',
    ],
  },
  {
    id: 'routine-4',
    timeRange: '10:00 – 12:00 PM',
    title: 'Main priority',
    startMinute: 10 * 60,
    endMinute: 12 * 60,
    steps: [
      'Capstone, studies, or important responsibilities',
      'Focus on one task at a time',
    ],
  },
  {
    id: 'routine-5',
    timeRange: '1:00 – 2:00 PM',
    title: 'Guitar practice',
    startMinute: 13 * 60,
    endMinute: 14 * 60,
    steps: [
      '10 minutes: technique',
      '15 minutes: chords and progressions',
      '20 minutes: actual songs',
      '15 minutes: play without tutorials',
    ],
  },
  {
    id: 'routine-6',
    timeRange: '2:00 – 4:00 PM',
    title: 'Build useful skills',
    subLabel: 'Rotate between:',
    startMinute: 14 * 60,
    endMinute: 16 * 60,
    steps: [
      'Business and money',
      'Technology and projects',
      'Practical knowledge',
    ],
  },
  {
    id: 'routine-7',
    timeRange: '4:00 – 5:00 PM',
    title: 'Personal time',
    startMinute: 16 * 60,
    endMinute: 17 * 60,
    steps: ['Walk, relax, socialize or enjoy a hobby.'],
  },
  {
    id: 'routine-8',
    timeRange: '7:00 – 8:00 PM',
    title: 'Learning and reflection',
    startMinute: 19 * 60,
    endMinute: 20 * 60,
    steps: [
      'Read about philosophy or Stoicism',
      'Review what you learned',
      'Write down your thoughts',
    ],
  },
  {
    id: 'routine-9',
    timeRange: '8:00 – 9:00 PM',
    title: 'Prepare for tomorrow',
    startMinute: 20 * 60,
    endMinute: 21 * 60,
    steps: [
      'Organize your things',
      'Review unfinished tasks',
      "Write tomorrow's most important task",
      'Sleep at a consistent time',
    ],
  },
];

function getTodayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DailyRoutineRoadmap() {
  const [blocks, setBlocks] = useState<RoutineBlock[]>(DEFAULT_DAILY_ROUTINE);
  const [progress, setProgress] = useState<DailyProgressState>({
    date: getTodayDateKey(),
    completedStepKeys: [],
    completedBlockIds: [],
  });
  const [layoutMode, setLayoutMode] = useState<'grid' | 'timeline'>('grid');
  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  // Add / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<RoutineBlock | null>(null);
  const [formTimeRange, setFormTimeRange] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSubLabel, setFormSubLabel] = useState('');
  const [formStepsText, setFormStepsText] = useState('');

  // Hydrate blocks + daily check state (resets checks automatically on a new day)
  useEffect(() => {
    try {
      const savedBlocks = localStorage.getItem(ROUTINE_STORAGE_KEY);
      if (savedBlocks) {
        const parsed = JSON.parse(savedBlocks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBlocks(parsed);
        }
      }
    } catch {}

    const today = getTodayDateKey();
    try {
      const savedProg = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (savedProg) {
        const parsed: DailyProgressState = JSON.parse(savedProg);
        if (parsed && parsed.date === today) {
          setProgress({
            date: today,
            completedStepKeys: Array.isArray(parsed.completedStepKeys) ? parsed.completedStepKeys : [],
            completedBlockIds: Array.isArray(parsed.completedBlockIds) ? parsed.completedBlockIds : [],
          });
          return;
        }
      }
    } catch {}

    const fresh: DailyProgressState = { date: today, completedStepKeys: [], completedBlockIds: [] };
    setProgress(fresh);
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(fresh));
    } catch {}
  }, []);

  // Update active time marker every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const persistBlocks = (next: RoutineBlock[]) => {
    setBlocks(next);
    try {
      localStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const persistProgress = (next: DailyProgressState) => {
    setProgress(next);
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const toggleBlockDone = (block: RoutineBlock) => {
    const today = getTodayDateKey();
    const isDone = progress.completedBlockIds.includes(block.id);
    const blockStepKeys = block.steps.map((_, idx) => `${block.id}:${idx}`);

    let nextBlockIds: string[];
    let nextStepKeys: string[];

    if (isDone) {
      nextBlockIds = progress.completedBlockIds.filter((id) => id !== block.id);
      nextStepKeys = progress.completedStepKeys.filter((k) => !blockStepKeys.includes(k));
    } else {
      nextBlockIds = [...progress.completedBlockIds, block.id];
      const stepSet = new Set([...progress.completedStepKeys, ...blockStepKeys]);
      nextStepKeys = Array.from(stepSet);
      playSuccessChime();
    }

    persistProgress({
      date: today,
      completedBlockIds: nextBlockIds,
      completedStepKeys: nextStepKeys,
    });
  };

  const toggleStepDone = (block: RoutineBlock, stepIdx: number) => {
    const today = getTodayDateKey();
    const stepKey = `${block.id}:${stepIdx}`;
    const isStepDone = progress.completedStepKeys.includes(stepKey);

    const nextStepKeys = isStepDone
      ? progress.completedStepKeys.filter((k) => k !== stepKey)
      : [...progress.completedStepKeys, stepKey];

    const allStepsDone =
      block.steps.length > 0 &&
      block.steps.every((_, i) => nextStepKeys.includes(`${block.id}:${i}`));

    let nextBlockIds = progress.completedBlockIds;
    if (allStepsDone && !nextBlockIds.includes(block.id)) {
      nextBlockIds = [...nextBlockIds, block.id];
      playSuccessChime();
    } else if (!allStepsDone && nextBlockIds.includes(block.id)) {
      nextBlockIds = nextBlockIds.filter((id) => id !== block.id);
    }

    persistProgress({
      date: today,
      completedBlockIds: nextBlockIds,
      completedStepKeys: nextStepKeys,
    });
  };

  const handleResetTodayChecks = () => {
    persistProgress({
      date: getTodayDateKey(),
      completedBlockIds: [],
      completedStepKeys: [],
    });
  };

  const handleRestoreDefaultRoutine = () => {
    if (!confirm('Restore the default 7:00 AM – 9:00 PM Daily Routine?')) return;
    persistBlocks(DEFAULT_DAILY_ROUTINE);
    handleResetTodayChecks();
  };

  const openAddModal = () => {
    setEditingBlock(null);
    setFormTimeRange('');
    setFormTitle('');
    setFormSubLabel('');
    setFormStepsText('');
    setModalOpen(true);
  };

  const openEditModal = (block: RoutineBlock) => {
    setEditingBlock(block);
    setFormTimeRange(block.timeRange);
    setFormTitle(block.title);
    setFormSubLabel(block.subLabel || '');
    setFormStepsText(block.steps.join('\n'));
    setModalOpen(true);
  };

  const handleSaveBlock = (e: React.FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    const timeRange = formTimeRange.trim() || 'Anytime';
    if (!title) return;

    const steps = formStepsText
      .split('\n')
      .map((s) => s.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean);

    if (editingBlock) {
      const updated = blocks.map((b) =>
        b.id === editingBlock.id
          ? {
              ...b,
              timeRange,
              title,
              subLabel: formSubLabel.trim() || undefined,
              steps,
            }
          : b
      );
      persistBlocks(updated);
    } else {
      const newBlock: RoutineBlock = {
        id: `routine-${Date.now()}`,
        timeRange,
        title,
        subLabel: formSubLabel.trim() || undefined,
        steps,
      };
      persistBlocks([...blocks, newBlock]);
    }

    setModalOpen(false);
    playSuccessChime();
  };

  const handleDeleteBlock = (block: RoutineBlock) => {
    if (!confirm(`Delete "${block.title}" from your routine?`)) return;
    persistBlocks(blocks.filter((b) => b.id !== block.id));
  };

  const completedCount = useMemo(
    () => blocks.filter((b) => progress.completedBlockIds.includes(b.id)).length,
    [blocks, progress.completedBlockIds]
  );

  const completionPct = blocks.length > 0 ? Math.round((completedCount / blocks.length) * 100) : 0;

  const renderBlockCard = (block: RoutineBlock, index: number) => {
    const isBlockDone = progress.completedBlockIds.includes(block.id);
    const isCurrentTime =
      typeof block.startMinute === 'number' &&
      typeof block.endMinute === 'number' &&
      nowMinutes >= block.startMinute &&
      nowMinutes < block.endMinute;

    return (
      <article
        key={block.id}
        className={`${styles.blockCard} ${isCurrentTime && !isBlockDone ? styles.blockCardCurrent : ''} ${isBlockDone ? styles.blockCardDone : ''}`}
      >
        <div className={styles.blockTopRow}>
          <div className={styles.blockMainLeft}>
            <button
              type="button"
              className={`${styles.checkSquareBtn} ${isBlockDone ? styles.checkSquareBtnChecked : ''}`}
              onClick={() => toggleBlockDone(block)}
              title={isBlockDone ? 'Mark block incomplete' : 'Mark block completed'}
              aria-label={isBlockDone ? `Mark ${block.title} incomplete` : `Mark ${block.title} completed`}
            >
              {isBlockDone ? <CheckSquare size={18} /> : <Square size={18} />}
            </button>

            <div className={styles.blockHeadingCol}>
              <div className={styles.blockMetaRow}>
                <span className={styles.stepIndexBadge}>{index + 1}.</span>
                <span className={styles.timeBadge}>
                  <Clock size={11} />
                  {block.timeRange}
                </span>
                {isCurrentTime && !isBlockDone && (
                  <span className={styles.nowBadge}>
                    <span className={styles.nowDot} /> Now
                  </span>
                )}
              </div>
              <h3 className={`${styles.blockTitle} ${isBlockDone ? styles.blockTitleDone : ''}`}>
                {block.title}
              </h3>
            </div>
          </div>

          <div className={styles.cardActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => openEditModal(block)}
              title="Edit routine block"
              aria-label={`Edit ${block.title}`}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
              onClick={() => handleDeleteBlock(block)}
              title="Delete routine block"
              aria-label={`Delete ${block.title}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {block.subLabel && <p className={styles.subLabel}>{block.subLabel}</p>}

        {block.steps.length > 0 && (
          <ul className={styles.stepsList}>
            {block.steps.map((step, stepIdx) => {
              const stepKey = `${block.id}:${stepIdx}`;
              const isStepDone = isBlockDone || progress.completedStepKeys.includes(stepKey);
              return (
                <li key={stepKey} className={styles.stepItem}>
                  <button
                    type="button"
                    className={`${styles.stepBtn} ${isStepDone ? styles.stepDone : ''}`}
                    onClick={() => toggleStepDone(block, stepIdx)}
                  >
                    {isStepDone ? (
                      <CheckSquare size={14} className={styles.stepIcon} />
                    ) : (
                      <Square size={14} className={styles.stepIcon} />
                    )}
                    <span className={isStepDone ? styles.stepTextDone : undefined}>{step}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    );
  };

  return (
    <div className={styles.routineContainer}>
      <div className={styles.routineInner}>
        {/* ── Summary Header ── */}
        <header className={styles.summaryHeader}>
          <div className={styles.summaryLeft}>
            <div className={styles.summaryTitleRow}>
              <h2 className={styles.summaryTitle}>My Daily Routine</h2>
              <span className={styles.schedulePill}>
                <Clock size={11} />
                Suggested schedule: 7:00 AM – 9:00 PM
              </span>
            </div>
            <p className={styles.summarySubtitle}>
              Tap any step or block as you move through your day. Resets automatically every morning.
            </p>
          </div>

          <div className={styles.summaryRight}>
            <div className={styles.progressBox}>
              <div className={styles.progressTextRow}>
                <span>Today&apos;s Progress</span>
                <span>
                  {completedCount} / {blocks.length} ({completionPct}%)
                </span>
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ transform: `scaleX(${completionPct / 100})` }}
                />
              </div>
            </div>

            <div className={styles.layoutToggle} role="group" aria-label="Routine view layout">
              <button
                type="button"
                className={`${styles.layoutBtn} ${layoutMode === 'grid' ? styles.layoutBtnActive : ''}`}
                onClick={() => setLayoutMode('grid')}
                title="Grid view"
              >
                <LayoutGrid size={12} />
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`${styles.layoutBtn} ${layoutMode === 'timeline' ? styles.layoutBtnActive : ''}`}
                onClick={() => setLayoutMode('timeline')}
                title="Timeline view"
              >
                <LayoutList size={12} />
                <span>Timeline</span>
              </button>
            </div>

            {completedCount > 0 && (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={handleResetTodayChecks}
                title="Uncheck all routine blocks for today"
              >
                <RotateCcw size={12} />
                <span>Clear Checks</span>
              </button>
            )}

            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleRestoreDefaultRoutine}
              title="Restore default 7 AM – 9 PM schedule"
            >
              <RotateCcw size={12} />
              <span>Default</span>
            </button>

            <button
              type="button"
              className={`${styles.actionBtn} ${styles.primaryBtn}`}
              onClick={openAddModal}
            >
              <Plus size={13} />
              <span>Add Block</span>
            </button>
          </div>
        </header>

        {/* ── Routine Blocks (Responsive Grid or Chronological Timeline) ── */}
        {layoutMode === 'timeline' ? (
          <div className={styles.timelineList}>
            {blocks.map((block, index) => renderBlockCard(block, index))}
          </div>
        ) : (
          <MasonryGrid
            items={blocks}
            getKey={(b) => b.id}
            minColumnWidth={310}
            maxColumns={3}
            gap={14}
            fallbackClassName={styles.fallbackGrid}
            estimateWeight={(b) => 96 + (b.subLabel ? 22 : 0) + b.steps.length * 26}
            renderItem={(block, index) => renderBlockCard(block, index)}
          />
        )}
      </div>

      {/* ── Add / Edit Routine Block Modal ── */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingBlock ? 'Edit Routine Block' : 'Add Routine Block'}
              </h3>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveBlock} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="routine-time">
                  Time Range
                </label>
                <input
                  id="routine-time"
                  type="text"
                  className={styles.formInput}
                  value={formTimeRange}
                  onChange={(e) => setFormTimeRange(e.target.value)}
                  placeholder="e.g. 7:00 – 8:00 AM"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="routine-title">
                  Block Title
                </label>
                <input
                  id="routine-title"
                  type="text"
                  className={styles.formInput}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Morning reset"
                  required
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="routine-sublabel">
                  Optional Note / Prefix (e.g. Rotate between:)
                </label>
                <input
                  id="routine-sublabel"
                  type="text"
                  className={styles.formInput}
                  value={formSubLabel}
                  onChange={(e) => setFormSubLabel(e.target.value)}
                  placeholder="Optional label before checklist"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="routine-steps">
                  Checklist Steps (one per line)
                </label>
                <textarea
                  id="routine-steps"
                  className={styles.formTextarea}
                  value={formStepsText}
                  onChange={(e) => setFormStepsText(e.target.value)}
                  placeholder={'Wake up and make your bed\nBrush teeth, wash face\nDrink water and eat breakfast'}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.actionBtn} ${styles.primaryBtn}`}
                >
                  {editingBlock ? 'Save Changes' : 'Add Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
