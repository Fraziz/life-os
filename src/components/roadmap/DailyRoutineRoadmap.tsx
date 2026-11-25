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
import {
  DEFAULT_DAILY_ROUTINE,
  ROUTINE_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  getTodayDateKey,
  notifyDailyRoutineUpdated,
  clearDailyRoutineReminderDoneToday,
  type RoutineBlock,
  type DailyProgressState,
} from '@/utils/dailyRoutineReminder';
import styles from './DailyRoutineRoadmap.module.css';

export type { RoutineBlock };
export { DEFAULT_DAILY_ROUTINE };

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

const GRAPH_NODE_W = 296;
const GRAPH_COL_GAP = 104;
const GRAPH_ROW_GAP = 48;
const GRAPH_PAD_X = 48;
const GRAPH_TOP_Y = 64;
const ROUTINE_POSITIONS_STORAGE_KEY = 'life_os_daily_routine_positions_v1';

interface GraphPositionedNode {
  block: RoutineBlock;
  index: number;
  colIdx: number;
  x: number;
  y: number;
  height: number;
}

function estimateGraphNodeHeight(block: RoutineBlock): number {
  const stepLines = block.steps.reduce((sum, s) => sum + Math.max(1, Math.ceil(s.length / 30)), 0);
  return 104 + (block.subLabel ? 22 : 0) + stepLines * 24 + Math.max(0, block.steps.length - 1) * 6;
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

  // Graph Flow Pan, Zoom & Draggable Node state
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState({ x: 24, y: 12 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});
  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const nodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const nodeRefs = useRef<Record<string, HTMLElement | null>>({});
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

  // Hydrate blocks + custom positions + daily check state (resets checks automatically on a new day)
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

    try {
      const savedPos = localStorage.getItem(ROUTINE_POSITIONS_STORAGE_KEY);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (parsed && typeof parsed === 'object') {
          setNodePositions(parsed);
          nodePositionsRef.current = parsed;
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
    notifyDailyRoutineUpdated();
  };

  const persistProgress = (next: DailyProgressState) => {
    setProgress(next);
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
    notifyDailyRoutineUpdated();
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
    clearDailyRoutineReminderDoneToday();
  };

  const handleResetNodePositions = useCallback(() => {
    setNodePositions({});
    nodePositionsRef.current = {};
    try {
      localStorage.removeItem(ROUTINE_POSITIONS_STORAGE_KEY);
    } catch {}
  }, []);

  const handleRestoreDefaultRoutine = () => {
    if (!confirm('Restore the default 7:00 AM – 9:00 PM Daily Routine?')) return;
    persistBlocks(DEFAULT_DAILY_ROUTINE);
    handleResetTodayChecks();
    handleResetNodePositions();
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

  // Measure rendered card heights in Graph Flow so arrows attach accurately to card edges
  useEffect(() => {
    if (layoutMode !== 'graph') return;
    const measure = () => {
      const next: Record<string, number> = {};
      let changed = false;
      blocks.forEach((b) => {
        const el = nodeRefs.current[b.id];
        if (el) {
          const h = el.offsetHeight;
          if (h > 0) {
            next[b.id] = h;
            if (nodeHeights[b.id] !== h) changed = true;
          }
        }
      });
      if (changed) setNodeHeights(next);
    };
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [blocks, layoutMode, progress.completedBlockIds, nodeHeights]);

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

    let maxX = 1180;
    let maxY = 500;
    colBuckets.forEach((colItems, colIdx) => {
      if (colItems.length === 0) return;
      const defaultX = GRAPH_PAD_X + colIdx * (GRAPH_NODE_W + GRAPH_COL_GAP);
      headers.push({
        colIdx,
        label: PHASE_NAMES[colIdx] || `Phase ${colIdx + 1}`,
        x: defaultX,
        y: 20,
      });

      let curY = GRAPH_TOP_Y;
      colItems.forEach(({ block, index }) => {
        const h = nodeHeights[block.id] || estimateGraphNodeHeight(block);
        const custom = nodePositions[block.id];
        const x = custom ? custom.x : defaultX;
        const y = custom ? custom.y : curY;
        positioned.push({ block, index, colIdx, x, y, height: h });
        if (x + GRAPH_NODE_W + 64 > maxX) maxX = x + GRAPH_NODE_W + 64;
        if (y + h + 64 > maxY) maxY = y + h + 64;
        curY += h + GRAPH_ROW_GAP;
        if (curY + 48 > maxY) maxY = curY + 48;
      });
    });

    // Ensure sequential visual order matches block index order for edge connections
    positioned.sort((a, b) => a.index - b.index);

    const totalCols = Math.max(1, colBuckets.length);
    const baseWidth = Math.max(1180, GRAPH_PAD_X * 2 + totalCols * GRAPH_NODE_W + (totalCols - 1) * GRAPH_COL_GAP);
    const width = Math.max(baseWidth, maxX);
    const height = Math.max(760, maxY);

    return { graphNodes: positioned, graphWidth: width, graphHeight: height, phaseHeaders: headers };
  }, [blocks, nodePositions, nodeHeights]);

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

  const fitGraphRef = useRef(fitGraphToViewport);
  fitGraphRef.current = fitGraphToViewport;

  useEffect(() => {
    if (layoutMode === 'graph') {
      fitGraphRef.current();
    }
  }, [layoutMode]);

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

  const handleNodeMouseDown = (
    e: React.MouseEvent,
    blockId: string,
    pos: { x: number; y: number }
  ) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, textarea')) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    setDraggingNode({
      id: blockId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    });
  };

  const handleNodeTouchStart = (
    e: React.TouchEvent,
    blockId: string,
    pos: { x: number; y: number }
  ) => {
    if (e.touches.length !== 1) return;
    if ((e.target as HTMLElement).closest('button, a, input, textarea')) {
      return;
    }
    e.stopPropagation();
    setDraggingNode({
      id: blockId,
      startClientX: e.touches[0].clientX,
      startClientY: e.touches[0].clientY,
      origX: pos.x,
      origY: pos.y,
    });
  };

  // Global mouse drag tracking while moving a routine card so fast drags remain smooth
  useEffect(() => {
    if (!draggingNode) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - draggingNode.startClientX) / zoom;
      const dy = (e.clientY - draggingNode.startClientY) / zoom;
      const nextPos = {
        x: Math.round(draggingNode.origX + dx),
        y: Math.round(draggingNode.origY + dy),
      };
      const updated = { ...nodePositionsRef.current, [draggingNode.id]: nextPos };
      nodePositionsRef.current = updated;
      setNodePositions(updated);
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const dx = (e.touches[0].clientX - draggingNode.startClientX) / zoom;
      const dy = (e.touches[0].clientY - draggingNode.startClientY) / zoom;
      const nextPos = {
        x: Math.round(draggingNode.origX + dx),
        y: Math.round(draggingNode.origY + dy),
      };
      const updated = { ...nodePositionsRef.current, [draggingNode.id]: nextPos };
      nodePositionsRef.current = updated;
      setNodePositions(updated);
    };

    const finishNodeDrag = () => {
      setDraggingNode(null);
      try {
        localStorage.setItem(ROUTINE_POSITIONS_STORAGE_KEY, JSON.stringify(nodePositionsRef.current));
      } catch {}
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', finishNodeDrag);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true });
    window.addEventListener('touchend', finishNodeDrag);
    window.addEventListener('touchcancel', finishNodeDrag);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', finishNodeDrag);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', finishNodeDrag);
      window.removeEventListener('touchcancel', finishNodeDrag);
    };
  }, [draggingNode, zoom]);

  const handleGraphMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || draggingNode) return;
    if ((e.target as HTMLElement).closest('button, a, input, textarea, [data-interactive="true"]')) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleGraphMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || draggingNode) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleGraphMouseUp = () => setIsDragging(false);

  const handleGraphTouchStart = (e: React.TouchEvent) => {
    if (draggingNode) return;
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
    if (draggingNode) return;
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
    const fromCx = from.x + GRAPH_NODE_W / 2;
    const fromCy = from.y + from.height / 2;
    const toCx = to.x + GRAPH_NODE_W / 2;
    const toCy = to.y + to.height / 2;
    const dx = toCx - fromCx;
    const dy = toCy - fromCy;

    // Route horizontally when horizontally separated more than vertically (supports dragging left OR right)
    if (Math.abs(dx) >= Math.abs(dy) * 0.85) {
      const goingRight = dx >= 0;
      const sx = goingRight ? from.x + GRAPH_NODE_W : from.x;
      const sy = fromCy;
      const tx = goingRight ? to.x : to.x + GRAPH_NODE_W;
      const ty = toCy;
      const curve = Math.max(48, Math.abs(tx - sx) * 0.52);
      const c1x = goingRight ? sx + curve : sx - curve;
      const c2x = goingRight ? tx - curve : tx + curve;
      return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`;
    }

    // Route vertically (supports dragging above OR below)
    const goingDown = dy >= 0;
    const sx = fromCx;
    const sy = goingDown ? from.y + from.height : from.y;
    const tx = toCx;
    const ty = goingDown ? to.y : to.y + to.height;
    const curve = Math.max(36, Math.abs(ty - sy) * 0.52);
    const c1y = goingDown ? sy + curve : sy - curve;
    const c2y = goingDown ? ty - curve : ty + curve;
    return `M ${sx} ${sy} C ${sx} ${c1y}, ${tx} ${c2y}, ${tx} ${ty}`;
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

    const isThisDragging = draggingNode?.id === block.id;

    return (
      <article
        key={block.id}
        ref={
          graphPos
            ? (el) => {
                nodeRefs.current[block.id] = el;
              }
            : undefined
        }
        data-interactive={graphPos ? 'true' : undefined}
        onMouseDown={graphPos ? (e) => handleNodeMouseDown(e, block.id, graphPos) : undefined}
        onTouchStart={graphPos ? (e) => handleNodeTouchStart(e, block.id, graphPos) : undefined}
        onMouseEnter={graphPos ? () => setHoveredId(block.id) : undefined}
        onMouseLeave={graphPos ? () => setHoveredId((prev) => (prev === block.id ? null : prev)) : undefined}
        className={`${graphPos ? styles.graphNodeCard : styles.blockCard} ${isThisDragging ? styles.graphNodeDragging : ''} ${isCurrentTime && !isBlockDone ? styles.blockCardCurrent : ''} ${isBlockDone ? styles.blockCardDone : ''}`}
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
                  style={{ left: ph.x + GRAPH_NODE_W / 2, top: ph.y, '--phase-rgb': phaseRgb } as React.CSSProperties}
                >
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

          <div className={styles.graphHintBadge}>
            Drag boxes to move · Drag background to pan · Scroll to zoom
          </div>

          {/* Floating Zoom, Fit & Auto-Arrange Controls */}
          <div className={styles.graphFloatingControls} data-interactive="true">
            {Object.keys(nodePositions).length > 0 && (
              <button
                type="button"
                className={styles.zoomBtn}
                onClick={handleResetNodePositions}
                title="Reset boxes to default layout"
                aria-label="Reset boxes layout"
              >
                <RotateCcw size={13} />
              </button>
            )}
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
