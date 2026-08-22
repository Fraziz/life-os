'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  CheckCircle2,
  Clock,
  Target,
  Flag,
  FolderKanban,
  CheckSquare,
  Repeat,
  Headphones,
  Sparkles,
  ArrowRight,
  ListFilter,
  Flame,
  Calendar,
} from 'lucide-react';
import { useGoals } from '@/context/GoalContext';
import { useMilestones } from '@/context/MilestoneContext';
import { useProjects } from '@/context/ProjectContext';
import { useTasks } from '@/context/TaskContext';
import { useFocus } from '@/context/FocusContext';
import { useHabits } from '@/context/HabitContext';
import styles from './page.module.css';

type Perspective = 'where_am_i' | 'accomplished' | 'unfinished';

export default function ProgressPage() {
  const { goals, isLoaded: goalsLoaded } = useGoals();
  const { milestones, isLoaded: msLoaded } = useMilestones();
  const { projects, isLoaded: projLoaded } = useProjects();
  const { tasks, isLoaded: tasksLoaded } = useTasks();
  const { focusHistory, isLoaded: focusLoaded } = useFocus();
  const { habits, isLoaded: habitsLoaded } = useHabits();

  const [activeTab, setActiveTab] = useState<Perspective>('where_am_i');

  const isLoaded = goalsLoaded && msLoaded && projLoaded && tasksLoaded && focusLoaded && habitsLoaded;

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Aggregating your life progress...
        </p>
      </div>
    );
  }

  // ── Computations ──
  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.status === 'completed');
  const inProgressGoals = goals.filter((g) => g.status === 'in-progress');

  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((m) => m.status === 'completed');
  const upcomingMilestones = milestones.filter((m) => m.status !== 'completed');

  const totalProjects = projects.length;
  const completedProjects = projects.filter((p) => p.status === 'completed');
  const activeProjects = projects.filter((p) => p.status === 'active');

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done');
  const unfinishedTasks = tasks.filter((t) => t.status !== 'done');

  // Focus & Time Metrics
  const totalFocusMinutes = focusHistory.reduce((acc, sess) => acc + sess.durationMinutes, 0);
  const totalActualMinutes = tasks.reduce((acc, t) => acc + (t.actualDuration || 0), 0);
  const totalPlannedMinutes = tasks.reduce((acc, t) => acc + (t.estimatedDuration || 0), 0);

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Meaningful Progress & Review</h1>
          <p className={styles.subtitle}>
            A clear, grounded reflection on your trajectory. Direct answers to where you are, what you have accomplished, and what remains ahead.
          </p>
        </div>

        <Link
          href="/"
          className={styles.btnSecondary}
          style={{ textDecoration: 'none' }}
        >
          Return to Today <ArrowRight size={13} />
        </Link>
      </header>

      {/* ── The 3 Core Navigation Perspective Tabs ── */}
      <div className={styles.perspectiveTabs}>
        <button
          className={`${styles.perspectiveTab} ${activeTab === 'where_am_i' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('where_am_i')}
        >
          <Compass size={14} /> 1. Where am I?
        </button>
        <button
          className={`${styles.perspectiveTab} ${activeTab === 'accomplished' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('accomplished')}
        >
          <CheckCircle2 size={14} /> 2. What have I accomplished?
        </button>
        <button
          className={`${styles.perspectiveTab} ${activeTab === 'unfinished' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('unfinished')}
        >
          <Clock size={14} /> 3. What is still unfinished?
        </button>
      </div>

      {/* ── Snapshot Summary Row ── */}
      <section className={styles.statsSummaryGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: 'var(--color-accent-light)' }}>
            <Target size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{completedGoals.length} / {totalGoals}</span>
            <span className={styles.statLabel}>Goals Achieved</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#38bdf8' }}>
            <FolderKanban size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{completedProjects.length} / {totalProjects}</span>
            <span className={styles.statLabel}>Projects Completed</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: 'var(--color-success)' }}>
            <CheckSquare size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{completedTasks.length} / {totalTasks}</span>
            <span className={styles.statLabel}>Tasks Finished</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#a855f7' }}>
            <Headphones size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{formatHours(totalFocusMinutes)}</span>
            <span className={styles.statLabel}>Logged Deep Focus</span>
          </div>
        </div>
      </section>

      {/* ── PERSPECTIVE 1: WHERE AM I? ── */}
      {activeTab === 'where_am_i' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Time Reality Check */}
          <section className={styles.timeRealityCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: 'var(--color-accent)' }} />
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                Time Reality Check
              </h2>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
              Comparing planned time estimations against logged deep focus and actual tracked effort.
            </p>

            <div className={styles.timeRealityMetrics}>
              <div className={styles.timeRealityBox}>
                <span className={styles.timeRealityBoxVal}>{formatHours(totalPlannedMinutes)}</span>
                <span className={styles.timeRealityBoxLabel}>Estimated / Planned Work</span>
              </div>
              <div className={styles.timeRealityBox}>
                <span className={styles.timeRealityBoxVal} style={{ color: 'var(--color-accent-light)' }}>
                  {formatHours(totalFocusMinutes)}
                </span>
                <span className={styles.timeRealityBoxLabel}>Deep Focus Time Logged</span>
              </div>
              <div className={styles.timeRealityBox}>
                <span className={styles.timeRealityBoxVal} style={{ color: 'var(--color-success)' }}>
                  {formatHours(totalActualMinutes)}
                </span>
                <span className={styles.timeRealityBoxLabel}>Total Actual Effort Tracked</span>
              </div>
            </div>
          </section>

          {/* Active Goals Momentum */}
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <Target size={16} style={{ color: 'var(--color-accent)' }} /> Active Goals ({inProgressGoals.length})
              </span>
              <Link href="/goals" style={{ fontSize: '11px', color: 'var(--color-text-faint)', textDecoration: 'none' }}>
                View all goals ➔
              </Link>
            </div>

            <div className={styles.cardsGrid}>
              {inProgressGoals.map((goal) => (
                <article key={goal.id} className={styles.itemCard}>
                  <div className={styles.itemTitleRow}>
                    <h3 className={styles.itemTitle}>{goal.title}</h3>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-accent-light)' }}>
                      {goal.progress}%
                    </span>
                  </div>

                  <div className={styles.progressBarTrack}>
                    <div className={styles.progressBarFill} style={{ width: `${goal.progress}%` }} />
                  </div>

                  <div className={styles.cardFooter}>
                    <span>Horizon: {goal.horizon}</span>
                    <span>Priority: {goal.priority}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Active Projects Momentum */}
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <FolderKanban size={16} style={{ color: '#38bdf8' }} /> Active Projects ({activeProjects.length})
              </span>
              <Link href="/projects" style={{ fontSize: '11px', color: 'var(--color-text-faint)', textDecoration: 'none' }}>
                View all projects ➔
              </Link>
            </div>

            <div className={styles.cardsGrid}>
              {activeProjects.map((project) => (
                <article key={project.id} className={styles.itemCard}>
                  <div className={styles.itemTitleRow}>
                    <h3 className={styles.itemTitle}>{project.title}</h3>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8' }}>
                      {project.progress}%
                    </span>
                  </div>

                  <div className={styles.progressBarTrack}>
                    <div className={styles.progressBarFill} style={{ width: `${project.progress}%`, background: '#38bdf8' }} />
                  </div>

                  <div className={styles.cardFooter}>
                    <span>Priority: {project.priority}</span>
                    {project.dueDate && <span>Due {project.dueDate}</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── PERSPECTIVE 2: WHAT HAVE I ACCOMPLISHED? ── */}
      {activeTab === 'accomplished' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Completed Tasks List */}
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <CheckSquare size={16} style={{ color: 'var(--color-success)' }} /> Completed Tasks ({completedTasks.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {completedTasks.length === 0 ? (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  No completed tasks yet. Finish actions in Today or Tasks Kanban to build your accomplishment record.
                </p>
              ) : (
                completedTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-3) var(--space-4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                        {t.title}
                      </span>
                    </div>

                    <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
                      {t.completedAt ? new Date(t.completedAt).toLocaleDateString() : 'Completed'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Logged Focus Sessions */}
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <Headphones size={16} style={{ color: '#a855f7' }} /> Focus Sessions Logged ({focusHistory.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {focusHistory.map((sess) => (
                <div
                  key={sess.id}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-3) var(--space-4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                      {sess.taskTitle}
                    </span>
                    {sess.notes && (
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0, fontStyle: 'italic' }}>
                        &ldquo;{sess.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--color-accent-light)', fontWeight: 600 }}>
                    {sess.durationMinutes} mins
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── PERSPECTIVE 3: WHAT IS STILL UNFINISHED? ── */}
      {activeTab === 'unfinished' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Unfinished Deliverables */}
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <Flag size={16} style={{ color: '#f59e0b' }} /> Upcoming Milestones ({upcomingMilestones.length})
              </span>
            </div>

            <div className={styles.cardsGrid}>
              {upcomingMilestones.map((ms) => (
                <article key={ms.id} className={styles.itemCard}>
                  <div className={styles.itemTitleRow}>
                    <h3 className={styles.itemTitle}>{ms.title}</h3>
                    <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>
                      {ms.progress}%
                    </span>
                  </div>

                  <div className={styles.progressBarTrack}>
                    <div className={styles.progressBarFill} style={{ width: `${ms.progress}%`, background: '#f59e0b' }} />
                  </div>

                  <div className={styles.cardFooter}>
                    <span>Target: {ms.targetDate || 'No date set'}</span>
                    <span>Status: {ms.status}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Pending Tasks Backlog */}
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <Clock size={16} style={{ color: 'var(--color-accent)' }} /> Open & Stalled Tasks ({unfinishedTasks.length})
              </span>
              <Link href="/tasks" style={{ fontSize: '11px', color: 'var(--color-text-faint)', textDecoration: 'none' }}>
                Open Kanban board ➔
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {unfinishedTasks.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-3) var(--space-4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                  }}
                >
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                    {t.title}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                      {t.status}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-accent-light)' }}>
                      {t.estimatedDuration ? `${t.estimatedDuration}m` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
