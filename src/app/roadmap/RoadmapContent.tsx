'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  GitBranch,
  CloudSun,
  Target,
  FolderKanban,
  CheckSquare,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  ExternalLink,
  X,
  PanelLeft,
  PanelLeftClose,
  Eye,
  EyeOff,
  Check,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { useDreams } from '@/context/DreamContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useTasks } from '@/context/TaskContext';
import styles from './page.module.css';

// ── Layout constants ──────────────────────────────────────────
const NODE_W = 250;
const NODE_H = 104;
const COL_GAP = 300;
const ROW_GAP = 125;
// Flow: Task (0) → Project (1) → Goal (2) → Dream (3)
const COL_STARTS = [50, 50 + COL_GAP, 50 + COL_GAP * 2, 50 + COL_GAP * 3];
const CANVAS_PAD = 70; // Room for canvas column headers at y=25

const AREA_COLORS: Record<string, string> = {
  'area-creative': '#ff6b6b',
  'area-career':   '#7c6fff',
  'area-money':    '#f5a623',
  'area-learning': '#4db8ff',
  'area-health':   '#22d3a5',
  'area-social':   '#ff79c6',
  'area-mindset':  '#bd93f9',
  'area-family':   '#ffb86c',
};
const AREA_LABELS: Record<string, string> = {
  'area-creative': 'Creative',
  'area-career':   'Career',
  'area-money':    'Finance',
  'area-learning': 'Learning',
  'area-health':   'Health',
  'area-social':   'Social',
  'area-mindset':  'Mindset',
  'area-family':   'Family',
};
const DEFAULT_COLOR = '#7c6fff';

type FilterMode = 'all' | 'active' | string;

interface NodePosition {
  id: string;
  x: number;
  y: number;
  color: string;
  type: 'task' | 'project' | 'goal' | 'dream';
  title: string;
  progress?: number;
  status?: string;
  parentId?: string;
  lifeAreaId?: string;
}

interface Connection {
  fromId: string;
  toId: string;
  color: string;
}

export default function RoadmapContent() {
  const { dreams, isLoaded: dreamsLoaded } = useDreams();
  const { goals, isLoaded: goalsLoaded } = useGoals();
  const { projects, isLoaded: projectsLoaded } = useProjects();
  const { tasks, isLoaded: tasksLoaded, updateTaskStatus } = useTasks();

  const [filter, setFilter] = useState<FilterMode>('all');
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [isCalmMode, setIsCalmMode] = useState(false);
  const [celebrationMsg, setCelebrationMsg] = useState<string | null>(null);
  const [lastCompletedTask, setLastCompletedTask] = useState<{ id: string; title: string; prevStatus: any } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const isLoaded = dreamsLoaded && goalsLoaded && projectsLoaded && tasksLoaded;

  // Track sidebar collapse state
  useEffect(() => {
    try {
      setSidebarHidden(localStorage.getItem('life_os_sidebar_collapsed') === 'true');
    } catch {}
    const handleStorage = () => {
      try {
        setSidebarHidden(localStorage.getItem('life_os_sidebar_collapsed') === 'true');
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleSidebar = () => {
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
    setSidebarHidden(prev => !prev);
  };

  // ── Filtered sets ────────────────────────────────────────
  const filteredDreams = useMemo(() => {
    if (filter === 'active') return dreams.filter(d => d.status !== 'archived');
    if (filter !== 'all') return dreams.filter(d => d.lifeAreaId === filter);
    return dreams;
  }, [dreams, filter]);

  const filteredGoals = useMemo(() => {
    const dreamIds = new Set(filteredDreams.map(d => d.id));
    let g = goals.filter(g => !g.parentDreamId || dreamIds.has(g.parentDreamId));
    if (filter === 'active') g = g.filter(g => g.status !== 'archived' && g.status !== 'completed');
    if (filter !== 'all' && filter !== 'active') g = g.filter(g => g.lifeAreaId === filter);
    return g;
  }, [goals, filteredDreams, filter]);

  const filteredProjects = useMemo(() => {
    const goalIds = new Set(filteredGoals.map(g => g.id));
    let p = projects.filter(p => !p.goalId || goalIds.has(p.goalId));
    if (filter === 'active') p = p.filter(p => p.status === 'active');
    return p;
  }, [projects, filteredGoals, filter]);

  const filteredTasks = useMemo(() => {
    const projIds = new Set(filteredProjects.map(p => p.id));
    return tasks
      .filter(t => t.status !== 'done' && t.projectId && projIds.has(t.projectId))
      .slice(0, 16);
  }, [tasks, filteredProjects]);

  // Unlinked tasks count for ADHD object permanence
  const unlinkedTasks = useMemo(() => {
    return tasks.filter(t => t.status !== 'done' && !t.projectId);
  }, [tasks]);

  // ── Dream aggregate progress (avg of linked goals) ──────
  const dreamProgress = useMemo(() => {
    const map: Record<string, number> = {};
    filteredDreams.forEach(dream => {
      const linked = filteredGoals.filter(g => g.parentDreamId === dream.id);
      map[dream.id] = linked.length === 0
        ? 0
        : Math.round(linked.reduce((s, g) => s + (g.progress ?? 0), 0) / linked.length);
    });
    return map;
  }, [filteredDreams, filteredGoals]);

  // ── Build balanced cluster layout (Task → Project → Goal → Dream) ──
  const { nodes, connections, canvasHeight } = useMemo(() => {
    const nodes: NodePosition[] = [];
    const connections: Connection[] = [];

    const processedTasks = new Set<string>();
    const processedProjects = new Set<string>();
    const processedGoals = new Set<string>();
    const processedDreams = new Set<string>();

    interface Cluster {
      tasks: typeof filteredTasks;
      projects: typeof filteredProjects;
      goals: typeof filteredGoals;
      dreams: typeof filteredDreams;
    }

    const clusters: Cluster[] = [];

    // 1. Seed clusters from Goals
    filteredGoals.forEach(goal => {
      if (processedGoals.has(goal.id)) return;
      processedGoals.add(goal.id);

      const clusterProjects = filteredProjects.filter(p => p.goalId === goal.id);
      clusterProjects.forEach(p => processedProjects.add(p.id));

      const clusterTasks = filteredTasks.filter(t => clusterProjects.some(p => p.id === t.projectId));
      clusterTasks.forEach(t => processedTasks.add(t.id));

      const clusterDreams = filteredDreams.filter(d => goal.parentDreamId === d.id);
      clusterDreams.forEach(d => processedDreams.add(d.id));

      clusters.push({
        tasks: clusterTasks,
        projects: clusterProjects,
        goals: [goal],
        dreams: clusterDreams,
      });
    });

    // 2. Unlinked Projects
    filteredProjects.forEach(proj => {
      if (processedProjects.has(proj.id)) return;
      processedProjects.add(proj.id);
      const clusterTasks = filteredTasks.filter(t => t.projectId === proj.id);
      clusterTasks.forEach(t => processedTasks.add(t.id));
      clusters.push({
        tasks: clusterTasks,
        projects: [proj],
        goals: [],
        dreams: [],
      });
    });

    // 3. Remaining unlinked Dreams
    const remainingDreams = filteredDreams.filter(d => !processedDreams.has(d.id));
    if (remainingDreams.length > 0) {
      clusters.push({
        tasks: [],
        projects: [],
        goals: [],
        dreams: remainingDreams,
      });
    }

    // 4. Remaining unlinked Tasks
    const remainingTasks = filteredTasks.filter(t => !processedTasks.has(t.id));
    if (remainingTasks.length > 0) {
      clusters.push({
        tasks: remainingTasks,
        projects: [],
        goals: [],
        dreams: [],
      });
    }

    // Now layout each cluster vertically
    let currentY = CANVAS_PAD;

    clusters.forEach(cluster => {
      const maxCount = Math.max(
        cluster.tasks.length,
        cluster.projects.length,
        cluster.goals.length,
        cluster.dreams.length,
        1
      );
      const clusterHeight = maxCount * ROW_GAP;
      const clusterCenterY = currentY + clusterHeight / 2;

      // Helper to center items vertically in this cluster
      const layoutColumn = <T,>(items: T[], colIndex: number, renderNode: (item: T, y: number) => void) => {
        const count = items.length;
        if (count === 0) return;
        const totalSpan = (count - 1) * ROW_GAP;
        const startY = clusterCenterY - totalSpan / 2 - NODE_H / 2;
        items.forEach((item, idx) => {
          renderNode(item, startY + idx * ROW_GAP);
        });
      };

      // Layout Tasks
      layoutColumn(cluster.tasks, 0, (task, y) => {
        const parentProj = filteredProjects.find(p => p.id === task.projectId);
        const parentGoal = parentProj ? filteredGoals.find(g => g.id === parentProj.goalId) : undefined;
        const color = parentGoal?.lifeAreaId
          ? (AREA_COLORS[parentGoal.lifeAreaId] ?? DEFAULT_COLOR)
          : DEFAULT_COLOR;
        nodes.push({
          id: task.id,
          x: COL_STARTS[0],
          y,
          color,
          type: 'task',
          title: task.title,
          status: task.status,
          parentId: task.projectId ?? undefined,
        });
      });

      // Layout Projects
      layoutColumn(cluster.projects, 1, (proj, y) => {
        const parentGoal = filteredGoals.find(g => g.id === proj.goalId);
        const color = parentGoal?.lifeAreaId
          ? (AREA_COLORS[parentGoal.lifeAreaId] ?? DEFAULT_COLOR)
          : DEFAULT_COLOR;
        nodes.push({
          id: proj.id,
          x: COL_STARTS[1],
          y,
          color,
          type: 'project',
          title: proj.title,
          progress: proj.progress,
          status: proj.status,
          parentId: proj.goalId ?? undefined,
        });
      });

      // Layout Goals
      layoutColumn(cluster.goals, 2, (goal, y) => {
        const color = goal.lifeAreaId
          ? (AREA_COLORS[goal.lifeAreaId] ?? DEFAULT_COLOR)
          : DEFAULT_COLOR;
        nodes.push({
          id: goal.id,
          x: COL_STARTS[2],
          y,
          color,
          type: 'goal',
          title: goal.title,
          progress: goal.progress,
          status: goal.status,
          parentId: goal.parentDreamId ?? undefined,
          lifeAreaId: goal.lifeAreaId,
        });
      });

      // Layout Dreams
      layoutColumn(cluster.dreams, 3, (dream, y) => {
        const color = dream.lifeAreaId
          ? (AREA_COLORS[dream.lifeAreaId] ?? DEFAULT_COLOR)
          : DEFAULT_COLOR;
        nodes.push({
          id: dream.id,
          x: COL_STARTS[3],
          y,
          color,
          type: 'dream',
          title: dream.title,
          progress: dreamProgress[dream.id],
          status: dream.status,
          lifeAreaId: dream.lifeAreaId,
        });
      });

      currentY += clusterHeight + 40;
    });

    // Collision avoidance per column to guarantee no overlaps
    for (let col = 0; col < 4; col++) {
      const colNodes = nodes.filter(n => n.x === COL_STARTS[col]).sort((a, b) => a.y - b.y);
      for (let i = 1; i < colNodes.length; i++) {
        const prev = colNodes[i - 1];
        const cur = colNodes[i];
        if (cur.y < prev.y + NODE_H + 18) {
          cur.y = prev.y + NODE_H + 18;
        }
      }
    }

    // Build connections
    nodes.forEach(n => {
      if (n.parentId) {
        const parent = nodes.find(p => p.id === n.parentId);
        if (parent) {
          connections.push({
            fromId: n.id,
            toId: parent.id,
            color: parent.color || n.color,
          });
        }
      }
    });

    nodes.filter(n => n.type === 'goal').forEach(g => {
      if (g.parentId) {
        const dream = nodes.find(d => d.id === g.parentId && d.type === 'dream');
        if (dream && !connections.some(c => c.fromId === g.id && c.toId === dream.id)) {
          connections.push({
            fromId: g.id,
            toId: dream.id,
            color: dream.color || g.color,
          });
        }
      }
    });

    const maxY = nodes.reduce((m, n) => Math.max(m, n.y + NODE_H + CANVAS_PAD), 520);
    return { nodes, connections, canvasHeight: maxY };
  }, [filteredTasks, filteredProjects, filteredGoals, filteredDreams, dreamProgress]);

  const canvasWidth = COL_STARTS[3] + NODE_W + CANVAS_PAD;

  const nodeMap = useMemo(() => {
    const m: Record<string, NodePosition> = {};
    nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [nodes]);

  // ── Focus mode: walk the full chain of a clicked node ───
  const focusedChain = useMemo<Set<string> | null>(() => {
    if (!focusedNodeId) return null;
    const chain = new Set<string>();
    chain.add(focusedNodeId);

    // Follow parentId upward toward Dream
    let cur: NodePosition | undefined = nodeMap[focusedNodeId];
    while (cur?.parentId) {
      chain.add(cur.parentId);
      cur = nodeMap[cur.parentId];
    }

    // Follow downward toward Tasks
    const addChildren = (parentId: string) => {
      nodes.filter(n => n.parentId === parentId).forEach(n => {
        chain.add(n.id);
        addChildren(n.id);
      });
    };
    addChildren(focusedNodeId);

    return chain;
  }, [focusedNodeId, nodes, nodeMap]);

  // ── Immediate Next Action (ADHD Next Small Win) ─────────
  const activeNextStep = useMemo(() => {
    const activeTask = nodes.find(n => n.type === 'task' && n.status !== 'done');
    if (!activeTask) return null;

    const parentProj = activeTask.parentId ? nodeMap[activeTask.parentId] : null;
    const parentGoal = parentProj?.parentId ? nodeMap[parentProj.parentId] : null;
    const parentDream = parentGoal?.parentId ? nodeMap[parentGoal.parentId] : null;

    return {
      task: activeTask,
      project: parentProj,
      goal: parentGoal,
      dream: parentDream,
    };
  }, [nodes, nodeMap]);

  // Quick complete action for instant ADHD dopamine
  const handleQuickDone = (taskId: string, taskTitle: string) => {
    const task = nodes.find(n => n.id === taskId);
    const prevStatus = task?.status || 'todo';
    setLastCompletedTask({ id: taskId, title: taskTitle, prevStatus });
    updateTaskStatus(taskId, 'done');
    setCelebrationMsg(`Done with "${taskTitle}"`);
  };

  // Undo action for completed task (Ctrl+Z or Undo button)
  const handleUndo = useCallback(() => {
    if (!lastCompletedTask) return;
    updateTaskStatus(lastCompletedTask.id, lastCompletedTask.prevStatus || 'todo');
    const title = lastCompletedTask.title;
    setLastCompletedTask(null);
    setCelebrationMsg(`↺ Reverted "${title}" back to active`);
    setTimeout(() => setCelebrationMsg(null), 3000);
  }, [lastCompletedTask, updateTaskStatus]);

  // Global Ctrl+Z / Cmd+Z handler for Undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (lastCompletedTask) {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lastCompletedTask, handleUndo]);

  // ── Area legend ──────────────────────────────────────────
  const uniqueAreas = useMemo(() => {
    const seen = new Set<string>();
    [...filteredDreams, ...filteredGoals].forEach(item => {
      if (item.lifeAreaId) seen.add(item.lifeAreaId);
    });
    return Array.from(seen);
  }, [filteredDreams, filteredGoals]);

  // ── Pan ──────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]') || (e.target as HTMLElement).closest('[data-header]') || (e.target as HTMLElement).closest('[data-pill]')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // ── Zoom ─────────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.25, Math.min(2, z - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(0.8);
    setFocusedNodeId(null);
  }, []);

  // ── Bezier connection path ───────────────────────────────
  function getBezierPath(from: NodePosition, to: NodePosition): string {
    const x1 = from.x + NODE_W;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_H / 2;
    const cx1 = x1 + Math.abs(x2 - x1) * 0.5;
    const cx2 = x2 - Math.abs(x2 - x1) * 0.5;
    return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
  }

  const isEmpty =
    filteredDreams.length === 0 &&
    filteredGoals.length === 0 &&
    filteredProjects.length === 0 &&
    filteredTasks.length === 0;

  if (!isLoaded) {
    return (
      <div className={styles.loadingScreen}>
        <GitBranch size={28} style={{ color: 'var(--color-accent)', opacity: 0.6 }} />
        <p>Loading Roadmap...</p>
      </div>
    );
  }

  return (
    <div className={styles.roadmapPage}>
      {/* ── Ultra-Slim Floating Header (Figma / Linear HUD style) ── */}
      <div className={styles.floatingHeader} data-header="true">
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.navToggleBtn}
            onClick={toggleSidebar}
            title="Toggle left navigation (Ctrl+B)"
          >
            {sidebarHidden ? <PanelLeft size={13} /> : <PanelLeftClose size={13} />}
            <span>{sidebarHidden ? 'Show Nav' : 'Hide Nav'}</span>
          </button>

          <div className={styles.headerDivider} />

          <span className={styles.pageTitle}>
            Roadmap
            <span className={styles.pageSub}>Task → Dream</span>
          </span>

          {/* ADHD Calm Mode & Unlinked Alert */}
          <button
            type="button"
            className={`${styles.adhdBtn} ${isCalmMode ? styles.adhdBtnActive : ''}`}
            onClick={() => setIsCalmMode(v => !v)}
            title="ADHD Calm View: Dims distractions and isolates active path"
          >
            {isCalmMode ? <EyeOff size={11} /> : <Eye size={11} />}
            <span>{isCalmMode ? 'Calm: On' : 'Calm View'}</span>
          </button>

          {unlinkedTasks.length > 0 && (
            <Link href="/tasks" className={styles.unlinkedChip} title="Tasks without a parent project">
              <Zap size={10} />
              <span>{unlinkedTasks.length} unlinked</span>
            </Link>
          )}
        </div>

        {/* Center filters */}
        <div className={styles.filterRow}>
          <button
            className={`${styles.filterPill} ${filter === 'all' ? styles.filterActive : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`${styles.filterPill} ${filter === 'active' ? styles.filterActive : ''}`}
            onClick={() => setFilter('active')}
          >
            <Sparkles size={10} /> Active
          </button>
          {uniqueAreas.map(areaId => (
            <button
              key={areaId}
              className={`${styles.filterPill} ${filter === areaId ? styles.filterActive : ''}`}
              style={filter === areaId ? { color: AREA_COLORS[areaId] } : {}}
              onClick={() => setFilter(f => f === areaId ? 'all' : areaId)}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: AREA_COLORS[areaId] ?? DEFAULT_COLOR, display: 'inline-block' }} />
              {AREA_LABELS[areaId] ?? areaId}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div className={styles.headerRight}>
          {focusedNodeId && (
            <button
              className={styles.ctrlBtn}
              onClick={() => setFocusedNodeId(null)}
              title="Exit Focus Mode"
              style={{ color: 'var(--color-accent)', width: 'auto', padding: '0 8px', gap: 4 }}
            >
              <X size={12} /> Clear
            </button>
          )}

          {lastCompletedTask && (
            <button
              type="button"
              className={styles.adhdUndoBtn}
              onClick={handleUndo}
              title="Undo completed task (Ctrl+Z)"
            >
              <RotateCcw size={10} /> Undo
            </button>
          )}

          <button className={styles.ctrlBtn} onClick={() => setZoom(z => Math.min(2, z + 0.1))} title="Zoom In">
            <ZoomIn size={13} />
          </button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button className={styles.ctrlBtn} onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} title="Zoom Out">
            <ZoomOut size={13} />
          </button>
          <button className={styles.ctrlBtn} onClick={resetView} title="Reset Canvas View">
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* ── Canvas viewport ── */}
      <div
        ref={containerRef}
        className={`${styles.canvasViewport} ${isDragging ? styles.dragging : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {isEmpty ? (
          <div className={styles.emptyCanvas}>
            <GitBranch size={36} style={{ color: 'var(--color-accent)', opacity: 0.45, marginBottom: 14 }} />
            <p className={styles.emptyTitle}>Roadmap is empty</p>
            <p className={styles.emptySubtitle}>
              Add tasks, projects, goals, or dreams to connect today's tasks to your long-term vision.
            </p>
            <div className={styles.emptyActions}>
              <Link href="/tasks" className={styles.emptyActionBtn}>
                <CheckSquare size={12} /> Add Task
              </Link>
              <Link href="/projects" className={styles.emptyActionBtn}>
                <FolderKanban size={12} /> Add Project
              </Link>
              <Link href="/goals" className={styles.emptyActionBtn}>
                <Target size={12} /> Add Goal
              </Link>
              <Link href="/dreams" className={styles.emptyActionBtn}>
                <CloudSun size={12} /> Add Dream
              </Link>
            </div>
          </div>
        ) : (
          <div
            ref={canvasRef}
            className={styles.canvas}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: canvasWidth,
              height: canvasHeight,
            }}
          >
            {/* Dot grid */}
            <svg
              className={styles.dotGrid}
              width={canvasWidth}
              height={canvasHeight}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              <defs>
                <pattern id="dotgrid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.05)" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dotgrid)" />
            </svg>

            {/* Column Headers rendered directly on canvas */}
            {[
              { label: 'Tasks', icon: <CheckSquare size={11} />, col: 0 },
              { label: 'Projects', icon: <FolderKanban size={11} />, col: 1 },
              { label: 'Goals', icon: <Target size={11} />, col: 2 },
              { label: 'Dreams', icon: <CloudSun size={11} />, col: 3 },
            ].map(({ label, icon, col }) => (
              <div
                key={label}
                className={styles.canvasColHeader}
                style={{
                  left: COL_STARTS[col] + NODE_W / 2,
                  top: 25,
                }}
              >
                {icon} {label}
              </div>
            ))}

            {/* SVG connections */}
            <svg
              className={styles.svgOverlay}
              width={canvasWidth}
              height={canvasHeight}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
            >
              <defs>
                {connections.map((conn, i) => (
                  <marker
                    key={`arr-${i}`}
                    id={`arrow-${i}`}
                    markerWidth="5"
                    markerHeight="5"
                    refX="4"
                    refY="2.5"
                    orient="auto"
                  >
                    <path d="M0,0 L0,5 L5,2.5 z" fill={conn.color} opacity="0.8" />
                  </marker>
                ))}
              </defs>

              {connections.map((conn, i) => {
                const from = nodeMap[conn.fromId];
                const to = nodeMap[conn.toId];
                if (!from || !to) return null;
                const inFocus = focusedChain
                  ? focusedChain.has(conn.fromId) && focusedChain.has(conn.toId)
                  : null;
                const highlighted = hoveredNode === conn.fromId || hoveredNode === conn.toId;
                const dimmed = (focusedChain !== null && !inFocus) || (isCalmMode && !inFocus);

                if (isCalmMode && !inFocus && focusedChain !== null) return null;

                return (
                  <path
                    key={`conn-${i}`}
                    d={getBezierPath(from, to)}
                    fill="none"
                    stroke={conn.color}
                    strokeWidth={highlighted || inFocus ? 2.2 : 1.4}
                    strokeOpacity={dimmed ? 0.03 : highlighted || inFocus ? 0.95 : 0.4}
                    markerEnd={`url(#arrow-${i})`}
                    className={styles.connectionPath}
                    style={{ transition: 'stroke-opacity 0.2s, stroke-width 0.2s' }}
                  />
                );
              })}
            </svg>

            {/* Node cards */}
            {nodes.map(node => {
              const inFocus = focusedChain !== null ? focusedChain.has(node.id) : null;
              if (isCalmMode && inFocus === false) return null;

              return (
                <RoadmapNodeCard
                  key={node.id}
                  node={node}
                  isHovered={hoveredNode === node.id}
                  isConnected={
                    hoveredNode != null &&
                    connections.some(
                      c => (c.fromId === hoveredNode && c.toId === node.id) ||
                        (c.toId === hoveredNode && c.fromId === node.id)
                    )
                  }
                  isFocused={inFocus}
                  focusedNodeId={focusedNodeId}
                  onHover={setHoveredNode}
                  onFocus={setFocusedNodeId}
                />
              );
            })}
          </div>
        )}

        {/* ── Sleek Floating ADHD Action Pill with Undo ── */}
        {(celebrationMsg || focusedNodeId || activeNextStep) && (
          <div className={styles.adhdFloatingPill} data-pill="true">
            {celebrationMsg ? (
              <div className={styles.adhdCelebration}>
                <Sparkles size={13} />
                <span>{celebrationMsg}</span>
                {lastCompletedTask && (
                  <button
                    type="button"
                    className={styles.adhdUndoBtn}
                    onClick={handleUndo}
                    title="Undo (Ctrl+Z)"
                  >
                    <RotateCcw size={10} /> Undo (Ctrl+Z)
                  </button>
                )}
              </div>
            ) : focusedNodeId && nodeMap[focusedNodeId] ? (
              <>
                <span className={styles.adhdTag}>Focus Path</span>
                <div className={styles.adhdPathText}>
                  <span className={styles.adhdHighlight}>{nodeMap[focusedNodeId].title}</span>
                  {nodeMap[focusedNodeId].progress !== undefined && (
                    <span style={{ color: nodeMap[focusedNodeId].color }}>({nodeMap[focusedNodeId].progress}%)</span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.adhdFocusBtn}
                  onClick={() => setFocusedNodeId(null)}
                >
                  <X size={10} /> Clear Focus
                </button>
              </>
            ) : activeNextStep ? (
              <>
                <span className={styles.adhdTag}>Next Win</span>
                <div className={styles.adhdPathText}>
                  <span className={styles.adhdHighlight}>{activeNextStep.task.title}</span>
                  {activeNextStep.dream && (
                    <>
                      <span>➔</span>
                      <span style={{ color: activeNextStep.dream.color }}>{activeNextStep.dream.title}</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.adhdFocusBtn}
                  onClick={() => setFocusedNodeId(activeNextStep.task.id)}
                  title="Isolate this thread and dim all background distractions"
                >
                  <Target size={10} /> Focus Path
                </button>
                <button
                  type="button"
                  className={styles.adhdDoneBtn}
                  onClick={() => handleQuickDone(activeNextStep.task.id, activeNextStep.task.title)}
                  title="Mark task done directly (Undo with Ctrl+Z)"
                >
                  <Check size={11} /> Done
                </button>
              </>
            ) : null}
          </div>
        )}

        {/* Minimal Corner Hint */}
        <div className={styles.canvasHintBadge}>
          <span>💡 Scroll to zoom · Drag to pan · Undo: Ctrl+Z</span>
        </div>
      </div>
    </div>
  );
}

// ── RoadmapNodeCard: Formal, Clean, Polished ───────────────────────
interface NodeCardProps {
  node: NodePosition;
  isHovered: boolean;
  isConnected: boolean;
  isFocused: boolean | null;
  focusedNodeId: string | null;
  onHover: (id: string | null) => void;
  onFocus: (id: string | null) => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  dream:   <CloudSun size={11} />,
  goal:    <Target size={11} />,
  project: <FolderKanban size={11} />,
  task:    <CheckSquare size={11} />,
};
const TYPE_LABELS: Record<string, string> = {
  dream:   'Dream',
  goal:    'Goal',
  project: 'Project',
  task:    'Task',
};
const STATUS_COLORS: Record<string, string> = {
  'in-progress': '#22d3a5',
  'active':      '#22d3a5',
  'dream':       '#7c6fff',
  'planning':    '#4db8ff',
  'not-started': '#8888a8',
  'completed':   '#22d3a5',
  'done':        '#22d3a5',
  'todo':        '#8888a8',
};

function RoadmapNodeCard({ node, isHovered, isConnected, isFocused, focusedNodeId, onHover, onFocus }: NodeCardProps) {
  const typeHrefs: Record<string, string> = {
    dream:   '/dreams',
    goal:    '/goals',
    project: '/projects',
    task:    '/tasks',
  };

  const dimmed = isFocused === false;
  const highlighted = isHovered || isConnected || isFocused === true;

  return (
    <div
      data-node="true"
      className={`${styles.nodeCard} ${isHovered ? styles.nodeHovered : ''} ${isConnected ? styles.nodeConnected : ''}`}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_W,
        minHeight: NODE_H,
        borderColor: highlighted ? node.color : 'rgba(255,255,255,0.08)',
        boxShadow: isHovered || isFocused === true
          ? `0 0 0 1px ${node.color}50, 0 10px 28px rgba(0,0,0,0.5), 0 0 20px ${node.color}25`
          : isConnected
            ? `0 0 0 1px ${node.color}30, 0 6px 18px rgba(0,0,0,0.4)`
            : '0 3px 12px rgba(0,0,0,0.3)',
        opacity: dimmed ? 0.12 : 1,
        transition: 'opacity 0.2s ease, box-shadow 0.18s ease, transform 0.15s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onFocus(focusedNodeId === node.id ? null : node.id)}
    >
      {/* Accent bar on left edge */}
      <div className={styles.nodeAccentBar} style={{ background: node.color }} />

      {/* Header */}
      <div className={styles.nodeHeader}>
        <span className={styles.nodeTypeBadge} style={{ color: node.color, borderColor: `${node.color}35`, background: `${node.color}15` }}>
          {TYPE_ICONS[node.type]}
          {TYPE_LABELS[node.type]}
        </span>
        {node.status && (
          <span
            className={styles.nodeStatusDot}
            style={{ background: STATUS_COLORS[node.status] ?? '#8888a8' }}
            title={`Status: ${node.status}`}
          />
        )}
        <Link
          href={typeHrefs[node.type]}
          className={styles.nodeExternalLink}
          onClick={e => e.stopPropagation()}
          title={`Open ${TYPE_LABELS[node.type]}s`}
        >
          <ExternalLink size={10} />
        </Link>
      </div>

      {/* Title */}
      <div className={styles.nodeTitle}>{node.title}</div>

      {/* Progress bar */}
      {node.progress !== undefined && (
        <div className={styles.nodeProgressArea}>
          <div className={styles.nodeProgressTrack}>
            <div
              className={styles.nodeProgressFill}
              style={{ width: `${node.progress}%`, background: node.color }}
            />
          </div>
          <span className={styles.nodeProgressLabel} style={{ color: node.color }}>
            {node.progress}%
          </span>
        </div>
      )}

      {/* Port dots */}
      <div className={styles.portOut} style={{ background: node.color }} />
      <div className={styles.portIn} style={{ background: node.color }} />
    </div>
  );
}
