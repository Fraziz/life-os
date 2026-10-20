'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGoals } from '@/context/GoalContext';
import { useDreams } from '@/context/DreamContext';
import { useProjects } from '@/context/ProjectContext';
import { useLifeAreas } from '@/context/LifeAreaContext';
import { useTasks } from '@/context/TaskContext';
import { useSettings } from '@/context/SettingsContext';
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
  Bot,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Folder,
  CheckSquare,
  Zap,
} from 'lucide-react';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';
import PageSkeleton from '@/components/ui/PageSkeleton';
import AdhdHierarchyModal from '@/components/guidance/AdhdHierarchyModal';
import AutoLinkText from '@/components/ui/AutoLinkText';
import { playSuccessChime } from '@/utils/soundAndDopamine';
import { coachGoalWithAI } from '@/utils/aiEngine';
import type { GoalCoachResult } from '@/utils/aiEngine';

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
  const { projects, addProject } = useProjects();
  const { activeAreas, focusedAreaId, setFocusedAreaId } = useLifeAreas();
  const { tasks, addTask } = useTasks();
  const { settings } = useSettings();

  // ADHD Guidance & 1-Click Bridges
  const [adhdGuideOpen, setAdhdGuideOpen] = useState(false);
  const [quickBridge, setQuickBridge] = useState<{
    type: 'project' | 'task';
    goal: Goal;
  } | null>(null);
  const [bridgeTitle, setBridgeTitle] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const openBridge = (type: 'project' | 'task', goal: Goal) => {
    setQuickBridge({ type, goal });
    if (type === 'project') {
      setBridgeTitle(`Project: ${goal.title}`);
    } else {
      setBridgeTitle(`15m step: ${goal.title}`);
    }
  };

  const handleBridgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBridge || !bridgeTitle.trim()) return;

    if (quickBridge.type === 'project') {
      addProject({
        title: bridgeTitle.trim(),
        description: `Project executing goal: ${quickBridge.goal.title}`,
        status: 'active',
        priority: 'high',
        progress: 0,
        goalId: quickBridge.goal.id,
      });
      playSuccessChime();
      showToast(`Project created & linked to "${quickBridge.goal.title}"!`);
    } else {
      addTask({
        title: bridgeTitle.trim(),
        description: `15-minute action step for goal: ${quickBridge.goal.title}`,
        status: 'todo',
        priority: 'high',
        estimatedDuration: 25,
        goalId: quickBridge.goal.id,
        tags: ['goal-action'],
        subtasks: [],
      });
      playSuccessChime();
      showToast(`Task added to your Tasks To Do!`);
    }
    setQuickBridge(null);
  };

  // AI Coach state: { [goalId]: { loading, result, open } }
  const [coachState, setCoachState] = useState<Record<string, { loading: boolean; result: GoalCoachResult | null; open: boolean }>>({});

  const handleCoachGoal = async (goal: Goal) => {
    const id = goal.id;
    setCoachState(prev => ({ ...prev, [id]: { loading: true, result: null, open: true } }));
    const relatedTasks = tasks.filter(t => t.goalId === id);
    const result = await coachGoalWithAI(goal, relatedTasks, settings.aiSettings);
    setCoachState(prev => ({ ...prev, [id]: { loading: false, result, open: true } }));
  };

  const toggleCoach = (goalId: string) => {
    setCoachState(prev => {
      const cur = prev[goalId];
      if (!cur) return prev;
      return { ...prev, [goalId]: { ...cur, open: !cur.open } };
    });
  };

  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');

  useEffect(() => {
    if (highlightId) {
      const el = document.getElementById(`goal-card-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightId, isLoaded]);

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


  const openCreateModal = () => {
    setEditingGoal(null);
    setTitle('');
    setDescription('');
    setWhy('');
    setParentDreamId(dreams[0]?.id || '');
    setLifeAreaId(activeAreas[0]?.id || '');
    setHorizon('90-day');
    setTargetDate(new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]);
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

  if (!isLoaded) {
    return <PageSkeleton variant="cards" cardsCount={4} showMetrics={true} showControls={true} />;
  }

  const filteredGoals = goals.filter((g) => {
    if (focusedAreaId && g.lifeAreaId !== focusedAreaId) return false;
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
            <Plus size={18} /> New Goal
          </button>
        </div>
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
            value={focusedAreaId || 'all'}
            onChange={(e) => setFocusedAreaId(e.target.value === 'all' ? null : e.target.value)}
            title="Filter by Life Area"
          >
            <option value="all">All Life Areas</option>
            {activeAreas.map((a) => (
              <option key={a.id} value={a.id}>
                Area: {a.name}
              </option>
            ))}
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
            border: '1px solid var(--color-border-subtle)',
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
            const isHighlighted = highlightId === goal.id;
            const linkedProjects = projects.filter((p) => p.goalId === goal.id);
            const directTasks = tasks.filter((t) => t.goalId === goal.id && !t.projectId);
            const isAutomated = linkedProjects.length > 0 || directTasks.length > 0;
            const completedProjects = linkedProjects.filter((p) => p.status === 'completed' || p.progress === 100);
            const doneTasks = directTasks.filter((t) => t.status === 'done');

            return (
              <article
                key={goal.id}
                id={`goal-card-${goal.id}`}
                className={styles.goalCard}
                style={{
                  transition: 'all 0.2s ease',
                  boxShadow: isHighlighted ? '0 0 0 2px var(--color-accent)' : undefined,
                  borderColor: isHighlighted ? 'var(--color-accent)' : undefined,
                }}
              >
                {/* ── Hierarchy Eyebrow (Dream -> Goal) ── */}
                {parentDream && (
                  <div className={styles.dreamEyebrow} title={`Dream: ${parentDream.title}`}>
                    <CloudSun size={12} className={styles.dreamIcon} />
                    <span className={styles.dreamEyebrowText}>{parentDream.title}</span>
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
                    <EntityFiles
                      variant="icon"
                      entityType="goal"
                      entityId={goal.id}
                      title={goal.title}
                      className={styles.fileActionBtn}
                    />
                    <button
                      className={styles.actionBtn}
                      onClick={() => openEditModal(goal)}
                      title="Edit Goal"
                    >
                      <Edit2 size={13} />
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
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className={styles.goalMain}>
                  <h3 className={styles.goalTitle}><AutoLinkText text={goal.title} /></h3>
                  {goal.description && <p className={styles.goalDesc}><AutoLinkText text={goal.description} /></p>}
                  {goal.why && (
                    <p className={styles.goalWhy} title="Why it matters">
                      &ldquo;<AutoLinkText text={goal.why} />&rdquo;
                    </p>
                  )}
                </div>

                {/* ── Single Interactive Progress Slider ── */}
                <div className={styles.progressSection}>
                  <div className={styles.progressHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={styles.progressLabel}>Progress</span>
                      {isAutomated && (
                        <span
                          className={styles.autoBadge}
                          title={`Auto-synced: ${completedProjects.length}/${linkedProjects.length} projects completed${
                            directTasks.length > 0 ? `, ${doneTasks.length}/${directTasks.length} direct tasks done` : ''
                          }`}
                        >
                          Auto ({completedProjects.length}/${linkedProjects.length} projs
                          {directTasks.length > 0 ? `, ${doneTasks.length}/${directTasks.length} tasks` : ''})
                        </span>
                      )}
                    </div>
                    <span className={styles.progressValue}>{goal.progress}%</span>
                  </div>
                  <div className={styles.sliderWrap}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      disabled={isAutomated}
                      className={styles.progressSlider}
                      style={{
                        background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${goal.progress}%, var(--color-surface-2) ${goal.progress}%, var(--color-surface-2) 100%)`,
                        cursor: isAutomated ? 'not-allowed' : 'pointer',
                        opacity: isAutomated ? 0.75 : 1,
                      }}
                      value={goal.progress}
                      onChange={(e) => updateGoalProgress(goal.id, parseInt(e.target.value))}
                      title={
                        isAutomated
                          ? `Auto-calculated from connected projects and tasks. Complete child items to advance this goal.`
                          : 'Slide to update progress'
                      }
                    />
                  </div>
                </div>

                {/* ── AI Coach Panel (if active) ── */}
                {coachState[goal.id]?.loading && (
                  <div className={styles.coachLoading}>
                    <Loader2 size={13} className={styles.spinner} />
                    <span>Analyzing your goal...</span>
                  </div>
                )}

                {coachState[goal.id]?.result && coachState[goal.id]?.open && (() => {
                  const r = coachState[goal.id].result!;
                  const statusColor = r.status === 'ahead' ? 'var(--color-success)' : r.status === 'behind' || r.status === 'stalled' ? '#ef4444' : 'var(--color-accent)';
                  const StatusIcon = r.status === 'ahead' ? TrendingUp : r.status === 'stalled' || r.status === 'behind' ? AlertTriangle : CheckCircle;
                  return (
                    <div className={styles.coachPanel}>
                      <div className={styles.coachPanelHeader}>
                        <div className={styles.coachStatus} style={{ color: statusColor }}>
                          <StatusIcon size={13} />
                          <strong style={{ textTransform: 'capitalize' }}>{r.status.replace('-', ' ')}</strong>
                        </div>
                        <span className={styles.coachAssessment}>{r.assessment}</span>
                      </div>
                      <div className={styles.coachSteps}>
                        <div className={styles.coachStepsTitle}>Next Steps</div>
                        {r.nextSteps.map((step, i) => (
                          <div key={i} className={styles.coachStepItem}>• {step}</div>
                        ))}
                      </div>
                      {r.motivation && (
                        <div className={styles.coachMotivation}>
                          &ldquo;{r.motivation}&rdquo;
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Consolidated Card Footer ── */}
                <div className={styles.cardFooter}>
                  <div className={styles.footerLeft}>
                    {area ? (
                      <span
                        className={styles.lifeAreaChip}
                        style={{
                          backgroundColor: `${area.color}15`,
                          color: area.color,
                          border: `1px solid ${area.color}35`,
                        }}
                      >
                        <AreaIcon name={area.icon} size={12} />
                        <span>{area.name}</span>
                      </span>
                    ) : (
                      <span className={styles.lifeAreaChipGeneral}>General Life</span>
                    )}

                    {goal.targetDate ? (
                      <span className={styles.targetDate} title={`Target: ${goal.targetDate}`}>
                        <Calendar size={12} />
                        <span>{goal.targetDate}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.targetDateBtn}
                        onClick={() => openEditModal(goal)}
                        title="Set Target Date"
                        aria-label="Set Target Date"
                      >
                        <Calendar size={12} />
                      </button>
                    )}
                  </div>

                  <div
                    className={`${styles.footerRight} ${
                      coachState[goal.id]?.open ? styles.footerRightActive : ''
                    }`}
                  >
                    <button
                      type="button"
                      className={styles.bridgeBtn}
                      onClick={() => openBridge('project', goal)}
                      title="Create a Project for this Goal"
                    >
                      <Folder size={11} />
                      <span>+ Project</span>
                    </button>
                    <button
                      type="button"
                      className={styles.bridgeBtn}
                      onClick={() => openBridge('task', goal)}
                      title="Create a 15-minute action step for this Goal"
                    >
                      <CheckSquare size={11} />
                      <span>+ Task</span>
                    </button>

                    {coachState[goal.id]?.result ? (
                      <button
                        type="button"
                        className={styles.coachToggleBtn}
                        onClick={() => toggleCoach(goal.id)}
                        title={coachState[goal.id]?.open ? 'Hide Coach' : 'Show Coach'}
                      >
                        <Bot size={11} />
                        {coachState[goal.id]?.open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.coachTriggerBtn}
                        onClick={() => handleCoachGoal(goal)}
                        disabled={coachState[goal.id]?.loading}
                        id={`coach-goal-btn-${goal.id}`}
                        title="AI Coach this Goal"
                      >
                        <Bot size={11} />
                        <span>Coach</span>
                      </button>
                    )}
                  </div>
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
                    background: quickBridge.type === 'project' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: quickBridge.type === 'project' ? '#38bdf8' : '#34d399',
                    border: `1px solid ${quickBridge.type === 'project' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                  }}
                >
                  {quickBridge.type === 'project' ? 'Goal → Project' : 'Goal → Task'}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setQuickBridge(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Connected to Goal: <strong style={{ color: 'var(--color-text)' }}>{quickBridge.goal.title}</strong>
            </div>

            <form onSubmit={handleBridgeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  {quickBridge.type === 'project' ? 'Project Name (Folder of Steps)' : '15-Minute Action Task'}
                </label>
                <input
                  type="text"
                  className={styles.input}
                  value={bridgeTitle}
                  onChange={(e) => setBridgeTitle(e.target.value)}
                  placeholder={quickBridge.type === 'project' ? 'e.g. Website rebuild sprint 1' : 'e.g. Spend 15 mins drafting outline'}
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
                  {quickBridge.type === 'project'
                    ? 'Creates an active project folder linked to this goal.'
                    : 'Creates an immediate 25-minute task linked to this goal.'}
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
                    background: quickBridge.type === 'project' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'linear-gradient(135deg, #10b981, #059669)',
                  }}
                >
                  {quickBridge.type === 'project' ? 'Create Project' : 'Add Task'}
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
    </div>
  );
}
