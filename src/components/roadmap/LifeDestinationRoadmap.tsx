'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  Flag,
  Sparkles,
  Edit2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Compass,
  X,
  Target,
  ChevronRight,
  RotateCcw,
  Eye,
  Check,
} from 'lucide-react';
import styles from './LifeDestinationRoadmap.module.css';
import type { LifeDestination, LifeDestinationStatus } from '@/types';

const STORAGE_KEY = 'life_os_life_destinations_v1';

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
  'area-career': 'Career & Business',
  'area-money': 'Financial Independence',
  'area-learning': 'Learning & Skills',
  'area-health': 'Health & Vitality',
  'area-social': 'Relationships',
  'area-mindset': 'Mindset & Vision',
};

export const DEFAULT_DESTINATIONS: LifeDestination[] = [
  {
    id: 'dest-1',
    title: 'Self-Mastery, Health & Core Skills Baseline',
    phaseLabel: 'Start: Groundwork & Energy',
    description: 'Establish unbreakable daily discipline, physical vitality, consistent training, and master professional English & technical fundamentals.',
    whyItMatters: 'Without health, high energy, and mental sharpness, all other goals collapse. This foundation gives me the stamina to build my future.',
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
    phaseLabel: 'Station 2: Safety & Autonomy',
    description: 'Accumulate a full 6-month liquid runway in high-yield savings to eliminate survival stress and unlock fearless creative risk-taking.',
    whyItMatters: 'Financial runway buys mental freedom. When basic survival is guaranteed, I never have to make desperate short-term compromises.',
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
    phaseLabel: 'Station 3: The Builder',
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
    phaseLabel: 'Station 4: Creative Enterprise',
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
    phaseLabel: 'End: The Summit & Life Legacy',
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

  // Reorder sort
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

  // Toggle checkpoint completion
  const handleToggleStatus = (id: string) => {
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
      // If we just completed this destination, advance the next destination to 'current' if it's upcoming
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
      phaseLabel: `Destination ${nextOrder}`,
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
  const handleEdit = (dest: LifeDestination) => {
    setEditingDest(dest);
    setIsModalOpen(true);
  };

  // Delete destination
  const handleDelete = (id: string) => {
    const filtered = destinations.filter((d) => d.id !== id);
    // Re-index orders
    const reindexed = filtered
      .sort((a, b) => a.order - b.order)
      .map((d, i) => ({ ...d, order: i + 1 }));
    saveDestinations(reindexed);
  };

  // Move destination up or down
  const handleMove = (id: string, dir: -1 | 1) => {
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

  if (!isLoaded) return null;

  return (
    <div className={styles.lifePathContainer}>
      {/* ── Sub-header Toolbar ── */}
      <div className={styles.toolbarRow}>
        <div className={styles.progressSummary}>
          <div className={styles.progressCompass}>
            <Compass size={16} className={styles.compassIcon} />
          </div>
          <div className={styles.progressTextGroup}>
            <span className={styles.progressTitle}>
              <strong>{completedCount}</strong> of <strong>{destinations.length}</strong> Destinations Reached
            </span>
            <span className={styles.progressSubtitle}>
              {currentDestination
                ? `Next Destination: ${currentDestination.title}`
                : 'All Destinations Achieved!'}
            </span>
          </div>
        </div>

        <div className={styles.toolbarActions}>
          {/* Order Direction Switcher */}
          <div className={styles.directionControl}>
            <button
              type="button"
              className={`${styles.directionBtn} ${direction === 'forward' ? styles.directionBtnActive : ''}`}
              onClick={() => setDirection('forward')}
              title="Start to End (Ascending Growth)"
            >
              Start → End
            </button>
            <button
              type="button"
              className={`${styles.directionBtn} ${direction === 'reverse' ? styles.directionBtnActive : ''}`}
              onClick={() => setDirection('reverse')}
              title="End to Start (Reverse Visionary Planning)"
            >
              End → Start
            </button>
          </div>

          <button
            type="button"
            className={styles.addBtn}
            onClick={handleAddNew}
          >
            <Plus size={14} />
            <span>Add Destination</span>
          </button>

          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleResetDefaults}
            title="Reset to default blueprint"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* ── Visual Life Roadmap Canvas ── */}
      <div className={styles.mapCanvas}>
        <div className={styles.pathStream}>
          {orderedDestinations.map((dest, idx) => {
            const isCompleted = dest.status === 'completed';
            const isCurrent = dest.status === 'current';
            const isLast = idx === orderedDestinations.length - 1;
            const areaColor = dest.lifeAreaId ? (AREA_COLORS[dest.lifeAreaId] ?? '#7c6fff') : '#7c6fff';
            const areaName = dest.lifeAreaId ? (AREA_LABELS[dest.lifeAreaId] ?? 'Life Growth') : 'Life Growth';

            return (
              <React.Fragment key={dest.id}>
                {/* ── Destination Station Card ── */}
                <div
                  className={`${styles.stationWrapper} ${
                    isCompleted ? styles.stationCompleted : isCurrent ? styles.stationCurrent : styles.stationUpcoming
                  }`}
                  style={{
                    '--station-color': areaColor,
                  } as React.CSSProperties}
                >
                  {/* Left Station Checkpoint Indicator */}
                  <div className={styles.checkpointTrack}>
                    <button
                      type="button"
                      className={`${styles.checkpointMarker} ${
                        isCompleted ? styles.markerCompleted : isCurrent ? styles.markerCurrent : ''
                      }`}
                      onClick={() => handleToggleStatus(dest.id)}
                      title={isCompleted ? 'Destination Reached! Click to mark current' : 'Click to mark destination achieved'}
                      aria-label={`Toggle destination ${dest.title}`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 size={20} className={styles.checkIconActive} />
                      ) : isCurrent ? (
                        <div className={styles.pulsingCore} />
                      ) : (
                        <Circle size={18} className={styles.checkIconInactive} />
                      )}
                    </button>
                    <span className={styles.stationNumber}>
                      {String(dest.order).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Destination Card Body */}
                  <div className={styles.destinationCard}>
                    {/* Header Row */}
                    <div className={styles.cardHeader}>
                      <div className={styles.badgeRow}>
                        <span className={styles.phaseBadge} style={{ color: areaColor, borderColor: `${areaColor}40`, background: `${areaColor}15` }}>
                          {dest.phaseLabel || `Station ${dest.order}`}
                        </span>

                        {dest.targetAgeOrYear && (
                          <span className={styles.targetBadge}>
                            <Target size={11} />
                            <span>{dest.targetAgeOrYear}</span>
                          </span>
                        )}

                        <span className={styles.areaBadge} style={{ color: areaColor }}>
                          {areaName}
                        </span>

                        {isCurrent && (
                          <span className={styles.inFocusBadge}>
                            <Sparkles size={11} /> You Are Here
                          </span>
                        )}

                        {isCompleted && (
                          <span className={styles.achievedBadge}>
                            <Check size={11} /> Achieved
                          </span>
                        )}
                      </div>

                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => handleMove(dest.id, -1)}
                          disabled={dest.order === 1}
                          title="Move earlier in journey"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => handleMove(dest.id, 1)}
                          disabled={dest.order === destinations.length}
                          title="Move later in journey"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => handleEdit(dest)}
                          title="Edit life destination"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                          onClick={() => handleDelete(dest.id)}
                          title="Delete destination"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className={styles.cardTitle}>{dest.title}</h3>

                    {/* Description */}
                    {dest.description && (
                      <p className={styles.cardDesc}>{dest.description}</p>
                    )}

                    {/* North Star (Why It Matters) */}
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
                  </div>
                </div>

                {/* ── Connecting Road Path ── */}
                {!isLast && (
                  <div
                    className={`${styles.roadConnector} ${
                      isCompleted ? styles.roadIlluminated : ''
                    }`}
                  >
                    <div className={styles.roadLine} />
                    <div className={styles.roadDashIcon}>
                      <ChevronRight size={14} className={styles.roadArrow} />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Edit / Add Destination Modal ── */}
      {isModalOpen && editingDest && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <Flag size={16} color="var(--color-accent)" />
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
                  <label className={styles.fieldLabel}>Phase / Station Label</label>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="e.g. Station 2: Security & Runway"
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
