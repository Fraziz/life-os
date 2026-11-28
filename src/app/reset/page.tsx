'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  RotateCcw,
  Calendar,
  Clock,
  Trash2,
  ArrowRight,
  GitFork,
  CheckSquare,
  X,
  Layers,
  ChevronDown,
  ChevronRight,
  Wand2,
  Play,
} from 'lucide-react';
import { useTasks } from '@/context/TaskContext';
import { useTodayPlan } from '@/context/TodayPlanContext';
import { useProjects } from '@/context/ProjectContext';
import { useInbox } from '@/context/InboxContext';
import { useFocus } from '@/context/FocusContext';
import { useSettings } from '@/context/SettingsContext';
import { useConfirm } from '@/context/ConfirmContext';
import { makeTaskEasierSteps } from '@/utils/makeTaskEasier';
import { playSubtaskTick, playSuccessChime } from '@/utils/soundAndDopamine';
import type { Task, TaskPriority } from '@/types';
import styles from './page.module.css';

export default function ResetPage() {
  const router = useRouter();
  const {
    tasks,
    quickAddTask,
    updateTask,
    toggleTaskDone,
    deleteTask,
    addSubtask,
    breakdownTask,
    isLoaded: tasksLoaded,
  } = useTasks();

  const {
    todayPlan,
    removeFromToday,
    setMainFocus,
    isLoaded: planLoaded,
  } = useTodayPlan();

  const { projects } = useProjects();
  const { quickDump } = useInbox();
  const { selectFocusTask, setTimerMode, startTimer } = useFocus();
  const { settings } = useSettings();
  const { confirm: confirmDialog } = useConfirm();

  // Guided 4-Step Mental Reset State
  const [dumpInput, setDumpInput] = useState('');
  const [capturedThoughts, setCapturedThoughts] = useState<string[]>([]);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [selectedPriorityId, setSelectedPriorityId] = useState<string>('');
  const [newPriorityTitle, setNewPriorityTitle] = useState('');
  const [customTinyStep, setCustomTinyStep] = useState('');
  const [makingEasierBusy, setMakingEasierBusy] = useState(false);
  const [showFullTriage, setShowFullTriage] = useState(false);

  // Full triage modals
  const [breakdownModalTask, setBreakdownModalTask] = useState<Task | null>(null);
  const [breakdownText, setBreakdownText] = useState('');
  const [rescheduleModalTask, setRescheduleModalTask] = useState<Task | null>(null);
  const [customDateInput, setCustomDateInput] = useState('');

  const flashNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 3200);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  const in3DaysStr = new Date(Date.now() + 86_400_000 * 3).toISOString().split('T')[0];
  const nextWeekStr = new Date(Date.now() + 86_400_000 * 7).toISOString().split('T')[0];

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'done'),
    [tasks]
  );

  // Candidate priority tasks (top 5 active)
  const priorityCandidates = useMemo(() => {
    const rank: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    return [...activeTasks]
      .sort((a, b) => {
        const aDo = a.tags?.includes('do-it-now') ? 1 : 0;
        const bDo = b.tags?.includes('do-it-now') ? 1 : 0;
        if (aDo !== bDo) return bDo - aDo;
        return (rank[b.priority] || 2) - (rank[a.priority] || 2);
      })
      .slice(0, 5);
  }, [activeTasks]);

  const effectivePriorityTask = useMemo(() => {
    if (selectedPriorityId) {
      return activeTasks.find((t) => t.id === selectedPriorityId) || null;
    }
    if (todayPlan.mainFocusTaskId) {
      const found = activeTasks.find((t) => t.id === todayPlan.mainFocusTaskId);
      if (found) return found;
    }
    return priorityCandidates[0] || null;
  }, [selectedPriorityId, todayPlan.mainFocusTaskId, activeTasks, priorityCandidates]);

  if (!tasksLoaded || !planLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Preparing your Mental Reset space...
        </p>
      </div>
    );
  }

  // Stream 1: Today's Unfinished Tasks
  const todayUnfinishedTasks = tasks.filter(
    (t) =>
      (todayPlan.selectedTaskIds.includes(t.id) || t.dueDate === todayStr) &&
      t.status !== 'done'
  );

  // Stream 2: Earlier Due Dates (dueDate < today and not completed)
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < todayStr && t.status !== 'done'
  );

  // Stream 3: Upcoming / Backlog
  const upcomingTasks = tasks.filter(
    (t) =>
      t.status !== 'done' &&
      !todayPlan.selectedTaskIds.includes(t.id) &&
      (!t.dueDate || t.dueDate > todayStr)
  );

  const nonessentialTargetsCount = todayUnfinishedTasks.length + overdueTasks.length;

  // Step 1: Capture overwhelming thoughts
  const handleCaptureThought = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = dumpInput.trim();
    if (!clean) return;
    quickDump(clean, { isReminder: false });
    setCapturedThoughts((prev) => [clean, ...prev]);
    setDumpInput('');
    playSubtaskTick();
    flashNotice('Saved to Brain Dump');
  };

  // Step 2: Postpone nonessential responsibilities calmly
  const handlePushAllToTomorrow = () => {
    const keepId = effectivePriorityTask?.id;
    const targets = [...todayUnfinishedTasks, ...overdueTasks].filter((t) => t.id !== keepId);
    if (targets.length === 0) {
      flashNotice('Nothing extra needed rescheduling');
      return;
    }
    targets.forEach((t) => {
      updateTask(t.id, { dueDate: tomorrowStr });
    });
    flashNotice(`Moved ${targets.length} item${targets.length === 1 ? '' : 's'} to Tomorrow`);
  };

  const handleCleanSlateBacklog = async () => {
    const ok = await confirmDialog({
      title: 'Postpone Nonessential Tasks',
      message:
        'Move unfinished tasks off today and park them calmly in your Backlog so you can breathe?',
      confirmLabel: 'Move to Backlog',
      isDestructive: false,
    });
    if (!ok) return;
    const keepId = effectivePriorityTask?.id;
    [...todayUnfinishedTasks, ...overdueTasks]
      .filter((t) => t.id !== keepId)
      .forEach((t) => {
        removeFromToday(t.id);
        updateTask(t.id, { status: 'backlog', dueDate: undefined });
      });
    flashNotice('Nonessential tasks parked in Backlog');
  };

  const handleKeepOnlyMainFocus = () => {
    if (!effectivePriorityTask) {
      flashNotice('Choose a priority in Step 3 first');
      return;
    }
    setMainFocus(effectivePriorityTask.id);
    todayUnfinishedTasks
      .filter((t) => t.id !== effectivePriorityTask.id)
      .forEach((t) => {
        removeFromToday(t.id);
      });
    flashNotice(`Kept only "${effectivePriorityTask.title}" for today`);
  };

  // Step 3: Select or create 1 current priority
  const handleSelectPriority = (task: Task) => {
    setSelectedPriorityId(task.id);
    setMainFocus(task.id);
    const nextTags = Array.from(new Set([...(task.tags || []), 'do-it-now']));
    tasks
      .filter((t) => t.id !== task.id && t.tags?.includes('do-it-now'))
      .forEach((t) =>
        updateTask(t.id, { tags: (t.tags || []).filter((tg) => tg !== 'do-it-now') })
      );
    updateTask(task.id, {
      dueDate: todayStr,
      status: task.status === 'backlog' ? 'todo' : task.status,
      tags: nextTags,
    });
    flashNotice('Priority selected');
  };

  const handleCreatePriority = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPriorityTitle.trim();
    if (!clean) return;
    quickAddTask(clean, {
      priority: 'high',
      status: 'todo',
      dueDate: todayStr,
      tags: ['do-it-now'],
    });
    setNewPriorityTitle('');
    playSuccessChime();
    flashNotice('New priority set for today');
  };

  // Step 4: Choose one small next action
  const handleGenerateTinySteps = async () => {
    if (!effectivePriorityTask || makingEasierBusy) return;
    setMakingEasierBusy(true);
    try {
      const { steps } = await makeTaskEasierSteps(effectivePriorityTask, settings.aiSettings);
      breakdownTask(effectivePriorityTask.id, steps);
      playSubtaskTick();
      flashNotice('Broken into tiny starter steps');
    } finally {
      setMakingEasierBusy(false);
    }
  };

  const handleAddTinyStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectivePriorityTask || !customTinyStep.trim()) return;
    addSubtask(effectivePriorityTask.id, customTinyStep.trim(), 5);
    setCustomTinyStep('');
    playSubtaskTick();
    flashNotice('Small next step added');
  };

  const handleStartGentleFocus = () => {
    if (effectivePriorityTask) {
      selectFocusTask(effectivePriorityTask);
    }
    setTimerMode('pomodoro', 10);
    startTimer();
    router.push('/focus');
  };

  // Per Task Triage Actions
  const handleMoveToLater = (task: Task) => {
    removeFromToday(task.id);
    updateTask(task.id, { status: 'backlog', dueDate: undefined });
  };

  const handleReschedule = (task: Task, date: string) => {
    updateTask(task.id, { dueDate: date });
    setRescheduleModalTask(null);
  };

  const handleBreakdownSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakdownModalTask || !breakdownText.trim()) return;
    const lines = breakdownText.split('\n').filter((l) => l.trim().length > 0);
    breakdownTask(breakdownModalTask.id, lines);
    setBreakdownModalTask(null);
    setBreakdownText('');
  };

  const firstTinyStep =
    effectivePriorityTask?.subtasks?.find((s) => !s.completed) || null;

  return (
    <div className={styles.page}>
      {/* ── Supportive Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Mental Reset</h1>
          <p className={styles.subtitle}>
            Pause for a moment. Empty what feels overwhelming, let go of nonessentials, and choose
            just one small next step.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {statusNotice && (
            <span className={styles.resetSavedPill} role="status">
              {statusNotice}
            </span>
          )}
          <Link href="/" className={styles.btnReturnToday}>
            <span>Back to Today</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* ── Guided 4-Step Calm Reset Flow ── */}
      <div className={styles.guidedStepsGrid}>
        {/* STEP 1: Capture Overwhelming Thoughts */}
        <section className={styles.resetStepCard}>
          <div className={styles.stepEyebrow}>Step 1 · Clear Your Head</div>
          <h2 className={styles.stepTitle}>What is weighing on your mind right now?</h2>
          <p className={styles.stepDesc}>
            Write down racing thoughts, worries, or reminders. They go straight to Brain Dump so
            you don&apos;t have to hold them in memory.
          </p>

          <form onSubmit={handleCaptureThought} className={styles.stepInputRow}>
            <input
              type="text"
              value={dumpInput}
              onChange={(e) => setDumpInput(e.target.value)}
              placeholder="Write a thought and press Enter..."
              className={styles.stepInput}
            />
            <button
              type="submit"
              className={styles.stepPrimaryBtn}
              disabled={!dumpInput.trim()}
            >
              Park Thought
            </button>
          </form>

          {capturedThoughts.length > 0 && (
            <div className={styles.capturedChipsList}>
              {capturedThoughts.map((item, idx) => (
                <span key={`${idx}-${item}`} className={styles.capturedChip}>
                  ✓ {item}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* STEP 2: Postpone Nonessential Responsibilities */}
        <section className={styles.resetStepCard}>
          <div className={styles.stepEyebrow}>Step 2 · Lower the Pressure</div>
          <h2 className={styles.stepTitle}>Postpone nonessential responsibilities</h2>
          <p className={styles.stepDesc}>
            {nonessentialTargetsCount > 0
              ? `You have ${nonessentialTargetsCount} open task${
                  nonessentialTargetsCount === 1 ? '' : 's'
                } scheduled for today or earlier. Give yourself permission to move what can wait.`
              : 'Your schedule has no extra overdue pressure right now.'}
          </p>

          <div className={styles.bulkButtons}>
            <button type="button" className={styles.btnBulk} onClick={handlePushAllToTomorrow}>
              <Calendar size={13} />
              <span>Postpone Extras to Tomorrow</span>
            </button>
            <button type="button" className={styles.btnBulk} onClick={handleKeepOnlyMainFocus}>
              <span>Keep Only 1 Priority</span>
            </button>
            <button
              type="button"
              className={styles.btnBulk}
              onClick={() => void handleCleanSlateBacklog()}
            >
              <RotateCcw size={13} />
              <span>Park Extras in Backlog</span>
            </button>
          </div>
        </section>

        {/* STEP 3: Identify Current Priority */}
        <section className={styles.resetStepCard}>
          <div className={styles.stepEyebrow}>Step 3 · One Priority</div>
          <h2 className={styles.stepTitle}>If you only did one thing next, what matters most?</h2>
          <p className={styles.stepDesc}>
            Pick one realistic priority—or write a fresh, gentle one below.
          </p>

          {priorityCandidates.length > 0 && (
            <div className={styles.priorityChoiceList}>
              {priorityCandidates.map((task) => {
                const isSelected = effectivePriorityTask?.id === task.id;
                return (
                  <button
                    key={task.id}
                    type="button"
                    className={`${styles.priorityChoiceBtn} ${
                      isSelected ? styles.priorityChoiceBtnActive : ''
                    }`}
                    onClick={() => handleSelectPriority(task)}
                  >
                    <span className={styles.priorityRadioDot} />
                    <span className={styles.priorityChoiceText}>{task.title}</span>
                    {isSelected && <span className={styles.priorityActiveTag}>Selected</span>}
                  </button>
                );
              })}
            </div>
          )}

          <form onSubmit={handleCreatePriority} className={styles.stepInputRow}>
            <input
              type="text"
              value={newPriorityTitle}
              onChange={(e) => setNewPriorityTitle(e.target.value)}
              placeholder="Or write a new gentle priority..."
              className={styles.stepInput}
            />
            <button
              type="submit"
              className={styles.btnBulk}
              disabled={!newPriorityTitle.trim()}
            >
              Set Priority
            </button>
          </form>
        </section>

        {/* STEP 4: Choose One Small Next Action */}
        <section className={styles.resetStepCard}>
          <div className={styles.stepEyebrow}>Step 4 · One Tiny Next Action</div>
          <h2 className={styles.stepTitle}>
            {effectivePriorityTask
              ? `Make "${effectivePriorityTask.title}" easy to start`
              : 'Choose one 5-minute action'}
          </h2>
          <p className={styles.stepDesc}>
            Shrink the first step until it feels effortless—like opening a document or doing just 5
            minutes.
          </p>

          {effectivePriorityTask && (
            <>
              {firstTinyStep ? (
                <div className={styles.tinyStepHighlight}>
                  <span className={styles.tinyStepLabel}>First small action:</span>
                  <strong>{firstTinyStep.title}</strong>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    className={styles.btnBulk}
                    disabled={makingEasierBusy}
                    onClick={() => void handleGenerateTinySteps()}
                  >
                    <Wand2 size={13} />
                    <span>
                      {makingEasierBusy
                        ? 'Breaking into small steps…'
                        : 'Make This Easier (Auto-Suggest Steps)'}
                    </span>
                  </button>
                </div>
              )}

              <form onSubmit={handleAddTinyStep} className={styles.stepInputRow}>
                <input
                  type="text"
                  value={customTinyStep}
                  onChange={(e) => setCustomTinyStep(e.target.value)}
                  placeholder="Or write your own 2-minute starter step..."
                  className={styles.stepInput}
                />
                <button
                  type="submit"
                  className={styles.btnBulk}
                  disabled={!customTinyStep.trim()}
                >
                  Add Step
                </button>
              </form>

              <div className={styles.resetFinalActions}>
                <button
                  type="button"
                  className={styles.btnStartGentle}
                  onClick={handleStartGentleFocus}
                >
                  <Play size={14} />
                  <span>Start 10-Min Gentle Focus</span>
                </button>
                <Link href="/" className={styles.btnBulk} style={{ textDecoration: 'none' }}>
                  <span>Return to Today</span>
                </Link>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── Progressive Disclosure: Full Task Triage Board ── */}
      <section className={styles.triageDisclosureSection}>
        <button
          type="button"
          className={styles.triageDisclosureBtn}
          onClick={() => setShowFullTriage((v) => !v)}
          aria-expanded={showFullTriage}
        >
          <span>
            {showFullTriage
              ? 'Hide Detailed Task Triage'
              : `Review Individual Tasks (${activeTasks.length} open)`}
          </span>
          {showFullTriage ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        {showFullTriage && (
          <div className={styles.streamsGrid} style={{ marginTop: 16 }}>
            {/* Stream 1: Today's Unfinished Tasks */}
            <div className={styles.streamColumn}>
              <div className={styles.streamHeader}>
                <span className={styles.streamTitle}>
                  <Clock size={14} /> Today&apos;s Unfinished
                </span>
                <span className={styles.streamCount}>{todayUnfinishedTasks.length}</span>
              </div>

              <div className={styles.triageList}>
                {todayUnfinishedTasks.length === 0 ? (
                  <p className={styles.emptyStreamNote}>No unfinished tasks scheduled for today.</p>
                ) : (
                  todayUnfinishedTasks.map((task) => {
                    const project = projects.find((p) => p.id === task.projectId);
                    return (
                      <article key={task.id} className={styles.triageCard}>
                        <div className={styles.cardTop}>
                          <h3 className={styles.cardTitle}>{task.title}</h3>
                        </div>

                        <div className={styles.metaRow}>
                          {project && <span>• {project.title}</span>}
                          {task.estimatedDuration && <span>• {task.estimatedDuration}m</span>}
                          <select
                            className={styles.prioritySelect}
                            value={task.priority}
                            onChange={(e) =>
                              updateTask(task.id, { priority: e.target.value as TaskPriority })
                            }
                          >
                            <option value="urgent">Urgent</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>

                        <div className={styles.triageActions}>
                          <button
                            className={`${styles.btnAction} ${styles.completeBtn}`}
                            onClick={() => toggleTaskDone(task.id)}
                          >
                            <CheckSquare size={12} /> Done
                          </button>

                          <button
                            className={styles.btnAction}
                            onClick={() => setRescheduleModalTask(task)}
                          >
                            <Calendar size={12} /> Reschedule
                          </button>

                          <button
                            className={styles.btnAction}
                            onClick={() => handleMoveToLater(task)}
                          >
                            <Clock size={12} /> Later
                          </button>

                          <button
                            className={styles.btnAction}
                            onClick={() => {
                              setBreakdownModalTask(task);
                              setBreakdownText('');
                            }}
                          >
                            <GitFork size={12} /> Break Down
                          </button>

                          <button
                            className={`${styles.btnAction} ${styles.deleteBtn}`}
                            onClick={async () => {
                              if (
                                await confirmDialog({
                                  title: 'Delete Task',
                                  message: `Delete "${task.title}"?`,
                                  confirmLabel: 'Delete Task',
                                })
                              ) {
                                deleteTask(task.id);
                                removeFromToday(task.id);
                              }
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>

            {/* Stream 2: Earlier Due Dates (Calm, non-punitive framing) */}
            <div className={styles.streamColumn}>
              <div className={styles.streamHeader}>
                <span className={styles.streamTitle}>
                  <Calendar size={14} /> From Earlier Days
                </span>
                <span className={styles.streamCount}>{overdueTasks.length}</span>
              </div>

              <div className={styles.triageList}>
                {overdueTasks.length === 0 ? (
                  <p className={styles.emptyStreamNote}>No tasks waiting from earlier days.</p>
                ) : (
                  overdueTasks.map((task) => {
                    const project = projects.find((p) => p.id === task.projectId);
                    return (
                      <article key={task.id} className={styles.triageCard}>
                        <div className={styles.cardTop}>
                          <h3 className={styles.cardTitle}>{task.title}</h3>
                        </div>

                        <div className={styles.metaRow}>
                          <span className={styles.calmPastBadge}>Scheduled {task.dueDate}</span>
                          {project && <span>• {project.title}</span>}
                        </div>

                        <div className={styles.triageActions}>
                          <button
                            className={`${styles.btnAction} ${styles.completeBtn}`}
                            onClick={() => toggleTaskDone(task.id)}
                          >
                            <CheckSquare size={12} /> Done
                          </button>

                          <button
                            className={styles.btnAction}
                            onClick={() => handleReschedule(task, tomorrowStr)}
                          >
                            Tomorrow
                          </button>

                          <button
                            className={styles.btnAction}
                            onClick={() => setRescheduleModalTask(task)}
                          >
                            <Calendar size={12} /> Pick Date
                          </button>

                          <button
                            className={styles.btnAction}
                            onClick={() => handleMoveToLater(task)}
                          >
                            Backlog
                          </button>

                          <button
                            className={`${styles.btnAction} ${styles.deleteBtn}`}
                            onClick={async () => {
                              if (
                                await confirmDialog({
                                  title: 'Delete Task',
                                  message: `Delete "${task.title}"?`,
                                  confirmLabel: 'Delete Task',
                                })
                              ) {
                                deleteTask(task.id);
                              }
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>

            {/* Stream 3: Upcoming & Backlog */}
            <div className={styles.streamColumn}>
              <div className={styles.streamHeader}>
                <span className={styles.streamTitle}>
                  <Layers size={14} /> Upcoming &amp; Backlog
                </span>
                <span className={styles.streamCount}>{upcomingTasks.length}</span>
              </div>

              <div className={styles.triageList}>
                {upcomingTasks.length === 0 ? (
                  <p className={styles.emptyStreamNote}>No additional upcoming tasks.</p>
                ) : (
                  upcomingTasks.slice(0, 8).map((task) => {
                    const project = projects.find((p) => p.id === task.projectId);
                    return (
                      <article key={task.id} className={styles.triageCard}>
                        <div className={styles.cardTop}>
                          <h3 className={styles.cardTitle}>{task.title}</h3>
                        </div>

                        <div className={styles.metaRow}>
                          {task.dueDate && <span>Scheduled {task.dueDate}</span>}
                          {project && <span>• {project.title}</span>}
                        </div>

                        <div className={styles.triageActions}>
                          <button
                            className={styles.btnAction}
                            onClick={() => updateTask(task.id, { dueDate: todayStr })}
                          >
                            Bring to Today
                          </button>
                          <button
                            className={styles.btnAction}
                            onClick={() => setRescheduleModalTask(task)}
                          >
                            <Calendar size={12} /> Reschedule
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Modal: Reschedule Task ── */}
      {rescheduleModalTask && (
        <div className={styles.modalOverlay} onClick={() => setRescheduleModalTask(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  margin: 0,
                }}
              >
                Reschedule: &ldquo;{rescheduleModalTask.title}&rdquo;
              </h3>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-faint)',
                  cursor: 'pointer',
                }}
                onClick={() => setRescheduleModalTask(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <button
                className={styles.btnAction}
                style={{ padding: 'var(--space-3)' }}
                onClick={() => handleReschedule(rescheduleModalTask, todayStr)}
              >
                Today ({todayStr})
              </button>
              <button
                className={styles.btnAction}
                style={{ padding: 'var(--space-3)' }}
                onClick={() => handleReschedule(rescheduleModalTask, tomorrowStr)}
              >
                Tomorrow ({tomorrowStr})
              </button>
              <button
                className={styles.btnAction}
                style={{ padding: 'var(--space-3)' }}
                onClick={() => handleReschedule(rescheduleModalTask, in3DaysStr)}
              >
                In 3 Days ({in3DaysStr})
              </button>
              <button
                className={styles.btnAction}
                style={{ padding: 'var(--space-3)' }}
                onClick={() => handleReschedule(rescheduleModalTask, nextWeekStr)}
              >
                Next Week ({nextWeekStr})
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: 'var(--space-2)',
              }}
            >
              <input
                type="date"
                value={customDateInput}
                onChange={(e) => setCustomDateInput(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 10px',
                  color: 'var(--color-text)',
                  fontSize: 'var(--text-xs)',
                  outline: 'none',
                }}
              />
              <button
                className={styles.btnAction}
                onClick={() => {
                  if (customDateInput) {
                    handleReschedule(rescheduleModalTask, customDateInput);
                  }
                }}
              >
                Set Date
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Task Breakdown ── */}
      {breakdownModalTask && (
        <div className={styles.modalOverlay} onClick={() => setBreakdownModalTask(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  margin: 0,
                }}
              >
                Break Into Small Steps
              </h3>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-faint)',
                  cursor: 'pointer',
                }}
                onClick={() => setBreakdownModalTask(null)}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
              Decompose &ldquo;{breakdownModalTask.title}&rdquo; into small, easy steps (one per
              line):
            </p>

            <form
              onSubmit={handleBreakdownSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
            >
              <textarea
                value={breakdownText}
                onChange={(e) => setBreakdownText(e.target.value)}
                placeholder={`Open file\nWrite 3 bullets\nReview once`}
                style={{
                  width: '100%',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--text-xs)',
                  minHeight: '120px',
                  outline: 'none',
                }}
                autoFocus
                required
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className={styles.btnAction}
                  onClick={() => setBreakdownModalTask(null)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.stepPrimaryBtn}>
                  Save Steps
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
