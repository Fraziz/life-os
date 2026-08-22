'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Target,
  CheckSquare,
  Square,
  Clock,
  Calendar,
  AlertCircle,
  Plus,
  ArrowRight,
  RotateCcw,
  SlidersHorizontal,
  X,
  Flame,
  Check,
  CheckCircle2,
  ChevronRight,
  Headphones,
  Send,
  Inbox,
  Repeat,
  Zap,
  FolderKanban,
  Lightbulb,
  Play,
  Compass,
  Wand2,
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useTodayPlan } from '@/context/TodayPlanContext';
import { useInbox } from '@/context/InboxContext';
import { useHabits } from '@/context/HabitContext';
import { useFocus } from '@/context/FocusContext';
import { analyzeTaskTimePatterns } from '@/utils/timeIntelligence';
import { playSuccessChime, playSubtaskTick, triggerDopamineBurst } from '@/utils/soundAndDopamine';
import { generateMicroBreakdown } from '@/utils/adhdBreakdown';
import type { Task } from '@/types';
import styles from './page.module.css';

export default function TodayDashboardContent() {
  const { settings } = useSettings();
  const { tasks, toggleTaskDone, toggleSubtask, breakdownTask, isLoaded: tasksLoaded } = useTasks();
  const { projects, isLoaded: projectsLoaded } = useProjects();
  const { goals, isLoaded: goalsLoaded } = useGoals();
  const { quickDump } = useInbox();
  const { habits, toggleHabitCheckIn, isHabitCompletedOnDate } = useHabits();
  const { selectFocusTask } = useFocus();

  const [brainDumpInput, setBrainDumpInput] = useState('');
  const [dumpSentNotice, setDumpSentNotice] = useState(false);
  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [curateModalOpen, setCurateModalOpen] = useState(false);

  const {
    availableMinutes,
    mainFocusTask,
    customMainFocus,
    importantTasks,
    smallTasks,
    scheduledTasks,
    completedTodayTasks,
    todayTasks,
    totalSelectedMinutes,
    remainingMinutes,
    isOverallocated,
    overallocatedDifference,
    formattedAvailable,
    formattedSelected,
    formattedRemaining,
    setAvailableMinutes,
    setMainFocus,
    addToToday,
    removeFromToday,
    setScheduledTime,
    clearScheduledTime,
    resetToDefaultPlan,
    isLoaded: planLoaded,
  } = useTodayPlan();

  if (!tasksLoaded || !planLoaded || !projectsLoaded || !goalsLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Initializing your Personal Command Center...
        </p>
      </div>
    );
  }

  const userName = settings?.profile?.displayName || 'Creator';
  const todayFormatted = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const todayIso = new Date().toISOString().split('T')[0];

  // Phase 19: Time Estimation Intelligence Analysis
  const timeIntelligence = analyzeTaskTimePatterns(tasks, projects);

  // Derive Next Immediate Action (first uncompleted subtask or next open task)
  const nextActionText = mainFocusTask?.subtasks?.find((s) => !s.completed)?.title
    || mainFocusTask?.title
    || importantTasks[0]?.title
    || 'Choose an action to focus on right now';

  // Active goals and projects for strategic alignment
  const activeGoals = goals.filter((g) => g.status === 'in-progress').slice(0, 3);
  const activeProjects = projects.filter((p) => p.status === 'active').slice(0, 3);

  const handleTimePillClick = (minutes: number) => {
    setAvailableMinutes(minutes);
  };

  const handleCustomTimeSubmit = () => {
    const raw = prompt('Enter available minutes for today (e.g. 90, 180, 300):', String(availableMinutes));
    if (raw) {
      const parsed = parseInt(raw);
      if (!isNaN(parsed) && parsed > 0) {
        setAvailableMinutes(parsed);
      }
    }
  };

  const handleTaskToggle = (e: React.MouseEvent, taskId: string) => {
    toggleTaskDone(taskId);
    playSuccessChime();
    triggerDopamineBurst(e.clientX, e.clientY);
  };

  const handleSubtaskToggle = (e: React.MouseEvent, taskId: string, subId: string) => {
    toggleSubtask(taskId, subId);
    playSubtaskTick();
    triggerDopamineBurst(e.clientX, e.clientY);
  };

  const handleHabitToggle = (e: React.MouseEvent, habitId: string, iso: string) => {
    toggleHabitCheckIn(habitId, iso);
    playSuccessChime();
    triggerDopamineBurst(e.clientX, e.clientY);
  };

  const handleMagicBreakdown = (taskId: string, title: string, desc?: string) => {
    const steps = generateMicroBreakdown(title, desc);
    breakdownTask(taskId, steps);
    playSuccessChime();
    triggerDopamineBurst();
  };

  return (
    <div className={styles.page}>
      {/* ── 1. Serene Personal Command Center Header ── */}
      <header className={styles.header}>
        <div className={styles.greetingArea}>
          <span className={styles.datePill}>
            <Calendar size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {todayFormatted}
          </span>
          <h1 className={styles.title}>
            Today
          </h1>
          <p className={styles.subtitle}>
            One step. Then the next. Dump the rest out of your head.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.btnPlanToday}
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-next-action'));
              }
            }}
            title="I don't know what to do — find the best next action (⌘J)"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #6a5cff)', color: '#fff', border: 'none' }}
          >
            <Compass size={13} /> What To Do?
          </button>

          <Link
            href="/focus"
            className={styles.btnSecondary}
            style={{ textDecoration: 'none' }}
          >
            <Headphones size={13} /> Focus Mode
          </Link>

          <Link
            href="/reset"
            className={styles.btnSecondary}
            title="Reorganize unfinished work without guilt"
            style={{ textDecoration: 'none' }}
          >
            <RotateCcw size={13} /> Reset Day
          </Link>

          <button
            className={styles.btnSecondary}
            onClick={() => setCurateModalOpen(true)}
            title="Curate tasks for Today"
          >
            <SlidersHorizontal size={13} /> Curate ({todayTasks.length})
          </button>
        </div>
      </header>

      {/* ── 2. Lightning Brain Dump Fast Capture Bar ── */}
      <section aria-labelledby="brain-dump-heading">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!brainDumpInput.trim()) return;
            quickDump(brainDumpInput.trim());
            setBrainDumpInput('');
            setDumpSentNotice(true);
            setTimeout(() => setDumpSentNotice(false), 2500);
          }}
          className={styles.brainDumpForm}
        >
          <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
          <input
            type="text"
            value={brainDumpInput}
            onChange={(e) => setBrainDumpInput(e.target.value)}
            placeholder="Brain Dump: Write whatever is on your mind in 2 seconds (e.g. Need to learn Blender, research clothing, fix computer)..."
            className={styles.brainDumpInput}
          />
          {dumpSentNotice && (
            <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
              ✓ In Inbox!
            </span>
          )}
          <button type="submit" className={styles.btnPlanToday} style={{ padding: '3px 10px', fontSize: '11px' }}>
            <Send size={12} /> Dump ↵
          </button>
          <Link href="/inbox" style={{ fontSize: '11px', color: 'var(--color-text-faint)', textDecoration: 'none' }}>
            <Inbox size={12} /> Inbox
          </Link>
        </form>
      </section>

      {/* ── Phase 19: Time Estimation Intelligence Insight Pill ── */}
      {timeIntelligence.topInsight && (
        <section aria-labelledby="time-intelligence-heading">
          <div className={styles.insightPill}>
            <Lightbulb size={14} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: 'var(--color-text)' }}>
              <strong>Planning Insight:</strong> {timeIntelligence.topInsight}
            </span>
          </div>
        </section>
      )}

      {/* ── 3. Next Immediate Action Banner ── */}
      <section className={styles.nextActionCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={16} style={{ color: 'var(--color-warning)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
            Next Physical Step:
          </span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
            {nextActionText}
          </span>
        </div>

        {mainFocusTask && (
          <Link
            href="/focus"
            onClick={() => selectFocusTask(mainFocusTask)}
            className={styles.btnStartAction}
          >
            <Play size={12} /> Start This Now
          </Link>
        )}
      </section>

      {/* ── 4. Main Focus Hero Centerpiece ── */}
      <section aria-labelledby="main-focus-heading">
        {mainFocusTask ? (
          <div className={styles.mainFocusCard}>
            <div className={styles.focusTopBar}>
              <span className={styles.focusBadge}>
                <Flame size={13} /> One Main Focus
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {mainFocusTask.estimatedDuration && (
                  <span className={styles.taskDurationChip}>
                    <Clock size={11} /> {mainFocusTask.estimatedDuration}m
                  </span>
                )}
                <Link
                  href="/focus"
                  onClick={() => selectFocusTask(mainFocusTask)}
                  className={styles.btnPlanToday}
                  style={{ fontSize: '11px', padding: '3px 8px', textDecoration: 'none' }}
                >
                  <Headphones size={12} /> Enter Focus Mode
                </Link>
                <button
                  className={styles.btnSecondary}
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                  onClick={() => setFocusModalOpen(true)}
                >
                  Change Focus
                </button>
              </div>
            </div>

            <div className={styles.focusTitleRow}>
              <button
                className={styles.focusCheckbox}
                onClick={(e) => handleTaskToggle(e, mainFocusTask.id)}
                title={mainFocusTask.status === 'done' ? 'Mark uncompleted' : 'Mark Main Focus Done'}
              >
                {mainFocusTask.status === 'done' ? (
                  <CheckSquare size={24} style={{ color: 'var(--color-success)' }} />
                ) : (
                  <Square size={24} />
                )}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h2
                  className={`${styles.focusTitle} ${
                    mainFocusTask.status === 'done' ? styles.done : ''
                  }`}
                  id="main-focus-heading"
                >
                  {mainFocusTask.title}
                </h2>
                {mainFocusTask.description && (
                  <p className={styles.focusDesc}>{mainFocusTask.description}</p>
                )}
              </div>
            </div>

            {/* Subtasks checklist & 1-Click Magic Breakdown */}
            <div style={{ borderLeft: '2px solid var(--color-border-subtle)', paddingLeft: 'var(--space-3)', marginLeft: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Action Steps ({mainFocusTask.subtasks?.filter((s) => s.completed).length || 0}/{mainFocusTask.subtasks?.length || 0}):
                </span>
                <button
                  style={{
                    background: 'rgba(124, 106, 255, 0.15)',
                    border: '1px solid var(--color-accent)',
                    color: 'var(--color-accent-light)',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  onClick={() => handleMagicBreakdown(mainFocusTask.id, mainFocusTask.title, mainFocusTask.description)}
                  title="Generate 5-minute easy starter steps"
                >
                  Break into 5-Min Steps
                </button>
              </div>

              {mainFocusTask.subtasks && mainFocusTask.subtasks.length > 0 ? (
                mainFocusTask.subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: 'var(--text-xs)',
                      color: sub.completed ? 'var(--color-text-faint)' : 'var(--color-text)',
                      textDecoration: sub.completed ? 'line-through' : 'none',
                    }}
                  >
                    <button
                      className={styles.taskCheckBtn}
                      onClick={(e) => handleSubtaskToggle(e, mainFocusTask.id, sub.id)}
                    >
                      {sub.completed ? <CheckSquare size={14} style={{ color: 'var(--color-success)' }} /> : <Square size={14} />}
                    </button>
                    <span>{sub.title}</span>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
                  Feeling friction starting? Click <strong>Break into 5-Min Steps</strong> to build momentum.
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.emptyFocusCard}>
            <Flame size={28} style={{ color: 'var(--color-accent)' }} />
            <div>
              <h3 className={styles.emptyFocusTitle}>What is your #1 Priority Today?</h3>
              <p className={styles.emptyFocusSubtitle}>
                Choose one single essential outcome that would make today a success.
              </p>
            </div>
            <button className={styles.btnPlanToday} onClick={() => setFocusModalOpen(true)}>
              <Plus size={14} /> Select Main Focus
            </button>
          </div>
        )}
      </section>

      {/* ── 5. Realistic Time Planning Bar ── */}
      <section className={styles.timeBudgetCard} aria-labelledby="time-budget-heading">
        <div className={styles.timeBudgetTop}>
          <div className={styles.timeBudgetPrompt}>
            <Clock size={14} style={{ color: 'var(--color-accent)' }} />
            <span>Time Available Today:</span>
          </div>

          <div className={styles.timePillGroup}>
            <button
              className={`${styles.timePill} ${availableMinutes === 60 ? styles.activeTimePill : ''}`}
              onClick={() => handleTimePillClick(60)}
            >
              1 hour
            </button>
            <button
              className={`${styles.timePill} ${availableMinutes === 120 ? styles.activeTimePill : ''}`}
              onClick={() => handleTimePillClick(120)}
            >
              2 hours
            </button>
            <button
              className={`${styles.timePill} ${availableMinutes === 240 ? styles.activeTimePill : ''}`}
              onClick={() => handleTimePillClick(240)}
            >
              4 hours
            </button>
            <button
              className={`${styles.timePill} ${availableMinutes === 480 ? styles.activeTimePill : ''}`}
              onClick={() => handleTimePillClick(480)}
            >
              8 hours
            </button>
            <button className={styles.timePill} onClick={handleCustomTimeSubmit}>
              Custom ⚙
            </button>
          </div>
        </div>

        {/* 3 Metrics: Available | Selected Tasks | Remaining */}
        <div className={styles.timeMetricsGrid}>
          <div className={styles.timeMetricBox}>
            <span className={styles.metricLabel}>Available</span>
            <span className={styles.metricValue}>{formattedAvailable}</span>
          </div>

          <div className={styles.timeMetricBox}>
            <span className={styles.metricLabel}>Selected Tasks</span>
            <span className={styles.metricValue}>{formattedSelected}</span>
          </div>

          <div className={styles.timeMetricBox}>
            <span className={styles.metricLabel}>Remaining</span>
            <span
              className={`${styles.metricValue} ${
                isOverallocated ? styles.overtime : styles.remaining
              }`}
            >
              {formattedRemaining}
            </span>
          </div>
        </div>

        {/* Visual Time Capacity Bar */}
        <div className={styles.timeBarTrack}>
          <div
            className={`${styles.timeBarFill} ${isOverallocated ? styles.overallocatedFill : ''}`}
            style={{
              width: `${Math.min(100, (totalSelectedMinutes / availableMinutes) * 100)}%`,
            }}
          />
        </div>

        {/* Gentle Over-allocation Banner */}
        {isOverallocated && (
          <div className={styles.overtimeBanner}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>Time Alert:</strong> You have {formattedAvailable} available but selected approximately {formattedSelected} of work. You can still proceed or trim non-essential items below.
            </div>
          </div>
        )}
      </section>

      {/* ── 6. Daily Habits Practice Strip ── */}
      {habits.length > 0 && (
        <section aria-labelledby="habits-strip-heading">
          <div className={styles.habitsStrip}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Repeat size={14} style={{ color: 'var(--color-accent)' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
                Daily Practice:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {habits.map((habit) => {
                const done = isHabitCompletedOnDate(habit.id, todayIso);
                return (
                  <button
                    key={habit.id}
                    onClick={(e) => handleHabitToggle(e, habit.id, todayIso)}
                    className={`${styles.habitPill} ${done ? styles.habitPillDone : ''}`}
                  >
                    {done ? <Check size={11} /> : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-text-faint)' }} />}
                    <span>{habit.title}</span>
                  </button>
                );
              })}

              <Link
                href="/habits"
                style={{ fontSize: '11px', color: 'var(--color-text-faint)', textDecoration: 'none', marginLeft: '4px' }}
              >
                All Habits ➔
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 7. Current Goals & Active Projects Momentum ── */}
      <div className={styles.curatedSectionsGrid}>
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              <Target size={14} style={{ color: 'var(--color-accent)' }} /> Current Goals ({activeGoals.length})
            </span>
            <Link href="/goals" style={{ fontSize: '11px', color: 'var(--color-text-faint)', textDecoration: 'none' }}>
              View All ➔
            </Link>
          </div>

          <div className={styles.todayTaskList}>
            {activeGoals.map((goal) => (
              <div key={goal.id} className={styles.todayTaskRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className={styles.taskRowTitle}>{goal.title}</span>
                  <div className={styles.progressBarTrack} style={{ height: '4px', marginTop: '4px' }}>
                    <div className={styles.progressBarFill} style={{ width: `${goal.progress}%` }} />
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-accent-light)', fontWeight: 600 }}>
                  {goal.progress}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              <FolderKanban size={14} style={{ color: '#38bdf8' }} /> Active Projects ({activeProjects.length})
            </span>
            <Link href="/projects" style={{ fontSize: '11px', color: 'var(--color-text-faint)', textDecoration: 'none' }}>
              View All ➔
            </Link>
          </div>

          <div className={styles.todayTaskList}>
            {activeProjects.map((project) => (
              <div key={project.id} className={styles.todayTaskRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className={styles.taskRowTitle}>{project.title}</span>
                  <div className={styles.progressBarTrack} style={{ height: '4px', marginTop: '4px' }}>
                    <div className={styles.progressBarFill} style={{ width: `${project.progress}%`, background: '#38bdf8' }} />
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>
                  {project.progress}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 8. Curated Today Action Sections ── */}
      <div className={styles.curatedSectionsGrid}>
        {/* Important Tasks */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              <Target size={14} style={{ color: '#f59e0b' }} /> Important Tasks ({importantTasks.length})
            </span>
          </div>

          <div className={styles.todayTaskList}>
            {importantTasks.length === 0 ? (
              <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', padding: 'var(--space-3) 0', textAlign: 'center' }}>
                No secondary important tasks selected for today.
              </p>
            ) : (
              importantTasks.map((task) => (
                <div key={task.id} className={styles.todayTaskRow}>
                  <button className={styles.taskCheckBtn} onClick={(e) => handleTaskToggle(e, task.id)}>
                    <Square size={16} />
                  </button>
                  <span className={styles.taskRowTitle} style={{ flex: 1 }}>{task.title}</span>
                  {task.estimatedDuration && (
                    <span className={styles.taskDurationChip}>{task.estimatedDuration}m</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Small Tasks */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              <Zap size={14} style={{ color: 'var(--color-success)' }} /> Small Tasks ({smallTasks.length})
            </span>
          </div>

          <div className={styles.todayTaskList}>
            {smallTasks.length === 0 ? (
              <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', padding: 'var(--space-3) 0', textAlign: 'center' }}>
                No small tasks queued.
              </p>
            ) : (
              smallTasks.map((task) => (
                <div key={task.id} className={styles.todayTaskRow}>
                  <button className={styles.taskCheckBtn} onClick={(e) => handleTaskToggle(e, task.id)}>
                    <Square size={16} />
                  </button>
                  <span className={styles.taskRowTitle} style={{ flex: 1 }}>{task.title}</span>
                  {task.estimatedDuration && (
                    <span className={styles.taskDurationChip}>{task.estimatedDuration}m</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Modal: Main Focus Selector ── */}
      {focusModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setFocusModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Choose Your Main Focus
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setFocusModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
              {tasks
                .filter((t) => t.status !== 'done')
                .map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--color-surface-2)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      border: mainFocusTask?.id === task.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                    }}
                    onClick={() => {
                      setMainFocus(task.id);
                      setFocusModalOpen(false);
                    }}
                  >
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', fontWeight: 500 }}>
                      {task.title}
                    </span>
                    <button className={styles.btnSecondary} style={{ padding: '2px 8px', fontSize: '11px' }}>
                      Select
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Curate Today Plan ── */}
      {curateModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setCurateModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Curate Actions for Today
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setCurateModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {tasks.map((task) => {
                const inToday = todayTasks.some((t) => t.id === task.id);
                return (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: inToday ? 'rgba(124, 106, 255, 0.1)' : 'var(--color-surface-2)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-lg)',
                      border: inToday ? '1px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', flex: 1 }}>
                      {task.title}
                    </span>
                    <button
                      className={styles.btnSecondary}
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => (inToday ? removeFromToday(task.id) : addToToday(task.id))}
                    >
                      {inToday ? '✓ Included' : '+ Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
