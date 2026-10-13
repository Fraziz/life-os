'use client';

import React, { useState, useMemo } from 'react';
import { useReview } from '@/context/ReviewContext';
import { useTasks } from '@/context/TaskContext';
import { useFocus } from '@/context/FocusContext';
import { useHabits } from '@/context/HabitContext';
import { useProjects } from '@/context/ProjectContext';
import { useInbox } from '@/context/InboxContext';
import { triggerDopamineBurst, playSuccessChime } from '@/utils/soundAndDopamine';
import styles from './page.module.css';

export default function WeeklyReviewPage() {
  const { reviews, saveWeeklyReview, deleteWeeklyReview, isLoaded: reviewLoaded } = useReview();
  const { tasks, updateTask, deleteTask, isLoaded: tasksLoaded } = useTasks();
  const { focusHistory, isLoaded: focusLoaded } = useFocus();
  const { habits, getWeeklyCompletionsCount, isLoaded: habitsLoaded } = useHabits();
  const { activeProjects, isLoaded: projectsLoaded } = useProjects();
  const { activeItems: inboxItems, deleteInboxItem, quickDump, isLoaded: inboxLoaded } = useInbox();

  // Tab switch: Guided Review vs Review Archive
  const [activeTab, setActiveTab] = useState<'guided' | 'archive'>('guided');

  // 3-Step Wizard state (1: Celebrate Wins, 2: Clear & Realign, 3: Top 3 for Next Week)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 3 selections
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [nextWeekFocusNote, setNextWeekFocusNote] = useState('');
  const [reflectionWentWell, setReflectionWentWell] = useState('');
  const [reflectionShouldChange, setReflectionShouldChange] = useState('');

  // Status notification
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // ── Auto-Aggregated Weekly Metrics ──────────────────────────
  const now = new Date();
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const weekStartStr = startOfWeek.toISOString().split('T')[0];
  const endOfWeek = new Date(startOfWeek.getTime() + 86400000 * 6);
  const weekEndStr = endOfWeek.toISOString().split('T')[0];

  // 1. Tasks completed this week
  const completedTasksThisWeek = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status !== 'done') return false;
      const comp = t.completedAt || t.updatedAt;
      return !comp || comp.split('T')[0] >= weekStartStr;
    });
  }, [tasks, weekStartStr]);

  // 2. Focus reading & timer minutes logged this week
  const focusMinutesThisWeek = useMemo(() => {
    return focusHistory
      .filter((s) => s.completedAt && s.completedAt.split('T')[0] >= weekStartStr)
      .reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  }, [focusHistory, weekStartStr]);

  // 3. Habit consistency rate
  const habitConsistency = useMemo(() => {
    let expected = 0;
    let actual = 0;
    habits.forEach((h) => {
      expected += h.targetCount || 1;
      actual += getWeeklyCompletionsCount(h.id);
    });
    return expected > 0 ? Math.min(100, Math.round((actual / expected) * 100)) : 100;
  }, [habits, getWeeklyCompletionsCount]);

  // 4. Overdue or open tasks needing realignment
  const openTasksForRealignment = useMemo(() => {
    return tasks.filter((t) => t.status !== 'done').slice(0, 8);
  }, [tasks]);

  const formatFocusTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m logged`;
    return m > 0 ? `${h}h ${m}m logged` : `${h}h logged`;
  };

  // ── Step Navigation Handlers ───────────────────────────────
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

  // Step 2: Zero-Guilt Task Realignment Actions
  const handlePushTaskToNextWeek = (taskId: string) => {
    const nextWeekDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    updateTask(taskId, { dueDate: nextWeekDate });
    setStatusNotice('Task rescheduled to next week without penalty.');
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleDemoteTaskToInbox = (task: { id: string; title: string }) => {
    quickDump(task.title, { isReminder: false });
    deleteTask(task.id);
    setStatusNotice(`"${task.title}" parked in Brain Dump to free mental bandwidth.`);
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleArchiveTaskWithoutGuilt = (taskId: string) => {
    deleteTask(taskId);
    setStatusNotice('Task archived without guilt.');
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleClearInboxItem = (itemId: string) => {
    deleteInboxItem(itemId);
    setStatusNotice('Inbox item resolved.');
    setTimeout(() => setStatusNotice(null), 3000);
  };

  // Finalize Review
  const handleFinalizeReview = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenProjects = activeProjects.filter((p) => selectedProjectIds.includes(p.id));
    const projectTitles = chosenProjects.map((p) => p.title).join(', ');

    saveWeeklyReview({
      weekStartDate: weekStartStr,
      weekEndDate: weekEndStr,
      completedTaskCount: completedTasksThisWeek.length,
      openTaskCount: openTasksForRealignment.length,
      focusMinutesLogged: focusMinutesThisWeek,
      goalsProgressedCount: chosenProjects.length,
      projectsProgressedCount: chosenProjects.length,
      habitsConsistencyRate: habitConsistency,
      importantWins: completedTasksThisWeek.slice(0, 5).map((t) => t.title),
      wentWell: reflectionWentWell.trim() || 'Consistent execution maintained across scheduled focus sessions.',
      didNotGoWell: 'Commitments streamlined to prevent cognitive overload.',
      shouldChange: reflectionShouldChange.trim() || 'Protect primary deep focus blocks from non-essential interruptions.',
      nextWeekFocus: nextWeekFocusNote.trim() || (projectTitles ? `Priority projects: ${projectTitles}` : 'Advance primary quarterly objectives.'),
    });

    playSuccessChime();
    triggerDopamineBurst();
    setStatusNotice('Weekly Review successfully recorded in archives.');
    setCurrentStep(1);
    setSelectedProjectIds([]);
    setNextWeekFocusNote('');
    setReflectionWentWell('');
    setReflectionShouldChange('');
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const isDataReady = reviewLoaded && tasksLoaded && focusLoaded && habitsLoaded && projectsLoaded && inboxLoaded;

  if (!isDataReady) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Preparing weekly review parameters...
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Formal Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Weekly Review & Alignment</h1>
          <p className={styles.subtitle}>
            A structured, low-friction reflection protocol to celebrate tangible progress, realign deferred commitments without guilt, and establish priority focus.
          </p>
        </div>

        <div className={styles.tabSwitch} role="tablist">
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'guided' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('guided')}
          >
            Guided Review
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'archive' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('archive')}
          >
            Review Archive ({reviews.length})
          </button>
        </div>
      </header>

      {/* ── Confirmation Banner ── */}
      {statusNotice && (
        <div className={styles.confirmationBanner} role="status">
          {statusNotice}
        </div>
      )}

      {/* ── Auto-Aggregated Dopamine Summary (Clean Formal Cards, No Icons) ── */}
      <section className={styles.summaryGrid} aria-label="Current Week Performance Summary">
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Completed Tasks</span>
          <span className={styles.summaryValue}>{completedTasksThisWeek.length}</span>
          <span className={styles.summaryDetail}>Actions resolved this week</span>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Focus &amp; Reading Time</span>
          <span className={styles.summaryValue}>{formatFocusTime(focusMinutesThisWeek)}</span>
          <span className={styles.summaryDetail}>Logged in deep focus sessions</span>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Habit Consistency</span>
          <span className={styles.summaryValue}>{habitConsistency}%</span>
          <span className={styles.summaryDetail}>Routine compliance score</span>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Active Initiatives</span>
          <span className={styles.summaryValue}>{activeProjects.length} Projects</span>
          <span className={styles.summaryDetail}>Open multi-step endeavors</span>
        </div>
      </section>

      {activeTab === 'guided' ? (
        <>
          {/* ── 3-Step Stepper Navigation (Clean & Formal, No Icons) ── */}
          <nav className={styles.stepperTrack} aria-label="Review Steps">
            <button
              type="button"
              className={`${styles.stepButton} ${currentStep === 1 ? styles.stepButtonActive : ''}`}
              onClick={() => setCurrentStep(1)}
            >
              <span className={styles.stepBadge}>Step 1</span>
              <span className={styles.stepTitle}>Celebrate Wins</span>
            </button>

            <button
              type="button"
              className={`${styles.stepButton} ${currentStep === 2 ? styles.stepButtonActive : ''}`}
              onClick={() => setCurrentStep(2)}
            >
              <span className={styles.stepBadge}>Step 2</span>
              <span className={styles.stepTitle}>Clear &amp; Realign</span>
            </button>

            <button
              type="button"
              className={`${styles.stepButton} ${currentStep === 3 ? styles.stepButtonActive : ''}`}
              onClick={() => setCurrentStep(3)}
            >
              <span className={styles.stepBadge}>Step 3</span>
              <span className={styles.stepTitle}>Top 3 Priorities</span>
            </button>
          </nav>

          {/* ── Step 1: Celebrate Wins ── */}
          {currentStep === 1 && (
            <section className={styles.stepContainer}>
              <div className={styles.stepHeader}>
                <h2 className={styles.stepHeading}>Step 1: Celebrate Completed Actions</h2>
                <p className={styles.stepDescription}>
                  Acknowledging finished work activates dopamine pathways and directly counteracts working memory amnesia. Review everything accomplished between {weekStartStr} and {weekEndStr}.
                </p>
              </div>

              {completedTasksThisWeek.length === 0 ? (
                <div className={styles.emptyStateMessage}>
                  No tasks marked as completed for the current week window yet. Completing actions in Today or Task Board will automatically surface here.
                </div>
              ) : (
                <div className={styles.winsFeed}>
                  {completedTasksThisWeek.map((t) => (
                    <div key={t.id} className={styles.winRow}>
                      <div className={styles.winMain}>
                        <span className={styles.winTitle}>{t.title}</span>
                        {t.completedAt && (
                          <span className={styles.winSubtitle}>
                            Resolved on {new Date(t.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <span className={styles.winStatusPill}>Done</span>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.stepFooter}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-faint)' }}>
                  {completedTasksThisWeek.length} accomplishment{completedTasksThisWeek.length === 1 ? '' : 's'} recorded
                </span>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleStep1Celebrate}
                >
                  Celebrate Wins &amp; Proceed to Alignment ➔
                </button>
              </div>
            </section>
          )}

          {/* ── Step 2: Clear & Realign (Zero Guilt Protocol) ── */}
          {currentStep === 2 && (
            <section className={styles.stepContainer}>
              <div className={styles.stepHeader}>
                <h2 className={styles.stepHeading}>Step 2: Clear &amp; Realign Without Guilt</h2>
                <p className={styles.stepDescription}>
                  Stalled tasks and accumulated inbox thoughts create subconscious drag. Make quick, decisive judgments: push what still matters, park exploratory thoughts into Brain Dump, or archive without self-criticism.
                </p>
              </div>

              <div className={styles.realignList}>
                {openTasksForRealignment.length === 0 && inboxItems.length === 0 ? (
                  <div className={styles.emptyStateMessage}>
                    Your active queue and brain dump are clear. No pending items require realignment.
                  </div>
                ) : (
                  <>
                    {openTasksForRealignment.map((t) => (
                      <div key={t.id} className={styles.realignCard}>
                        <div className={styles.realignHeader}>
                          <span className={styles.realignTitle}>{t.title}</span>
                          <span className={styles.realignMeta}>
                            {t.dueDate ? `Due ${t.dueDate}` : 'Pending Queue'}
                          </span>
                        </div>
                        <div className={styles.realignActions}>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => handlePushTaskToNextWeek(t.id)}
                            title="Reschedule deadline by 7 days"
                          >
                            Push to Next Week
                          </button>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => handleDemoteTaskToInbox(t)}
                            title="Move to Brain Dump to remove pressure"
                          >
                            Move to Brain Dump
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={() => handleArchiveTaskWithoutGuilt(t.id)}
                            title="Drop task without guilt"
                          >
                            Archive Without Guilt
                          </button>
                        </div>
                      </div>
                    ))}

                    {inboxItems.slice(0, 5).map((item) => (
                      <div key={item.id} className={styles.realignCard}>
                        <div className={styles.realignHeader}>
                          <span className={styles.realignTitle}>{item.content}</span>
                          <span className={styles.realignMeta}>Brain Dump</span>
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
                  </>
                )}
              </div>

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
                  Continue to Priority Selection ➔
                </button>
              </div>
            </section>
          )}

          {/* ── Step 3: Top 3 for Next Week ── */}
          {currentStep === 3 && (
            <form className={styles.stepContainer} onSubmit={handleFinalizeReview}>
              <div className={styles.stepHeader}>
                <h2 className={styles.stepHeading}>Step 3: Establish Top 3 Priorities for Next Week</h2>
                <p className={styles.stepDescription}>
                  Focusing on a maximum of three key project initiatives prevents executive paralysis and sets an intentional target for the week ahead.
                </p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Select Up to 3 Key Projects ({selectedProjectIds.length} / 3 selected)
                </label>
                {activeProjects.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    No active projects found. You can define projects in the Projects section.
                  </p>
                ) : (
                  <div className={styles.projectSelectionGrid}>
                    {activeProjects.map((p) => {
                      const isSelected = selectedProjectIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          className={`${styles.projectChip} ${isSelected ? styles.projectChipSelected : ''}`}
                          onClick={() => toggleProjectSelection(p.id)}
                          role="checkbox"
                          aria-checked={isSelected}
                          tabIndex={0}
                        >
                          <span className={styles.projectChipTitle}>{p.title}</span>
                          <span className={styles.projectChipProgress}>
                            Progress: {p.progress}% • {isSelected ? 'Selected' : 'Click to select'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="focus-note-input">
                  Next Week Focus Objective
                </label>
                <textarea
                  id="focus-note-input"
                  className={styles.formTextarea}
                  value={nextWeekFocusNote}
                  onChange={(e) => setNextWeekFocusNote(e.target.value)}
                  placeholder="Summarize the single most critical breakthrough or deliverable to achieve next week..."
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="went-well-input">
                  Notable Successes &amp; Strengths (Optional Reflection)
                </label>
                <textarea
                  id="went-well-input"
                  className={styles.formTextarea}
                  value={reflectionWentWell}
                  onChange={(e) => setReflectionWentWell(e.target.value)}
                  placeholder="What routines or decisions supported deep focus this week?"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="should-change-input">
                  Friction to Eliminate (Optional Reflection)
                </label>
                <textarea
                  id="should-change-input"
                  className={styles.formTextarea}
                  value={reflectionShouldChange}
                  onChange={(e) => setReflectionShouldChange(e.target.value)}
                  placeholder="What caused friction or misdirected focus, and how to calibrate it?"
                />
              </div>

              <div className={styles.stepFooter}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setCurrentStep(2)}
                >
                  Back to Realignment
                </button>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                >
                  Complete &amp; Finalize Weekly Review
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        /* ── Review Archive View (Formal & Clean) ── */
        <section className={styles.archiveList} aria-label="Historical Weekly Reviews">
          {reviews.length === 0 ? (
            <div className={styles.emptyStateMessage}>
              No previous reviews found. Finalizing a review in the Guided Review tab will preserve it here.
            </div>
          ) : (
            reviews.map((rev) => (
              <article key={rev.id} className={styles.archiveCard}>
                <div className={styles.archiveCardHeader}>
                  <span className={styles.archiveDateRange}>
                    Week of {rev.weekStartDate} to {rev.weekEndDate}
                  </span>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => deleteWeeklyReview(rev.id)}
                    title="Remove review record"
                  >
                    Delete Record
                  </button>
                </div>

                <div className={styles.archiveMetricsRow}>
                  <span>Tasks Completed: {rev.completedTaskCount}</span>
                  <span>Focus Logged: {Math.floor(rev.focusMinutesLogged / 60)}h {rev.focusMinutesLogged % 60}m</span>
                  <span>Habit Consistency: {rev.habitsConsistencyRate}%</span>
                </div>

                {rev.nextWeekFocus && (
                  <div className={styles.archiveNotes}>
                    <strong>Focus Commitment:</strong> {rev.nextWeekFocus}
                  </div>
                )}

                {rev.wentWell && (
                  <div className={styles.archiveNotes}>
                    <strong>Reflection:</strong> {rev.wentWell}
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      )}
    </div>
  );
}
