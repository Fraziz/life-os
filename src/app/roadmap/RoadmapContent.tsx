'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  GitBranch,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  X,
  RotateCcw,
} from 'lucide-react';
import { useDreams } from '@/context/DreamContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useTasks } from '@/context/TaskContext';
import { useMilestones } from '@/context/MilestoneContext';
import { useSettings } from '@/context/SettingsContext';
import { executeOptionalAICall } from '@/utils/aiEngine';
import styles from './page.module.css';

// ── Layout constants ──────────────────────────────────────────
const NODE_W = 240;
const NODE_H = 96;
const COL_GAP = 280;
const ROW_GAP = 118;
// Flow: Task (0) → Project (1) → Goal (2) → Dream (3)
const COL_STARTS = [40, 40 + COL_GAP, 40 + COL_GAP * 2, 40 + COL_GAP * 3];
const CANVAS_PAD = 64;

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
type HorizonMode = 'all' | '90-day' | 'yearly';
type ViewMode = 'graph' | 'timeline';

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
  const { milestones } = useMilestones();
  const { settings } = useSettings();

  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [horizonFilter, setHorizonFilter] = useState<HorizonMode>('all');

  // AI Strategy Audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditResult, setAuditResult] = useState<string | null>(null);

  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [lastCompletedTask, setLastCompletedTask] = useState<{ id: string; title: string; prevStatus: any } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const isLoaded = dreamsLoaded && goalsLoaded && projectsLoaded && tasksLoaded;

  // ── Filtered sets ────────────────────────────────────────
  const filteredDreams = useMemo(() => {
    let d = dreams;
    if (filter === 'active') d = d.filter(item => item.status !== 'archived');
    if (filter !== 'all' && filter !== 'active') d = d.filter(item => item.lifeAreaId === filter);
    return d;
  }, [dreams, filter]);

  const filteredGoals = useMemo(() => {
    const dreamIds = new Set(filteredDreams.map(d => d.id));
    let g = goals.filter(g => !g.parentDreamId || dreamIds.has(g.parentDreamId));
    if (filter === 'active') g = g.filter(item => item.status !== 'archived' && item.status !== 'completed');
    if (filter !== 'all' && filter !== 'active') g = g.filter(item => item.lifeAreaId === filter);

    if (horizonFilter === '90-day') {
      g = g.filter(item => item.status === 'in-progress' || (item.progress && item.progress > 0));
    }
    return g;
  }, [goals, filteredDreams, filter, horizonFilter]);

  const filteredProjects = useMemo(() => {
    const goalIds = new Set(filteredGoals.map(g => g.id));
    let p = projects.filter(p => !p.goalId || goalIds.has(p.goalId));
    if (filter === 'active') p = p.filter(item => item.status === 'active');
    if (horizonFilter === '90-day') {
      p = p.filter(item => item.status === 'active');
    }
    return p;
  }, [projects, filteredGoals, filter, horizonFilter]);

  const filteredTasks = useMemo(() => {
    const projIds = new Set(filteredProjects.map(p => p.id));
    return tasks
      .filter(t => t.status !== 'done' && t.projectId && projIds.has(t.projectId))
      .slice(0, 20);
  }, [tasks, filteredProjects]);

  const unlinkedTasks = useMemo(() => {
    return tasks.filter(t => t.status !== 'done' && !t.projectId);
  }, [tasks]);

  // ── Executive Alignment Metrics ──────────────────────────
  const metrics = useMemo(() => {
    const activeGoals = goals.filter(g => g.status !== 'archived' && g.status !== 'completed');
    const goalsWithActiveProjects = activeGoals.filter(g =>
      projects.some(p => p.goalId === g.id && p.status === 'active')
    ).length;
    const goalCoverage = activeGoals.length > 0
      ? Math.round((goalsWithActiveProjects / activeGoals.length) * 100)
      : 100;

    const activeProjectCount = projects.filter(p => p.status === 'active').length;
    const activeTaskCount = tasks.filter(t => t.status !== 'done').length;
    const unlinkedCount = unlinkedTasks.length;
    const pendingMilestones = (milestones || []).filter(m => m.status === 'in-progress' || m.status === 'upcoming').length;

    return {
      goalCoverage,
      activeGoalsCount: activeGoals.length,
      goalsWithActiveProjects,
      activeProjectCount,
      activeTaskCount,
      unlinkedCount,
      pendingMilestones,
    };
  }, [goals, projects, tasks, unlinkedTasks, milestones]);

  // ── Dream aggregate progress ─────────────────────────────
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

  // ── Balanced cluster layout (Task → Project → Goal → Dream) ──
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

      const layoutColumn = <T,>(items: T[], colIndex: number, renderNode: (item: T, y: number) => void) => {
        const count = items.length;
        if (count === 0) return;
        const totalSpan = (count - 1) * ROW_GAP;
        const startY = clusterCenterY - totalSpan / 2 - NODE_H / 2;
        items.forEach((item, idx) => {
          renderNode(item, startY + idx * ROW_GAP);
        });
      };

      // Tasks
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

      // Projects
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

      // Goals
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

      // Dreams
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

      currentY += clusterHeight + 36;
    });

    // Collision avoidance
    for (let col = 0; col < 4; col++) {
      const colNodes = nodes.filter(n => n.x === COL_STARTS[col]).sort((a, b) => a.y - b.y);
      for (let i = 1; i < colNodes.length; i++) {
        const prev = colNodes[i - 1];
        const cur = colNodes[i];
        if (cur.y < prev.y + NODE_H + 16) {
          cur.y = prev.y + NODE_H + 16;
        }
      }
    }

    // Connections
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

    const maxY = nodes.reduce((m, n) => Math.max(m, n.y + NODE_H + CANVAS_PAD), 500);
    return { nodes, connections, canvasHeight: maxY };
  }, [filteredTasks, filteredProjects, filteredGoals, filteredDreams, dreamProgress]);

  const canvasWidth = COL_STARTS[3] + NODE_W + CANVAS_PAD;

  const nodeMap = useMemo(() => {
    const m: Record<string, NodePosition> = {};
    nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [nodes]);

  // ── Focus chain ──────────────────────────────────────────
  const focusedChain = useMemo<Set<string> | null>(() => {
    if (!focusedNodeId) return null;
    const chain = new Set<string>();
    chain.add(focusedNodeId);

    let cur: NodePosition | undefined = nodeMap[focusedNodeId];
    while (cur?.parentId) {
      chain.add(cur.parentId);
      cur = nodeMap[cur.parentId];
    }

    const addChildren = (parentId: string) => {
      nodes.filter(n => n.parentId === parentId).forEach(n => {
        chain.add(n.id);
        addChildren(n.id);
      });
    };
    addChildren(focusedNodeId);

    return chain;
  }, [focusedNodeId, nodes, nodeMap]);

  // Undo action for completed task
  const handleUndo = useCallback(() => {
    if (!lastCompletedTask) return;
    updateTaskStatus(lastCompletedTask.id, lastCompletedTask.prevStatus || 'todo');
    setLastCompletedTask(null);
  }, [lastCompletedTask, updateTaskStatus]);

  // Global Ctrl+Z handler
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

  const uniqueAreas = useMemo(() => {
    const seen = new Set<string>();
    [...filteredDreams, ...filteredGoals].forEach(item => {
      if (item.lifeAreaId) seen.add(item.lifeAreaId);
    });
    return Array.from(seen);
  }, [filteredDreams, filteredGoals]);

  // Pan & Zoom
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]') || (e.target as HTMLElement).closest('[data-interactive]')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (viewMode !== 'graph') return;
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(1.8, z - e.deltaY * 0.001)));
  }, [viewMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || viewMode !== 'graph') return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel, viewMode]);

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(0.85);
    setFocusedNodeId(null);
  }, []);

  // AI Strategy Audit
  const handleAuditStrategy = async () => {
    setIsAuditing(true);
    setAuditModalOpen(true);
    try {
      const activeGoals = goals.filter(g => g.status !== 'archived' && g.status !== 'completed');
      const activeProjects = projects.filter(p => p.status === 'active');
      const unlinked = tasks.filter(t => t.status !== 'done' && !t.projectId);

      const prompt = `Conduct a clean, formal 3-bullet strategic executive audit for this life/project roadmap:
Goals (${activeGoals.length}): ${activeGoals.map(g => g.title).join(', ') || 'None'}
Active Projects (${activeProjects.length}): ${activeProjects.map(p => `${p.title} (Goal ID: ${p.goalId || 'Unlinked'})`).join(', ') || 'None'}
Orphan/Unlinked Tasks: ${unlinked.length} tasks without a parent project.
Goal Coverage: ${metrics.goalCoverage}% of active goals have active projects.

Format strictly as 3 concise bullet points:
1. Alignment Health & Pipeline Balance
2. Strategic Bottlenecks / Orphaned Work
3. Immediate 30-Day Focus Recommendation
Keep language professional, crisp, and clean. No emojis.`;

      const systemPrompt = "You are an executive strategy advisor. Provide concise, high-signal, professional roadmap audits.";
      let text = '';
      if (settings?.aiSettings?.apiKey) {
        const res = await executeOptionalAICall(prompt, systemPrompt, settings.aiSettings);
        text = res.text;
      }
      
      if (text) {
        setAuditResult(text);
      } else {
        setAuditResult(
          `• Alignment Health: ${metrics.goalCoverage}% of active goals currently have linked execution projects. Total active pipeline contains ${metrics.activeProjectCount} projects and ${metrics.activeTaskCount} tasks in flight.\n` +
          `• Strategic Bottlenecks: Found ${metrics.unlinkedCount} standalone tasks not attached to any project. Connect these tasks to active projects to maintain traceability.\n` +
          `• Immediate Recommendation: Focus capacity on clearing the ${metrics.pendingMilestones} imminent milestones in queue before taking on new parallel initiatives.`
        );
      }
    } catch {
      setAuditResult(
        `• Alignment Health: ${metrics.goalCoverage}% coverage across ${metrics.activeGoalsCount} active goals.\n` +
        `• Work In Flight: ${metrics.activeProjectCount} active projects with ${metrics.activeTaskCount} pending tasks.\n` +
        `• Strategic Recommendation: Review unlinked items (${metrics.unlinkedCount}) to maintain full goal traceability.`
      );
    } finally {
      setIsAuditing(false);
    }
  };

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
        <GitBranch size={22} style={{ color: 'var(--color-accent)', opacity: 0.6 }} />
        <p>Loading Roadmap...</p>
      </div>
    );
  }

  return (
    <div className={styles.roadmapPage}>
      {/* ── Fixed Structured Top Bar ── */}
      <header className={styles.topBar}>
        {/* Main Row */}
        <div className={styles.topBarMain}>
          <div className={styles.topBarLeft}>
            <div className={styles.pageTitleGroup}>
              <span className={styles.pageTitle}>Roadmap</span>
              <span className={styles.pageSubtitle}>Execution Flow</span>
            </div>

            {/* View Mode Switcher */}
            <div className={styles.viewSwitcher}>
              <button
                type="button"
                className={`${styles.viewBtn} ${viewMode === 'graph' ? styles.viewBtnActive : ''}`}
                onClick={() => setViewMode('graph')}
              >
                Graph Flow
              </button>
              <button
                type="button"
                className={`${styles.viewBtn} ${viewMode === 'timeline' ? styles.viewBtnActive : ''}`}
                onClick={() => setViewMode('timeline')}
              >
                Timeline Gantt
              </button>
            </div>
          </div>

          <div className={styles.topBarRight}>
            {/* Horizon Filter */}
            <div className={styles.horizonControl}>
              {(['all', '90-day', 'yearly'] as HorizonMode[]).map(h => (
                <button
                  key={h}
                  type="button"
                  className={`${styles.horizonBtn} ${horizonFilter === h ? styles.horizonBtnActive : ''}`}
                  onClick={() => setHorizonFilter(h)}
                >
                  {h === 'all' ? 'All Horizons' : h === '90-day' ? '90-Day Focus' : 'Yearly'}
                </button>
              ))}
            </div>

            {/* Audit Button */}
            <button
              type="button"
              className={styles.auditBtn}
              onClick={handleAuditStrategy}
            >
              Audit Strategy
            </button>

            {/* Zoom Controls */}
            {viewMode === 'graph' && (
              <div className={styles.zoomControlGroup}>
                <button className={styles.ctrlBtn} onClick={() => setZoom(z => Math.min(1.8, z + 0.1))} title="Zoom In">
                  <ZoomIn size={12} />
                </button>
                <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
                <button className={styles.ctrlBtn} onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} title="Zoom Out">
                  <ZoomOut size={12} />
                </button>
                <button className={styles.ctrlBtn} onClick={resetView} title="Reset View">
                  <Maximize2 size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sub Row: Filter & Executive KPI Metrics */}
        <div className={styles.topBarSub}>
          <div className={styles.filterGroup}>
            <button
              type="button"
              className={`${styles.filterPill} ${filter === 'all' ? styles.filterActive : ''}`}
              onClick={() => setFilter('all')}
            >
              All Areas
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${filter === 'active' ? styles.filterActive : ''}`}
              onClick={() => setFilter('active')}
            >
              Active Only
            </button>
            {uniqueAreas.map(areaId => (
              <button
                key={areaId}
                type="button"
                className={`${styles.filterPill} ${filter === areaId ? styles.filterActive : ''}`}
                onClick={() => setFilter(f => f === areaId ? 'all' : areaId)}
              >
                {AREA_LABELS[areaId] ?? areaId}
              </button>
            ))}
          </div>

          <div className={styles.metricsGroup}>
            <div className={`${styles.metricBadge} ${metrics.goalCoverage >= 80 ? styles.metricSuccess : ''}`}>
              <span>Goal Alignment:</span>
              <strong>{metrics.goalCoverage}%</strong>
            </div>

            <div className={styles.metricDivider} />

            <div className={styles.metricBadge}>
              <span>Pipeline:</span>
              <strong>{metrics.activeProjectCount} Projects · {metrics.activeTaskCount} Tasks</strong>
            </div>

            <div className={styles.metricDivider} />

            <div className={`${styles.metricBadge} ${metrics.unlinkedCount > 0 ? styles.metricWarning : ''}`}>
              <span>Unlinked:</span>
              <strong>{metrics.unlinkedCount} Tasks</strong>
            </div>

            <div className={styles.metricDivider} />

            <div className={styles.metricBadge}>
              <span>Milestones:</span>
              <strong>{metrics.pendingMilestones} in Queue</strong>
            </div>
          </div>
        </div>
      </header>

      {/* ── Viewport Content ── */}
      {viewMode === 'timeline' ? (
        <div className={styles.timelineViewport}>
          <div className={styles.timelineGridHeader}>
            <div>Initiative / Project</div>
            <div className={styles.quarterHeader}>Q1 Focus</div>
            <div className={styles.quarterHeader}>Q2 Focus</div>
            <div className={styles.quarterHeader}>Q3 Focus</div>
            <div className={styles.quarterHeader}>Q4 Focus</div>
          </div>

          {filteredGoals.length === 0 && filteredProjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              No initiatives found for the current horizon and area filters.
            </div>
          ) : (
            filteredGoals.map(goal => {
              const linkedProjects = filteredProjects.filter(p => p.goalId === goal.id);
              const goalColor = goal.lifeAreaId ? (AREA_COLORS[goal.lifeAreaId] ?? DEFAULT_COLOR) : DEFAULT_COLOR;

              return (
                <div key={goal.id} className={styles.goalSection}>
                  <div className={styles.goalRow}>
                    <div className={styles.goalInfo}>
                      <div className={styles.goalAreaIndicator} style={{ background: goalColor }} />
                      <span className={styles.goalTitle}>{goal.title}</span>
                    </div>
                    <div className={styles.goalMeta}>
                      <span>{goal.progress ?? 0}% Complete</span>
                      <span>·</span>
                      <span>{linkedProjects.length} Active {linkedProjects.length === 1 ? 'Project' : 'Projects'}</span>
                    </div>
                  </div>

                  {linkedProjects.length === 0 ? (
                    <div className={styles.emptyGoalRow}>
                      <span>No active execution projects linked to this goal.</span>
                      <Link href="/projects" className={styles.addProjectLink}>+ Add Project</Link>
                    </div>
                  ) : (
                    linkedProjects.map(proj => {
                      const linkedTasksCount = tasks.filter(t => t.projectId === proj.id).length;
                      const completedTasksCount = tasks.filter(t => t.projectId === proj.id && t.status === 'done').length;
                      const progressVal = proj.progress ?? (linkedTasksCount > 0 ? Math.round((completedTasksCount / linkedTasksCount) * 100) : 0);

                      return (
                        <div key={proj.id} className={styles.projectRow}>
                          <div className={styles.projectInfo}>
                            <span className={styles.projectTitle}>{proj.title}</span>
                            <span className={styles.projectSub}>
                              Status: {proj.status} · {completedTasksCount}/{linkedTasksCount} Tasks
                            </span>
                          </div>

                          <div className={styles.projectTrackWrapper}>
                            <div className={styles.trackQuarterLine} />
                            <div className={styles.trackQuarterLine} />
                            <div className={styles.trackQuarterLine} />
                            <div className={styles.trackQuarterLine} />
                            <div
                              className={styles.projectBar}
                              style={{
                                width: `${Math.max(10, progressVal)}%`,
                                background: goalColor,
                              }}
                            >
                              <span className={styles.projectBarLabel}>{progressVal}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })
          )}

          {/* Standalone Initiatives */}
          {filteredProjects.filter(p => !p.goalId).length > 0 && (
            <div className={styles.goalSection}>
              <div className={styles.goalRow}>
                <div className={styles.goalInfo}>
                  <div className={styles.goalAreaIndicator} style={{ background: '#f5a623' }} />
                  <span className={styles.goalTitle}>Unlinked Initiatives</span>
                </div>
                <div className={styles.goalMeta}>
                  <span>{filteredProjects.filter(p => !p.goalId).length} Projects without Parent Goal</span>
                </div>
              </div>

              {filteredProjects.filter(p => !p.goalId).map(proj => {
                const linkedTasksCount = tasks.filter(t => t.projectId === proj.id).length;
                const completedTasksCount = tasks.filter(t => t.projectId === proj.id && t.status === 'done').length;
                const progressVal = proj.progress ?? (linkedTasksCount > 0 ? Math.round((completedTasksCount / linkedTasksCount) * 100) : 0);

                return (
                  <div key={proj.id} className={styles.projectRow}>
                    <div className={styles.projectInfo}>
                      <span className={styles.projectTitle}>{proj.title}</span>
                      <span className={styles.projectSub}>
                        Status: {proj.status} · {completedTasksCount}/{linkedTasksCount} Tasks
                      </span>
                    </div>

                    <div className={styles.projectTrackWrapper}>
                      <div className={styles.trackQuarterLine} />
                      <div className={styles.trackQuarterLine} />
                      <div className={styles.trackQuarterLine} />
                      <div className={styles.trackQuarterLine} />
                      <div
                        className={styles.projectBar}
                        style={{
                          width: `${Math.max(10, progressVal)}%`,
                          background: '#f5a623',
                        }}
                      >
                        <span className={styles.projectBarLabel}>{progressVal}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Canvas Viewport: Graph Flow ── */
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
              <GitBranch size={28} style={{ color: 'var(--color-accent)', opacity: 0.5, marginBottom: 10 }} />
              <p className={styles.emptyTitle}>Roadmap is empty</p>
              <p className={styles.emptySubtitle}>
                Add tasks, projects, goals, or dreams to establish your strategy blueprint.
              </p>
              <div className={styles.emptyActions}>
                <Link href="/tasks" className={styles.emptyActionBtn}>Add Task</Link>
                <Link href="/projects" className={styles.emptyActionBtn}>Add Project</Link>
                <Link href="/goals" className={styles.emptyActionBtn}>Add Goal</Link>
                <Link href="/dreams" className={styles.emptyActionBtn}>Add Dream</Link>
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
              {/* Dot Grid Background */}
              <svg
                className={styles.dotGrid}
                width={canvasWidth}
                height={canvasHeight}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              >
                <defs>
                  <pattern id="dotgrid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="1.1" fill="currentColor" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotgrid)" />
              </svg>

              {/* Column Headers on Canvas */}
              {[
                { label: '1. Daily Tasks', col: 0 },
                { label: '2. Projects', col: 1 },
                { label: '3. Strategic Goals', col: 2 },
                { label: '4. Vision & Dreams', col: 3 },
              ].map(({ label, col }) => (
                <div
                  key={label}
                  className={styles.canvasColHeader}
                  style={{
                    left: COL_STARTS[col] + NODE_W / 2,
                    top: 20,
                  }}
                >
                  {label}
                </div>
              ))}

              {/* SVG Connections */}
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
                  const dimmed = focusedChain !== null && !inFocus;

                  return (
                    <path
                      key={`conn-${i}`}
                      d={getBezierPath(from, to)}
                      fill="none"
                      stroke={conn.color}
                      strokeWidth={highlighted || inFocus ? 2 : 1.2}
                      strokeOpacity={dimmed ? 0.04 : highlighted || inFocus ? 0.95 : 0.35}
                      markerEnd={`url(#arrow-${i})`}
                      className={styles.connectionPath}
                      style={{ transition: 'stroke-opacity 0.2s, stroke-width 0.2s' }}
                    />
                  );
                })}
              </svg>

              {/* Nodes */}
              {nodes.map(node => {
                const inFocus = focusedChain !== null ? focusedChain.has(node.id) : null;

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

          {/* Focus Bar (Bottom Center) */}
          {focusedNodeId && nodeMap[focusedNodeId] && (
            <div className={styles.focusBar} data-interactive="true">
              <span className={styles.focusTag}>Focused Thread</span>
              <span className={styles.focusText}>{nodeMap[focusedNodeId].title}</span>
              <button
                type="button"
                className={styles.focusClearBtn}
                onClick={() => setFocusedNodeId(null)}
              >
                <X size={10} /> Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── AI Strategy Audit Modal ── */}
      {auditModalOpen && (
        <div className={styles.auditOverlay} onClick={() => setAuditModalOpen(false)}>
          <div className={styles.auditCard} onClick={e => e.stopPropagation()}>
            <div className={styles.auditHeader}>
              <span className={styles.auditTitle}>Executive Strategy Audit</span>
              <button
                type="button"
                className={styles.ctrlBtn}
                onClick={() => setAuditModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            <div className={styles.auditBody}>
              {isAuditing ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  Analyzing goal alignment, orphaned pipelines, and execution capacity...
                </div>
              ) : (
                auditResult
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className={styles.emptyActionBtn}
                onClick={() => setAuditModalOpen(false)}
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Node Card Component ──────────────────────────────────────────
interface NodeCardProps {
  node: NodePosition;
  isHovered: boolean;
  isConnected: boolean;
  isFocused: boolean | null;
  focusedNodeId: string | null;
  onHover: (id: string | null) => void;
  onFocus: (id: string | null) => void;
}

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
      className={styles.nodeCard}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_W,
        minHeight: NODE_H,
        borderColor: highlighted ? node.color : undefined,
        boxShadow: isHovered || isFocused === true
          ? `0 0 0 2px ${node.color}50, var(--shadow-md)`
          : undefined,
        opacity: dimmed ? 0.12 : 1,
      }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onFocus(focusedNodeId === node.id ? null : node.id)}
    >
      <div className={styles.nodeAccentBar} style={{ background: node.color }} />

      <div className={styles.nodeHeader}>
        <span className={styles.nodeTypeBadge} style={{ color: node.color, borderColor: `${node.color}35`, background: `${node.color}15` }}>
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

      <div className={styles.nodeTitle}>{node.title}</div>

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

      <div className={styles.portOut} style={{ background: node.color }} />
      <div className={styles.portIn} style={{ background: node.color }} />
    </div>
  );
}
