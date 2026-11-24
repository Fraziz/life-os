'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  Flag,
  Sparkles,
  Edit2,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Compass,
  X,
  Target,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Check,
} from 'lucide-react';
import styles from './LifeDestinationRoadmap.module.css';
import type { LifeDestination, LifeDestinationStatus } from '@/types';

const STORAGE_KEY = 'life_os_life_destinations_v1';

// Layout geometry on canvas
const NODE_W = 340;
const NODE_H = 240;
const COL_GAP = 420;
const START_X = 80;
const START_Y = 190;

const AREA_COLORS: Record<string, string> = {
  'area-creative': '#ff6b6b',
  'area-career': '#7c6fff',
  'area-money': '#f5a623',
  'area-learning': '#4db8ff',
  'area-health': '#22d3a5',
  'area-social': '#ff79c6',
  'area-mindset': '#bd93f9',
};

const AREA_LABELS: Record<string, string> = {
  'area-creative': 'Creative & Craft',
  'area-career': 'Career & Enterprise',
  'area-money': 'Financial Runway',
  'area-learning': 'Learning & Skills',
  'area-health': 'Health & Vitality',
  'area-social': 'Relationships',
  'area-mindset': 'Mindset & Vision',
};

export const DEFAULT_DESTINATIONS: LifeDestination[] = [
  {
    id: 'dest-1',
    title: 'Self-Mastery, Health & Core Skills Baseline',
    phaseLabel: 'Stage 1: Groundwork & Energy',
    description: 'Establish unbreakable daily discipline, physical vitality, consistent training, and master professional English & technical fundamentals.',
    whyItMatters: 'Without health, stamina, and mental sharpness, all other goals collapse. This foundation fuels my entire future.',
    targetAgeOrYear: 'Current Phase',
    lifeAreaId: 'area-health',
    status: 'completed',
    criteria: [
      'Consistent daily fitness & nutrition habits',
      'Fluent conversational & technical English communication',
      'Deep focus routine with zero burnout',
    ],
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dest-2',
    title: '6-Month Independence Fund & Debt-Free Runway',
    phaseLabel: 'Stage 2: Runway & Autonomy',
    description: 'Accumulate a full 6-month liquid runway in high-yield savings to eliminate survival stress and unlock fearless creative risk-taking.',
    whyItMatters: 'Financial runway buys mental freedom. When survival is guaranteed, I never have to make desperate short-term compromises.',
    targetAgeOrYear: 'Target: 2026-2027',
    lifeAreaId: 'area-money',
    status: 'current',
    criteria: [
      'Save $15,000 emergency buffer',
      'Reach full $30,000 independence runway',
      'Zero consumer debt with diversified savings',
    ],
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dest-3',
    title: 'Ship & Publish Playable 2D/3D Game Prototype',
    phaseLabel: 'Stage 3: The Builder',
    description: 'Master kinematic 2D movement physics, 3D low-poly environment modeling in Blender, and release a polished playable game to real players.',
    whyItMatters: 'To prove creative capability, experience the thrill of building interactive worlds, and transition from consumer to master creator.',
    targetAgeOrYear: 'Target: 2027',
    lifeAreaId: 'area-creative',
    status: 'upcoming',
    criteria: [
      'Complete 3D diorama & stylized character modeling',
      'Finish responsive 2D movement controller & combat feel',
      'Publish playable demo with 1,000+ enthusiastic players',
    ],
    order: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dest-4',
    title: 'Scale GAINROOT / Creative Studio to Full Autonomy',
    phaseLabel: 'Stage 4: Creative Enterprise',
    description: 'Turn digital software, games, and creative products into an autonomous, profitable business generating sustainable recurring revenue.',
    whyItMatters: 'True freedom means owning my intellectual property, controlling my schedule, and never trading life hours for a wage.',
    targetAgeOrYear: 'Target: 2028-2029',
    lifeAreaId: 'area-career',
    status: 'upcoming',
    criteria: [
      'Launch product with paying subscribers or customers',
      'Reach $10,000+/month recurring baseline revenue',
      'Build a respected indie brand in game dev & tech',
    ],
    order: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dest-5',
    title: 'Total Autonomy, Living Without Limits & Mentoring Others',
    phaseLabel: 'Stage 5: The Summit & Legacy',
    description: 'Complete geographic, temporal, and financial sovereignty. Living wherever I choose, creating purely for passion, and inspiring others.',
    whyItMatters: 'This is my ultimate destination and North Star. Remembering this final summit ensures I never lose direction along the way.',
    targetAgeOrYear: 'Ultimate Destination',
    lifeAreaId: 'area-mindset',
    status: 'upcoming',
    criteria: [
      'Location independence: freedom to live and build anywhere',
      'Time freedom: 100% control over daily time and priorities',
      'Generational wealth & mentoring the next generation of builders',
    ],
    order: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function LifeDestinationRoadmap() {
  const [destinations, setDestinations] = useState<LifeDestination[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward'); // forward: Start -> End, reverse: End -> Start
  const [editingDest, setEditingDest] = useState<LifeDestination | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Pan & Zoom Canvas State
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 30, y: 10 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const hasMovedRef = useRef<boolean>(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDestinations(parsed);
          setIsLoaded(true);
          return;
        }
      }
    } catch {}
    setDestinations(DEFAULT_DESTINATIONS);
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  const saveDestinations = (items: LifeDestination[]) => {
    setDestinations(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  };

  // Reorder sort (forward vs reverse)
  const orderedDestinations = useMemo(() => {
    const sorted = [...destinations].sort((a, b) => a.order - b.order);
    return direction === 'forward' ? sorted : [...sorted].reverse();
  }, [destinations, direction]);

  const completedCount = useMemo(() => {
    return destinations.filter((d) => d.status === 'completed').length;
  }, [destinations]);

  const currentDestination = useMemo(() => {
    const sorted = [...destinations].sort((a, b) => a.order - b.order);
    return sorted.find((d) => d.status === 'current') || sorted.find((d) => d.status === 'upcoming');
  }, [destinations]);

  // Canvas dimensions
  const canvasWidth = useMemo(() => {
    return Math.max(2600, START_X + (orderedDestinations.length + 1) * COL_GAP + 300);
  }, [orderedDestinations.length]);

  const canvasHeight = 1000;

  // Pan & Zoom event handlers (exact Graph Flow ergonomics)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]') || (e.target as HTMLElement).closest('[data-interactive]')) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // Mobile Touch Pan & Pinch
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input, textarea, [data-interactive]')) {
      return;
    }
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      hasMovedRef.current = false;
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartZoomRef.current = zoom;
    }
  }, [pan, zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      if (touchStartPosRef.current) {
        const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
        if (dx > 4 || dy > 4) hasMovedRef.current = true;
      }
      setPan({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
    } else if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / pinchStartDistRef.current;
      const nextZoom = Math.max(0.35, Math.min(1.8, pinchStartZoomRef.current * factor));
      setZoom(nextZoom);
    }
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    pinchStartDistRef.current = null;
    setTimeout(() => {
      hasMovedRef.current = false;
    }, 120);
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.35, Math.min(1.8, z - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const resetView = useCallback(() => {
    setPan({ x: 30, y: 10 });
    setZoom(0.85);
  }, []);

  // Toggle checkpoint completion
  const handleToggleStatus = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const sorted = [...destinations].sort((a, b) => a.order - b.order);
    const targetIdx = sorted.findIndex((d) => d.id === id);
    if (targetIdx === -1) return;

    const target = sorted[targetIdx];
    const willBeCompleted = target.status !== 'completed';

    const updated = sorted.map((d, idx) => {
      if (idx === targetIdx) {
        return {
          ...d,
          status: willBeCompleted ? ('completed' as LifeDestinationStatus) : ('current' as LifeDestinationStatus),
          completedAt: willBeCompleted ? new Date().toISOString() : undefined,
          updatedAt: new Date().toISOString(),
        };
      }
      // If completed, make next station 'current' if upcoming
      if (willBeCompleted && idx === targetIdx + 1 && d.status === 'upcoming') {
        return {
          ...d,
          status: 'current' as LifeDestinationStatus,
          updatedAt: new Date().toISOString(),
        };
      }
      return d;
    });

    saveDestinations(updated);
  };

  // Open modal to add new
  const handleAddNew = () => {
    const nextOrder = destinations.length > 0 ? Math.max(...destinations.map((d) => d.order)) + 1 : 1;
    setEditingDest({
      id: `dest-${Date.now()}`,
      title: '',
      phaseLabel: `Stage ${nextOrder}: New Horizon`,
      description: '',
      whyItMatters: '',
      targetAgeOrYear: '',
      lifeAreaId: 'area-career',
      status: 'upcoming',
      criteria: [],
      order: nextOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsModalOpen(true);
  };

  // Open modal to edit existing
  const handleEdit = (dest: LifeDestination, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDest(dest);
    setIsModalOpen(true);
  };

  // Delete destination
  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const filtered = destinations.filter((d) => d.id !== id);
    const reindexed = filtered
      .sort((a, b) => a.order - b.order)
      .map((d, i) => ({ ...d, order: i + 1 }));
    saveDestinations(reindexed);
  };

  // Move destination earlier or later
  const handleMove = (id: string, dir: -1 | 1, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const sorted = [...destinations].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((d) => d.id === id);
    if (idx === -1) return;

    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    const tempOrder = sorted[idx].order;
    sorted[idx].order = sorted[targetIdx].order;
    sorted[targetIdx].order = tempOrder;

    saveDestinations([...sorted]);
  };

  // Save modal edit/create
  const handleSaveModal = (data: Partial<LifeDestination>) => {
    if (!editingDest) return;
    const exists = destinations.some((d) => d.id === editingDest.id);

    let updated: LifeDestination[];
    if (exists) {
      updated = destinations.map((d) =>
        d.id === editingDest.id ? { ...d, ...data, updatedAt: new Date().toISOString() } : d
      );
    } else {
      updated = [...destinations, { ...editingDest, ...data, updatedAt: new Date().toISOString() }];
    }
    saveDestinations(updated);
    setIsModalOpen(false);
    setEditingDest(null);
  };

  // Reset to default
  const handleResetDefaults = () => {
    if (window.confirm('Reset life destinations to default master blueprint?')) {
      saveDestinations(DEFAULT_DESTINATIONS);
    }
  };

  // SVG Bezier curved path calculation
  const getBezierCurve = (fromX: number, fromY: number, toX: number, toY: number): string => {
    const cx1 = fromX + Math.abs(toX - fromX) * 0.5;
    const cx2 = toX - Math.abs(toX - fromX) * 0.5;
    return `M ${fromX} ${fromY} C ${cx1} ${fromY}, ${cx2} ${toY}, ${toX} ${toY}`;
  };

  if (!isLoaded) return null;

  return (
    <div className={styles.lifePathContainer}>
      {/* ── Top Floating Toolbar (Sticky Glass Header) ── */}
      <div className={styles.toolbarRow} data-interactive="true">
        <div className={styles.progressSummary}>
          <div className={styles.progressCompass}>
            <Compass size={15} className={styles.compassIcon} />
          </div>
          <div className={styles.progressTextGroup}>
            <span className={styles.progressTitle}>
              <strong>{completedCount}</strong> of <strong>{destinations.length}</strong> Stations Reached
            </span>
            <span className={styles.progressSubtitle}>
              {currentDestination
                ? `Current Destination: ${currentDestination.title}`
                : 'All Destinations Achieved!'}
            </span>
          </div>
        </div>

        <div className={styles.toolbarCenter}>
          {/* Order Direction Switcher */}
          <div className={styles.directionControl}>
            <button
              type="button"
              className={`${styles.directionBtn} ${direction === 'forward' ? styles.directionBtnActive : ''}`}
              onClick={() => setDirection('forward')}
              title="Start to End (Ascending Growth Journey)"
            >
              Start → End
            </button>
            <button
              type="button"
              className={`${styles.directionBtn} ${direction === 'reverse' ? styles.directionBtnActive : ''}`}
              onClick={() => setDirection('reverse')}
              title="End to Start (Reverse Visionary Planning from Summit)"
            >
              End → Start
            </button>
          </div>
        </div>

        <div className={styles.toolbarActions}>
          {/* Canvas Zoom Controls (Exact Graph Flow Standard) */}
          <div className={styles.zoomControlGroup}>
            <button
              type="button"
              className={styles.ctrlBtn}
              onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
              title="Zoom In"
            >
              <ZoomIn size={12} />
            </button>
            <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className={styles.ctrlBtn}
              onClick={() => setZoom((z) => Math.max(0.35, z - 0.1))}
              title="Zoom Out"
            >
              <ZoomOut size={12} />
            </button>
            <button
              type="button"
              className={styles.ctrlBtn}
              onClick={resetView}
              title="Reset View (100% / Fit)"
            >
              <Maximize2 size={12} />
            </button>
          </div>

          <button
            type="button"
            className={styles.addBtn}
            onClick={handleAddNew}
            title="Add a new life destination station"
          >
            <Plus size={13} />
            <span>Add Destination</span>
          </button>

          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleResetDefaults}
            title="Reset to default life blueprint"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* ── Canvas Viewport (Identical to Graph Flow) ── */}
      <div
        ref={containerRef}
        className={`${styles.canvasViewport} ${isDragging ? styles.dragging : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
          {/* Dot Grid Background (Identical to Graph Flow) */}
          <svg
            className={styles.dotGrid}
            width={canvasWidth}
            height={canvasHeight}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <defs>
              <pattern id="life-dotgrid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1.1" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#life-dotgrid)" />
          </svg>

          {/* Column Stage Headers on Canvas */}
          {orderedDestinations.map((dest, idx) => {
            const x = START_X + idx * COL_GAP;
            const areaColor = dest.lifeAreaId ? (AREA_COLORS[dest.lifeAreaId] ?? '#7c6fff') : '#7c6fff';
            return (
              <div
                key={`col-${dest.id}`}
                className={styles.canvasColHeader}
                style={{
                  left: x + NODE_W / 2,
                  top: START_Y - 56,
                }}
              >
                <div className={styles.colHeaderDot} style={{ background: areaColor }} />
                <span>{dest.phaseLabel || `Station ${dest.order}`}</span>
              </div>
            );
          })}

          {/* SVG Connector Lines (Smooth Bezier Paths with Glow Illumination) */}
          <svg
            className={styles.svgOverlay}
            width={canvasWidth}
            height={canvasHeight}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
          >
            <defs>
              {orderedDestinations.map((dest, i) => {
                const areaColor = dest.lifeAreaId ? (AREA_COLORS[dest.lifeAreaId] ?? '#ffffff') : '#ffffff';
                return (
                  <marker
                    key={`arrow-${dest.id}`}
                    id={`life-arrow-${dest.id}`}
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path
                      d="M0,0 L0,6 L6,3 z"
                      fill={dest.status === 'completed' ? areaColor : 'var(--color-border-focus)'}
                      opacity={dest.status === 'completed' ? '1' : '0.4'}
                    />
                  </marker>
                );
              })}
            </defs>

            {orderedDestinations.map((dest, idx) => {
              if (idx === orderedDestinations.length - 1) return null;
              const nextDest = orderedDestinations[idx + 1];

              const fromX = START_X + idx * COL_GAP + NODE_W;
              const fromY = START_Y + 110;
              const toX = START_X + (idx + 1) * COL_GAP;
              const toY = START_Y + 110;

              const isIlluminated = dest.status === 'completed';
              const isHovered = hoveredNodeId === dest.id || hoveredNodeId === nextDest.id;
              const areaColor = dest.lifeAreaId ? (AREA_COLORS[dest.lifeAreaId] ?? '#ffffff') : '#ffffff';

              return (
                <g key={`path-group-${dest.id}`}>
                  {/* Glowing halo if illuminated */}
                  {isIlluminated && (
                    <path
                      d={getBezierCurve(fromX, fromY, toX, toY)}
                      fill="none"
                      stroke={areaColor}
                      strokeWidth={6}
                      strokeOpacity={0.2}
                      className={styles.glowingHalo}
                    />
                  )}
                  {/* Core Line */}
                  <path
                    d={getBezierCurve(fromX, fromY, toX, toY)}
                    fill="none"
                    stroke={isIlluminated ? areaColor : 'var(--color-border)'}
                    strokeWidth={isIlluminated || isHovered ? 2.5 : 1.5}
                    strokeOpacity={isIlluminated ? 0.95 : isHovered ? 0.7 : 0.3}
                    markerEnd={`url(#life-arrow-${dest.id})`}
                    className={styles.connectionPath}
                  />
                </g>
              );
            })}
          </svg>

          {/* ── Life Destination Node Cards on Canvas ── */}
          {orderedDestinations.map((dest, idx) => {
            const x = START_X + idx * COL_GAP;
            const y = START_Y;
            const isCompleted = dest.status === 'completed';
            const isCurrent = dest.status === 'current';
            const isHovered = hoveredNodeId === dest.id;
            const areaColor = dest.lifeAreaId ? (AREA_COLORS[dest.lifeAreaId] ?? '#7c6fff') : '#7c6fff';
            const areaName = dest.lifeAreaId ? (AREA_LABELS[dest.lifeAreaId] ?? 'Life Growth') : 'Life Growth';

            return (
              <div
                key={dest.id}
                data-node="true"
                className={`${styles.nodeCard} ${
                  isCompleted ? styles.nodeCompleted : isCurrent ? styles.nodeCurrent : styles.nodeUpcoming
                }`}
                style={{
                  left: x,
                  top: y,
                  width: NODE_W,
                  '--dest-color': areaColor,
                  borderColor: isCompleted
                    ? areaColor
                    : isCurrent
                    ? 'var(--color-border-focus)'
                    : isHovered
                    ? 'var(--color-text-muted)'
                    : undefined,
                  boxShadow: isCompleted
                    ? `0 0 24px ${areaColor}25, 0 4px 16px rgba(0, 0, 0, 0.6)`
                    : isCurrent
                    ? `0 0 20px rgba(255, 255, 255, 0.15), 0 4px 16px rgba(0, 0, 0, 0.6)`
                    : undefined,
                } as React.CSSProperties}
                onMouseEnter={() => setHoveredNodeId(dest.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* Header Row: Phase, Area, Checkpoint Marker */}
                <div className={styles.cardHeader}>
                  <div className={styles.badgeGroup}>
                    <span
                      className={styles.phaseTag}
                      style={{
                        color: areaColor,
                        borderColor: `${areaColor}35`,
                        background: `${areaColor}12`,
                      }}
                    >
                      {dest.phaseLabel || `Station ${dest.order}`}
                    </span>
                    <span className={styles.areaTag} style={{ color: areaColor }}>
                      {areaName}
                    </span>
                  </div>

                  {/* Checkpoint Toggle Button */}
                  <button
                    type="button"
                    data-interactive="true"
                    className={`${styles.checkpointBtn} ${
                      isCompleted ? styles.checkpointCompleted : isCurrent ? styles.checkpointCurrent : ''
                    }`}
                    onClick={(e) => handleToggleStatus(dest.id, e)}
                    title={
                      isCompleted
                        ? 'Destination Reached! Click to mark current'
                        : 'Click to mark destination achieved & illuminate path'
                    }
                    aria-label={`Toggle checkpoint for ${dest.title}`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={16} className={styles.checkIconActive} />
                    ) : isCurrent ? (
                      <div className={styles.pulsingCore} />
                    ) : (
                      <Circle size={15} className={styles.checkIconInactive} />
                    )}
                  </button>
                </div>

                {/* Status Indicator & Target Year Banner */}
                <div className={styles.metaRow}>
                  {dest.targetAgeOrYear && (
                    <span className={styles.targetBadge}>
                      <Target size={11} />
                      <span>{dest.targetAgeOrYear}</span>
                    </span>
                  )}

                  {isCurrent && (
                    <span className={styles.inFocusBadge}>
                      <Sparkles size={10} /> You Are Here
                    </span>
                  )}

                  {isCompleted && (
                    <span className={styles.achievedBadge}>
                      <Check size={10} /> Achieved
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className={styles.nodeTitle}>{dest.title}</h3>

                {/* Description */}
                {dest.description && <p className={styles.nodeDesc}>{dest.description}</p>}

                {/* North Star Purpose Box (Why This Matters So I Don't Get Lost) */}
                {dest.whyItMatters && (
                  <div className={styles.whyBox}>
                    <span className={styles.whyLabel}>My North Star:</span>
                    <span className={styles.whyText}>{dest.whyItMatters}</span>
                  </div>
                )}

                {/* Criteria Pillars */}
                {dest.criteria && dest.criteria.length > 0 && (
                  <div className={styles.criteriaList}>
                    {dest.criteria.map((c, i) => (
                      <div key={i} className={styles.criteriaItem}>
                        <div className={styles.criteriaDot} style={{ background: areaColor }} />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom Actions Row */}
                <div className={styles.cardActionsRow} data-interactive="true">
                  <div className={styles.reorderBtns}>
                    <button
                      type="button"
                      className={styles.miniActionBtn}
                      onClick={(e) => handleMove(dest.id, -1, e)}
                      disabled={dest.order === 1}
                      title="Move earlier along path"
                    >
                      <ArrowLeft size={11} />
                    </button>
                    <button
                      type="button"
                      className={styles.miniActionBtn}
                      onClick={(e) => handleMove(dest.id, 1, e)}
                      disabled={dest.order === destinations.length}
                      title="Move later along path"
                    >
                      <ArrowRight size={11} />
                    </button>
                  </div>

                  <div className={styles.editDeleteBtns}>
                    <button
                      type="button"
                      className={styles.miniActionBtn}
                      onClick={(e) => handleEdit(dest, e)}
                      title="Edit life destination"
                    >
                      <Edit2 size={11} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.miniActionBtn} ${styles.miniDeleteBtn}`}
                      onClick={(e) => handleDelete(dest.id, e)}
                      title="Delete destination"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Canvas End "+ Add Next Station" Node Card */}
          <div
            className={styles.addStationCard}
            style={{
              left: START_X + orderedDestinations.length * COL_GAP,
              top: START_Y,
              width: NODE_W,
              minHeight: 180,
            }}
            onClick={handleAddNew}
            data-interactive="true"
          >
            <div className={styles.addStationIcon}>
              <Plus size={20} />
            </div>
            <span className={styles.addStationTitle}>Add Next Horizon</span>
            <span className={styles.addStationSub}>
              Map your next milestone so your journey stays limitless
            </span>
          </div>
        </div>
      </div>

      {/* ── Edit / Add Destination Modal ── */}
      {isModalOpen && editingDest && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <Flag size={15} color="var(--color-accent)" />
                <span className={styles.modalTitle}>
                  {destinations.some((d) => d.id === editingDest.id)
                    ? 'Edit Life Destination'
                    : 'Add New Life Destination'}
                </span>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setIsModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveModal(editingDest);
              }}
              className={styles.modalForm}
            >
              <div className={styles.formGroup}>
                <label className={styles.fieldLabel}>Destination Title *</label>
                <input
                  type="text"
                  required
                  className={styles.inputField}
                  placeholder="e.g. Become Financially Independent & Build 6-Month Runway"
                  value={editingDest.title}
                  onChange={(e) => setEditingDest({ ...editingDest, title: e.target.value })}
                  autoFocus
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel}>Stage / Phase Label</label>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="e.g. Stage 2: Security & Runway"
                    value={editingDest.phaseLabel}
                    onChange={(e) => setEditingDest({ ...editingDest, phaseLabel: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel}>Target Age or Year</label>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="e.g. Age 26, 2027, or Future"
                    value={editingDest.targetAgeOrYear || ''}
                    onChange={(e) => setEditingDest({ ...editingDest, targetAgeOrYear: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel}>Life Area</label>
                  <select
                    className={styles.selectField}
                    value={editingDest.lifeAreaId || 'area-career'}
                    onChange={(e) => setEditingDest({ ...editingDest, lifeAreaId: e.target.value })}
                  >
                    {Object.entries(AREA_LABELS).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel}>Status</label>
                  <select
                    className={styles.selectField}
                    value={editingDest.status}
                    onChange={(e) =>
                      setEditingDest({ ...editingDest, status: e.target.value as LifeDestinationStatus })
                    }
                  >
                    <option value="upcoming">Upcoming Target</option>
                    <option value="current">Current Destination (In Focus)</option>
                    <option value="completed">Achieved / Completed</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.fieldLabel}>Vision &amp; Description</label>
                <textarea
                  className={styles.textareaField}
                  rows={2}
                  placeholder="What does reaching this destination look like in reality?"
                  value={editingDest.description}
                  onChange={(e) => setEditingDest({ ...editingDest, description: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.fieldLabel}>My North Star (Why This Matters So I Don't Get Lost)</label>
                <textarea
                  className={styles.textareaField}
                  rows={2}
                  placeholder="The deep purpose behind this destination that keeps me on track..."
                  value={editingDest.whyItMatters}
                  onChange={(e) => setEditingDest({ ...editingDest, whyItMatters: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.fieldLabel}>Pillars / Key Milestones (1 per line)</label>
                <textarea
                  className={styles.textareaField}
                  rows={3}
                  placeholder="e.g.&#10;Reach $30k savings runway&#10;Zero consumer debt&#10;Launch game demo on Steam"
                  value={(editingDest.criteria || []).join('\n')}
                  onChange={(e) =>
                    setEditingDest({
                      ...editingDest,
                      criteria: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn}>
                  Save Destination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
