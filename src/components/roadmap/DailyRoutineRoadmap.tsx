'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  GitBranch,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
} from 'lucide-react';
import MasonryGrid from '@/components/ui/MasonryGrid';
import { playSuccessChime } from '@/utils/soundAndDopamine';
import styles from './DailyRoutineRoadmap.module.css';

export interface RoutinePaletteItem {
  id: string;
  label: string;
  hex: string;
  rgb: string;
}

export const ROUTINE_PALETTE: RoutinePaletteItem[] = [
  { id: 'amber', label: 'Amber Gold', hex: '#f59e0b', rgb: '245, 158, 11' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981', rgb: '16, 185, 129' },
  { id: 'sky', label: 'Sky Blue', hex: '#38bdf8', rgb: '56, 189, 248' },
  { id: 'rose', label: 'Coral Rose', hex: '#fb7185', rgb: '251, 113, 133' },
  { id: 'violet', label: 'Violet', hex: '#a855f7', rgb: '168, 85, 247' },
  { id: 'cyan', label: 'Teal Cyan', hex: '#06b6d4', rgb: '6, 182, 212' },
  { id: 'orange', label: 'Tangerine', hex: '#fb923c', rgb: '251, 146, 60' },
  { id: 'indigo', label: 'Indigo', hex: '#818cf8', rgb: '129, 140, 248' },
  { id: 'lime', label: 'Fresh Lime', hex: '#84cc16', rgb: '132, 204, 22' },
];

const PHASE_RGB_LIST = [
  '245, 158, 11',  // Morning: warm amber
  '168, 85, 247',  // Afternoon: vibrant violet
  '129, 140, 248', // Evening: calm indigo
];

export interface RoutineBlock {
  id: string;
  timeRange: string;
  title: string;
  subLabel?: string;
  steps: string[];
  color?: string;
  /** Start and end minutes from midnight (0-1440) for highlighting the active block. */
  startMinute?: number;
  endMinute?: number;
}

function getBlockPalette(block: RoutineBlock, index: number): RoutinePaletteItem {
  if (block.color) {
    const byId = ROUTINE_PALETTE.find((p) => p.id === block.color);
    if (byId) return byId;
  }
  const defaultIdx = DEFAULT_DAILY_ROUTINE.findIndex((d) => d.id === block.id);
  if (defaultIdx >= 0) {
    return ROUTINE_PALETTE[defaultIdx % ROUTINE_PALETTE.length];
  }
  return ROUTINE_PALETTE[index % ROUTINE_PALETTE.length];
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

const GRAPH_NODE_W = 296;
const GRAPH_COL_GAP = 96;
const GRAPH_ROW_GAP = 42;
const GRAPH_PAD_X = 48;
const GRAPH_TOP_Y = 64;

interface GraphPositionedNode {
  block: RoutineBlock;
  index: number;
  colIdx: number;
  x: number;
  y: number;
  height: number;
}

function estimateGraphNodeHeight(block: RoutineBlock): number {
  const stepLines = block.steps.reduce((sum, s) => sum + Math.max(1, Math.ceil(s.length / 32)), 0);
  return 82 + (block.subLabel ? 20 : 0) + stepLines * 22 + Math.max(0, block.steps.length - 1) * 4;
}

export default function DailyRoutineRoadmap() {
  const [blocks, setBlocks] = useState<RoutineBlock[]>(DEFAULT_DAILY_ROUTINE);
  const [progress, setProgress] = useState<DailyProgressState>({
    date: getTodayDateKey(),
    completedStepKeys: [],
    completedBlockIds: [],
  });
  const [layoutMode, setLayoutMode] = useState<'graph' | 'grid' | 'timeline'>('graph');
  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  // Graph Flow Pan & Zoom state
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState({ x: 24, y: 12 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const pinchDistRef = useRef<number | null>(null);
  const pinchZoomRef = useRef<number>(0.9);

  // Add / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<RoutineBlock | null>(null);
  const [formTimeRange, setFormTimeRange] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSubLabel, setFormSubLabel] = useState('');
  const [formStepsText, setFormStepsText] = useState('');
  const [formColor, setFormColor] = useState<string>(ROUTINE_PALETTE[0].id);

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
    setFormColor(ROUTINE_PALETTE[blocks.length % ROUTINE_PALETTE.length].id);
    setModalOpen(true);
  };

  const openEditModal = (block: RoutineBlock) => {
    const idx = Math.max(0, blocks.findIndex((b) => b.id === block.id));
    setEditingBlock(block);
    setFormTimeRange(block.timeRange);
    setFormTitle(block.title);
    setFormSubLabel(block.subLabel || '');
    setFormStepsText(block.steps.join('\n'));
    setFormColor(getBlockPalette(block, idx).id);
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
              color: formColor,
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
        color: formColor,
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

  // Compute Graph Flow node coordinates grouped into Morning -> Afternoon -> Evening columns
  const { graphNodes, graphWidth, graphHeight, phaseHeaders } = useMemo(() => {
    const colBuckets: { block: RoutineBlock; index: number }[][] = [];
    blocks.forEach((block, index) => {
      let colIdx = 0;
      if (typeof block.startMinute === 'number') {
        colIdx = block.startMinute < 12 * 60 ? 0 : block.startMinute < 17 * 60 ? 1 : 2;
      } else {
        colIdx = index < 4 ? 0 : index < 7 ? 1 : 2 + Math.floor((index - 7) / 4);
      }
      while (colBuckets.length <= colIdx) colBuckets.push([]);
      colBuckets[colIdx].push({ block, index });
    });

    const positioned: GraphPositionedNode[] = [];
    const headers: { colIdx: number; label: string; x: number; y: number }[] = [];
    const PHASE_NAMES = ['Morning Flow · 7 AM – 12 PM', 'Afternoon Flow · 1 – 5 PM', 'Evening Wind-Down · 7 – 9 PM'];

    let maxY = 500;
    colBuckets.forEach((colItems, colIdx) => {
      if (colItems.length === 0) return;
      const x = GRAPH_PAD_X + colIdx * (GRAPH_NODE_W + GRAPH_COL_GAP);
      headers.push({
        colIdx,
        label: PHASE_NAMES[colIdx] || `Phase ${colIdx + 1}`,
        x,
        y: 20,
      });

      let curY = GRAPH_TOP_Y;
      colItems.forEach(({ block, index }) => {
        const h = estimateGraphNodeHeight(block);
        positioned.push({ block, index, colIdx, x, y: curY, height: h });
        curY += h + GRAPH_ROW_GAP;
      });
      if (curY > maxY) maxY = curY;
    });

    // Ensure sequential visual order matches block index order for edge connections
    positioned.sort((a, b) => a.index - b.index);

    const totalCols = Math.max(1, colBuckets.length);
    const width = Math.max(1180, GRAPH_PAD_X * 2 + totalCols * GRAPH_NODE_W + (totalCols - 1) * GRAPH_COL_GAP);
    const height = Math.max(760, maxY + 48);

    return { graphNodes: positioned, graphWidth: width, graphHeight: height, phaseHeaders: headers };
  }, [blocks]);

  const fitGraphToViewport = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) {
      setZoom(0.9);
      setPan({ x: 24, y: 12 });
      return;
    }
    const rect = vp.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const scaleX = (rect.width - 32) / graphWidth;
    const scaleY = (rect.height - 24) / graphHeight;
    const nextZoom = Math.max(0.45, Math.min(1.0, Math.min(scaleX, scaleY)));
    const nextX = Math.max(16, Math.round((rect.width - graphWidth * nextZoom) / 2));
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({ x: nextX, y: 10 });
  }, [graphWidth, graphHeight]);

  useEffect(() => {
    if (layoutMode === 'graph') {
      fitGraphToViewport();
    }
  }, [layoutMode, fitGraphToViewport]);

  const handleGraphWheel = useCallback(
    (e: WheelEvent) => {
      if (layoutMode !== 'graph') return;
      e.preventDefault();
      setZoom((z) => Math.max(0.35, Math.min(1.6, Number((z - e.deltaY * 0.001).toFixed(3)))));
    },
    [layoutMode]
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || layoutMode !== 'graph') return;
    el.addEventListener('wheel', handleGraphWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleGraphWheel);
  }, [handleGraphWheel, layoutMode]);

  const handleGraphMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, textarea, [data-interactive="true"]')) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleGraphMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleGraphMouseUp = () => setIsDragging(false);

  const handleGraphTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, textarea, [data-interactive="true"]')) {
      return;
    }
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      pinchDistRef.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchZoomRef.current = zoom;
    }
  };

  const handleGraphTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
    } else if (e.touches.length === 2 && pinchDistRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setZoom(Math.max(0.35, Math.min(1.6, pinchZoomRef.current * (dist / pinchDistRef.current))));
    }
  };

  const handleGraphTouchEnd = () => {
    setIsDragging(false);
    pinchDistRef.current = null;
  };

  const getFlowEdgePath = (from: GraphPositionedNode, to: GraphPositionedNode): string => {
    if (from.colIdx === to.colIdx) {
      // Vertical flow inside same phase column
      const sx = from.x + GRAPH_NODE_W / 2;
      const sy = from.y + from.height;
      const tx = to.x + GRAPH_NODE_W / 2;
      const ty = to.y;
      const midY = (sy + ty) / 2;
      return `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
    }
    // Cross-column S-curve bridge to next phase
    const sx = from.x + GRAPH_NODE_W;
    const sy = from.y + from.height / 2;
    const tx = to.x;
    const ty = to.y + to.height / 2;
    const dx = Math.abs(tx - sx) * 0.52;
    return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
  };

  const renderBlockCard = (
    block: RoutineBlock,
    index: number,
    graphPos?: { x: number; y: number }
  ) => {
    const isBlockDone = progress.completedBlockIds.includes(block.id);
    const palette = getBlockPalette(block, index);
    const doneStepsCount = isBlockDone
      ? block.steps.length
      : block.steps.filter((_, i) => progress.completedStepKeys.includes(`${block.id}:${i}`)).length;
    const isCurrentTime =
      typeof block.startMinute === 'number' &&
      typeof block.endMinute === 'number' &&
      nowMinutes >= block.startMinute &&
      nowMinutes < block.endMinute;

    const cardStyle = {
      ...(graphPos ? { left: graphPos.x, top: graphPos.y, width: GRAPH_NODE_W } : {}),
      '--block-hex': palette.hex,
      '--block-rgb': palette.rgb,
    } as React.CSSProperties;

    return (
      <article
        key={block.id}
        data-interactive={graphPos ? 'true' : undefined}
        onMouseEnter={graphPos ? () => setHoveredId(block.id) : undefined}
        onMouseLeave={graphPos ? () => setHoveredId((prev) => (prev === block.id ? null : prev)) : undefined}
        className={`${graphPos ? styles.graphNodeCard : styles.blockCard} ${isCurrentTime && !isBlockDone ? styles.blockCardCurrent : ''} ${isBlockDone ? styles.blockCardDone : ''}`}
        style={cardStyle}
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
                <span className={styles.stepIndexBadge}>{index + 1}</span>
                <span className={styles.timeBadge}>
                  <Clock size={11} />
                  {block.timeRange}
                </span>
                {block.steps.length > 0 && (
                  <span className={`${styles.stepCountBadge} ${isBlockDone ? styles.stepCountBadgeDone : ''}`}>
                    {doneStepsCount}/{block.steps.length}
                  </span>
                )}
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
      {/* ── Minimalist Top Bar (Matches Roadmap & System Tab Headers) ── */}
      <header className={styles.summaryHeader}>
        <div className={styles.summaryLeft}>
          <h1 className={styles.summaryTitle}>Daily Routine</h1>
        </div>

        <div className={styles.summaryRight}>
          <div className={`${styles.progressBox} ${completionPct === 100 ? styles.progressBoxComplete : ''}`}>
            <div className={styles.progressTextRow}>
              <span>
                {completedCount}/{blocks.length} ({completionPct}%)
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
              className={`${styles.layoutBtn} ${layoutMode === 'graph' ? styles.layoutBtnActive : ''}`}
              onClick={() => setLayoutMode('graph')}
              title="Graph Flow view"
            >
              <GitBranch size={12} />
              <span>Graph Flow</span>
            </button>
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
              <span>Clear</span>
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

      {/* ── Graph Flow View OR Scrollable Grid / Timeline ── */}
      {layoutMode === 'graph' ? (
        <div
          ref={viewportRef}
          className={`${styles.graphViewport} ${isDragging ? styles.graphViewportDragging : ''}`}
          onMouseDown={handleGraphMouseDown}
          onMouseMove={handleGraphMouseMove}
          onMouseUp={handleGraphMouseUp}
          onMouseLeave={handleGraphMouseUp}
          onTouchStart={handleGraphTouchStart}
          onTouchMove={handleGraphTouchMove}
          onTouchEnd={handleGraphTouchEnd}
          onTouchCancel={handleGraphTouchEnd}
        >
          <div
            className={styles.graphCanvas}
            style={{
              width: graphWidth,
              height: graphHeight,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Dot Grid Background */}
            <svg
              className={styles.dotGrid}
              width={graphWidth}
              height={graphHeight}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              <defs>
                <pattern id="routine-dotgrid" x="0" y="0" width="26" height="26" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1.15" fill="currentColor" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#routine-dotgrid)" />
            </svg>

            {/* Phase Column Pills */}
            {phaseHeaders.map((ph) => {
              const phaseRgb = PHASE_RGB_LIST[ph.colIdx % PHASE_RGB_LIST.length];
              return (
                <div
                  key={ph.colIdx}
                  className={styles.phaseHeaderChip}
                  style={{ left: ph.x, top: ph.y, '--phase-rgb': phaseRgb } as React.CSSProperties}
                >
                  <span className={styles.phaseDot} />
                  <span>{ph.label}</span>
                </div>
              );
            })}

            {/* Curved SVG Flow Paths */}
            <svg
              width={graphWidth}
              height={graphHeight}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
            >
              <defs>
                {ROUTINE_PALETTE.map((pal) => (
                  <marker
                    key={pal.id}
                    id={`routine-arrow-${pal.id}`}
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L6,3 z" fill={pal.hex} />
                  </marker>
                ))}
              </defs>

              {graphNodes.slice(0, -1).map((fromNode, idx) => {
                const toNode = graphNodes[idx + 1];
                if (!toNode) return null;
                const fromPalette = getBlockPalette(fromNode.block, fromNode.index);
                const isPowered = progress.completedBlockIds.includes(fromNode.block.id);
                const isHoveredEdge = hoveredId === fromNode.block.id || hoveredId === toNode.block.id;

                return (
                  <g key={`${fromNode.block.id}->${toNode.block.id}`}>
                    <path
                      d={getFlowEdgePath(fromNode, toNode)}
                      fill="none"
                      stroke={fromPalette.hex}
                      strokeWidth={isPowered ? 2.6 : isHoveredEdge ? 2.3 : 1.75}
                      strokeOpacity={isPowered ? 0.95 : isHoveredEdge ? 0.9 : 0.45}
                      className={isPowered ? styles.flowLineActive : undefined}
                      markerEnd={`url(#routine-arrow-${fromPalette.id})`}
                      style={{ transition: 'stroke-opacity 0.2s ease, stroke-width 0.2s ease' }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Interactive Flow Nodes */}
            {graphNodes.map(({ block, index, x, y }) => renderBlockCard(block, index, { x, y }))}
          </div>

          <div className={styles.graphHintBadge}>Drag canvas to pan · Scroll to zoom</div>

          {/* Floating Zoom & Fit Controls */}
          <div className={styles.graphFloatingControls} data-interactive="true">
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={() => setZoom((z) => Math.max(0.35, Number((z - 0.1).toFixed(2))))}
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span className={styles.zoomPct}>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))))}
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={fitGraphToViewport}
              title="Fit Routine Graph to Screen"
              aria-label="Fit View"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.routineScrollArea}>
          <div className={styles.routineInner}>
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
        </div>
      )}

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
                <label className={styles.formLabel}>Block Color</label>
                <div className={styles.colorSwatchRow} role="radiogroup" aria-label="Block accent color">
                  {ROUTINE_PALETTE.map((pal) => {
                    const isSelected = formColor === pal.id;
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={pal.label}
                        title={pal.label}
                        onClick={() => setFormColor(pal.id)}
                        className={`${styles.colorSwatchBtn} ${isSelected ? styles.colorSwatchBtnSelected : ''}`}
                        style={{ '--swatch-hex': pal.hex, '--swatch-rgb': pal.rgb } as React.CSSProperties}
                      />
                    );
                  })}
                </div>
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
