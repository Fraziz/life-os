'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  RotateCcw,
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  Trash2,
  ArrowRight,
  GitFork,
  CheckSquare,
  Square,
  AlertTriangle,
  Flame,
  X,
  FastForward,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useTasks } from '@/context/TaskContext';
import { useTodayPlan } from '@/context/TodayPlanContext';
import { useProjects } from '@/context/ProjectContext';
import type { Task, TaskPriority } from '@/types';
import styles from './page.module.css';

export default function ResetPage() {
  const {
    tasks,
    updateTask,
    toggleTaskDone,
    deleteTask,
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

  // Modals
  const [breakdownModalTask, setBreakdownModalTask] = useState<Task | null>(null);
  const [breakdownText, setBreakdownText] = useState('');
  const [rescheduleModalTask, setRescheduleModalTask] = useState<Task | null>(null);
  const [customDateInput, setCustomDateInput] = useState('');

  if (!tasksLoaded || !planLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Preparing your Reset workspace...
        </p>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const in3DaysStr = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
  const nextWeekStr = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];

  // 1. Today's Unfinished Tasks
  const todayUnfinishedTasks = tasks.filter(
    (t) => todayPlan.selectedTaskIds.includes(t.id) && t.status !== 'done'
  );

  // 2. Overdue Tasks (dueDate < today and not completed)
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < todayStr && t.status !== 'done'
  );

  // 3. Upcoming / Other Active Tasks (not in today and not overdue)
  const upcomingTasks = tasks.filter(
    (t) =>
      t.status !== 'done' &&
      !todayPlan.selectedTaskIds.includes(t.id) &&
      (!t.dueDate || t.dueDate >= todayStr)
  );

  // ── Bulk Actions ──
  const handlePushAllToTomorrow = () => {
    const targets = [...todayUnfinishedTasks, ...overdueTasks];
    if (targets.length === 0) return;

    targets.forEach((t) => {
      updateTask(t.id, { dueDate: tomorrowStr });
    });
    alert(`Moved ${targets.length} tasks to Tomorrow.`);
  };

  const handleCleanSlateBacklog = () => {
    if (confirm('Move all of today\'s unfinished tasks to Backlog for a fresh start?')) {
      todayUnfinishedTasks.forEach((t) => {
        removeFromToday(t.id);
        updateTask(t.id, { status: 'backlog' });
      });
    }
  };

  const handleKeepOnlyMainFocus = () => {
    if (!todayPlan.mainFocusTaskId) {
      alert('No Main Focus is currently set. Pick one first on Today screen.');
      return;
    }
    todayUnfinishedTasks
      .filter((t) => t.id !== todayPlan.mainFocusTaskId)
      .forEach((t) => {
        removeFromToday(t.id);
      });
  };

  // ── Per Task Triage Actions ──
  const handleMoveToLater = (task: Task) => {
    removeFromToday(task.id);
    updateTask(task.id, { status: 'backlog' });
  };

  const handleReschedule = (task: Task, date: string) => {
    updateTask(task.id, { dueDate: date });
    setRescheduleModalTask(null);
  };

  const handleBreakdownSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakdownModalTask || !breakdownText.trim()) return;
    const lines = breakdownText.split('\n');
    breakdownTask(breakdownModalTask.id, lines);
    setBreakdownModalTask(null);
    setBreakdownText('');
  };

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Reset My Day & Plan</h1>
          <p className={styles.subtitle}>
            Plans exist to serve you, not trap you. When life happens or tasks pile up, quickly reorganize your work with zero guilt.
          </p>
        </div>

        <Link
          href="/"
          className={styles.btnBulk}
          style={{ textDecoration: 'none', background: 'var(--color-accent)', color: '#fff' }}
        >
          Return to Today <ArrowRight size={14} />
        </Link>
      </header>

      {/* ── Compassionate Philosophy Banner ── */}
      <section className={styles.philosophyBanner}>
        <div className={styles.bannerQuoteArea}>
          <Sparkles size={24} style={{ color: 'var(--color-accent-light)', flexShrink: 0 }} />
          <div>
            <h2 className={styles.bannerQuote}>
              &ldquo;Your plan didn&apos;t work. Let&apos;s make a better one.&rdquo;
            </h2>
            <p className={styles.bannerSubtext}>
              Friction, interruptions, and energy shifts are normal. Clear the noise and re-align your actions in 60 seconds.
            </p>
          </div>
        </div>
      </section>

      {/* ── 1-Click Clean Slate Quick Actions ── */}
      <section className={styles.bulkBar}>
        <span className={styles.bulkTitle}>
          <FastForward size={14} /> 1-Click Plan Reset Presets
        </span>

        <div className={styles.bulkButtons}>
          <button className={styles.btnBulk} onClick={handlePushAllToTomorrow}>
            <Calendar size={13} /> Push Unfinished & Overdue to Tomorrow
          </button>
          <button className={styles.btnBulk} onClick={handleKeepOnlyMainFocus}>
            <Flame size={13} /> Keep Only 1 Main Focus
          </button>
          <button className={`${styles.btnBulk} ${styles.btnBulkDanger}`} onClick={handleCleanSlateBacklog}>
            <RotateCcw size={13} /> Fresh Clean Slate (Move Today to Backlog)
          </button>
        </div>
      </section>

      {/* ── 3 Stream Columns Grid ── */}
      <div className={styles.streamsGrid}>
        {/* Stream 1: Today's Unfinished Tasks */}
        <div className={styles.streamColumn}>
          <div className={styles.streamHeader}>
            <span className={styles.streamTitle}>
              <Clock size={14} style={{ color: 'var(--color-accent)' }} /> Today&apos;s Unfinished
            </span>
            <span className={styles.streamCount}>{todayUnfinishedTasks.length}</span>
          </div>

          <div className={styles.triageList}>
            {todayUnfinishedTasks.length === 0 ? (
              <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', textAlign: 'center', padding: 'var(--space-6) 0' }}>
                ✓ No unfinished tasks pending for today.
              </p>
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
                        onChange={(e) => updateTask(task.id, { priority: e.target.value as TaskPriority })}
                      >
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    {/* Triage Actions */}
                    <div className={styles.triageActions}>
                      <button
                        className={`${styles.btnAction} ${styles.completeBtn}`}
                        onClick={() => toggleTaskDone(task.id)}
                        title="Mark complete"
                      >
                        <CheckSquare size={12} /> Done
                      </button>

                      <button
                        className={styles.btnAction}
                        onClick={() => setRescheduleModalTask(task)}
                        title="Reschedule task"
                      >
                        <Calendar size={12} /> Reschedule
                      </button>

                      <button
                        className={styles.btnAction}
                        onClick={() => handleMoveToLater(task)}
                        title="Move to Backlog / Later"
                      >
                        <Clock size={12} /> Move to Later
                      </button>

                      <button
                        className={styles.btnAction}
                        onClick={() => {
                          setBreakdownModalTask(task);
                          setBreakdownText('');
                        }}
                        title="Break into smaller sub-actions"
                      >
                        <GitFork size={12} /> Break Down
                      </button>

                      <button
                        className={`${styles.btnAction} ${styles.deleteBtn}`}
                        onClick={() => {
                          if (confirm(`Delete task "${task.title}"?`)) {
                            deleteTask(task.id);
                            removeFromToday(task.id);
                          }
                        }}
                        title="Delete task"
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

        {/* Stream 2: Overdue Tasks */}
        <div className={styles.streamColumn}>
          <div className={styles.streamHeader}>
            <span className={styles.streamTitle}>
              <AlertTriangle size={14} style={{ color: '#ef4444' }} /> Overdue Tasks
            </span>
            <span className={styles.streamCount}>{overdueTasks.length}</span>
          </div>

          <div className={styles.triageList}>
            {overdueTasks.length === 0 ? (
              <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', textAlign: 'center', padding: 'var(--space-6) 0' }}>
                ✓ No overdue tasks in your workspace.
              </p>
            ) : (
              overdueTasks.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                return (
                  <article key={task.id} className={styles.triageCard}>
                    <div className={styles.cardTop}>
                      <h3 className={styles.cardTitle}>{task.title}</h3>
                    </div>

                    <div className={styles.metaRow}>
                      <span className={styles.overdueBadge}>Due {task.dueDate}</span>
                      {project && <span>• {project.title}</span>}
                    </div>

                    {/* Triage Actions */}
                    <div className={styles.triageActions}>
                      <button
                        className={`${styles.btnAction} ${styles.completeBtn}`}
                        onClick={() => toggleTaskDone(task.id)}
                        title="Mark complete"
                      >
                        <CheckSquare size={12} /> Done
                      </button>

                      <button
                        className={styles.btnAction}
                        onClick={() => handleReschedule(task, tomorrowStr)}
                        title="Move to Tomorrow"
                      >
                        + Tomorrow
                      </button>

                      <button
                        className={styles.btnAction}
                        onClick={() => setRescheduleModalTask(task)}
                        title="Reschedule task"
                      >
                        <Calendar size={12} /> Pick Date
                      </button>

                      <button
                        className={styles.btnAction}
                        onClick={() => handleMoveToLater(task)}
                        title="Drop deadline & move to Backlog"
                      >
                        Backlog
                      </button>

                      <button
                        className={`${styles.btnAction} ${styles.deleteBtn}`}
                        onClick={() => {
                          if (confirm(`Delete task "${task.title}"?`)) {
                            deleteTask(task.id);
                          }
                        }}
                        title="Delete task"
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

        {/* Stream 3: Upcoming & Next Up */}
        <div className={styles.streamColumn}>
          <div className={styles.streamHeader}>
            <span className={styles.streamTitle}>
              <Layers size={14} style={{ color: '#38bdf8' }} /> Upcoming & Backlog
            </span>
            <span className={styles.streamCount}>{upcomingTasks.length}</span>
          </div>

          <div className={styles.triageList}>
            {upcomingTasks.length === 0 ? (
              <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', textAlign: 'center', padding: 'var(--space-6) 0' }}>
                No additional upcoming tasks in backlog.
              </p>
            ) : (
              upcomingTasks.slice(0, 8).map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                return (
                  <article key={task.id} className={styles.triageCard}>
                    <div className={styles.cardTop}>
                      <h3 className={styles.cardTitle}>{task.title}</h3>
                    </div>

                    <div className={styles.metaRow}>
                      {task.dueDate && <span>Due {task.dueDate}</span>}
                      {project && <span>• {project.title}</span>}
                    </div>

                    <div className={styles.triageActions}>
                      <button
                        className={styles.btnAction}
                        onClick={() => updateTask(task.id, { dueDate: todayStr })}
                        title="Bring to Today"
                      >
                        + Pull to Today
                      </button>
                      <button
                        className={styles.btnAction}
                        onClick={() => setRescheduleModalTask(task)}
                        title="Reschedule"
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

      {/* ── Modal: Reschedule Task ── */}
      {rescheduleModalTask && (
        <div className={styles.modalOverlay} onClick={() => setRescheduleModalTask(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Reschedule: &ldquo;{rescheduleModalTask.title}&rdquo;
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setRescheduleModalTask(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <button className={styles.btnAction} style={{ padding: 'var(--space-3)' }} onClick={() => handleReschedule(rescheduleModalTask, todayStr)}>
                📅 Today ({todayStr})
              </button>
              <button className={styles.btnAction} style={{ padding: 'var(--space-3)' }} onClick={() => handleReschedule(rescheduleModalTask, tomorrowStr)}>
                ☀️ Tomorrow ({tomorrowStr})
              </button>
              <button className={styles.btnAction} style={{ padding: 'var(--space-3)' }} onClick={() => handleReschedule(rescheduleModalTask, in3DaysStr)}>
                ⚡ In 3 Days ({in3DaysStr})
              </button>
              <button className={styles.btnAction} style={{ padding: 'var(--space-3)' }} onClick={() => handleReschedule(rescheduleModalTask, nextWeekStr)}>
                🗓 Next Week ({nextWeekStr})
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'var(--space-2)' }}>
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
                Set Custom Date
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
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Break Down Stalled Task
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setBreakdownModalTask(null)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
              Decompose &ldquo;{breakdownModalTask.title}&rdquo; into bite-sized actionable steps (one step per line):
            </p>

            <form onSubmit={handleBreakdownSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <textarea
                value={breakdownText}
                onChange={(e) => setBreakdownText(e.target.value)}
                placeholder={`Step 1\nStep 2\nStep 3`}
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
                <button type="button" className={styles.btnAction} onClick={() => setBreakdownModalTask(null)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnBulk} style={{ background: 'var(--color-accent)', color: '#fff' }}>
                  Generate Steps
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
