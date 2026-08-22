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
  Filter,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useDreams } from '@/context/DreamContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useTasks } from '@/context/TaskContext';
import styles from './page.module.css';

// ── Layout constants ──────────────────────────────────────────
const NODE_W = 260;
const NODE_H = 130;
const COL_GAP = 340;
const ROW_GAP = 180;
const COL_STARTS = [60, 60 + COL_GAP, 60 + COL_GAP * 2, 60 + COL_GAP * 3];
const CANVAS_PAD = 80;

// Life area color map
const AREA_COLORS: Record<string, string> = {
  'area-creative': '#ff6b6b',
  'area-career': '#7c6fff',
  'area-money': '#f5a623',
  'area-learning': '#4db8ff',
  'area-health': '#22d3a5',
  'area-social': '#ff79c6',
  'area-mindset': '#bd93f9',
  'area-family': '#ffb86c',
};
const DEFAULT_COLOR = '#7c6fff';

type FilterMode = 'all' | 'active' | string; // string = area id

interface NodePosition {
  id: string;
  x: number;
  y: number;
  color: string;
  type: 'dream' | 'goal' | 'project' | 'task';
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
  const { tasks, isLoaded: tasksLoaded } = useTasks();

  const [filter, setFilter] = useState<FilterMode>('all');
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const isLoaded = dreamsLoaded && goalsLoaded && projectsLoaded && tasksLoaded;

  // ── Filter data based on mode ────────────────────────────
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
      .slice(0, 12);
  }, [tasks, filteredProjects]);

  // ── Build node positions ─────────────────────────────────
  const { nodes, connections, canvasHeight } = useMemo(() => {
    const nodes: NodePosition[] = [];
    const connections: Connection[] = [];

    // Place dreams in column 0
    filteredDreams.forEach((dream, i) => {
      const color = dream.lifeAreaId
        ? AREA_COLORS[dream.lifeAreaId] ?? DEFAULT_COLOR
        : DEFAULT_COLOR;
      nodes.push({
        id: dream.id,
        x: COL_STARTS[0],
        y: CANVAS_PAD + i * ROW_GAP,
        color,
        type: 'dream',
        title: dream.title,
        status: dream.status,
        lifeAreaId: dream.lifeAreaId,
      });
    });

    // Place goals in column 1, grouped by parent dream
    let goalY = CANVAS_PAD;
    filteredGoals.forEach((goal) => {
      const parentDream = nodes.find(n => n.id === goal.parentDreamId);
      // Try to align near parent
      if (parentDream) {
        goalY = Math.max(goalY, parentDream.y);
      }
      const color = goal.lifeAreaId
        ? AREA_COLORS[goal.lifeAreaId] ?? DEFAULT_COLOR
        : DEFAULT_COLOR;
      nodes.push({
        id: goal.id,
        x: COL_STARTS[1],
        y: goalY,
        color,
        type: 'goal',
        title: goal.title,
        progress: goal.progress,
        status: goal.status,
        parentId: goal.parentDreamId,
        lifeAreaId: goal.lifeAreaId,
      });
      if (goal.parentDreamId) {
        connections.push({ fromId: goal.parentDreamId, toId: goal.id, color });
      }
      goalY += ROW_GAP;
    });

    // Place projects in column 2
    let projY = CANVAS_PAD;
    filteredProjects.forEach((proj) => {
      const parentGoal = nodes.find(n => n.id === proj.goalId);
      if (parentGoal) {
        projY = Math.max(projY, parentGoal.y);
      }
      const parentColor = parentGoal?.color ?? DEFAULT_COLOR;
      nodes.push({
        id: proj.id,
        x: COL_STARTS[2],
        y: projY,
        color: parentColor,
        type: 'project',
        title: proj.title,
        progress: proj.progress,
        status: proj.status,
        parentId: proj.goalId,
      });
      if (proj.goalId) {
        connections.push({ fromId: proj.goalId, toId: proj.id, color: parentColor });
      }
      projY += ROW_GAP;
    });

    // Place tasks in column 3
    let taskY = CANVAS_PAD;
    filteredTasks.forEach((task) => {
      const parentProj = nodes.find(n => n.id === task.projectId);
      if (parentProj) {
        taskY = Math.max(taskY, parentProj.y);
      }
      const parentColor = parentProj?.color ?? DEFAULT_COLOR;
      nodes.push({
        id: task.id,
        x: COL_STARTS[3],
        y: taskY,
        color: parentColor,
        type: 'task',
        title: task.title,
        status: task.status,
        parentId: task.projectId,
      });
      if (task.projectId) {
        connections.push({ fromId: task.projectId, toId: task.id, color: parentColor });
      }
      taskY += ROW_GAP;
    });

    const maxY = nodes.reduce((m, n) => Math.max(m, n.y + NODE_H + CANVAS_PAD), 600);

    return { nodes, connections, canvasHeight: maxY };
  }, [filteredDreams, filteredGoals, filteredProjects, filteredTasks]);

  const canvasWidth = COL_STARTS[3] + NODE_W + CANVAS_PAD;

  // ── Pan handlers ─────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // ── Zoom handlers ────────────────────────────────────────
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
    setZoom(0.75);
  }, []);

  // ── SVG bezier path ──────────────────────────────────────
  function getBezierPath(from: NodePosition, to: NodePosition): string {
    const x1 = from.x + NODE_W;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_H / 2;
    const cx1 = x1 + Math.abs(x2 - x1) * 0.5;
    const cx2 = x2 - Math.abs(x2 - x1) * 0.5;
    return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
  }

  // ── Area color legend ────────────────────────────────────
  const uniqueAreas = useMemo(() => {
    const seen = new Set<string>();
    [...filteredDreams, ...filteredGoals].forEach(item => {
      if (item.lifeAreaId) seen.add(item.lifeAreaId);
    });
    return Array.from(seen);
  }, [filteredDreams, filteredGoals]);

  const AREA_LABELS: Record<string, string> = {
    'area-creative': 'Creative',
    'area-career': 'Career',
    'area-money': 'Finance',
    'area-learning': 'Learning',
    'area-health': 'Health',
    'area-social': 'Social',
    'area-mindset': 'Mindset',
    'area-family': 'Family',
  };

  const nodeMap = useMemo(() => {
    const m: Record<string, NodePosition> = {};
    nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [nodes]);

  if (!isLoaded) {
    return (
      <div className={styles.loadingScreen}>
        <GitBranch size={32} style={{ color: 'var(--color-accent)', opacity: 0.6 }} />
        <p>Loading your Life Roadmap...</p>
      </div>
    );
  }

  return (
    <div className={styles.roadmapPage}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <GitBranch size={18} style={{ color: 'var(--color-accent)' }} />
          <span className={styles.pageTitle}>Life Roadmap</span>
          <span className={styles.pageSub}>Node Graph View</span>
        </div>

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
            <Sparkles size={11} /> Active
          </button>
          {uniqueAreas.map(areaId => (
            <button
              key={areaId}
              className={`${styles.filterPill} ${filter === areaId ? styles.filterActive : ''}`}
              style={filter === areaId ? { borderColor: AREA_COLORS[areaId], color: AREA_COLORS[areaId] } : {}}
              onClick={() => setFilter(f => f === areaId ? 'all' : areaId)}
            >
              <span
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: AREA_COLORS[areaId] ?? DEFAULT_COLOR,
                  display: 'inline-block', flexShrink: 0,
                }}
              />
              {AREA_LABELS[areaId] ?? areaId}
            </button>
          ))}
        </div>

        <div className={styles.zoomControls}>
          <button className={styles.zoomBtn} onClick={() => setZoom(z => Math.min(2, z + 0.1))} title="Zoom In">
            <ZoomIn size={14} />
          </button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button className={styles.zoomBtn} onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          <button className={styles.zoomBtn} onClick={resetView} title="Reset View">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Column headers (outside canvas so they stay fixed) ── */}
      <div className={styles.columnHeaders}>
        {[
          { label: 'Dreams', icon: <CloudSun size={13} />, col: 0 },
          { label: 'Goals', icon: <Target size={13} />, col: 1 },
          { label: 'Projects', icon: <FolderKanban size={13} />, col: 2 },
          { label: 'Tasks', icon: <CheckSquare size={13} />, col: 3 },
        ].map(({ label, icon, col }) => (
          <div
            key={label}
            className={styles.colHeader}
            style={{ left: (COL_STARTS[col] + NODE_W / 2) * zoom + pan.x }}
          >
            {icon} {label}
          </div>
        ))}
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        className={`${styles.canvasViewport} ${isDragging ? styles.dragging : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
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
          {/* ── Dot grid background ── */}
          <svg
            className={styles.dotGrid}
            width={canvasWidth}
            height={canvasHeight}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <defs>
              <pattern id="dotgrid" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.06)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dotgrid)" />
          </svg>

          {/* ── SVG connection curves ── */}
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
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L6,3 z" fill={conn.color} opacity="0.7" />
                </marker>
              ))}
            </defs>

            {connections.map((conn, i) => {
              const from = nodeMap[conn.fromId];
              const to = nodeMap[conn.toId];
              if (!from || !to) return null;
              const isHighlighted = hoveredNode === conn.fromId || hoveredNode === conn.toId;
              return (
                <path
                  key={`conn-${i}`}
                  d={getBezierPath(from, to)}
                  fill="none"
                  stroke={conn.color}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeOpacity={isHighlighted ? 0.9 : 0.35}
                  markerEnd={`url(#arrow-${i})`}
                  className={styles.connectionPath}
                  style={{ transition: 'stroke-opacity 0.2s, stroke-width 0.2s' }}
                />
              );
            })}
          </svg>

          {/* ── Node cards ── */}
          {nodes.map(node => (
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
              onHover={setHoveredNode}
            />
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className={styles.legend}>
        <span className={styles.legendLabel}><Filter size={11} /> Legend:</span>
        {Object.entries(AREA_LABELS)
          .filter(([id]) => uniqueAreas.includes(id))
          .map(([id, label]) => (
            <span key={id} className={styles.legendItem}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: AREA_COLORS[id], display: 'inline-block' }} />
              {label}
            </span>
          ))}
        <span className={styles.legendHint}>Drag to pan · Scroll to zoom</span>
      </div>
    </div>
  );
}

// ── RoadmapNodeCard ──────────────────────────────────────────
interface NodeCardProps {
  node: NodePosition;
  isHovered: boolean;
  isConnected: boolean;
  onHover: (id: string | null) => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  dream: <CloudSun size={13} />,
  goal: <Target size={13} />,
  project: <FolderKanban size={13} />,
  task: <CheckSquare size={13} />,
};

const TYPE_LABELS: Record<string, string> = {
  dream: 'Dream',
  goal: 'Goal',
  project: 'Project',
  task: 'Task',
};

const STATUS_COLORS: Record<string, string> = {
  'in-progress': '#22d3a5',
  'active': '#22d3a5',
  'dream': '#7c6fff',
  'planning': '#4db8ff',
  'not-started': '#8888a8',
  'completed': '#22d3a5',
  'done': '#22d3a5',
  'todo': '#8888a8',
};

function RoadmapNodeCard({ node, isHovered, isConnected, onHover }: NodeCardProps) {
  const typeHrefs: Record<string, string> = {
    dream: '/dreams',
    goal: '/goals',
    project: '/projects',
    task: '/tasks',
  };

  return (
    <div
      data-node="true"
      className={`${styles.nodeCard} ${isHovered ? styles.nodeHovered : ''} ${isConnected ? styles.nodeConnected : ''}`}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_W,
        minHeight: NODE_H,
        borderColor: isHovered || isConnected ? node.color : 'var(--color-border)',
        boxShadow: isHovered
          ? `0 0 0 1px ${node.color}40, 0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${node.color}30`
          : isConnected
            ? `0 0 0 1px ${node.color}25, 0 4px 16px rgba(0,0,0,0.4)`
            : '0 2px 12px rgba(0,0,0,0.4)',
      }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Color accent bar */}
      <div
        className={styles.nodeAccentBar}
        style={{ background: node.color }}
      />

      {/* Node header */}
      <div className={styles.nodeHeader}>
        <span className={styles.nodeTypeBadge} style={{ color: node.color, borderColor: `${node.color}40` }}>
          {TYPE_ICONS[node.type]}
          {TYPE_LABELS[node.type]}
        </span>
        {node.status && (
          <span
            className={styles.nodeStatusDot}
            style={{ background: STATUS_COLORS[node.status] ?? '#8888a8' }}
            title={node.status}
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

      {/* Node title */}
      <div className={styles.nodeTitle}>{node.title}</div>

      {/* Progress bar (for goals & projects) */}
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

      {/* Output port dot (right side) */}
      <div className={styles.portOut} style={{ background: node.color }} />
      {/* Input port dot (left side) */}
      <div className={styles.portIn} style={{ background: node.color }} />
    </div>
  );
}
