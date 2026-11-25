'use client';

import React, { useState } from 'react';
import { useDreams } from '@/context/DreamContext';
import { useGoals } from '@/context/GoalContext';
import { useTasks } from '@/context/TaskContext';
import { useLifeAreas } from '@/context/LifeAreaContext';
import type { Dream, DreamStatus } from '@/types';
import {
  Plus,
  Edit2,
  Trash2,
  Heart,
  CheckCircle2,
  X,
  RotateCcw,
  CloudSun,
  Target,
  CheckSquare,
  Zap,
  ArrowRight,
} from 'lucide-react';
import styles from './page.module.css';
import BulkActionBar from '@/components/ui/BulkActionBar';
import SelectCheckbox, { shouldToggleSelectionOnCardClick } from '@/components/ui/SelectCheckbox';
import MasonryGrid from '@/components/ui/MasonryGrid';
import EntityFiles from '@/components/files/EntityFiles';
import PageSkeleton from '@/components/ui/PageSkeleton';
import AdhdHierarchyModal from '@/components/guidance/AdhdHierarchyModal';
import { playSuccessChime } from '@/utils/soundAndDopamine';
import AutoLinkText from '@/components/ui/AutoLinkText';

const STATUS_CONFIG: Record<DreamStatus, { label: string; className: string }> = {
  dream: { label: 'Dream', className: styles.dream },
  planning: { label: 'Planning', className: styles.planning },
  active: { label: 'Active', className: styles.active },
  paused: { label: 'Paused', className: styles.paused },
  achieved: { label: 'Achieved', className: styles.achieved },
  archived: { label: 'Archived', className: styles.archived },
};

export default function DreamsPage() {
  const { dreams, addDream, updateDream, updateDreamStatus, deleteDream, resetToDefaultDreams, isLoaded } = useDreams();
  const { goals, addGoal } = useGoals();
  const { addTask } = useTasks();
  const { activeAreas } = useLifeAreas();

  const [activeFilter, setActiveFilter] = useState<'all' | DreamStatus>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDream, setEditingDream] = useState<Dream | null>(null);

  // ADHD Guidance & 1-Click Bridges
  const [adhdGuideOpen, setAdhdGuideOpen] = useState(false);
  const [quickBridge, setQuickBridge] = useState<{
    type: 'goal' | 'task';
    dream: Dream;
  } | null>(null);
  const [bridgeTitle, setBridgeTitle] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Multi-selection for bulk delete/archive
  const [selectedDreamIds, setSelectedDreamIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  const toggleSelectDream = (id: string) => {
    setSelectedDreamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllDreams = () => {
    setSelectedDreamIds(new Set(filteredDreams.map((d) => d.id)));
    setIsSelectMode(true);
  };

  const handleDeselectAllDreams = () => {
    setSelectedDreamIds(new Set());
  };

  const handleBatchDeleteDreams = () => {
    const count = selectedDreamIds.size;
    selectedDreamIds.forEach((id) => deleteDream(id));
    setSelectedDreamIds(new Set());
    setIsSelectMode(false);
    showToast(`Deleted ${count} dreams`);
  };

  const handleBatchArchiveDreams = () => {
    const count = selectedDreamIds.size;
    selectedDreamIds.forEach((id) => updateDream(id, { status: 'archived' as any }));
    setSelectedDreamIds(new Set());
    setIsSelectMode(false);
    showToast(`Archived ${count} dreams`);
  };

  const openBridge = (type: 'goal' | 'task', dream: Dream) => {
    setQuickBridge({ type, dream });
    if (type === 'goal') {
      setBridgeTitle(`90-Day Quest: ${dream.title}`);
    } else {
      setBridgeTitle(`Start 15 mins: Research ${dream.title}`);
    }
  };

  const handleBridgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBridge || !bridgeTitle.trim()) return;

    if (quickBridge.type === 'goal') {
      addGoal({
        title: bridgeTitle.trim(),
        why: quickBridge.dream.whyItMatters || 'Aligned with parent dream',
        parentDreamId: quickBridge.dream.id,
        lifeAreaId: quickBridge.dream.lifeAreaId,
        horizon: '90-day',
        priority: 'high',
        status: 'in-progress',
        progress: 0,
      });
      playSuccessChime();
      showToast(`Goal created & linked to "${quickBridge.dream.title}"!`);
    } else {
      addTask({
        title: bridgeTitle.trim(),
        description: `15-minute starter step for dream: ${quickBridge.dream.title}`,
        status: 'todo',
        priority: 'medium',
        estimatedDuration: 25,
        tags: ['dream-action'],
        subtasks: [],
      });
      playSuccessChime();
      showToast(`Task added to your Tasks To Do!`);
    }
    setQuickBridge(null);
  };

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [whyItMatters, setWhyItMatters] = useState('');
  const [lifeAreaId, setLifeAreaId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<DreamStatus>('dream');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');


  const openCreateModal = () => {
    setEditingDream(null);
    setTitle('');
    setDescription('');
    setWhyItMatters('');
    setLifeAreaId(activeAreas[0]?.id || '');
    setTargetDate('');
    setStatus('dream');
    setNotes('');
    setImageUrl('');
    setModalOpen(true);
  };

  const openEditModal = (d: Dream) => {
    setEditingDream(d);
    setTitle(d.title);
    setDescription(d.description || '');
    setWhyItMatters(d.whyItMatters);
    setLifeAreaId(d.lifeAreaId || '');
    setTargetDate(d.targetDate || '');
    setStatus(d.status);
    setNotes(d.notes || '');
    setImageUrl(d.imageUrl || '');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !whyItMatters.trim()) return;

    if (editingDream) {
      updateDream(editingDream.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        whyItMatters: whyItMatters.trim(),
        lifeAreaId: lifeAreaId || undefined,
        targetDate: targetDate || undefined,
        status,
        notes: notes.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      });
    } else {
      addDream({
        title: title.trim(),
        description: description.trim() || undefined,
        whyItMatters: whyItMatters.trim(),
        lifeAreaId: lifeAreaId || undefined,
        targetDate: targetDate || undefined,
        status,
        notes: notes.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      });
    }
    setModalOpen(false);
  };

  if (!isLoaded) {
    return <PageSkeleton variant="cards" cardsCount={6} showMetrics={false} showControls={true} />;
  }


  const filteredDreams = dreams.filter((d) => {
    if (activeFilter === 'all') {
      if (d.status === 'archived') return false;
    } else if (d.status !== activeFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Dreams &amp; Vision Board</h1>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.btnAdhdGuide}
            onClick={() => setAdhdGuideOpen(true)}
            title="ADHD 4-Level Guide: How Dreams, Goals, Projects, and Tasks work together"
          >
            4-Level Guide
          </button>
          <button className={styles.btnCreate} onClick={openCreateModal}>
            <Plus size={18} /> New Dream
          </button>
        </div>
      </header>

      {/* ── Controls Bar ── */}
      <div className={styles.controlsBar}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeFilter === 'all' ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All ({dreams.filter((d) => d.status !== 'archived').length})
          </button>
          <button
            className={`${styles.tab} ${activeFilter === 'dream' ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter('dream')}
          >
            Dreams
          </button>
          <button
            className={`${styles.tab} ${activeFilter === 'planning' ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter('planning')}
          >
            Planning
          </button>
          <button
            className={`${styles.tab} ${activeFilter === 'active' ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter('active')}
          >
            Active
          </button>
          <button
            className={`${styles.tab} ${activeFilter === 'achieved' ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter('achieved')}
          >
            Achieved ({dreams.filter((d) => d.status === 'achieved').length})
          </button>
          <button
            className={`${styles.tab} ${activeFilter === 'archived' ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter('archived')}
          >
            Archived ({dreams.filter((d) => d.status === 'archived').length})
          </button>
          {!isSelectMode && selectedDreamIds.size === 0 ? (
            <button
              type="button"
              className={styles.tab}
              onClick={() => setIsSelectMode(true)}
              title="Select dreams to delete or organize"
            >
              <CheckSquare size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
              Select
            </button>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className={`${styles.tab} ${selectedDreamIds.size > 0 ? styles.activeTab : ''}`}
                onClick={() => {
                  if (selectedDreamIds.size === filteredDreams.length) handleDeselectAllDreams();
                  else handleSelectAllDreams();
                }}
                title="Select all visible dreams for bulk actions"
              >
                <CheckSquare size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                {selectedDreamIds.size > 0 ? `${selectedDreamIds.size} Selected` : 'Select All'}
              </button>
              <button
                type="button"
                className={styles.tab}
                onClick={() => {
                  setIsSelectMode(false);
                  handleDeselectAllDreams();
                }}
                title="Exit selection mode"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Dreams Grid ── */}
      {filteredDreams.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <CloudSun size={40} style={{ color: 'var(--color-text-faint)', marginBottom: 'var(--space-2)' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            No dreams matching this filter. Click &quot;New Dream&quot; to add your ambition!
          </p>
        </div>
      ) : (
        <MasonryGrid
          items={filteredDreams}
          getKey={(d) => d.id}
          minColumnWidth={300}
          maxColumns={4}
          fallbackClassName={styles.dreamsGrid}
          estimateWeight={(d) =>
            160 +
            (d.imageUrl ? 160 : 0) +
            Math.ceil((d.title?.length || 0) / 30) * 18 +
            Math.ceil((d.description?.length || 0) / 34) * 18 +
            Math.ceil((d.whyItMatters?.length || 0) / 34) * 18
          }
          renderItem={(d) => {
            const area = activeAreas.find((a) => a.id === d.lifeAreaId);
            const statusInfo = STATUS_CONFIG[d.status] || STATUS_CONFIG.dream;

            const isSelected = selectedDreamIds.has(d.id);
            const isSelectionActive = isSelectMode || selectedDreamIds.size > 0;

            return (
              <article
                key={d.id}
                className={styles.dreamCard}
                onClick={(e) => {
                  if (shouldToggleSelectionOnCardClick(e, isSelectionActive)) {
                    toggleSelectDream(d.id);
                  }
                }}
                style={{
                  background: isSelected ? 'var(--color-surface-2)' : undefined,
                  boxShadow: isSelected ? '0 0 0 1.5px var(--color-accent)' : undefined,
                  borderColor: isSelected ? 'var(--color-accent)' : undefined,
                  cursor: isSelectionActive ? 'pointer' : undefined,
                }}
              >
                {d.imageUrl && (
                  <img src={d.imageUrl} alt={d.title} className={styles.cardCover} />
                )}

                <div className={styles.cardBody}>
                  <div className={styles.cardTopRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SelectCheckbox
                        checked={isSelected}
                        onToggle={() => toggleSelectDream(d.id)}
                        selectionMode={isSelectMode || selectedDreamIds.size > 0}
                        ariaLabel={`Select dream ${d.title}`}
                      />
                      <span className={`${styles.statusBadge} ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className={styles.cardActions}>
                      <EntityFiles
                        variant="icon"
                        entityType="dream"
                        entityId={d.id}
                        title={d.title}
                        className={styles.fileActionBtn}
                      />
                      <button
                        className={styles.actionBtn}
                        onClick={() => openEditModal(d)}
                        title="Edit Dream"
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => {
                          if (confirm(`Delete Dream "${d.title}"?`)) {
                            deleteDream(d.id);
                          }
                        }}
                        title="Delete Dream"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.dreamTitleGroup}>
                    <h3 className={styles.dreamTitle}><AutoLinkText text={d.title} /></h3>
                    {d.description && <p className={styles.dreamDesc}><AutoLinkText text={d.description} /></p>}
                  </div>

                  {d.whyItMatters && (
                    <p className={styles.whyQuote}>
                      <AutoLinkText text={d.whyItMatters} />
                    </p>
                  )}

                  {d.notes && (
                    <p className={styles.notesText}>
                      <AutoLinkText text={d.notes} />
                    </p>
                  )}

                  {/* ── Minimal Progress Line ── */}
                  {(() => {
                    const linkedGoals = goals.filter((g) => g.parentDreamId === d.id);
                    const completedGoals = linkedGoals.filter((g) => g.status === 'completed' || g.progress === 100);
                    const isAutomated = linkedGoals.length > 0;
                    const computedMomentum = isAutomated
                      ? Math.round(linkedGoals.reduce((sum, g) => sum + (g.progress || 0), 0) / linkedGoals.length)
                      : (d.progress ?? (d.status === 'achieved' ? 100 : 0));

                    return (
                      <div className={styles.progressSection}>
                        <div className={styles.progressHeader}>
                          <span className={styles.progressLabel}>
                            {isAutomated
                              ? `${completedGoals.length}/${linkedGoals.length} goals`
                              : 'Progress'}
                          </span>
                          <span className={styles.progressValue}>{computedMomentum}%</span>
                        </div>
                        <div className={styles.progressBarTrack}>
                          <div
                            className={styles.progressBarFill}
                            style={{ width: `${computedMomentum}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  <div className={styles.cardFooter}>
                    {area ? (
                      <span className={styles.lifeAreaText}>
                        <span className={styles.areaDot} style={{ background: area.color }} />
                        <span>{area.name}</span>
                      </span>
                    ) : (
                      <span className={styles.generalArea}>General</span>
                    )}

                    <div className={styles.footerRight}>
                      {d.targetDate && (
                        <span className={styles.targetDate}>{d.targetDate}</span>
                      )}

                      <div className={styles.bridgeGroup}>
                        <button
                          type="button"
                          className={styles.bridgeBtn}
                          onClick={() => openBridge('goal', d)}
                          title="Create a Goal from this Dream"
                        >
                          + Goal
                        </button>
                        <button
                          type="button"
                          className={styles.bridgeBtn}
                          onClick={() => openBridge('task', d)}
                          title="Create a starter Task for this Dream"
                        >
                          + Task
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          }}
        />
      )}

      {/* ── Modal Dialog for Create / Edit ── */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingDream ? 'Edit Dream' : 'New Dream Vision'}
              </h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="dream-title">Dream Title</label>
                <input
                  id="dream-title"
                  type="text"
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Build my own game, Become financially independent"
                  required
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="dream-why">Why It Matters (Core Motivation)</label>
                <textarea
                  id="dream-why"
                  className={styles.textarea}
                  value={whyItMatters}
                  onChange={(e) => setWhyItMatters(e.target.value)}
                  placeholder="Why is this dream important to your life? What will achieving it feel like?"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="dream-desc">Description & Context (Optional)</label>
                <textarea
                  id="dream-desc"
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of what this dream entails..."
                />
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="dream-status">Status</label>
                  <select
                    id="dream-status"
                    className={styles.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DreamStatus)}
                  >
                    <option value="dream">Dream (Vision / Someday)</option>
                    <option value="planning">Planning (Defining Path)</option>
                    <option value="active">Active (Currently Pursuing)</option>
                    <option value="paused">Paused (On Hold)</option>
                    <option value="achieved">Achieved ✓ (Realized)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="dream-area">Life Area</label>
                  <select
                    id="dream-area"
                    className={styles.select}
                    value={lifeAreaId}
                    onChange={(e) => setLifeAreaId(e.target.value)}
                  >
                    <option value="">-- Select Life Area --</option>
                    {activeAreas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="dream-target-date">Target Realization Date (Optional)</label>
                  <input
                    id="dream-target-date"
                    type="date"
                    className={styles.input}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="dream-image">Vision Cover Image URL (Optional)</label>
                  <input
                    id="dream-image"
                    type="url"
                    className={styles.input}
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="dream-notes">Inspiration Notes & Ideas (Optional)</label>
                <textarea
                  id="dream-notes"
                  className={styles.textarea}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Inspirations, books, references, mental notes..."
                />
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnCreate}>
                  {editingDream ? 'Save Dream' : 'Add Dream'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 1-Click ADHD Quick Bridge Modal ── */}
      {quickBridge && (
        <div className={styles.modalOverlay} onClick={() => setQuickBridge(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: quickBridge.type === 'goal' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: quickBridge.type === 'goal' ? '#fbbf24' : '#34d399',
                    border: `1px solid ${quickBridge.type === 'goal' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                  }}
                >
                  {quickBridge.type === 'goal' ? 'Dream → Goal' : 'Dream → Task'}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setQuickBridge(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Connected to Dream: <strong style={{ color: 'var(--color-text)' }}>{quickBridge.dream.title}</strong>
            </div>

            <form onSubmit={handleBridgeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  {quickBridge.type === 'goal' ? 'Goal Quest Name (1–3 Months)' : '15-Minute Action Task'}
                </label>
                <input
                  type="text"
                  className={styles.input}
                  value={bridgeTitle}
                  onChange={(e) => setBridgeTitle(e.target.value)}
                  placeholder={quickBridge.type === 'goal' ? 'e.g. Finish prototype v1' : 'e.g. Spend 15 mins drafting notes'}
                  required
                  autoFocus
                />
              </div>

              <div
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '11.5px',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>
                  {quickBridge.type === 'goal'
                    ? 'Pre-configured as an in-progress 90-day goal linked to this dream.'
                    : 'Pre-configured as a 25-minute task added straight to your Tasks To Do.'}
                </span>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setQuickBridge(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnCreate}
                  style={{
                    background: quickBridge.type === 'goal' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #10b981, #059669)',
                  }}
                >
                  {quickBridge.type === 'goal' ? 'Create Goal' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="chatgptToast" role="status" aria-live="polite">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── ADHD 4-Level Guide Modal ── */}
      <AdhdHierarchyModal
        isOpen={adhdGuideOpen}
        onClose={() => setAdhdGuideOpen(false)}
      />

      {/* ── Professional Bulk Action Bar ── */}
      <BulkActionBar
        selectedCount={selectedDreamIds.size}
        totalCount={filteredDreams.length}
        itemLabel="dreams"
        onSelectAll={handleSelectAllDreams}
        onDeselectAll={() => {
          handleDeselectAllDreams();
          setIsSelectMode(false);
        }}
        onDelete={handleBatchDeleteDreams}
        onArchive={handleBatchArchiveDreams}
        archiveLabel="Archive"
      />
    </div>
  );
}
