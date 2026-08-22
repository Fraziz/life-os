'use client';

import React, { useState } from 'react';
import { useMilestones } from '@/context/MilestoneContext';
import { useGoals } from '@/context/GoalContext';
import { useDreams } from '@/context/DreamContext';
import type { Milestone, MilestoneStatus } from '@/types';
import {
  Flag,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Sparkles,
  CloudSun,
  Target,
  ArrowUp,
  ArrowDown,
  X,
  RotateCcw,
} from 'lucide-react';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: styles.upcoming },
  'in-progress': { label: 'In Progress', className: styles.inProgress },
  completed: { label: 'Completed ✓', className: styles.completed },
  missed: { label: 'Missed', className: styles.upcoming },
  archived: { label: 'Archived', className: styles.upcoming },
};

export default function MilestonesPage() {
  const {
    milestones,
    addMilestone,
    updateMilestone,
    updateMilestoneProgress,
    reorderMilestone,
    deleteMilestone,
    resetToDefaultMilestones,
    isLoaded,
  } = useMilestones();
  const { goals } = useGoals();
  const { dreams } = useDreams();

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [goalFilter, setGoalFilter] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalId, setGoalId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('upcoming');
  const [progress, setProgress] = useState<number>(0);

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading your Milestones...
        </p>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingMilestone(null);
    setTitle('');
    setDescription('');
    setGoalId(goals[0]?.id || '');
    setTargetDate('');
    setStatus('upcoming');
    setProgress(0);
    setModalOpen(true);
  };

  const openEditModal = (m: Milestone) => {
    setEditingMilestone(m);
    setTitle(m.title);
    setDescription(m.description || '');
    setGoalId(m.goalId);
    setTargetDate(m.targetDate || '');
    setStatus(m.status);
    setProgress(m.progress);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !goalId) return;

    if (editingMilestone) {
      updateMilestone(editingMilestone.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        goalId,
        targetDate: targetDate || undefined,
        status,
        progress,
      });
    } else {
      addMilestone({
        title: title.trim(),
        description: description.trim() || undefined,
        goalId,
        targetDate: targetDate || undefined,
        status,
        progress,
      });
    }
    setModalOpen(false);
  };

  const filteredMilestones = milestones
    .filter((m) => {
      if (statusFilter === 'active' && (m.status === 'completed' || m.status === 'archived')) return false;
      if (statusFilter === 'completed' && m.status !== 'completed') return false;
      if (goalFilter !== 'all' && m.goalId !== goalFilter) return false;
      return true;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Milestones & Checkpoints</h1>
          <p className={styles.subtitle}>
            Major checkpoints bridging Goals and actionable Projects. Keep your long-term roadmap calibrated with concrete progress gates.
          </p>
        </div>

        <button className={styles.btnCreate} onClick={openCreateModal}>
          <Plus size={18} /> New Milestone
        </button>
      </header>

      {/* ── Controls Bar ── */}
      <div className={styles.controlsBar}>
        <div className={styles.filtersGroup}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${statusFilter === 'active' ? styles.activeTab : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active ({milestones.filter((m) => m.status !== 'completed' && m.status !== 'archived').length})
            </button>
            <button
              className={`${styles.tab} ${statusFilter === 'completed' ? styles.activeTab : ''}`}
              onClick={() => setStatusFilter('completed')}
            >
              Completed ({milestones.filter((m) => m.status === 'completed').length})
            </button>
            <button
              className={`${styles.tab} ${statusFilter === 'all' ? styles.activeTab : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
          </div>

          <select
            className={styles.selectFilter}
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}
          >
            <option value="all">All Goals</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                Goal: {g.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Milestones Grid ── */}
      {filteredMilestones.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed var(--color-border-subtle)',
          }}
        >
          <Flag size={40} style={{ color: 'var(--color-text-faint)', marginBottom: 'var(--space-2)' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            No milestones found. Click &quot;New Milestone&quot; to define your roadmap!
          </p>
        </div>
      ) : (
        <div className={styles.milestonesGrid}>
          {filteredMilestones.map((milestone) => {
            const parentGoal = goals.find((g) => g.id === milestone.goalId);
            const parentDream = parentGoal ? dreams.find((d) => d.id === parentGoal.parentDreamId) : undefined;
            const statusInfo = STATUS_CONFIG[milestone.status] || STATUS_CONFIG.upcoming;

            return (
              <article key={milestone.id} className={styles.milestoneCard}>
                {/* ── Hierarchy Banner: Dream -> Goal ── */}
                {parentGoal && (
                  <div className={styles.hierarchyBanner}>
                    {parentDream && (
                      <>
                        <span className={styles.hierarchyItem}>{parentDream.title}</span>
                        <span className={styles.hierarchySep}>→</span>
                      </>
                    )}
                    <span style={{ color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {parentGoal.title}
                    </span>
                  </div>
                )}

                <div className={styles.cardTopRow}>
                  <span className={`${styles.statusBadge} ${statusInfo.className}`}>
                    {statusInfo.label}
                  </span>

                  <div className={styles.cardActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => reorderMilestone(milestone.id, 'up')}
                      title="Move Up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      className={styles.actionBtn}
                      onClick={() => reorderMilestone(milestone.id, 'down')}
                      title="Move Down"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <EntityFiles variant="icon" entityType="milestone" entityId={milestone.id} title={milestone.title} />
                    <button
                      className={styles.actionBtn}
                      onClick={() => openEditModal(milestone)}
                      title="Edit Milestone"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      onClick={() => {
                        if (confirm(`Delete Milestone "${milestone.title}"?`)) {
                          deleteMilestone(milestone.id);
                        }
                      }}
                      title="Delete Milestone"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className={styles.milestoneTitle}>{milestone.title}</h3>
                  {milestone.description && <p className={styles.milestoneDesc}>{milestone.description}</p>}
                </div>

                {/* ── Progress Section ── */}
                <div className={styles.progressSection}>
                  <div className={styles.progressHeader}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Progress</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{milestone.progress}%</span>
                  </div>

                  <div className={styles.progressBarContainer}>
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${milestone.progress}%` }}
                    />
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    className={styles.sliderInput}
                    value={milestone.progress}
                    onChange={(e) => updateMilestoneProgress(milestone.id, parseInt(e.target.value))}
                    title="Slide to update progress"
                  />
                </div>

                <div className={styles.cardFooter}>
                  <span style={{ color: 'var(--color-text-faint)' }}>Order: #{milestone.sortOrder}</span>

                  {milestone.targetDate && (
                    <span className={styles.targetDate}>
                      <Calendar size={13} /> {milestone.targetDate}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Modal Dialog for Create / Edit ── */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingMilestone ? 'Edit Milestone' : 'New Milestone'}
              </h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="milestone-title">Milestone Title</label>
                <input
                  id="milestone-title"
                  type="text"
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Character Controller & Fluid Jump Physics"
                  required
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="milestone-goal">Parent Goal</label>
                <select
                  id="milestone-goal"
                  className={styles.select}
                  value={goalId}
                  onChange={(e) => setGoalId(e.target.value)}
                  required
                >
                  <option value="">-- Select Parent Goal --</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="milestone-desc">Description (Optional)</label>
                <textarea
                  id="milestone-desc"
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Key deliverables and acceptance criteria..."
                />
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="milestone-target-date">Target Date</label>
                  <input
                    id="milestone-target-date"
                    type="date"
                    className={styles.input}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="milestone-status">Status</label>
                  <select
                    id="milestone-status"
                    className={styles.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed ✓</option>
                    <option value="missed">Missed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Initial Progress ({progress}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  className={styles.sliderInput}
                  value={progress}
                  onChange={(e) => setProgress(parseInt(e.target.value))}
                />
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnCreate}>
                  {editingMilestone ? 'Save Milestone' : 'Create Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
