'use client';

import React, { useState } from 'react';
import { useTasks } from '@/context/TaskContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useMilestones } from '@/context/MilestoneContext';
import type { Task, TaskStatus, TaskPriority } from '@/types';
import {
  CheckSquare,
  Square,
  Check,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Tag,
  ArrowRight,
  X,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ListTodo,
  ListTree,
  ExternalLink,
  GitFork,
  Wand2,
} from 'lucide-react';
import { playSuccessChime, playSubtaskTick, triggerDopamineBurst } from '@/utils/soundAndDopamine';
import { generateMicroBreakdown } from '@/utils/adhdBreakdown';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';

const STATUS_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
];

export default function TasksPage() {
  const {
    tasks,
    quickAddTask,
    addTask,
    updateTask,
    updateTaskStatus,
    toggleTaskDone,
    addSubtask,
    breakdownTask,
    promoteSubtaskToTask,
    toggleSubtask,
    deleteSubtask,
    deleteTask,
    resetToDefaultTasks,
    isLoaded,
  } = useTasks();

  const { projects } = useProjects();
  const { goals } = useGoals();
  const { milestones } = useMilestones();

  // Quick Add State
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState<TaskPriority>('medium');
  const [quickStatus, setQuickStatus] = useState<TaskStatus>('todo');
  const [quickProjectId, setQuickProjectId] = useState<string>('');

  // Filters & Views
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Breakdown Modal State
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
  const [breakdownTargetTask, setBreakdownTargetTask] = useState<Task | null>(null);
  const [breakdownStepsText, setBreakdownStepsText] = useState('');

  // Inline Subtask Adder states (taskId -> newSubtaskTitle)
  const [activeSubtaskTaskId, setActiveSubtaskTaskId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Modal Editor State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [modalTitle, setModalTitle] = useState('');
  const [modalDesc, setModalDesc] = useState('');
  const [modalStatus, setModalStatus] = useState<TaskStatus>('todo');
  const [modalPriority, setModalPriority] = useState<TaskPriority>('medium');
  const [modalDueDate, setModalDueDate] = useState('');
  const [modalEst, setModalEst] = useState<number | ''>('');
  const [modalAct, setModalAct] = useState<number | ''>('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalGoalId, setModalGoalId] = useState('');
  const [modalMilestoneId, setModalMilestoneId] = useState('');
  const [modalTags, setModalTags] = useState('');
  const [modalColor, setModalColor] = useState('');

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading your Tasks...
        </p>
      </div>
    );
  }

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    quickAddTask(quickTitle.trim(), {
      priority: quickPriority,
      status: quickStatus,
      projectId: quickProjectId || undefined,
    });
    setQuickTitle('');
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setModalTitle('');
    setModalDesc('');
    setModalStatus('todo');
    setModalPriority('medium');
    setModalDueDate('');
    setModalEst('');
    setModalAct('');
    setModalProjectId(projects[0]?.id || '');
    setModalGoalId('');
    setModalMilestoneId('');
    setModalTags('');
    setModalColor('');
    setModalOpen(true);
  };

  const openEditModal = (t: Task) => {
    setEditingTask(t);
    setModalTitle(t.title);
    setModalDesc(t.description || '');
    setModalStatus(t.status);
    setModalPriority(t.priority);
    setModalDueDate(t.dueDate || '');
    setModalEst(t.estimatedDuration ?? '');
    setModalAct(t.actualDuration ?? '');
    setModalProjectId(t.projectId || '');
    setModalGoalId(t.goalId || '');
    setModalMilestoneId(t.milestoneId || '');
    setModalTags(t.tags.join(', '));
    setModalColor(t.color || '');
    setModalOpen(true);
  };

  const openBreakdownModal = (t: Task) => {
    setBreakdownTargetTask(t);
    setBreakdownStepsText('');
    setBreakdownModalOpen(true);
  };

  const handleTaskToggle = (e: React.MouseEvent, taskId: string) => {
    toggleTaskDone(taskId);
    playSuccessChime();
    triggerDopamineBurst(e.clientX, e.clientY);
  };

  const handleSubtaskToggleDopamine = (e: React.MouseEvent, taskId: string, subId: string) => {
    toggleSubtask(taskId, subId);
    playSubtaskTick();
    triggerDopamineBurst(e.clientX, e.clientY);
  };

  const handleDirectMagicBreakdown = (taskId: string, title: string, desc?: string) => {
    const steps = generateMicroBreakdown(title, desc);
    breakdownTask(taskId, steps);
    playSuccessChime();
    triggerDopamineBurst();
  };

  const handleAutoFillBreakdownModal = () => {
    if (!breakdownTargetTask) return;
    const steps = generateMicroBreakdown(breakdownTargetTask.title, breakdownTargetTask.description);
    setBreakdownStepsText(steps.join('\n'));
    playSubtaskTick();
  };

  const handleBreakdownSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakdownTargetTask || !breakdownStepsText.trim()) return;

    const lines = breakdownStepsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    breakdownTask(breakdownTargetTask.id, lines);
    playSuccessChime();
    triggerDopamineBurst();
    setBreakdownModalOpen(false);
    setBreakdownStepsText('');
    setBreakdownTargetTask(null);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) return;

    const parsedTags = modalTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (editingTask) {
      updateTask(editingTask.id, {
        title: modalTitle.trim(),
        description: modalDesc.trim() || undefined,
        status: modalStatus,
        priority: modalPriority,
        dueDate: modalDueDate || undefined,
        estimatedDuration: typeof modalEst === 'number' ? modalEst : undefined,
        actualDuration: typeof modalAct === 'number' ? modalAct : undefined,
        projectId: modalProjectId || undefined,
        goalId: modalGoalId || undefined,
        milestoneId: modalMilestoneId || undefined,
        tags: parsedTags,
        color: modalColor || undefined,
      });
    } else {
      addTask({
        title: modalTitle.trim(),
        description: modalDesc.trim() || undefined,
        status: modalStatus,
        priority: modalPriority,
        dueDate: modalDueDate || undefined,
        estimatedDuration: typeof modalEst === 'number' ? modalEst : undefined,
        actualDuration: typeof modalAct === 'number' ? modalAct : undefined,
        projectId: modalProjectId || undefined,
        goalId: modalGoalId || undefined,
        milestoneId: modalMilestoneId || undefined,
        tags: parsedTags,
        color: modalColor || undefined,
        subtasks: [],
      });
    }
    setModalOpen(false);
  };

  const handleAddSubtaskSubmit = (taskId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    addSubtask(taskId, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
    setActiveSubtaskTaskId(null);
  };

  const filteredTasks = tasks.filter((t) => {
    if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Tasks & Actions</h1>
          <p className={styles.subtitle}>
            Daily execution engine. Move tasks across Backlog, To Do, Doing, and Done with frictionless Quick Add and duration tracking.
          </p>
        </div>

        <button className={styles.quickAddBtn} onClick={openCreateModal}>
          <Plus size={16} /> Detailed Task
        </button>
      </header>

      {/* ── Quick Add Bar ── */}
      <form className={styles.quickAddCard} onSubmit={handleQuickAddSubmit}>
        <div className={styles.quickAddRow}>
          <Plus size={20} style={{ color: 'var(--color-accent)' }} />
          <input
            type="text"
            className={styles.quickAddInput}
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Type a task and press Enter to add instantly (e.g. Refactor movement jump curve)..."
            autoFocus
          />
          <button type="submit" className={styles.quickAddBtn}>
            Quick Add ↵
          </button>
        </div>

        <div className={styles.quickAddMetaRow}>
          <div className={styles.quickAddPills}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>Optional:</span>
            <select
              className={styles.pillSelect}
              value={quickStatus}
              onChange={(e) => setQuickStatus(e.target.value as TaskStatus)}
            >
              <option value="todo">Stage: To Do</option>
              <option value="doing">Stage: Doing</option>
              <option value="backlog">Stage: Backlog</option>
              <option value="done">Stage: Done</option>
            </select>

            <select
              className={styles.pillSelect}
              value={quickPriority}
              onChange={(e) => setQuickPriority(e.target.value as TaskPriority)}
            >
              <option value="medium">Priority: Medium</option>
              <option value="high">Priority: High</option>
              <option value="urgent">Priority: Urgent</option>
              <option value="low">Priority: Low</option>
            </select>

            <select
              className={styles.pillSelect}
              value={quickProjectId}
              onChange={(e) => setQuickProjectId(e.target.value)}
            >
              <option value="">No Project (General)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  Project: {p.title}
                </option>
              ))}
            </select>
          </div>

          <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
            Tip: Press <kbd style={{ background: 'var(--color-surface-2)', padding: '2px 4px', borderRadius: '4px' }}>Enter</kbd> to save
          </span>
        </div>
      </form>

      {/* ── Controls Bar ── */}
      <div className={styles.controlsBar}>
        <div className={styles.filtersGroup}>
          <select
            className={styles.selectFilter}
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <select
            className={styles.selectFilter}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* ── Kanban Grid: Backlog | To Do | Doing | Done ── */}
      <div className={styles.kanbanGrid}>
        {STATUS_COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          const columnAccents: Record<string, string> = {
            backlog: '#64748b',
            todo: '#38bdf8',
            doing: '#f59e0b',
            done: '#22d3a5',
          };
          const colAccent = columnAccents[col.id] || '#7c6fff';

          return (
            <div key={col.id} className={styles.column}>
              <div className={styles.columnHeader} style={{ borderBottom: `2px solid ${colAccent}` }}>
                <span className={styles.columnTitle} style={{ color: colAccent }}>
                  {col.label}
                </span>
                <span className={styles.columnCount}>{colTasks.length}</span>
              </div>

              <div className={styles.taskList}>
                {colTasks.length === 0 ? (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', textAlign: 'center', padding: 'var(--space-6) 0' }}>
                    No {col.label.toLowerCase()} tasks
                  </p>
                ) : (
                  colTasks.map((task) => {
                    const parentProject = projects.find((p) => p.id === task.projectId);
                    const isDone = task.status === 'done';
                    const isCompound = task.isCompound || task.subtasks.length > 0;
                    const completedSubs = task.subtasks.filter((s) => s.completed).length;
                    const subPercent = task.subtasks.length > 0 ? Math.round((completedSubs / task.subtasks.length) * 100) : 0;

                    // Color accent: left border using task.color; inverted/muted when done
                    const accentColor = task.color || null;
                    const cardBorderLeft = accentColor
                      ? `4px solid ${isDone ? 'rgba(120,120,140,0.35)' : accentColor}`
                      : isCompound
                      ? `4px solid var(--color-accent)`
                      : undefined;
                    const cardBg = accentColor && !isDone
                      ? `linear-gradient(135deg, var(--color-surface) 0%, ${accentColor}18 100%)`
                      : undefined;

                    return (
                      <article
                        key={task.id}
                        className={`${styles.taskCard} ${isDone ? styles.doneCard : ''}`}
                        style={{ borderLeft: cardBorderLeft, background: cardBg }}
                      >
                        <div className={styles.taskTopRow}>
                          <div className={styles.checkTitleRow}>
                            <button
                              className={`${styles.checkboxBtn} ${isDone ? styles.checked : ''}`}
                              onClick={(e) => handleTaskToggle(e, task.id)}
                              title={isDone ? 'Mark uncompleted' : 'Mark done'}
                            >
                              {isDone ? <CheckSquare size={18} /> : <Square size={18} />}
                            </button>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                <h3 className={`${styles.taskTitle} ${isDone ? styles.strikethrough : ''}`}>
                                  {task.title}
                                </h3>
                                {isCompound && (
                                  <span className={styles.compoundBadge}>
                                    <ListTree size={10} /> Compound
                                  </span>
                                )}
                              </div>
                              {task.description && (
                                <p className={styles.taskDesc}>{task.description}</p>
                              )}
                            </div>
                          </div>

                          <span className={`${styles.priorityBadge} ${styles[task.priority]}`}>
                            {task.priority}
                          </span>
                        </div>

                        {/* ── Subtask Progress Mini-bar ── */}
                        {task.subtasks.length > 0 && (
                          <div>
                            <div className={styles.subtaskProgressHeader}>
                              <span>Steps Breakdown</span>
                              <span style={{ fontWeight: 600 }}>{completedSubs}/{task.subtasks.length} ({subPercent}%)</span>
                            </div>
                            <div className={styles.subtaskMiniBar}>
                              <div
                                className={styles.subtaskMiniFill}
                                style={{ width: `${subPercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* ── Subtasks Section ── */}
                        {task.subtasks.length > 0 && (
                          <div className={styles.subtasksBox}>
                            {task.subtasks.map((sub) => (
                              <div
                                key={sub.id}
                                className={`${styles.subtaskRow} ${sub.completed ? styles.done : ''}`}
                              >
                                <button
                                  className={styles.checkboxBtn}
                                  onClick={(e) => handleSubtaskToggleDopamine(e, task.id, sub.id)}
                                >
                                  {sub.completed ? <CheckSquare size={13} /> : <Square size={13} />}
                                </button>
                                <span style={{ flex: 1 }}>{sub.title}</span>
                                
                                {/* Promote subtask to standalone task */}
                                <button
                                  className={styles.actionBtn}
                                  onClick={() => {
                                    if (confirm(`Promote "${sub.title}" to a standalone task?`)) {
                                      promoteSubtaskToTask(task.id, sub.id);
                                    }
                                  }}
                                  title="Promote to standalone task"
                                >
                                  <ExternalLink size={12} />
                                </button>

                                <button
                                  className={styles.actionBtn}
                                  onClick={() => deleteSubtask(task.id, sub.id)}
                                  title="Remove subtask"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ── Inline Subtask & Breakdown Buttons ── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {activeSubtaskTaskId === task.id ? (
                            <form
                              onSubmit={(e) => handleAddSubtaskSubmit(task.id, e)}
                              className={styles.subtaskAddForm}
                              style={{ flex: 1 }}
                            >
                              <input
                                type="text"
                                className={styles.subtaskAddInput}
                                value={newSubtaskTitle}
                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                placeholder="New subtask..."
                                autoFocus
                              />
                              <button type="submit" className={styles.actionBtn} title="Save subtask">
                                <Check size={13} />
                              </button>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => setActiveSubtaskTaskId(null)}
                              >
                                <X size={13} />
                              </button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--color-text-faint)',
                                fontSize: '11px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              onClick={() => {
                                setActiveSubtaskTaskId(task.id);
                                setNewSubtaskTitle('');
                              }}
                            >
                              <Plus size={12} /> Add Step
                            </button>
                          )}

                          <button
                            type="button"
                            style={{
                              background: 'rgba(124, 106, 255, 0.12)',
                              border: '1px solid rgba(124, 106, 255, 0.3)',
                              color: 'var(--color-accent-light)',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            onClick={() => handleDirectMagicBreakdown(task.id, task.title, task.description)}
                            title="1-Click Micro-Breakdown into 5-minute easy steps"
                          >
                            5-Min Steps
                          </button>

                          <button
                            type="button"
                            className={styles.btnBreakdown}
                            onClick={() => openBreakdownModal(task)}
                            title="Quick multi-line task breakdown"
                          >
                            <GitFork size={12} /> Breakdown
                          </button>
                        </div>

                        {/* ── Chips & Project Tags ── */}
                        {(parentProject || task.tags.length > 0) && (
                          <div className={styles.tagsRow}>
                            {parentProject && (
                              <span className={styles.parentProjectChip}>
                                {parentProject.title}
                              </span>
                            )}
                            {task.tags.map((tg) => (
                              <span key={tg} className={styles.tagChip}>
                                #{tg}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* ── Card Footer ── */}
                        <div className={styles.taskFooter}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {task.dueDate && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Calendar size={12} /> {task.dueDate}
                              </span>
                            )}

                            {task.estimatedDuration && (
                              <span className={styles.durationBadge} title="Estimated vs Actual Duration">
                                <Clock size={12} /> {task.actualDuration || 0}/{task.estimatedDuration}m
                              </span>
                            )}
                          </div>

                          <div className={styles.cardActions}>
                            {/* Quick Status Shift */}
                            {col.id !== 'backlog' && (
                              <button
                                className={styles.actionBtn}
                                onClick={() => {
                                  const prev: Record<TaskStatus, TaskStatus> = {
                                    done: 'doing',
                                    doing: 'todo',
                                    todo: 'backlog',
                                    backlog: 'backlog',
                                  };
                                  updateTaskStatus(task.id, prev[task.status]);
                                }}
                                title="Move left"
                              >
                                ←
                              </button>
                            )}

                            {col.id !== 'done' && (
                              <button
                                className={styles.actionBtn}
                                onClick={() => {
                                  const next: Record<TaskStatus, TaskStatus> = {
                                    backlog: 'todo',
                                    todo: 'doing',
                                    doing: 'done',
                                    done: 'done',
                                  };
                                  updateTaskStatus(task.id, next[task.status]);
                                }}
                                title="Move right"
                              >
                                →
                              </button>
                            )}

                            <EntityFiles variant="icon" entityType="task" entityId={task.id} title={task.title} />

                            <button
                              className={styles.actionBtn}
                              onClick={() => openEditModal(task)}
                              title="Edit Task"
                            >
                              <Edit2 size={14} />
                            </button>

                            <button
                              className={`${styles.actionBtn} ${styles.deleteBtn}`}
                              onClick={() => {
                                if (confirm(`Delete Task "${task.title}"?`)) {
                                  deleteTask(task.id);
                                }
                              }}
                              title="Delete Task"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal Dialog for Full Edit / Create ── */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingTask ? 'Edit Task' : 'Detailed Task Creation'}
              </h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="modal-title">Task Title</label>
                <input
                  id="modal-title"
                  type="text"
                  className={styles.input}
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="Task title..."
                  required
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="modal-desc">Description (Optional)</label>
                <textarea
                  id="modal-desc"
                  className={styles.textarea}
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  placeholder="Additional context or details..."
                />
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="modal-status">Status</label>
                  <select
                    id="modal-status"
                    className={styles.select}
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value as TaskStatus)}
                  >
                    <option value="backlog">Backlog</option>
                    <option value="todo">To Do</option>
                    <option value="doing">Doing</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="modal-priority">Priority</label>
                  <select
                    id="modal-priority"
                    className={styles.select}
                    value={modalPriority}
                    onChange={(e) => setModalPriority(e.target.value as TaskPriority)}
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
                  <label className={styles.label} htmlFor="modal-project">Parent Project</label>
                  <select
                    id="modal-project"
                    className={styles.select}
                    value={modalProjectId}
                    onChange={(e) => setModalProjectId(e.target.value)}
                  >
                    <option value="">-- No Project --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="modal-due">Due Date</label>
                  <input
                    id="modal-due"
                    type="date"
                    className={styles.input}
                    value={modalDueDate}
                    onChange={(e) => setModalDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="modal-est">Estimated Duration (Minutes)</label>
                  <input
                    id="modal-est"
                    type="number"
                    min="0"
                    step="5"
                    className={styles.input}
                    value={modalEst}
                    onChange={(e) => setModalEst(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="e.g. 30"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="modal-act">Actual Duration (Minutes)</label>
                  <input
                    id="modal-act"
                    type="number"
                    min="0"
                    step="5"
                    className={styles.input}
                    value={modalAct}
                    onChange={(e) => setModalAct(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="e.g. 45"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="modal-tags">Tags (Comma-separated)</label>
                <input
                  id="modal-tags"
                  type="text"
                  className={styles.input}
                  value={modalTags}
                  onChange={(e) => setModalTags(e.target.value)}
                  placeholder="e.g. physics, gameplay, sound"
                />
              </div>

              {/* ── Color Accent Picker ── */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Card Accent Color (Optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {[
                    { color: '', label: 'None' },
                    { color: '#7c6fff', label: 'Violet' },
                    { color: '#38bdf8', label: 'Sky' },
                    { color: '#22d3a5', label: 'Teal' },
                    { color: '#f59e0b', label: 'Amber' },
                    { color: '#ef4444', label: 'Red' },
                    { color: '#ec4899', label: 'Pink' },
                    { color: '#a855f7', label: 'Purple' },
                    { color: '#84cc16', label: 'Lime' },
                    { color: '#fb923c', label: 'Orange' },
                  ].map(({ color, label }) => (
                    <button
                      key={color || 'none'}
                      type="button"
                      title={label}
                      onClick={() => setModalColor(color)}
                      style={{
                        width: color ? '28px' : 'auto',
                        height: '28px',
                        borderRadius: color ? '50%' : 'var(--radius-md)',
                        padding: color ? 0 : '0 10px',
                        background: color || 'var(--color-surface-2)',
                        border: modalColor === color
                          ? `3px solid white`
                          : `2px solid transparent`,
                        outline: modalColor === color ? `2px solid ${color || 'var(--color-accent)'}` : 'none',
                        outlineOffset: '2px',
                        cursor: 'pointer',
                        fontSize: color ? 0 : '11px',
                        color: 'var(--color-text-muted)',
                        fontWeight: 600,
                        transition: 'all 0.15s',
                      }}
                    >
                      {!color && 'None'}
                    </button>
                  ))}
                </div>
                {modalColor && (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginTop: '4px' }}>
                    Card will get a <span style={{ color: modalColor, fontWeight: 700 }}>colored accent</span> bar. Done tasks show it muted automatically.
                  </p>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.quickAddBtn}>
                  {editingTask ? 'Save Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manual Task Breakdown Modal ── */}
      {breakdownModalOpen && breakdownTargetTask && (
        <div className={styles.modalOverlay} onClick={() => setBreakdownModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>
                  Break Down: &ldquo;{breakdownTargetTask.title}&rdquo;
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0, marginTop: '4px' }}>
                  Decompose this large or vague task into concrete, bite-sized actionable steps.
                </p>
              </div>
              <button className={styles.closeBtn} onClick={() => setBreakdownModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBreakdownSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className={styles.formGroup}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label className={styles.label} style={{ margin: 0 }}>Actionable Steps (One step per line)</label>
                  <button
                    type="button"
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
                    onClick={handleAutoFillBreakdownModal}
                  >
                    Auto-Suggest 5-Min Steps
                  </button>
                </div>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '160px', fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-xs)' }}
                  value={breakdownStepsText}
                  onChange={(e) => setBreakdownStepsText(e.target.value)}
                  placeholder={`Create terrain\nAdd trees\nAdd buildings\nAdd lighting\nTest environment`}
                  autoFocus
                  required
                />
              </div>

              <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                💡 <strong>Tip:</strong> Click <strong>Auto-Suggest 5-Min Steps</strong> or paste multi-line step lists. Each line will become a trackable subtask checklist item on this card.
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setBreakdownModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.quickAddBtn}>
                  Generate {breakdownStepsText.split('\n').filter((l) => l.trim().length > 0).length || 0} Steps
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
