'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CheckCircle2,
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
  const [showAllOpenTasks, setShowAllOpenTasks] = useState(false);

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [nextWeekFocusNote, setNextWeekFocusNote] = useState('');
  const [reflectionWentWell, setReflectionWentWell] = useState('');
  const [reflectionFriction, setReflectionFriction] = useState('');
  const [reflectionShouldChange, setReflectionShouldChange] = useState('');

  const [aiDrafting, setAiDrafting] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const handleStep1Celebrate = (e: React.MouseEvent) => {
    playSuccessChime();
    triggerDopamineBurst(e.clientX, e.clientY);
    setCurrentStep(2);
  };

  const handleStep2Continue = () => {
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
    setStatusNotice('Weekly review archived.');
    setCurrentStep(1);
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
      {/* ── Clean Page Header (Consistent with Tasks / Goals / Routine) ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Weekly Review</h1>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.dateBadge}>
            {formatShortDateLabel(weekStartStr)} – {formatShortDateLabel(weekEndStr)}
          </span>
          <div className={styles.tabSwitch} role="tablist" aria-label="Review mode">
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
              Archive ({reviews.length})
            </button>
          </div>
        </div>
      </header>

      {statusNotice && (
        <div className={styles.confirmationBanner} role="status">
          <CheckCircle2 size={14} />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* ── Quiet Minimal Metrics Strip ── */}
      <section className={styles.statsRow} aria-label="Weekly summary metrics">
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Completed Tasks</span>
          <span className={styles.statValue}>{completedTasksThisWeek.length}</span>
          <span className={styles.statMeta}>{openTasks.length} open remaining</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Focus Time</span>
          <span className={styles.statValue}>{formatFocusTime(focusMinutesThisWeek)}</span>
          <span className={styles.statMeta}>
            {focusSessionsThisWeek.length} session{focusSessionsThisWeek.length === 1 ? '' : 's'} this week
          </span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Habit Consistency</span>
          <span className={styles.statValue}>
            {habitStats.hasHabits ? `${habitStats.pct}%` : '—'}
          </span>
          <span className={styles.statMeta}>
            {habitStats.hasHabits
              ? `${habitStats.actual} / ${habitStats.expected} check-ins`
              : 'No habits tracked'}
          </span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active Projects</span>
          <span className={styles.statValue}>{activeProjects.length}</span>
          <span className={styles.statMeta}>Ongoing initiatives</span>
        </div>
      </section>

      {activeTab === 'guided' ? (
        <>
          {/* ── Clean Underline Step Navigation ── */}
          <nav className={styles.stepTabs} aria-label="Review steps">
            {(
              [
                { id: 1, label: '1. Celebrate Wins' },
                { id: 2, label: `2. Clear & Realign (${openTasks.length + inboxItems.length})` },
                { id: 3, label: '3. Top 3 Priorities' },
              ] as const
            ).map((step) => {
              const isActive = currentStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`${styles.stepTab} ${isActive ? styles.stepTabActive : ''}`}
                  onClick={() => setCurrentStep(step.id)}
                >
                  {step.label}
                </button>
              );
            })}
          </nav>

          {/* ── Step 1: Celebrate Wins ── */}
          {currentStep === 1 && (
            <section className={styles.surfaceCard}>
              <div className={styles.sectionHead}>
                <div>
                  <h2 className={styles.sectionTitle}>Completed Actions</h2>
                  <p className={styles.sectionDesc}>
                    Work resolved between {formatShortDateLabel(weekStartStr)} and{' '}
                    {formatShortDateLabel(weekEndStr)}.
                  </p>
                </div>
                <span className={styles.metaCount}>
                  {completedTasksThisWeek.length} completed
                </span>
              </div>

              {completedTasksThisWeek.length === 0 ? (
                <div className={styles.emptyBlock}>
                  <p className={styles.emptyText}>
                    No tasks marked as done this week yet. Completed tasks from Today or Tasks appear here automatically.
                  </p>
                  <div className={styles.emptyLinks}>
                    <Link href="/" className={styles.btnGhost}>
                      Open Today
                    </Link>
                    <Link href="/tasks" className={styles.btnGhost}>
                      Open Tasks
                    </Link>
                  </div>
                </div>
              ) : (
                <div className={styles.itemList}>
                  {completedTasksThisWeek.map((t) => (
                    <div key={t.id} className={styles.itemRow}>
                      <div className={styles.itemLeft}>
                        <CheckCircle2 size={15} className={styles.checkIcon} aria-hidden="true" />
                        <div className={styles.itemText}>
                          <span className={styles.itemTitle}>{t.title}</span>
                          {t.completedAt && (
                            <span className={styles.itemSub}>
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
                      <span className={styles.pillDone}>Done</span>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.cardFooter}>
                <span className={styles.footerHint}>Step 1 of 3</span>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleStep1Celebrate}
                >
                  <span>Continue to Alignment</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </section>
          )}

          {/* ── Step 2: Clear & Realign ── */}
          {currentStep === 2 && (
            <section className={styles.surfaceCard}>
              <div className={styles.sectionHead}>
                <div>
                  <h2 className={styles.sectionTitle}>Clear &amp; Realign</h2>
                  <p className={styles.sectionDesc}>
                    Reschedule what still matters, park thoughts in Idea Parking, or drop stale items without guilt.
                  </p>
                </div>
                <span className={styles.metaCount}>
                  {openTasks.length} open · {inboxItems.length} parked
                </span>
              </div>

              {openTasks.length === 0 && inboxItems.length === 0 ? (
                <div className={styles.emptyBlock}>
                  <p className={styles.emptyText}>
                    Your active queue and Idea Parking are completely clear.
                  </p>
                </div>
              ) : (
                <div className={styles.itemList}>
                  {displayedOpenTasks.map((t) => {
                    const isOverdue = Boolean(t.dueDate && t.dueDate < todayStr);
                    return (
                      <div key={t.id} className={styles.realignRow}>
                        <div className={styles.realignInfo}>
                          <span className={styles.itemTitle}>{t.title}</span>
                          <span className={`${styles.pillMeta} ${isOverdue ? styles.pillWarn : ''}`}>
                            {t.dueDate ? (isOverdue ? `Overdue ${t.dueDate}` : `Due ${t.dueDate}`) : 'No due date'}
                          </span>
                        </div>
                        <div className={styles.realignBtns}>
                          <button
                            type="button"
                            className={styles.btnGhost}
                            onClick={() => handlePushTaskToNextWeek(t.id)}
                          >
                            Push +7d
                          </button>
                          <button
                            type="button"
                            className={styles.btnGhost}
                            onClick={() => handleDemoteTaskToInbox(t)}
                          >
                            To Idea Parking
                          </button>
                          <button
                            type="button"
                            className={`${styles.btnGhost} ${styles.btnDangerText}`}
                            onClick={() => handleArchiveTaskWithoutGuilt(t.id)}
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {openTasks.length > 8 && (
                    <button
                      type="button"
                      className={styles.btnGhost}
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => setShowAllOpenTasks((prev) => !prev)}
                    >
                      {showAllOpenTasks ? 'Show top 8' : `Show all ${openTasks.length} open tasks`}
                    </button>
                  )}

                  {inboxItems.slice(0, 6).map((item) => (
                    <div key={item.id} className={styles.realignRow}>
                      <div className={styles.realignInfo}>
                        <span className={styles.itemTitle}>{item.content}</span>
                        <span className={styles.pillMeta}>Idea Parking</span>
                      </div>
                      <div className={styles.realignBtns}>
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={() => handleClearInboxItem(item.id)}
                        >
                          Mark Handled
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.cardFooter}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => setCurrentStep(1)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
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
            <form className={styles.surfaceCard} onSubmit={handleFinalizeReview}>
              <div className={styles.sectionHead}>
                <div>
                  <h2 className={styles.sectionTitle}>Next Week Priorities &amp; Reflection</h2>
                  <p className={styles.sectionDesc}>
                    Pick up to three active projects and capture your main intention before archiving this week.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => void handleAiDraft()}
                  disabled={aiDrafting}
                >
                  <Sparkles size={14} />
                  <span>{aiDrafting ? 'Drafting…' : 'Draft Reflection'}</span>
                </button>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Priority Projects ({selectedProjectIds.length} / 3)
                </label>
                {activeProjects.length === 0 ? (
                  <p className={styles.sectionDesc}>
                    No active projects right now. Manage projects in{' '}
                    <Link href="/projects" className={styles.inlineLink}>
                      Projects
                    </Link>
                    .
                  </p>
                ) : (
                  <div className={styles.projectsGrid}>
                    {activeProjects.map((p) => {
                      const isSelected = selectedProjectIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={isSelected}
                          className={`${styles.projectBtn} ${isSelected ? styles.projectBtnSelected : ''}`}
                          onClick={() => toggleProjectSelection(p.id)}
                        >
                          <div className={styles.projectBtnRow}>
                            <span className={styles.projectName}>{p.title}</span>
                            <span className={styles.projectPct}>
                              {isSelected ? 'Selected' : `${p.progress}%`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="focus-note-input">
                  Next Week Primary Focus
                </label>
                <textarea
                  id="focus-note-input"
                  className={styles.textarea}
                  value={nextWeekFocusNote}
                  onChange={(e) => setNextWeekFocusNote(e.target.value)}
                  placeholder="What single outcome matters most next week?"
                />
              </div>

              <div className={styles.fieldsGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="went-well-input">
                    What Worked Well
                  </label>
                  <textarea
                    id="went-well-input"
                    className={styles.textarea}
                    value={reflectionWentWell}
                    onChange={(e) => setReflectionWentWell(e.target.value)}
                    placeholder="Wins, routines, or decisions to repeat…"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="friction-input">
                    Bottlenecks or Friction
                  </label>
                  <textarea
                    id="friction-input"
                    className={styles.textarea}
                    value={reflectionFriction}
                    onChange={(e) => setReflectionFriction(e.target.value)}
                    placeholder="Where progress stalled or got sidetracked…"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="should-change-input">
                    Adjustment for Next Week
                  </label>
                  <textarea
                    id="should-change-input"
                    className={styles.textarea}
                    value={reflectionShouldChange}
                    onChange={(e) => setReflectionShouldChange(e.target.value)}
                    placeholder="One concrete change for next week…"
                  />
                </div>
              </div>

              <div className={styles.cardFooter}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => setCurrentStep(2)}
                >
                  Back
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  <span>Save Weekly Review</span>
                  <Check size={14} />
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        /* ── Archive View ── */
        <section className={styles.archiveSection} aria-label="Review archive">
          {reviews.length === 0 ? (
            <div className={styles.surfaceCard}>
              <div className={styles.emptyBlock}>
                <p className={styles.emptyText}>
                  No archived reviews yet. Complete a guided review to store it here.
                </p>
                <div className={styles.emptyLinks}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => setActiveTab('guided')}
                  >
                    Start Weekly Review
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.archiveGrid}>
              {reviews.map((rev) => (
                <article key={rev.id} className={styles.archiveCard}>
                  <div className={styles.archiveHead}>
                    <span className={styles.archiveRange}>
                      {formatShortDateLabel(rev.weekStartDate)} – {formatShortDateLabel(rev.weekEndDate)}
                    </span>
                    {confirmDeleteId === rev.id ? (
                      <div className={styles.realignBtns}>
                        <button
                          type="button"
                          className={`${styles.btnGhost} ${styles.btnDangerText}`}
                          onClick={() => {
                            deleteWeeklyReview(rev.id);
                            setConfirmDeleteId(null);
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => setConfirmDeleteId(rev.id)}
                        aria-label="Delete archived review"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className={styles.archiveStats}>
                    <span className={styles.pillMeta}>{rev.completedTaskCount} Tasks</span>
                    <span className={styles.pillMeta}>
                      {Math.floor(rev.focusMinutesLogged / 60)}h {rev.focusMinutesLogged % 60}m Focus
                    </span>
                    <span className={styles.pillMeta}>{rev.habitsConsistencyRate}% Habits</span>
                  </div>

                  {rev.nextWeekFocus && (
                    <div className={styles.archiveNote}>
                      <strong>Focus:</strong> {rev.nextWeekFocus}
                    </div>
                  )}

                  {rev.wentWell && (
                    <div className={styles.archiveNote}>
                      <strong>Wins:</strong> {rev.wentWell}
                    </div>
                  )}

                  {rev.shouldChange && (
                    <div className={styles.archiveNote}>
                      <strong>Adjustment:</strong> {rev.shouldChange}
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
