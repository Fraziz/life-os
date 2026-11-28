'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useReview } from '@/context/ReviewContext';
import { useTasks } from '@/context/TaskContext';
import { useFocus } from '@/context/FocusContext';
import { useHabits } from '@/context/HabitContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useInbox } from '@/context/InboxContext';
import { useSettings } from '@/context/SettingsContext';
import { draftWeeklyReviewWithAI } from '@/utils/aiEngine';
import { triggerDopamineBurst, playSuccessChime } from '@/utils/soundAndDopamine';
import PageSkeleton from '@/components/ui/PageSkeleton';
import styles from './page.module.css';

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatShortDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function WeeklyReviewPage() {
  const { reviews, saveWeeklyReview, deleteWeeklyReview, isLoaded: reviewLoaded } = useReview();
  const { tasks, updateTask, deleteTask, isLoaded: tasksLoaded } = useTasks();
  const { focusHistory, isLoaded: focusLoaded } = useFocus();
  const { habits, getWeeklyCompletionsCount, isLoaded: habitsLoaded } = useHabits();
  const { activeProjects, isLoaded: projectsLoaded } = useProjects();
  const { activeGoals, isLoaded: goalsLoaded } = useGoals();
  const { activeItems: inboxItems, deleteInboxItem, quickDump, isLoaded: inboxLoaded } = useInbox();
  const { settings } = useSettings();

  const [activeTab, setActiveTab] = useState<'guided' | 'archive'>('guided');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [step1VisitedDone, setStep1VisitedDone] = useState(false);
  const [step2VisitedDone, setStep2VisitedDone] = useState(false);
  const [showAllOpenTasks, setShowAllOpenTasks] = useState(false);

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [nextWeekFocusNote, setNextWeekFocusNote] = useState('');
  const [reflectionWentWell, setReflectionWentWell] = useState('');
  const [reflectionFriction, setReflectionFriction] = useState('');
  const [reflectionShouldChange, setReflectionShouldChange] = useState('');

  const [aiDrafting, setAiDrafting] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Week Window (Monday → Sunday in local calendar time) ─────────────────
  const { weekStartStr, weekEndStr, todayStr } = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      weekStartStr: toLocalDateKey(start),
      weekEndStr: toLocalDateKey(end),
      todayStr: toLocalDateKey(now),
    };
  }, []);

  const isCurrentWeekReviewed = useMemo(
    () => reviews.some((r) => r.weekStartDate === weekStartStr),
    [reviews, weekStartStr]
  );

  // ── Weekly Aggregations ──────────────────────────────────────────────────
  const completedTasksThisWeek = useMemo(() => {
    return tasks
      .filter((t) => {
        if (t.status !== 'done') return false;
        const comp = t.completedAt || t.updatedAt;
        return !comp || comp.slice(0, 10) >= weekStartStr;
      })
      .sort((a, b) => (b.completedAt || b.updatedAt || '').localeCompare(a.completedAt || a.updatedAt || ''));
  }, [tasks, weekStartStr]);

  const focusSessionsThisWeek = useMemo(() => {
    return focusHistory.filter((s) => s.completedAt && s.completedAt.slice(0, 10) >= weekStartStr);
  }, [focusHistory, weekStartStr]);

  const focusMinutesThisWeek = useMemo(() => {
    return focusSessionsThisWeek.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  }, [focusSessionsThisWeek]);

  const habitStats = useMemo(() => {
    if (habits.length === 0) {
      return { hasHabits: false, pct: 0, actual: 0, expected: 0 };
    }
    let expected = 0;
    let actual = 0;
    habits.forEach((h) => {
      expected += h.targetCount || 1;
      actual += getWeeklyCompletionsCount(h.id);
    });
    const pct = expected > 0 ? Math.min(100, Math.round((actual / expected) * 100)) : 0;
    return { hasHabits: true, pct, actual, expected };
  }, [habits, getWeeklyCompletionsCount]);

  const openTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'));
  }, [tasks]);

  const displayedOpenTasks = showAllOpenTasks ? openTasks : openTasks.slice(0, 8);

  const avgProjectProgress = useMemo(() => {
    if (activeProjects.length === 0) return 0;
    const sum = activeProjects.reduce((acc, p) => acc + (p.progress || 0), 0);
    return Math.round(sum / activeProjects.length);
  }, [activeProjects]);

  const totalWeeklyTasks = completedTasksThisWeek.length + openTasks.length;
  const completionPct =
    totalWeeklyTasks > 0
      ? Math.round((completedTasksThisWeek.length / totalWeeklyTasks) * 100)
      : 0;

  const formatFocusTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const notify = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleStep1Celebrate = (e: React.MouseEvent) => {
    playSuccessChime();
    triggerDopamineBurst(e.clientX, e.clientY);
    setStep1VisitedDone(true);
    setCurrentStep(2);
  };

  const handleStep2Continue = () => {
    setStep2VisitedDone(true);
    setCurrentStep(3);
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds((prev) => {
      if (prev.includes(projectId)) {
        return prev.filter((id) => id !== projectId);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), projectId];
      }
      return [...prev, projectId];
    });
  };

  const handlePushTaskToNextWeek = (taskId: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    updateTask(taskId, { dueDate: toLocalDateKey(d) });
    notify('Task rescheduled +7 days.');
  };

  const handleDemoteTaskToInbox = (task: { id: string; title: string }) => {
    quickDump(task.title, { isReminder: false });
    deleteTask(task.id);
    notify(`"${task.title}" moved to Idea Parking.`);
  };

  const handleArchiveTaskWithoutGuilt = (taskId: string) => {
    deleteTask(taskId);
    notify('Task cleared without guilt.');
  };

  const handleClearInboxItem = (itemId: string) => {
    deleteInboxItem(itemId);
    notify('Captured item resolved.');
  };

  const handleAiDraft = async () => {
    setAiDrafting(true);
    try {
      const topGoal = activeGoals[0]?.title;
      const draft = await draftWeeklyReviewWithAI(
        {
          completedTaskCount: completedTasksThisWeek.length,
          completedTaskTitles: completedTasksThisWeek.map((t) => t.title),
          focusMinutes: focusMinutesThisWeek,
          habitStreak: habitStats.actual,
          activeGoalCount: activeGoals.length,
          topGoalTitle: topGoal,
        },
        settings.aiSettings
      );
      if (draft.nextWeekFocus) setNextWeekFocusNote(draft.nextWeekFocus);
      if (draft.wentWell) setReflectionWentWell(draft.wentWell);
      if (draft.didNotGoWell) setReflectionFriction(draft.didNotGoWell);
      if (draft.shouldChange) setReflectionShouldChange(draft.shouldChange);
      notify('Generated reflection draft from this week’s metrics.');
    } finally {
      setAiDrafting(false);
    }
  };

  const handleFinalizeReview = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenProjects = activeProjects.filter((p) => selectedProjectIds.includes(p.id));
    const projectTitles = chosenProjects.map((p) => p.title).join(', ');

    saveWeeklyReview({
      weekStartDate: weekStartStr,
      weekEndDate: weekEndStr,
      completedTaskCount: completedTasksThisWeek.length,
      openTaskCount: openTasks.length,
      focusMinutesLogged: focusMinutesThisWeek,
      goalsProgressedCount: chosenProjects.length,
      projectsProgressedCount: chosenProjects.length,
      habitsConsistencyRate: habitStats.hasHabits ? habitStats.pct : 0,
      importantWins: completedTasksThisWeek.slice(0, 5).map((t) => t.title),
      wentWell:
        reflectionWentWell.trim() ||
        'Consistent execution maintained across scheduled focus sessions.',
      didNotGoWell:
        reflectionFriction.trim() || 'Commitments streamlined to prevent cognitive overload.',
      shouldChange:
        reflectionShouldChange.trim() ||
        'Protect primary deep focus blocks from non-essential interruptions.',
      nextWeekFocus:
        nextWeekFocusNote.trim() ||
        (projectTitles ? `Priority projects: ${projectTitles}` : 'Advance primary quarterly objectives.'),
    });

    playSuccessChime();
    triggerDopamineBurst();
    setStatusNotice('Weekly review archived cleanly.');
    setCurrentStep(1);
    setStep1VisitedDone(false);
    setStep2VisitedDone(false);
    setSelectedProjectIds([]);
    setNextWeekFocusNote('');
    setReflectionWentWell('');
    setReflectionFriction('');
    setReflectionShouldChange('');
    setActiveTab('archive');
  };

  const isDataReady =
    reviewLoaded &&
    tasksLoaded &&
    focusLoaded &&
    habitsLoaded &&
    projectsLoaded &&
    goalsLoaded &&
    inboxLoaded;

  if (!isDataReady) {
    return <PageSkeleton variant="default" cardsCount={4} showMetrics={true} showControls={false} />;
  }

  return (
    <div className={styles.page}>
      {/* ── Executive Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.kicker}>
            <span
              className={`${styles.statusDot} ${
                isCurrentWeekReviewed ? styles.statusDotOk : styles.statusDotActive
              }`}
              aria-hidden="true"
            />
            <span>
              Weekly Cadence · {formatShortDateLabel(weekStartStr)} – {formatShortDateLabel(weekEndStr)}
            </span>
          </div>
          <h1 className={styles.title}>Weekly Review &amp; Alignment</h1>
          <p className={styles.subtitle}>
            Close open loops, acknowledge concrete progress, and lock in up to three priorities for next week.
          </p>
        </div>

        <div className={styles.tabSwitch} role="tablist" aria-label="Review sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'guided'}
            className={`${styles.tabBtn} ${activeTab === 'guided' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('guided')}
          >
            Guided Review
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'archive'}
            className={`${styles.tabBtn} ${activeTab === 'archive' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('archive')}
          >
            Review Archive ({reviews.length})
          </button>
        </div>
      </header>

      {statusNotice && (
        <div className={styles.confirmationBanner} role="status">
          <CheckCircle2 size={15} />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* ── Weekly KPI Strip with Micro-Meters ── */}
      <section className={styles.summaryGrid} aria-label="Current week telemetry">
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Completed Tasks</span>
          <span className={styles.summaryValue}>{completedTasksThisWeek.length}</span>
          <div className={styles.miniMeterTrack} aria-hidden="true">
            <div className={styles.miniMeterFill} style={{ width: `${completionPct}%` }} />
          </div>
          <span className={styles.summaryDetail}>
            {totalWeeklyTasks > 0
              ? `${completedTasksThisWeek.length} of ${totalWeeklyTasks} active resolved`
              : 'No tasks logged this week yet'}
          </span>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Deep Focus Logged</span>
          <span className={styles.summaryValue}>{formatFocusTime(focusMinutesThisWeek)}</span>
          <div className={styles.miniMeterTrack} aria-hidden="true">
            <div
              className={styles.miniMeterFill}
              style={{ width: `${Math.min(100, Math.round((focusMinutesThisWeek / 300) * 100))}%` }}
            />
          </div>
          <span className={styles.summaryDetail}>
            {focusSessionsThisWeek.length} focus session{focusSessionsThisWeek.length === 1 ? '' : 's'} this week
          </span>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Habit Consistency</span>
          <span className={styles.summaryValue}>
            {habitStats.hasHabits ? `${habitStats.pct}%` : '—'}
          </span>
          <div className={styles.miniMeterTrack} aria-hidden="true">
            <div
              className={styles.miniMeterFill}
              style={{ width: `${habitStats.hasHabits ? habitStats.pct : 0}%` }}
            />
          </div>
          <span className={styles.summaryDetail}>
            {habitStats.hasHabits
              ? `${habitStats.actual} / ${habitStats.expected} routine check-ins`
              : 'Configure routines in Daily Routine'}
          </span>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Active Initiatives</span>
          <span className={styles.summaryValue}>{activeProjects.length}</span>
          <div className={styles.miniMeterTrack} aria-hidden="true">
            <div className={styles.miniMeterFill} style={{ width: `${avgProjectProgress}%` }} />
          </div>
          <span className={styles.summaryDetail}>
            {activeProjects.length > 0
              ? `${avgProjectProgress}% average project completion`
              : 'No active projects yet'}
          </span>
        </div>
      </section>

      {activeTab === 'guided' ? (
        <>
          {/* ── Unified Segmented Step Rail ── */}
          <nav className={styles.stepperTrack} aria-label="Weekly review steps">
            {(
              [
                { id: 1, num: '01', title: 'Celebrate Wins', done: step1VisitedDone },
                { id: 2, num: '02', title: 'Clear & Realign', done: step2VisitedDone },
                { id: 3, num: '03', title: 'Top 3 Priorities', done: isCurrentWeekReviewed },
              ] as const
            ).map((step) => {
              const isActive = currentStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`${styles.stepButton} ${isActive ? styles.stepButtonActive : ''}`}
                  onClick={() => setCurrentStep(step.id)}
                >
                  <span className={styles.stepNumBadge}>
                    {step.done && !isActive ? <Check size={12} /> : step.num}
                  </span>
                  <span className={styles.stepTitle}>{step.title}</span>
                </button>
              );
            })}
          </nav>

          {/* ── Two-Column Balanced Workspace ── */}
          <div className={styles.workspaceGrid}>
            <div className={styles.mainStage}>
              {/* ── Step 1: Celebrate Wins ── */}
              {currentStep === 1 && (
                <section className={styles.stepContainer}>
                  <div className={styles.stepHeader}>
                    <h2 className={styles.stepHeading}>Step 1: Celebrate Completed Actions</h2>
                    <p className={styles.stepDescription}>
                      Review everything resolved between {formatShortDateLabel(weekStartStr)} and{' '}
                      {formatShortDateLabel(weekEndStr)} to lock in progress before planning next week.
                    </p>
                  </div>

                  {completedTasksThisWeek.length === 0 ? (
                    <div className={styles.calmEmptyCard}>
                      <div className={styles.emptyIconCircle} aria-hidden="true">
                        <CheckCircle2 size={20} />
                      </div>
                      <h3 className={styles.emptyTitle}>No completed tasks recorded this week</h3>
                      <p className={styles.emptySubtext}>
                        Tasks completed from Today or the Task Board automatically surface here as your weekly record. You can jump in to finish one or proceed to clean up open work.
                      </p>
                      <div className={styles.emptyActions}>
                        <Link href="/" className={styles.secondaryLink}>
                          Open Today
                        </Link>
                        <Link href="/tasks" className={styles.secondaryLink}>
                          View Task Board
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.winsFeed}>
                      {completedTasksThisWeek.map((t) => (
                        <div key={t.id} className={styles.winRow}>
                          <div className={styles.winLeft}>
                            <span className={styles.winCheckIcon} aria-hidden="true">
                              <CheckCircle2 size={15} />
                            </span>
                            <div className={styles.winMain}>
                              <span className={styles.winTitle}>{t.title}</span>
                              {t.completedAt && (
                                <span className={styles.winSubtitle}>
                                  Resolved{' '}
                                  {new Date(t.completedAt).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={styles.winStatusPill}>Completed</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.stepFooter}>
                    <span className={styles.footerMeta}>
                      {completedTasksThisWeek.length} accomplishment
                      {completedTasksThisWeek.length === 1 ? '' : 's'} this week
                    </span>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={handleStep1Celebrate}
                    >
                      <span>Celebrate &amp; Continue</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
              )}

              {/* ── Step 2: Clear & Realign ── */}
              {currentStep === 2 && (
                <section className={styles.stepContainer}>
                  <div className={styles.stepHeader}>
                    <h2 className={styles.stepHeading}>Step 2: Clear &amp; Realign Without Guilt</h2>
                    <p className={styles.stepDescription}>
                      Triage remaining tasks and captured ideas cleanly—push deadlines out, park ideas for later, or drop low-value commitments.
                    </p>
                  </div>

                  {openTasks.length === 0 && inboxItems.length === 0 ? (
                    <div className={styles.calmEmptyCard}>
                      <div className={styles.emptyIconCircle} aria-hidden="true">
                        <Layers size={20} />
                      </div>
                      <h3 className={styles.emptyTitle}>Queue and Idea Parking are clear</h3>
                      <p className={styles.emptySubtext}>
                        Zero open tasks or pending captures require realignment right now. Proceed directly to locking in next week’s priorities.
                      </p>
                    </div>
                  ) : (
                    <div className={styles.realignList}>
                      {displayedOpenTasks.map((t) => {
                        const isOverdue = Boolean(t.dueDate && t.dueDate < todayStr);
                        return (
                          <div key={t.id} className={styles.realignCard}>
                            <div className={styles.realignHeader}>
                              <span className={styles.realignTitle}>{t.title}</span>
                              <span
                                className={`${styles.realignBadge} ${
                                  isOverdue ? styles.realignBadgeWarn : ''
                                }`}
                              >
                                <Calendar size={11} />
                                <span>{t.dueDate ? (isOverdue ? `Overdue · ${t.dueDate}` : `Due ${t.dueDate}`) : 'Pending'}</span>
                              </span>
                            </div>
                            <div className={styles.realignActions}>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => handlePushTaskToNextWeek(t.id)}
                              >
                                Push +7 Days
                              </button>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => handleDemoteTaskToInbox(t)}
                              >
                                Move to Idea Parking
                              </button>
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                onClick={() => handleArchiveTaskWithoutGuilt(t.id)}
                              >
                                Archive Task
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {openTasks.length > 8 && (
                        <button
                          type="button"
                          className={styles.expandListBtn}
                          onClick={() => setShowAllOpenTasks((prev) => !prev)}
                        >
                          {showAllOpenTasks
                            ? 'Show top 8 tasks'
                            : `Show all ${openTasks.length} open tasks`}
                        </button>
                      )}

                      {inboxItems.slice(0, 6).map((item) => (
                        <div key={item.id} className={styles.realignCard}>
                          <div className={styles.realignHeader}>
                            <span className={styles.realignTitle}>{item.content}</span>
                            <span className={styles.realignBadge}>Idea Parking</span>
                          </div>
                          <div className={styles.realignActions}>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => handleClearInboxItem(item.id)}
                            >
                              Mark Handled
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.stepFooter}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => setCurrentStep(1)}
                    >
                      Back to Wins
                    </button>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={handleStep2Continue}
                    >
                      <span>Select Top 3 Priorities</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
              )}

              {/* ── Step 3: Top 3 Priorities & Reflection ── */}
              {currentStep === 3 && (
                <form className={styles.stepContainer} onSubmit={handleFinalizeReview}>
                  <div className={styles.stepHeaderRow}>
                    <div className={styles.stepHeaderText}>
                      <h2 className={styles.stepHeading}>Step 3: Lock In Top 3 Priorities</h2>
                      <p className={styles.stepDescription}>
                        Choose up to three priority projects and summarize your primary objective before archiving this week.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => void handleAiDraft()}
                      disabled={aiDrafting}
                    >
                      <Sparkles size={14} />
                      <span>{aiDrafting ? 'Drafting…' : 'Draft Reflection'}</span>
                    </button>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Priority Projects ({selectedProjectIds.length} / 3 selected)
                    </label>
                    {activeProjects.length === 0 ? (
                      <div className={styles.calmEmptyCard}>
                        <p className={styles.emptySubtext}>
                          No active projects yet. You can add projects anytime on the{' '}
                          <Link href="/projects" className={styles.inlineLink}>
                            Projects page
                          </Link>
                          .
                        </p>
                      </div>
                    ) : (
                      <div className={styles.projectSelectionGrid}>
                        {activeProjects.map((p) => {
                          const isSelected = selectedProjectIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              aria-pressed={isSelected}
                              className={`${styles.projectChip} ${
                                isSelected ? styles.projectChipSelected : ''
                              }`}
                              onClick={() => toggleProjectSelection(p.id)}
                            >
                              <div className={styles.projectChipTop}>
                                <span className={styles.projectChipTitle}>{p.title}</span>
                                <span className={styles.projectChipTag}>
                                  {isSelected ? 'Selected' : `${p.progress}%`}
                                </span>
                              </div>
                              <div className={styles.miniMeterTrack} aria-hidden="true">
                                <div
                                  className={styles.miniMeterFill}
                                  style={{ width: `${p.progress || 0}%` }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor="focus-note-input">
                      Next Week Primary Objective
                    </label>
                    <textarea
                      id="focus-note-input"
                      className={styles.formTextarea}
                      value={nextWeekFocusNote}
                      onChange={(e) => setNextWeekFocusNote(e.target.value)}
                      placeholder="Define the single most critical milestone or deliverable for next week…"
                    />
                  </div>

                  <div className={styles.twoColFields}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel} htmlFor="went-well-input">
                        What Worked Well
                      </label>
                      <textarea
                        id="went-well-input"
                        className={styles.formTextarea}
                        value={reflectionWentWell}
                        onChange={(e) => setReflectionWentWell(e.target.value)}
                        placeholder="Routines, wins, or decisions that helped…"
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel} htmlFor="friction-input">
                        Friction or Bottlenecks
                      </label>
                      <textarea
                        id="friction-input"
                        className={styles.formTextarea}
                        value={reflectionFriction}
                        onChange={(e) => setReflectionFriction(e.target.value)}
                        placeholder="Where momentum stalled or scope crept…"
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor="should-change-input">
                      Adjustment for Next Week
                    </label>
                    <textarea
                      id="should-change-input"
                      className={styles.formTextarea}
                      value={reflectionShouldChange}
                      onChange={(e) => setReflectionShouldChange(e.target.value)}
                      placeholder="One concrete change to improve focus or calm next week…"
                    />
                  </div>

                  <div className={styles.stepFooter}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => setCurrentStep(2)}
                    >
                      Back to Alignment
                    </button>
                    <button type="submit" className={styles.primaryBtn}>
                      <span>Complete &amp; Save Weekly Review</span>
                      <Check size={14} />
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* ── Companion Context Sidebar ── */}
            <aside className={styles.companionPanel} aria-label="Weekly context">
              <section className={styles.companionCard}>
                <h3 className={styles.companionTitle}>Review Checklist</h3>
                <div className={styles.checklist}>
                  <button
                    type="button"
                    className={styles.checkRowBtn}
                    onClick={() => setCurrentStep(1)}
                  >
                    <span className={styles.checkRowLeft}>
                      <span
                        className={`${styles.checkDot} ${
                          step1VisitedDone ? styles.checkDotDone : ''
                        }`}
                        aria-hidden="true"
                      />
                      <span>Acknowledge weekly wins</span>
                    </span>
                    <span className={styles.mono}>{completedTasksThisWeek.length}</span>
                  </button>

                  <button
                    type="button"
                    className={styles.checkRowBtn}
                    onClick={() => setCurrentStep(2)}
                  >
                    <span className={styles.checkRowLeft}>
                      <span
                        className={`${styles.checkDot} ${
                          step2VisitedDone ? styles.checkDotDone : ''
                        }`}
                        aria-hidden="true"
                      />
                      <span>Triage pending backlog</span>
                    </span>
                    <span className={styles.mono}>{openTasks.length}</span>
                  </button>

                  <button
                    type="button"
                    className={styles.checkRowBtn}
                    onClick={() => setCurrentStep(3)}
                  >
                    <span className={styles.checkRowLeft}>
                      <span
                        className={`${styles.checkDot} ${
                          selectedProjectIds.length > 0 ? styles.checkDotDone : ''
                        }`}
                        aria-hidden="true"
                      />
                      <span>Select priority projects</span>
                    </span>
                    <span className={styles.mono}>{selectedProjectIds.length}/3</span>
                  </button>
                </div>
              </section>

              <section className={styles.companionCard}>
                <div className={styles.companionHead}>
                  <h3 className={styles.companionTitle}>Active Projects ({activeProjects.length})</h3>
                  <Link href="/projects" className={styles.inlineLink}>
                    Manage
                  </Link>
                </div>

                {activeProjects.length === 0 ? (
                  <p className={styles.companionMuted}>
                    No active projects tracked right now.
                  </p>
                ) : (
                  <div className={styles.projectSnapshotList}>
                    {activeProjects.slice(0, 4).map((p) => (
                      <div key={p.id} className={styles.projectSnapshotRow}>
                        <div className={styles.projectSnapshotTop}>
                          <span className={styles.projectSnapshotName}>{p.title}</span>
                          <span className={styles.mono}>{p.progress}%</span>
                        </div>
                        <div className={styles.miniMeterTrack} aria-hidden="true">
                          <div
                            className={styles.miniMeterFill}
                            style={{ width: `${p.progress || 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.companionCard}>
                <div className={styles.companionHead}>
                  <h3 className={styles.companionTitle}>Quick Links</h3>
                  <Clock size={14} className={styles.mutedIcon} aria-hidden="true" />
                </div>
                <div className={styles.quickLinksCol}>
                  <Link href="/" className={styles.quickNavLink}>
                    <span>Return to Today</span>
                    <ArrowRight size={13} />
                  </Link>
                  <Link href="/tasks" className={styles.quickNavLink}>
                    <span>Open Tasks ({openTasks.length})</span>
                    <ArrowRight size={13} />
                  </Link>
                  <Link href="/focus" className={styles.quickNavLink}>
                    <span>Start Focus Session</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </section>
            </aside>
          </div>
        </>
      ) : (
        /* ── Historical Review Archive ── */
        <section className={styles.archiveSection} aria-label="Historical weekly reviews">
          {reviews.length === 0 ? (
            <div className={styles.stepContainer}>
              <div className={styles.calmEmptyCard}>
                <div className={styles.emptyIconCircle} aria-hidden="true">
                  <Calendar size={20} />
                </div>
                <h3 className={styles.emptyTitle}>No archived weekly reviews yet</h3>
                <p className={styles.emptySubtext}>
                  Once you complete Step 3 in the Guided Review tab, each week’s snapshot and commitments are preserved here.
                </p>
                <div className={styles.emptyActions}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => setActiveTab('guided')}
                  >
                    Start This Week’s Review
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.archiveGrid}>
              {reviews.map((rev) => (
                <article key={rev.id} className={styles.archiveCard}>
                  <div className={styles.archiveCardHeader}>
                    <span className={styles.archiveDateRange}>
                      {formatShortDateLabel(rev.weekStartDate)} – {formatShortDateLabel(rev.weekEndDate)}
                    </span>
                    {confirmDeleteId === rev.id ? (
                      <div className={styles.confirmRow}>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => {
                            deleteWeeklyReview(rev.id);
                            setConfirmDeleteId(null);
                          }}
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.deleteIconBtn}
                        onClick={() => setConfirmDeleteId(rev.id)}
                        aria-label="Delete archived review"
                        title="Delete record"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className={styles.archiveMetricsRow}>
                    <span className={styles.metricPill}>{rev.completedTaskCount} Tasks</span>
                    <span className={styles.metricPill}>
                      {Math.floor(rev.focusMinutesLogged / 60)}h {rev.focusMinutesLogged % 60}m Focus
                    </span>
                    <span className={styles.metricPill}>{rev.habitsConsistencyRate}% Habits</span>
                  </div>

                  {rev.nextWeekFocus && (
                    <div className={styles.archiveNoteBlock}>
                      <span className={styles.archiveNoteLabel}>Priority Focus</span>
                      <p className={styles.archiveNoteBody}>{rev.nextWeekFocus}</p>
                    </div>
                  )}

                  {rev.wentWell && (
                    <div className={styles.archiveNoteBlock}>
                      <span className={styles.archiveNoteLabel}>What Worked</span>
                      <p className={styles.archiveNoteBody}>{rev.wentWell}</p>
                    </div>
                  )}

                  {rev.shouldChange && (
                    <div className={styles.archiveNoteBlock}>
                      <span className={styles.archiveNoteLabel}>Adjustment</span>
                      <p className={styles.archiveNoteBody}>{rev.shouldChange}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
