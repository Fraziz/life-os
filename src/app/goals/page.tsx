'use client';

import React, { useState } from 'react';
import { useGoals } from '@/context/GoalContext';
import { useDreams } from '@/context/DreamContext';
import { useLifeAreas } from '@/context/LifeAreaContext';
import type { Goal, GoalHorizon, GoalPriority, GoalStatus } from '@/types';
import { AreaIcon } from '@/app/areas/page';
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Sparkles,
  CloudSun,
  CheckCircle2,
  X,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';

const HORIZON_LABELS: Record<GoalHorizon, string> = {
  'long-term': 'Long-term',
  'yearly': 'Yearly',
  '90-day': '90-Day',
  'monthly': 'Monthly',
  'custom': 'Custom',
};

const STATUS_LABELS: Record<GoalStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'completed': 'Completed ✓',
  'paused': 'Paused',
  'archived': 'Archived',
};

export default function GoalsPage() {
  const { goals, addGoal, updateGoal, updateGoalProgress, deleteGoal, resetToDefaultGoals, isLoaded } = useGoals();
  const { dreams } = useDreams();
  const { activeAreas } = useLifeAreas();

  const [horizonFilter, setHorizonFilter] = useState<'all' | GoalHorizon>('all');
  const [dreamFilter, setDreamFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [why, setWhy] = useState('');
  const [parentDreamId, setParentDreamId] = useState('');
  const [lifeAreaId, setLifeAreaId] = useState('');
  const [horizon, setHorizon] = useState<GoalHorizon>('90-day');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState<GoalPriority>('medium');
  const [status, setStatus] = useState<GoalStatus>('in-progress');
  const [progress, setProgress] = useState<number>(0);

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading your Goals...
        </p>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingGoal(null);
    setTitle('');
    setDescription('');
    setWhy('');
    setParentDreamId(dreams[0]?.id || '');
    setLifeAreaId(activeAreas[0]?.id || '');
    setHorizon('90-day');
    setTargetDate('');
    setPriority('high');
    setStatus('in-progress');
    setProgress(0);
    setModalOpen(true);
  };

  const openEditModal = (g: Goal) => {
    setEditingGoal(g);
    setTitle(g.title);
    setDescription(g.description || '');
    setWhy(g.why);
    setParentDreamId(g.parentDreamId || '');
    setLifeAreaId(g.lifeAreaId || '');
    setHorizon(g.horizon);
    setTargetDate(g.targetDate || '');
    setPriority(g.priority);
    setStatus(g.status);
    setProgress(g.progress);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !why.trim()) return;

    if (editingGoal) {
      updateGoal(editingGoal.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        why: why.trim(),
        parentDreamId: parentDreamId || undefined,
        lifeAreaId: lifeAreaId || undefined,
        horizon,
        targetDate: targetDate || undefined,
        priority,
        status,
        progress,
      });
    } else {
      addGoal({
        title: title.trim(),
        description: description.trim() || undefined,
        why: why.trim(),
        parentDreamId: parentDreamId || undefined,
        lifeAreaId: lifeAreaId || undefined,
        horizon,
        targetDate: targetDate || undefined,
        priority,
        status,
        progress,
      });
    }
    setModalOpen(false);
  };

  const filteredGoals = goals.filter((g) => {
    if (statusFilter === 'active' && (g.status === 'completed' || g.status === 'archived')) return false;
    if (statusFilter === 'completed' && g.status !== 'completed') return false;
    if (horizonFilter !== 'all' && g.horizon !== horizonFilter) return false;
    if (dreamFilter !== 'all' && g.parentDreamId !== dreamFilter) return false;
    return true;
  });

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Goals & Objectives</h1>
          <p className={styles.subtitle}>
            Concrete milestones on the path to your Dreams. Each goal has a defined horizon, priority, and clear human purpose.
          </p>
        </div>

        <button className={styles.btnCreate} onClick={openCreateModal}>
          <Plus size={18} /> New Goal
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
              Active ({goals.filter((g) => g.status !== 'completed' && g.status !== 'archived').length})
            </button>
            <button
              className={`${styles.tab} ${statusFilter === 'completed' ? styles.activeTab : ''}`}
              onClick={() => setStatusFilter('completed')}
            >
              Completed ({goals.filter((g) => g.status === 'completed').length})
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
            value={horizonFilter}
            onChange={(e) => setHorizonFilter(e.target.value as 'all' | GoalHorizon)}
          >
            <option value="all">All Horizons</option>
            <option value="90-day">90-Day</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="long-term">Long-term</option>
            <option value="custom">Custom</option>
          </select>

          <select
            className={styles.selectFilter}
            value={dreamFilter}
            onChange={(e) => setDreamFilter(e.target.value)}
          >
            <option value="all">All Parent Dreams</option>
            {dreams.map((d) => (
              <option key={d.id} value={d.id}>
                Dream: {d.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Goals Grid ── */}
      {filteredGoals.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed var(--color-border-subtle)',
          }}
        >
          <Target size={40} style={{ color: 'var(--color-text-faint)', marginBottom: 'var(--space-2)' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            No goals found for this filter. Click &quot;New Goal&quot; to define your next milestone!
          </p>
        </div>
      ) : (
        <div className={styles.goalsGrid}>
          {filteredGoals.map((goal) => {
            const parentDream = dreams.find((d) => d.id === goal.parentDreamId);
            const area = activeAreas.find((a) => a.id === goal.lifeAreaId);

            return (
              <article key={goal.id} className={styles.goalCard}>
                {/* ── Hierarchy Banner (Dream -> Goal) ── */}
                {parentDream && (
                  <div className={styles.dreamConnector}>
                    <span className={styles.dreamConnectorLabel}>
                      <CloudSun size={12} /> Dream:
                    </span>
                    <span className={styles.dreamConnectorTitle}>{parentDream.title}</span>
                  </div>
                )}

                <div className={styles.cardTopRow}>
                  <div className={styles.tagsRow}>
                    <span className={styles.horizonBadge}>
                      {HORIZON_LABELS[goal.horizon] || goal.horizon}
                    </span>
                    <span className={`${styles.priorityBadge} ${styles[goal.priority]}`}>
                      {goal.priority}
                    </span>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => openEditModal(goal)}
                      title="Edit Goal"
                    >
                      <Edit2 size={16} />
                    </button>

                    <button
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      onClick={() => {
                        if (confirm(`Delete Goal "${goal.title}"?`)) {
                          deleteGoal(goal.id);
                        }
                      }}
                      title="Delete Goal"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className={styles.goalTitle}>{goal.title}</h3>
                  {goal.description && <p className={styles.goalDesc}>{goal.description}</p>}
                </div>

                <div className={styles.whyBanner}>
                  <span className={styles.whyLabel}>Why it matters</span>
                  <p className={styles.whyText}>&ldquo;{goal.why}&rdquo;</p>
                </div>

                {/* ── Progress Slider ── */}
                <div className={styles.progressSection}>
                  <div className={styles.progressHeader}>
                    <span className={styles.progressLabel}>Progress</span>
                    <span className={styles.progressValue}>{goal.progress}%</span>
                  </div>

                  <div className={styles.progressBarContainer}>
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    className={styles.sliderInput}
                    value={goal.progress}
                    onChange={(e) => updateGoalProgress(goal.id, parseInt(e.target.value))}
                    title="Slide to update progress"
                  />
                </div>

                <div className={styles.cardFooter}>
                  {area ? (
                    <span
                      className={styles.lifeAreaChip}
                      style={{
                        backgroundColor: `${area.color}15`,
                        color: area.color,
                        border: `1px solid ${area.color}40`,
                      }}
                    >
                      <AreaIcon name={area.icon} size={14} /> {area.name}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-text-faint)' }}>General Life</span>
                  )}

                  {goal.targetDate && (
                    <span className={styles.targetDate}>
                      <Calendar size={13} /> {goal.targetDate}
                    </span>
                  )}
                </div>

                <EntityFiles entityType="goal" entityId={goal.id} title={goal.title} />
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
                {editingGoal ? 'Edit Goal' : 'New Goal'}
              </h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="goal-title">Goal Title</label>
                <input
                  id="goal-title"
                  type="text"
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Develop 2D Movement Prototype, Save $10,000"
                  required
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="goal-why">Why (Contribution to Dream)</label>
                <textarea
                  id="goal-why"
                  className={styles.textarea}
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  placeholder="Why does this goal matter? How does it move your Dream forward?"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="goal-desc">Description (Optional)</label>
                <textarea
                  id="goal-desc"
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed breakdown or context..."
                />
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="goal-dream">Parent Dream</label>
                  <select
                    id="goal-dream"
                    className={styles.select}
                    value={parentDreamId}
                    onChange={(e) => setParentDreamId(e.target.value)}
                  >
                    <option value="">-- Standalone Goal (No Dream) --</option>
                    {dreams.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="goal-area">Life Area</label>
                  <select
                    id="goal-area"
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
                  <label className={styles.label} htmlFor="goal-horizon">Time Horizon</label>
                  <select
                    id="goal-horizon"
                    className={styles.select}
                    value={horizon}
                    onChange={(e) => setHorizon(e.target.value as GoalHorizon)}
                  >
                    <option value="90-day">90-Day (Quarterly Focus)</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="long-term">Long-term</option>
                    <option value="custom">Custom Horizon</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="goal-priority">Priority</label>
                  <select
                    id="goal-priority"
                    className={styles.select}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as GoalPriority)}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="goal-target-date">Target Date</label>
                  <input
                    id="goal-target-date"
                    type="date"
                    className={styles.input}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="goal-status">Status</label>
                  <select
                    id="goal-status"
                    className={styles.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as GoalStatus)}
                  >
                    <option value="not-started">Not Started</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed ✓</option>
                    <option value="paused">Paused</option>
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
                  {editingGoal ? 'Save Changes' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
