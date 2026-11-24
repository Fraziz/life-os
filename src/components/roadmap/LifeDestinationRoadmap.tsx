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
  GitBranch,
  X,
  Target,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Check,
  Compass,
  ArrowRight,
} from 'lucide-react';
import styles from './LifeDestinationRoadmap.module.css';
import type { LifeDestination, LifeDestinationStatus } from '@/types';

const STORAGE_KEY = 'life_os_life_destinations_tree_v1';

// ── ADHD-Optimized Canvas Layout Geometry ──
// Compact cards (identical form factor to Graph Flow) with generous breathing space
const NODE_W = 240;
const NODE_H = 88;
const H_COL_GAP = 310;
const H_ROW_GAP = 64;
const H_START_X = 80;
const H_Y_CENTER = 420;

const V_ROW_GAP = 220;
const V_COL_GAP = 48;
const V_Y_BOTTOM = 860;
const V_X_CENTER = 900;

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
  'area-creative': 'Creative Craft',
  'area-career': 'Enterprise & Career',
  'area-money': 'Financial Freedom',
  'area-learning': 'Skills Mastery',
  'area-health': 'Vitality & Body',
  'area-social': 'Freedom & Travel',
  'area-mindset': 'Vision & Legacy',
};

const TIER_NAMES: Record<number, string> = {
  1: 'Tier 1: Roots',
  2: 'Tier 2: Trunk',
  3: 'Tier 3: Branches',
  4: 'Tier 4: Canopy',
  5: 'Tier 5: Crown Summit',
};

export const DEFAULT_TREE_DESTINATIONS: LifeDestination[] = [
  // Tier 1 — Roots (The Foundation)
  {
    id: 'tree-root',
    title: 'Self-Mastery, Fitness & English Fluency',
    phaseLabel: 'Roots: Base Groundwork',
    branchName: 'Roots & Energy',
    description: 'Establish unbreakable daily fitness discipline, high athletic vitality, deep focus habits, and professional English communication.',
    whyItMatters: 'Without health, stamina, and mental clarity, all other branches wither. This root fuels every dream above it.',
    targetAgeOrYear: 'Current Base',
    lifeAreaId: 'area-health',
    status: 'completed',
    criteria: [
      'Daily strength & cardio conditioning',
      'Fluent conversational & technical English',
      'Consistent 4-hour deep focus blocks',
    ],
    order: 1,
    tier: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Tier 2 — Trunk (Two Core Pillars)
  {
    id: 'tree-wealth',
    title: '6-Month Independence Buffer ($30k)',
    phaseLabel: 'Trunk: Wealth Pillar',
    branchName: 'Financial Freedom',
    description: 'Accumulate a full liquid 6-month runway in high-yield accounts to eliminate survival stress and unlock fearless risk-taking.',
    whyItMatters: 'Financial runway buys mental sovereignty. When survival is guaranteed, I never have to make desperate compromises.',
    targetAgeOrYear: 'Target: 2026-2027',
    lifeAreaId: 'area-money',
    status: 'current',
    parentId: 'tree-root',
    criteria: [
      'Save $15,000 emergency safety cushion',
      'Reach $30,000 full independence runway',
      'Zero consumer debt with diversified cashflow',
    ],
    order: 2,
    tier: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tree-craft',
    title: 'Master 3D Blender & Kinematic Physics',
    phaseLabel: 'Trunk: Craft Pillar',
    branchName: 'Game Dev Craft',
    description: 'Master low-poly 3D modeling, texturing in Blender, and kinematic 2D/3D physics engines from first principles.',
    whyItMatters: 'To build interactive worlds from my imagination and transition permanently from a digital consumer to an elite creator.',
    targetAgeOrYear: 'Target: 2026-2027',
    lifeAreaId: 'area-learning',
    status: 'current',
    parentId: 'tree-root',
    criteria: [
      '3D character & environmental modeling',
      'Kinematic movement & responsive feel',
      'Custom gameplay mechanics architecture',
    ],
    order: 3,
    tier: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Tier 3 — Branches (Active Ventures)
  {
    id: 'tree-gainroot',
    title: 'GAINROOT MVP Launch & 10 Beta Users',
    phaseLabel: 'Branch: Digital Product',
    branchName: 'Software Venture',
    description: 'Ship polished GAINROOT product, validate core value proposition with real paying or highly engaged beta users.',
    whyItMatters: 'Transform technical craft into valuable digital assets that solve real problems and generate scalable independence.',
    targetAgeOrYear: 'Target: 2027',
    lifeAreaId: 'area-career',
    status: 'upcoming',
    parentId: 'tree-wealth',
    criteria: [
      'Launch MVP with high-craft user experience',
      'Onboard 10 active beta testers',
      'Establish core retention & feedback loop',
    ],
    order: 4,
    tier: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tree-game',
    title: 'Publish Playable 2D/3D Indie Game Demo',
    phaseLabel: 'Branch: Indie Game Studio',
    branchName: 'Game Studio',
    description: 'Release a complete, standalone playable game demo with stylized art direction, immersive audio, and 1,000+ enthusiastic players.',
    whyItMatters: 'Experience the joy of seeing players explore an original universe I designed, engineered, and brought to life.',
    targetAgeOrYear: 'Target: 2027-2028',
    lifeAreaId: 'area-creative',
    status: 'upcoming',
    parentId: 'tree-craft',
    criteria: [
      'Complete cohesive sound & visual atmosphere',
      'Smooth 60fps performance across hardware',
      'Publish playable demo on Steam / itch.io',
    ],
    order: 5,
    tier: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tree-vitality',
    title: 'Peak Athletic Conditioning & Stamina',
    phaseLabel: 'Branch: Physical Peak',
    branchName: 'Vitality & Health',
    description: 'Elevate physical conditioning, cardiovascular stamina, and nutrition discipline so the body never becomes a bottleneck to ambition.',
    whyItMatters: 'A razor-sharp mind requires a resilient, energized body capable of performing under pressure for decades.',
    targetAgeOrYear: 'Ongoing Life Pillar',
    lifeAreaId: 'area-health',
    status: 'upcoming',
    parentId: 'tree-root',
    criteria: [
      'Consistent weekly strength & mobility sessions',
      'Optimal sleep and energy biomarkers',
      'Peak stamina for marathon creative focus',
    ],
    order: 6,
    tier: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Tier 4 — Scaled Canopy
  {
    id: 'tree-studio',
    title: 'Autonomous Studio ($10k+/mo MRR)',
    phaseLabel: 'Canopy: Enterprise Autonomy',
    branchName: 'Creative Enterprise',
    description: 'Combine software products and game releases into an autonomous, profitable business generating sustainable recurring revenue.',
    whyItMatters: 'True freedom means owning my intellectual property, controlling my schedule, and never having to sell life hours for a wage.',
    targetAgeOrYear: 'Target: 2028-2029',
    lifeAreaId: 'area-career',
    status: 'upcoming',
    parentIds: ['tree-gainroot', 'tree-game'],
    criteria: [
      'Reach $10,000+/month recurring baseline revenue',
      'Diversified digital product & game catalog',
      'Respected indie creator brand reputation',
    ],
    order: 7,
    tier: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tree-geo',
    title: 'Location Independence & Travel Freedom',
    phaseLabel: 'Canopy: Sovereignty',
    branchName: 'Living Free',
    description: 'Complete geographic freedom: ability to work, travel, and live anywhere in the world without friction or logistical barriers.',
    whyItMatters: 'Life is meant to be explored firsthand. Freedom to experience new cultures, environments, and perspectives.',
    targetAgeOrYear: 'Target: 2028+',
    lifeAreaId: 'area-social',
    status: 'upcoming',
    parentIds: ['tree-wealth'],
    criteria: [
      'Remote-first asynchronous setup',
      'Multi-currency banking & mobility readiness',
      'Freedom to change home location on demand',
    ],
    order: 8,
    tier: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Tier 5 — Crown Summit (Where all branches unite)
  {
    id: 'tree-summit',
    title: 'Total Life Sovereignty & Mentoring Others',
    phaseLabel: 'Crown: The Summit',
    branchName: 'Life Legacy',
    description: 'Complete geographic, temporal, and financial sovereignty. Creating purely for passion, building generational peace, and guiding other builders.',
    whyItMatters: 'This is my ultimate North Star where every branch converges. Remembering this summit ensures I never lose direction through life.',
    targetAgeOrYear: 'Ultimate Destination',
    lifeAreaId: 'area-mindset',
    status: 'upcoming',
    parentIds: ['tree-studio', 'tree-geo', 'tree-vitality'],
    criteria: [
      '100% control over my daily time and creative pursuits',
      'Generational financial peace and lasting security',
      'Mentoring and funding the next generation of builders',
    ],
    order: 9,
    tier: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface NodePositionData {
  node: LifeDestination;
  x: number;
  y: number;
}

interface TreeConnection {
  fromId: string;
  toId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isIlluminated: boolean;
  color: string;
}

export default function LifeDestinationRoadmap() {
  const [destinations, setDestinations] = useState<LifeDestination[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingDest, setEditingDest] = useState<LifeDestination | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Pan & Zoom Canvas State
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState({ x: 30, y: 30 });
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
    setDestinations(DEFAULT_TREE_DESTINATIONS);
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  const saveDestinations = (items: LifeDestination[]) => {
    setDestinations(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  };

  const completedCount = useMemo(() => {
    return destinations.filter((d) => d.status === 'completed').length;
  }, [destinations]);

  // Selected Node Object
  const selectedNode = useMemo(() => {
    return destinations.find((d) => d.id === selectedNodeId) || null;
  }, [destinations, selectedNodeId]);

  // Group nodes by tier (1 to 5)
  const tierGroups = useMemo(() => {
    const groups: Record<number, LifeDestination[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    destinations.forEach((d) => {
      const t = Math.max(1, Math.min(5, d.tier || 1));
      groups[t].push(d);
    });
    Object.keys(groups).forEach((key) => {
      const numKey = Number(key);
      groups[numKey].sort((a, b) => a.order - b.order);
    });
    return groups;
  }, [destinations]);

  // Calculate Node Coordinates in Tree Layout
  const { nodePositions, connections, canvasWidth, canvasHeight } = useMemo(() => {
    const positions: Record<string, NodePositionData> = {};
    const conns: TreeConnection[] = [];

    if (orientation === 'horizontal') {
      // ── Horizontal Tree: Roots on Left → Crown on Right ──
      [1, 2, 3, 4, 5].forEach((tierNum, colIndex) => {
        const nodesInTier = tierGroups[tierNum] || [];
        const M = nodesInTier.length;
        if (M === 0) return;

        const totalHeight = M * NODE_H + (M - 1) * H_ROW_GAP;
        const startY = H_Y_CENTER - totalHeight / 2;
        const x = H_START_X + colIndex * H_COL_GAP;

        nodesInTier.forEach((node, rowIndex) => {
          const y = startY + rowIndex * (NODE_H + H_ROW_GAP);
          positions[node.id] = { node, x, y };
        });
      });

      // Connections
      destinations.forEach((node) => {
        const targetPos = positions[node.id];
        if (!targetPos) return;

        const parentIdList: string[] = [];
        if (node.parentId) parentIdList.push(node.parentId);
        if (node.parentIds && Array.isArray(node.parentIds)) {
          node.parentIds.forEach((pid) => {
            if (!parentIdList.includes(pid)) parentIdList.push(pid);
          });
        }

        parentIdList.forEach((pid) => {
          const sourcePos = positions[pid];
          if (!sourcePos) return;

          const isIlluminated = sourcePos.node.status === 'completed';
          const areaColor = sourcePos.node.lifeAreaId
            ? (AREA_COLORS[sourcePos.node.lifeAreaId] ?? '#ffffff')
            : '#ffffff';

          conns.push({
            fromId: pid,
            toId: node.id,
            fromX: sourcePos.x + NODE_W,
            fromY: sourcePos.y + NODE_H / 2,
            toX: targetPos.x,
            toY: targetPos.y + NODE_H / 2,
            isIlluminated,
            color: areaColor,
          });
        });
      });

      const width = Math.max(2000, H_START_X + 5 * H_COL_GAP + 260);
      const height = Math.max(900, 800);
      return { nodePositions: positions, connections: conns, canvasWidth: width, canvasHeight: height };
    } else {
      // ── Vertical Tree: Roots at Bottom → Crown at Top ──
      [1, 2, 3, 4, 5].forEach((tierNum, rowIndex) => {
        const nodesInTier = tierGroups[tierNum] || [];
        const M = nodesInTier.length;
        if (M === 0) return;

        const totalWidth = M * NODE_W + (M - 1) * V_COL_GAP;
        const startX = V_X_CENTER - totalWidth / 2;
        const y = V_Y_BOTTOM - (tierNum - 1) * V_ROW_GAP;

        nodesInTier.forEach((node, colIndex) => {
          const x = startX + colIndex * (NODE_W + V_COL_GAP);
          positions[node.id] = { node, x, y };
        });
      });

      // Connections
      destinations.forEach((node) => {
        const targetPos = positions[node.id];
        if (!targetPos) return;

        const parentIdList: string[] = [];
        if (node.parentId) parentIdList.push(node.parentId);
        if (node.parentIds && Array.isArray(node.parentIds)) {
          node.parentIds.forEach((pid) => {
            if (!parentIdList.includes(pid)) parentIdList.push(pid);
          });
        }

        parentIdList.forEach((pid) => {
          const sourcePos = positions[pid];
          if (!sourcePos) return;

          const isIlluminated = sourcePos.node.status === 'completed';
          const areaColor = sourcePos.node.lifeAreaId
            ? (AREA_COLORS[sourcePos.node.lifeAreaId] ?? '#ffffff')
            : '#ffffff';

          conns.push({
            fromId: pid,
            toId: node.id,
            fromX: sourcePos.x + NODE_W / 2,
            fromY: sourcePos.y,
            toX: targetPos.x + NODE_W / 2,
            toY: targetPos.y + NODE_H,
            isIlluminated,
            color: areaColor,
          });
        });
      });

      const width = Math.max(2000, 1900);
      const height = Math.max(1200, 1100);
      return { nodePositions: positions, connections: conns, canvasWidth: width, canvasHeight: height };
    }
  }, [destinations, orientation, tierGroups]);

  // SVG Bezier Curves
  const getCurvePath = (fromX: number, fromY: number, toX: number, toY: number): string => {
    if (orientation === 'horizontal') {
      const dx = Math.abs(toX - fromX) * 0.5;
      return `M ${fromX} ${fromY} C ${fromX + dx} ${fromY}, ${toX - dx} ${toY}, ${toX} ${toY}`;
    } else {
      const dy = Math.abs(toY - fromY) * 0.5;
      return `M ${fromX} ${fromY} C ${fromX} ${fromY - dy}, ${toX} ${toY + dy}, ${toX} ${toY}`;
    }
  };

  // Canvas Pan & Zoom Handlers
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
      const nextZoom = Math.max(0.4, Math.min(1.6, pinchStartZoomRef.current * factor));
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
    setZoom((z) => Math.max(0.4, Math.min(1.6, z - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const resetView = useCallback(() => {
    if (orientation === 'horizontal') {
      setPan({ x: 30, y: 30 });
    } else {
      setPan({ x: -280, y: -260 });
    }
    setZoom(0.9);
  }, [orientation]);

  // Toggle checkpoint completion
  const handleToggleStatus = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = destinations.find((d) => d.id === id);
    if (!target) return;

    const willBeCompleted = target.status !== 'completed';

    const updated = destinations.map((d) => {
      if (d.id === id) {
        return {
          ...d,
          status: willBeCompleted ? ('completed' as LifeDestinationStatus) : ('current' as LifeDestinationStatus),
          completedAt: willBeCompleted ? new Date().toISOString() : undefined,
          updatedAt: new Date().toISOString(),
        };
      }
      // If completed, unlock upcoming children
      if (willBeCompleted && (d.parentId === id || (d.parentIds && d.parentIds.includes(id)))) {
        if (d.status === 'upcoming') {
          return {
            ...d,
            status: 'current' as LifeDestinationStatus,
            updatedAt: new Date().toISOString(),
          };
        }
      }
      return d;
    });

    saveDestinations(updated);
  };

  // Add child branch from a node
  const handleAddChildBranch = (parentDest: LifeDestination, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextTier = Math.min(5, (parentDest.tier || 1) + 1);
    const nextOrder = destinations.length > 0 ? Math.max(...destinations.map((d) => d.order)) + 1 : 1;
    setEditingDest({
      id: `tree-${Date.now()}`,
      title: '',
      phaseLabel: `Branch: ${parentDest.branchName || 'Growth'}`,
      branchName: parentDest.branchName || 'New Branch',
      description: '',
      whyItMatters: '',
      targetAgeOrYear: '',
      lifeAreaId: parentDest.lifeAreaId || 'area-career',
      status: 'upcoming',
      parentId: parentDest.id,
      tier: nextTier,
      criteria: [],
      order: nextOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsModalOpen(true);
  };

  // Open modal to add generic new node
  const handleAddNewNode = () => {
    const nextOrder = destinations.length > 0 ? Math.max(...destinations.map((d) => d.order)) + 1 : 1;
    setEditingDest({
      id: `tree-${Date.now()}`,
      title: '',
      phaseLabel: 'New Life Destination',
      branchName: 'Personal Growth',
      description: '',
      whyItMatters: '',
      targetAgeOrYear: '',
      lifeAreaId: 'area-career',
      status: 'upcoming',
      parentId: destinations.length > 0 ? destinations[0].id : undefined,
      tier: 2,
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

  // Delete node
  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (destinations.length <= 1) {
      alert('You must have at least one root destination in your life tree.');
      return;
    }
    const filtered = destinations.filter((d) => d.id !== id);
    saveDestinations(filtered);
    if (selectedNodeId === id) setSelectedNodeId(null);
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
    if (window.confirm('Reset life tree to default master blueprint?')) {
      saveDestinations(DEFAULT_TREE_DESTINATIONS);
      setSelectedNodeId(null);
    }
  };

  if (!isLoaded) return null;

  return (
    <div className={styles.lifePathContainer}>
      {/* ── Top Toolbar (Clean, Minimalist SaaS Bar) ── */}
      <div className={styles.toolbarRow} data-interactive="true">
        <div className={styles.progressSummary}>
          <div className={styles.progressCompass}>
            <GitBranch size={14} className={styles.compassIcon} />
          </div>
          <div className={styles.progressTextGroup}>
            <span className={styles.progressTitle}>
              <strong>{completedCount}</strong> of <strong>{destinations.length}</strong> Milestones Achieved
            </span>
            <span className={styles.progressSubtitle}>Life Tree &amp; Purpose Map</span>
          </div>
        </div>

        <div className={styles.toolbarCenter}>
          {/* Tree Orientation Switcher */}
          <div className={styles.segmentedControl}>
            <button
              type="button"
              className={`${styles.segmentBtn} ${orientation === 'horizontal' ? styles.segmentBtnActive : ''}`}
              onClick={() => setOrientation('horizontal')}
              title="Horizontal Tree (Roots on Left → Crown on Right)"
            >
              Horizontal Tree
            </button>
            <button
              type="button"
              className={`${styles.segmentBtn} ${orientation === 'vertical' ? styles.segmentBtnActive : ''}`}
              onClick={() => setOrientation('vertical')}
              title="Vertical Tree (Roots at Bottom → Crown at Top)"
            >
              Vertical Tree
            </button>
          </div>
        </div>

        <div className={styles.toolbarActions}>
          {/* Zoom Controls */}
          <div className={styles.zoomControlGroup}>
            <button
              type="button"
              className={styles.ctrlBtn}
              onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
              title="Zoom In"
            >
              <ZoomIn size={12} />
            </button>
            <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className={styles.ctrlBtn}
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              title="Zoom Out"
            >
              <ZoomOut size={12} />
            </button>
            <button
              type="button"
              className={styles.ctrlBtn}
              onClick={resetView}
              title="Reset View"
            >
              <Maximize2 size={12} />
            </button>
          </div>

          <button
            type="button"
            className={styles.addBtn}
            onClick={handleAddNewNode}
            title="Add a new milestone node"
          >
            <Plus size={12} />
            <span>Add Node</span>
          </button>

          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleResetDefaults}
            title="Reset to default life tree"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* ── Main Canvas Viewport ── */}
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
        onClick={() => {
          if (!hasMovedRef.current) {
            // Click on canvas background dismisses the detail drawer
            setSelectedNodeId(null);
          }
        }}
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
          {/* Dot Grid Background */}
          <svg
            className={styles.dotGrid}
            width={canvasWidth}
            height={canvasHeight}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <defs>
              <pattern id="tree-dotgrid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1.1" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#tree-dotgrid)" />
          </svg>

          {/* SVG Connector Lines (Smooth Curved Bezier Lines with Glowing Illumination) */}
          <svg
            className={styles.svgOverlay}
            width={canvasWidth}
            height={canvasHeight}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
          >
            <defs>
              {connections.map((conn, i) => (
                <marker
                  key={`arrow-${conn.fromId}-${conn.toId}-${i}`}
                  id={`tree-arrow-${conn.fromId}-${conn.toId}`}
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path
                    d="M0,0 L0,6 L6,3 z"
                    fill={conn.isIlluminated ? conn.color : 'var(--color-border-focus)'}
                    opacity={conn.isIlluminated ? '1' : '0.4'}
                  />
                </marker>
              ))}
            </defs>

            {connections.map((conn, i) => {
              const isHighlighted =
                selectedNodeId === conn.fromId ||
                selectedNodeId === conn.toId ||
                hoveredNodeId === conn.fromId ||
                hoveredNodeId === conn.toId;

              return (
                <g key={`branch-path-${conn.fromId}-${conn.toId}-${i}`}>
                  {/* Glowing halo when branch is illuminated or selected */}
                  {(conn.isIlluminated || isHighlighted) && (
                    <path
                      d={getCurvePath(conn.fromX, conn.fromY, conn.toX, conn.toY)}
                      fill="none"
                      stroke={conn.color}
                      strokeWidth={6}
                      strokeOpacity={isHighlighted ? 0.35 : 0.2}
                      className={styles.glowingHalo}
                    />
                  )}
                  {/* Core Line */}
                  <path
                    d={getCurvePath(conn.fromX, conn.fromY, conn.toX, conn.toY)}
                    fill="none"
                    stroke={conn.isIlluminated || isHighlighted ? conn.color : 'var(--color-border)'}
                    strokeWidth={conn.isIlluminated || isHighlighted ? 2.5 : 1.4}
                    strokeOpacity={conn.isIlluminated ? 0.95 : isHighlighted ? 0.9 : 0.3}
                    markerEnd={`url(#tree-arrow-${conn.fromId}-${conn.toId})`}
                    className={styles.connectionPath}
                  />
                </g>
              );
            })}
          </svg>

          {/* ── Compact Node Cards on Canvas (ADHD-Optimized: Clean, Spacious, Zero Clutter) ── */}
          {Object.values(nodePositions).map(({ node, x, y }) => {
            const isCompleted = node.status === 'completed';
            const isCurrent = node.status === 'current';
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const areaColor = node.lifeAreaId ? (AREA_COLORS[node.lifeAreaId] ?? '#7c6fff') : '#7c6fff';

            return (
              <div
                key={node.id}
                data-node="true"
                className={`${styles.nodeCard} ${
                  isCompleted ? styles.nodeCompleted : isCurrent ? styles.nodeCurrent : styles.nodeUpcoming
                } ${isSelected ? styles.nodeSelected : ''}`}
                style={{
                  left: x,
                  top: y,
                  width: NODE_W,
                  minHeight: NODE_H,
                  '--dest-color': areaColor,
                  borderColor: isSelected
                    ? 'var(--color-text)'
                    : isCompleted
                    ? areaColor
                    : isCurrent
                    ? 'var(--color-border-focus)'
                    : isHovered
                    ? 'var(--color-text-muted)'
                    : undefined,
                  boxShadow: isSelected
                    ? `0 0 0 2px var(--color-text), 0 8px 24px rgba(0, 0, 0, 0.8)`
                    : isCompleted
                    ? `0 0 16px ${areaColor}25, 0 4px 12px rgba(0, 0, 0, 0.5)`
                    : isCurrent
                    ? `0 0 14px rgba(255, 255, 255, 0.15), 0 4px 12px rgba(0, 0, 0, 0.5)`
                    : undefined,
                } as React.CSSProperties}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
                }}
              >
                {/* Header: Branch Tag & Checkpoint Indicator */}
                <div className={styles.cardHeader}>
                  <span
                    className={styles.branchTag}
                    style={{
                      color: areaColor,
                      borderColor: `${areaColor}35`,
                      background: `${areaColor}12`,
                    }}
                  >
                    {node.branchName || `Tier ${node.tier || 1}`}
                  </span>

                  {/* Interactive Checkpoint Toggle */}
                  <button
                    type="button"
                    data-interactive="true"
                    className={`${styles.checkpointBtn} ${
                      isCompleted ? styles.checkpointCompleted : isCurrent ? styles.checkpointCurrent : ''
                    }`}
                    onClick={(e) => handleToggleStatus(node.id, e)}
                    title={
                      isCompleted
                        ? 'Milestone Achieved! Click to set in focus'
                        : 'Click to mark achieved & illuminate branches'
                    }
                    aria-label={`Toggle checkpoint for ${node.title}`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={15} className={styles.checkIconActive} />
                    ) : isCurrent ? (
                      <div className={styles.pulsingCore} />
                    ) : (
                      <Circle size={14} className={styles.checkIconInactive} />
                    )}
                  </button>
                </div>

                {/* Bold Concise Title */}
                <h3 className={styles.nodeTitle}>{node.title}</h3>

                {/* Clean Bottom Meta Row */}
                <div className={styles.metaRow}>
                  {node.targetAgeOrYear ? (
                    <span className={styles.targetBadge}>{node.targetAgeOrYear}</span>
                  ) : null}

                  {isCurrent && (
                    <span className={styles.inFocusBadge}>
                      <Sparkles size={9} /> You Are Here
                    </span>
                  )}

                  {isCompleted && (
                    <span className={styles.achievedBadge}>
                      <Check size={9} /> Achieved
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ADHD Cognitive Usability: Calm Side Detail Inspector Drawer ── */}
      {selectedNode && (
        <aside className={styles.detailDrawer} data-interactive="true" onClick={(e) => e.stopPropagation()}>
          {/* Drawer Header */}
          <div className={styles.drawerHeader}>
            <div className={styles.drawerBadgeRow}>
              <span
                className={styles.drawerBranchPill}
                style={{
                  color: selectedNode.lifeAreaId ? AREA_COLORS[selectedNode.lifeAreaId] : 'var(--color-accent)',
                  borderColor: selectedNode.lifeAreaId ? `${AREA_COLORS[selectedNode.lifeAreaId]}40` : 'var(--color-border)',
                  background: selectedNode.lifeAreaId ? `${AREA_COLORS[selectedNode.lifeAreaId]}15` : 'var(--color-surface-2)',
                }}
              >
                {selectedNode.branchName || `Tier ${selectedNode.tier || 1}`}
              </span>

              <span className={styles.drawerTierLabel}>
                {TIER_NAMES[selectedNode.tier || 1]}
              </span>
            </div>

            <button
              type="button"
              className={styles.drawerCloseBtn}
              onClick={() => setSelectedNodeId(null)}
              title="Close inspector"
            >
              <X size={15} />
            </button>
          </div>

          <div className={styles.drawerBody}>
            {/* Title */}
            <h2 className={styles.drawerTitle}>{selectedNode.title}</h2>

            {/* Target Year & Status Bar */}
            <div className={styles.drawerStatusBar}>
              <button
                type="button"
                className={`${styles.drawerStatusToggle} ${
                  selectedNode.status === 'completed' ? styles.statusToggleCompleted : ''
                }`}
                onClick={() => handleToggleStatus(selectedNode.id)}
              >
                {selectedNode.status === 'completed' ? (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Destination Achieved</span>
                  </>
                ) : selectedNode.status === 'current' ? (
                  <>
                    <Sparkles size={16} />
                    <span>Current Focus (In Progress)</span>
                  </>
                ) : (
                  <>
                    <Circle size={16} />
                    <span>Upcoming Milestone</span>
                  </>
                )}
              </button>

              {selectedNode.targetAgeOrYear && (
                <div className={styles.drawerTargetPill}>
                  <Target size={12} />
                  <span>{selectedNode.targetAgeOrYear}</span>
                </div>
              )}
            </div>

            {/* North Star Box (The ADHD Anchor: Why this matters so you never get lost) */}
            {selectedNode.whyItMatters && (
              <div className={styles.drawerNorthStar}>
                <div className={styles.northStarHeader}>
                  <Compass size={13} />
                  <span>My North Star (Why This Matters)</span>
                </div>
                <p className={styles.northStarText}>{selectedNode.whyItMatters}</p>
              </div>
            )}

            {/* Vision / Description */}
            {selectedNode.description && (
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionLabel}>Vision &amp; Reality</div>
                <p className={styles.drawerDescText}>{selectedNode.description}</p>
              </div>
            )}

            {/* Milestone Criteria Checklist */}
            {selectedNode.criteria && selectedNode.criteria.length > 0 && (
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionLabel}>Milestone Pillars</div>
                <div className={styles.drawerCriteriaList}>
                  {selectedNode.criteria.map((c, i) => (
                    <div key={i} className={styles.drawerCriteriaItem}>
                      <div
                        className={styles.criteriaPillarDot}
                        style={{
                          background: selectedNode.lifeAreaId
                            ? AREA_COLORS[selectedNode.lifeAreaId]
                            : 'var(--color-accent)',
                        }}
                      />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions: Sprout Branch, Edit, Delete */}
            <div className={styles.drawerActions}>
              <button
                type="button"
                className={styles.drawerBranchBtn}
                onClick={(e) => handleAddChildBranch(selectedNode, e)}
              >
                <Plus size={13} />
                <span>Sprout Child Branch</span>
              </button>

              <div className={styles.drawerActionGroup}>
                <button
                  type="button"
                  className={styles.drawerEditBtn}
                  onClick={(e) => handleEdit(selectedNode, e)}
                >
                  <Edit2 size={12} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className={styles.drawerDeleteBtn}
                  onClick={(e) => handleDelete(selectedNode.id, e)}
                  title="Delete destination"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ── Edit / Add Destination Modal ── */}
      {isModalOpen && editingDest && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <Flag size={15} color="var(--color-accent)" />
                <span className={styles.modalTitle}>
                  {destinations.some((d) => d.id === editingDest.id)
                    ? 'Edit Life Tree Node'
                    : 'Add Life Tree Branch'}
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
                <label className={styles.fieldLabel}>Milestone Title *</label>
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
                  <label className={styles.fieldLabel}>Branch Name</label>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="e.g. Creative Craft, Wealth & Freedom"
                    value={editingDest.branchName || ''}
                    onChange={(e) => setEditingDest({ ...editingDest, branchName: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel}>Tree Tier (Depth)</label>
                  <select
                    className={styles.selectField}
                    value={editingDest.tier || 1}
                    onChange={(e) => setEditingDest({ ...editingDest, tier: Number(e.target.value) })}
                  >
                    <option value={1}>Tier 1: Roots &amp; Groundwork</option>
                    <option value={2}>Tier 2: Core Trunk Pillars</option>
                    <option value={3}>Tier 3: Specialized Branches</option>
                    <option value={4}>Tier 4: Scaled Canopy</option>
                    <option value={5}>Tier 5: Crown &amp; Life Summit</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel}>Parent Branch (Connects From)</label>
                  <select
                    className={styles.selectField}
                    value={editingDest.parentId || ''}
                    onChange={(e) => setEditingDest({ ...editingDest, parentId: e.target.value || undefined })}
                  >
                    <option value="">None (Tree Root)</option>
                    {destinations
                      .filter((d) => d.id !== editingDest.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} ({d.branchName || `Tier ${d.tier || 1}`})
                        </option>
                      ))}
                  </select>
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
                <label className={styles.fieldLabel}>Milestone Criteria Pillars (1 per line)</label>
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
