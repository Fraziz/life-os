'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProjects } from '@/context/ProjectContext';
import { useMilestones } from '@/context/MilestoneContext';
import { useGoals } from '@/context/GoalContext';
import { useDreams } from '@/context/DreamContext';
import { useTasks } from '@/context/TaskContext';
import { useLifeAreas } from '@/context/LifeAreaContext';
import type { Project, ProjectStatus, ProjectPriority } from '@/types';
import {
  Folder,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Sparkles,
  Target,
  Flag,
  X,
  RotateCcw,
  LayoutList,
  LayoutGrid,
  Columns,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Zap,
  CheckSquare,
  Bell,
} from 'lucide-react';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';
import PageSkeleton from '@/components/ui/PageSkeleton';
import AdhdHierarchyModal from '@/components/guidance/AdhdHierarchyModal';
import { playSuccessChime } from '@/utils/soundAndDopamine';
import AutoLinkText from '@/components/ui/AutoLinkText';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
  active:    { label: 'Active',       color: '#3b82f6' },
  planning:  { label: 'Planning',     color: '#a594ff' },
  'on-hold': { label: 'On Hold',      color: '#f59e0b' },
  completed: { label: 'Completed ✓',  color: '#10b981' },
  cancelled: { label: 'Cancelled',    color: '#6b7280' },
};

const BOARD_COLS: ProjectStatus[] = ['planning', 'active', 'on-hold', 'completed'];

type ViewMode = 'notes' | 'list' | 'board' | 'calendar';

function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div style={{ height: '5px', background: 'var(--color-surface-2)', borderRadius: '99px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${value}%`, background: color || 'var(--color-accent)', borderRadius: '99px', transition: 'width 0.3s' }} />
    </div>
  );
}

/** Compact row used in List and Board views */
function ProjectRow({
  project,
  onEdit,
  onDelete,
  onProgressChange,
  parentGoalTitle,
  compact,
  highlightId,
  onAddBridgeTask,
}: {
  project: Project;
  onEdit: (p: Project) => void;
  onDelete: (id: string) => void;
  onProgressChange: (id: string, v: number) => void;
  parentGoalTitle?: string;
  compact?: boolean;
  highlightId?: string | null;
  onAddBridgeTask?: (p: Project) => void;
}) {
  const { toggleProjectReminder } = useProjects();
  const { tasks } = useTasks();
  const linkedTasks = tasks.filter(
    (t) =>
      t.projectId === project.id ||
      (t.tags && t.tags.some((tag) => tag.trim().toLowerCase() === project.title.trim().toLowerCase()))
  );
  const doneTasksCount = linkedTasks.filter((t) => t.status === 'done').length;

  const cfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;
  const accent = project.color || cfg.color;
  const isHighlighted = highlightId === project.id;

  return (
    <article
      id={`project-card-${project.id}`}
      style={{
        display: 'flex',
        gap: '12px',
        padding: compact ? '10px 14px' : '14px 18px',
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-surface)',
        borderRadius: compact ? '10px' : '12px',
        marginBottom: compact ? '6px' : '8px',
        transition: 'all 0.2s ease',
        boxShadow: isHighlighted ? '0 0 0 2px var(--color-accent)' : undefined,
        borderColor: isHighlighted ? 'var(--color-accent)' : undefined,
      }}
    >
      {/* Main Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: compact ? '13px' : '14px', color: 'var(--color-text)' }}>
            <AutoLinkText text={project.title} />
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '1px 8px', borderRadius: '99px',
            background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40`,
          }}>
            {cfg.label}
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
            color: project.priority === 'urgent' ? '#ef4444' : project.priority === 'high' ? '#f59e0b' : 'var(--color-text-faint)',
          }}>
            {project.priority}
          </span>
        </div>

        {!compact && project.description && (
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
            <AutoLinkText text={project.description} />
          </p>
        )}

        {parentGoalTitle && (
          <span style={{ fontSize: '11px', color: 'var(--color-text-faint)', display: 'block', marginTop: '3px' }}>
            ↳ {parentGoalTitle}
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
          <div style={{ flex: 1 }}>
            <ProgressBar value={project.progress} color={accent} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: accent, minWidth: '30px', textAlign: 'right' }}>
            {project.progress}%
          </span>
          {linkedTasks.length > 0 && (
            <span
              className={styles.autoBadge}
              title={`Auto-synced: ${doneTasksCount}/${linkedTasks.length} tasks completed`}
            >
              Auto ({doneTasksCount}/{linkedTasks.length})
            </span>
          )}
          <input
            type="range" min="0" max="100" step="5"
            value={project.progress}
            disabled={linkedTasks.length > 0}
            onChange={(e) => onProgressChange(project.id, parseInt(e.target.value))}
            style={{
              width: '60px',
              accentColor: accent,
              cursor: linkedTasks.length > 0 ? 'not-allowed' : 'pointer',
              opacity: linkedTasks.length > 0 ? 0.45 : 1,
            }}
            title={linkedTasks.length > 0 ? `Auto-calculated from ${doneTasksCount}/${linkedTasks.length} tasks` : "Update progress"}
          />
        </div>

        {!compact && (
          project.dueDate ? (
            <span style={{ fontSize: '11px', color: 'var(--color-text-faint)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <Calendar size={11} /> Due {project.dueDate}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onEdit(project)}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '2px 6px',
                color: 'var(--color-text-faint)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '6px',
              }}
              title="Add to Calendar"
              aria-label="Add to Calendar"
            >
              <Calendar size={12} />
            </button>
          )
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
        <EntityFiles variant="icon" entityType="project" entityId={project.id} title={project.title} />
        {onAddBridgeTask && (
          <button
            type="button"
            onClick={() => onAddBridgeTask(project)}
            title="1-Click: Create a 15-minute action task in this Project"
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '6px',
              padding: '3px 6px',
              color: '#34d399',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            + Task
          </button>
        )}
        <button
          type="button"
          onClick={() => toggleProjectReminder(project.id)}
          title={project.isReminder ? "Remove reminder (clears from Today)" : "Set Reminder (Show on Today)"}
          style={{
            ...btnStyle,
            color: project.isReminder ? 'var(--color-warning, #f59e0b)' : 'var(--color-text-faint)',
            background: project.isReminder ? 'var(--color-surface-2)' : 'transparent',
          }}
        >
          <Bell size={13} style={project.isReminder ? { color: 'var(--color-warning, #f59e0b)' } : undefined} />
        </button>
        <button onClick={() => onEdit(project)} title="Edit" style={btnStyle}>
          <Edit2 size={13} />
        </button>
        <button onClick={() => { if (confirm(`Delete "${project.title}"?`)) onDelete(project.id); }} title="Delete" style={{ ...btnStyle, color: 'var(--color-danger)' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none',
  color: 'var(--color-text-faint)', cursor: 'pointer',
  padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center',
};

/** ── Notes / Masonry Grid View (Google Keep-style, auto-adjusting rows & columns) ── */
function NotesView({ projects, goals, onEdit, onDelete, onProgressChange, highlightId, onAddBridgeTask }: {
  projects: Project[];
  goals: { id: string; title: string }[];
  onEdit: (p: Project) => void;
  onDelete: (id: string) => void;
  onProgressChange: (id: string, v: number) => void;
  highlightId?: string | null;
  onAddBridgeTask?: (p: Project) => void;
}) {
  const { toggleProjectReminder } = useProjects();
  const { tasks } = useTasks();
  if (projects.length === 0) return <EmptyState />;
  return (
    <div className={styles.projectsGrid}>
      {projects.map((p) => {
        const linkedTasks = tasks.filter(
          (t) =>
            t.projectId === p.id ||
            (t.tags && t.tags.some((tag) => tag.trim().toLowerCase() === p.title.trim().toLowerCase()))
        );
        const doneTasksCount = linkedTasks.filter((t) => t.status === 'done').length;
        const isAutomated = linkedTasks.length > 0;
        const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.active;
        const accent = p.color || cfg.color;
        const parentGoal = goals.find((g) => g.id === p.goalId);
        const isHighlighted = highlightId === p.id;
        return (
          <article
            key={p.id}
            id={`project-card-${p.id}`}
            className={styles.projectCard}
            style={{
              boxShadow: isHighlighted ? '0 0 0 2px var(--color-accent)' : undefined,
              borderColor: isHighlighted ? 'var(--color-accent)' : undefined,
            }}
          >
            {/* Top header row: tags + actions */}
            <div className={styles.cardHeader}>
              <div className={styles.tagsRow}>
                <span
                  className={`${styles.statusBadge} ${styles[p.status === 'on-hold' ? 'onHold' : p.status] || ''}`}
                  style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}35` }}
                >
                  <span className={styles.statusDot} style={{ background: cfg.color }} />
                  {cfg.label}
                </span>
                <span
                  className={`${styles.priorityBadge} ${styles[p.priority] || ''}`}
                >
                  {p.priority}
                </span>
              </div>
              <div className={styles.cardActions}>
                <EntityFiles variant="icon" entityType="project" entityId={p.id} title={p.title} className={styles.fileActionBtn} />
                {onAddBridgeTask && (
                  <button
                    type="button"
                    className={styles.taskBridgeBtn}
                    onClick={() => onAddBridgeTask(p)}
                    title="Create a 15-minute action task"
                    aria-label="Add bridge task"
                  >
                    + Task
                  </button>
                )}
                <button
                  className={`${styles.actionBtn} ${p.isReminder ? styles.actionBtnActive : ''}`}
                  onClick={() => toggleProjectReminder(p.id)}
                  title={p.isReminder ? "Remove reminder (clears from Today)" : "Set Reminder (Show on Today)"}
                  style={p.isReminder ? { color: 'var(--color-warning, #f59e0b)' } : undefined}
                >
                  <Bell size={13} style={p.isReminder ? { color: 'var(--color-warning, #f59e0b)' } : undefined} />
                </button>
                <button className={styles.actionBtn} onClick={() => onEdit(p)} title="Edit" aria-label="Edit project">
                  <Edit2 size={13} />
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={() => { if (confirm(`Delete "${p.title}"?`)) onDelete(p.id); }}
                  title="Delete"
                  aria-label="Delete project"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Title (full card width) */}
            <h3 className={styles.projectTitle}>
              <AutoLinkText text={p.title} />
            </h3>

            {/* Hierarchy chain (parent goal) */}
            {parentGoal && (
              <div className={styles.hierarchyChain} title={`Parent Goal: ${parentGoal.title}`}>
                <div className={styles.chainRow}>
                  <span className={styles.chainBadge}>
                    <Target size={11} className={styles.chainIcon} />
                    Goal
                  </span>
                  <span className={styles.chainVal}>{parentGoal.title}</span>
                </div>
              </div>
            )}

            {/* Description */}
            {p.description && (
              <p className={styles.projectDesc}>
                <AutoLinkText text={p.description} />
              </p>
            )}

            {/* Notes */}
            {p.notes && (
              <div className={styles.notesBox}>
                <AutoLinkText text={p.notes} />
              </div>
            )}

            {/* Single Interactive Progress Slider */}
            <div className={styles.progressSection}>
              <div className={styles.progressHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className={styles.progressLabel}>Progress</span>
                  {isAutomated && (
                    <span
                      className={styles.autoBadge}
                      title={`Auto-synced: ${doneTasksCount}/${linkedTasks.length} tasks completed`}
                    >
                      Auto ({doneTasksCount}/{linkedTasks.length})
                    </span>
                  )}
                </div>
                <span className={styles.progressValue} style={{ color: accent }}>{p.progress}%</span>
              </div>
              <div className={styles.sliderWrap}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={p.progress}
                  disabled={isAutomated}
                  className={styles.progressSlider}
                  style={{
                    background: `linear-gradient(to right, ${accent} 0%, ${accent} ${p.progress}%, var(--color-surface-2) ${p.progress}%, var(--color-surface-2) 100%)`,
                    cursor: isAutomated ? 'not-allowed' : 'pointer',
                    opacity: isAutomated ? 0.75 : 1,
                  }}
                  onChange={(e) => onProgressChange(p.id, parseInt(e.target.value))}
                  title={isAutomated ? `Auto-calculated from ${doneTasksCount}/${linkedTasks.length} tasks` : "Slide to update progress"}
                  aria-label="Update project progress"
                />
              </div>
            </div>

            {/* Footer: dates */}
            <div className={styles.cardFooter}>
              <span className={styles.dateRange}>
                <Calendar size={11} className={styles.dateIcon} />
                {p.startDate ? p.startDate : 'No start'}
                {p.dueDate && <> → {p.dueDate}</>}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** ── List View (flat rows fallback) ── */
function ListView({ projects, goals, onEdit, onDelete, onProgressChange, highlightId, onAddBridgeTask }: {
  projects: Project[];
  goals: { id: string; title: string }[];
  onEdit: (p: Project) => void;
  onDelete: (id: string) => void;
  onProgressChange: (id: string, v: number) => void;
  highlightId?: string | null;
  onAddBridgeTask?: (p: Project) => void;
}) {
  if (projects.length === 0) return <EmptyState />;
  return (
    <div>
      {projects.map((p) => (
        <ProjectRow
          key={p.id}
          project={p}
          onEdit={onEdit}
          onDelete={onDelete}
          onProgressChange={onProgressChange}
          parentGoalTitle={goals.find((g) => g.id === p.goalId)?.title}
          highlightId={highlightId}
          onAddBridgeTask={onAddBridgeTask}
        />
      ))}
    </div>
  );
}

/** ── Board View ── */
function BoardView({ projects, goals, onEdit, onDelete, onProgressChange, highlightId, onAddBridgeTask }: {
  projects: Project[];
  goals: { id: string; title: string }[];
  onEdit: (p: Project) => void;
  onDelete: (id: string) => void;
  onProgressChange: (id: string, v: number) => void;
  highlightId?: string | null;
  onAddBridgeTask?: (p: Project) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', overflowX: 'auto' }}>
      {BOARD_COLS.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const colProjects = projects.filter((p) => p.status === status);
        return (
          <div key={status} style={{ minWidth: '240px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 4px', borderBottom: `2px solid ${cfg.color}`, marginBottom: '10px',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {cfg.label}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 700, minWidth: '20px', height: '20px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${cfg.color}20`, color: cfg.color,
              }}>
                {colProjects.length}
              </span>
            </div>
            {colProjects.length === 0 ? (
              <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', textAlign: 'center', padding: '20px 0' }}>
                Empty
              </p>
            ) : (
              colProjects.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onProgressChange={onProgressChange}
                  parentGoalTitle={goals.find((g) => g.id === p.goalId)?.title}
                  compact
                  highlightId={highlightId}
                  onAddBridgeTask={onAddBridgeTask}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

/** ── Calendar View ── */
function CalendarView({ projects, onEdit }: {
  projects: Project[];
  onEdit: (p: Project) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Map projects to their due dates within this month
  const projectsByDate = useMemo(() => {
    const map: Record<string, Project[]> = {};
    projects.forEach((p) => {
      if (p.dueDate) {
        const d = new Date(p.dueDate + 'T00:00:00');
        if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          map[day].push(p);
        }
      }
      // Also show startDate markers
      if (p.startDate) {
        const d = new Date(p.startDate + 'T00:00:00');
        if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
          const day = d.getDate();
          if (!map[`s_${day}`]) map[`s_${day}`] = [];
          map[`s_${day}`].push(p);
        }
      }
    });
    return map;
  }, [projects, viewYear, viewMonth]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth ? today.getDate() : null;

  // Projects with no dates — shown in a sidebar
  const undatedProjects = projects.filter((p) => !p.dueDate && !p.startDate);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '20px' }}>
      {/* Calendar Grid */}
      <div>
        {/* Month Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <button onClick={() => { const d = new Date(viewYear, viewMonth - 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }} style={calNavBtn}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text)' }}>{monthName}</span>
          <button onClick={() => { const d = new Date(viewYear, viewMonth + 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }} style={calNavBtn}>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} style={{ fontSize: '10px', fontWeight: 700, textAlign: 'center', color: 'var(--color-text-faint)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const dueProjets = projectsByDate[day] || [];
            const startProjects = projectsByDate[`s_${day}`] || [];
            const isToday = day === todayDay;

            return (
              <div
                key={day}
                style={{
                  minHeight: '72px', padding: '6px', borderRadius: '10px',
                  background: isToday ? 'rgba(124, 111, 255, 0.12)' : 'var(--color-surface)',
                  border: isToday ? '1px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                  overflow: 'hidden',
                }}
              >
                <span style={{
                  fontSize: '11px', fontWeight: isToday ? 800 : 500,
                  color: isToday ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  display: 'block', marginBottom: '4px',
                }}>
                  {day}
                </span>

                {/* Start dates */}
                {startProjects.map((p) => {
                  const accent = p.color || STATUS_CONFIG[p.status]?.color || '#7c6fff';
                  return (
                    <button
                      key={`s_${p.id}`}
                      onClick={() => onEdit(p)}
                      title={`Start: ${p.title}`}
                      style={{
                        display: 'block', width: '100%', fontSize: '9px', padding: '1px 4px',
                        borderRadius: '4px', background: `${accent}15`, color: accent,
                        border: `1px solid ${accent}30`, cursor: 'pointer', textAlign: 'left',
                        marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      ▶ {p.title}
                    </button>
                  );
                })}

                {/* Due dates */}
                {dueProjets.map((p) => {
                  const accent = p.color || STATUS_CONFIG[p.status]?.color || '#7c6fff';
                  return (
                    <button
                      key={p.id}
                      onClick={() => onEdit(p)}
                      title={`Due: ${p.title}`}
                      style={{
                        display: 'block', width: '100%', fontSize: '9px', padding: '1px 4px',
                        borderRadius: '4px', background: `${accent}25`, color: accent,
                        border: `1px solid ${accent}60`, cursor: 'pointer', textAlign: 'left',
                        marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: 700,
                      }}
                    >
                      ◆ {p.title}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '11px', color: 'var(--color-text-faint)' }}>
          <span>▶ Start date</span>
          <span>◆ Due date</span>
        </div>
      </div>

      {/* Sidebar: Projects without dates */}
      <div>
        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-faint)', marginBottom: '10px' }}>
          No Date Set ({undatedProjects.length})
        </p>
        {undatedProjects.map((p) => {
          const cfg = STATUS_CONFIG[p.status];
          const accent = p.color || cfg.color;
          return (
            <button
              key={p.id}
              onClick={() => onEdit(p)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 10px', marginBottom: '6px', borderRadius: '8px',
                background: 'var(--color-surface)', border: `1px solid var(--color-border-subtle)`,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>
                {p.title}
              </span>
              <span style={{ fontSize: '10px', color: cfg.color }}>{cfg.label}</span>
            </button>
          );
        })}
        {undatedProjects.length === 0 && (
          <p style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>All projects have dates.</p>
        )}
      </div>
    </div>
  );
}

const calNavBtn: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)',
  borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'var(--color-text-muted)',
  display: 'flex', alignItems: 'center',
};

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '48px', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-subtle)' }}>
      <Folder size={40} style={{ color: 'var(--color-text-faint)', marginBottom: '12px' }} />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>No projects match. Click &quot;New Project&quot; to add one.</p>
    </div>
  );
}

// ── Color swatches ──
const PROJECT_COLORS = ['#7c6fff', '#38bdf8', '#22d3a5', '#f59e0b', '#ef4444', '#ec4899', '#a855f7', '#84cc16', '#fb923c'];

export default function ProjectsPage() {
  const {
    projects,
    addProject,
    updateProject,
    updateProjectProgress,
    deleteProject,
    resetToDefaultProjects,
    isLoaded,
  } = useProjects();
  const { milestones } = useMilestones();
  const { goals } = useGoals();
  const { dreams } = useDreams();
  const { addTask, tasks } = useTasks();
  const { focusedAreaId } = useLifeAreas();

  // ADHD Guidance & 1-Click Bridges
  const [adhdGuideOpen, setAdhdGuideOpen] = useState(false);
  const [quickBridgeTask, setQuickBridgeTask] = useState<Project | null>(null);
  const [bridgeTaskTitle, setBridgeTaskTitle] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const openBridgeTask = (project: Project) => {
    setQuickBridgeTask(project);
    setBridgeTaskTitle(`15m step: ${project.title}`);
  };

  const handleBridgeTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBridgeTask || !bridgeTaskTitle.trim()) return;
    addTask({
      title: bridgeTaskTitle.trim(),
      description: `Task inside project: ${quickBridgeTask.title}`,
      status: 'todo',
      priority: 'high',
      estimatedDuration: 25,
      projectId: quickBridgeTask.id,
      goalId: quickBridgeTask.goalId,
      tags: ['project-action'],
      subtasks: [],
    });
    playSuccessChime();
    showToast(`Task added to "${quickBridgeTask.title}"!`);
    setQuickBridgeTask(null);
  };

  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');

  useEffect(() => {
    if (highlightId) {
      const el = document.getElementById(`project-card-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightId, isLoaded]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'planning' | 'completed'>('active');
  const [goalFilter, setGoalFilter]     = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('notes');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form State
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [goalId, setGoalId]         = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [status, setStatus]         = useState<ProjectStatus>('active');
  const [priority, setPriority]     = useState<ProjectPriority>('medium');
  const [startDate, setStartDate]   = useState('');
  const [dueDate, setDueDate]       = useState('');
  const [progress, setProgress]     = useState<number>(0);
  const [notes, setNotes]           = useState('');
  const [projectColor, setProjectColor] = useState('');


  if (!isLoaded) {
    return <PageSkeleton variant="cards" cardsCount={4} showMetrics={true} showControls={true} />;
  }

  const openCreateModal = () => {
    setEditingProject(null);
    setTitle(''); setDescription(''); setGoalId(goals[0]?.id || '');
    setMilestoneId(''); setStatus('active'); setPriority('high');
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    setStartDate(todayStr);
    setDueDate(defaultDue); setProgress(0); setNotes(''); setProjectColor('');
    setModalOpen(true);
  };

  const openEditModal = (p: Project) => {
    setEditingProject(p);
    setTitle(p.title); setDescription(p.description || '');
    setGoalId(p.goalId || ''); setMilestoneId(p.milestoneId || '');
    setStatus(p.status); setPriority(p.priority);
    setStartDate(p.startDate || ''); setDueDate(p.dueDate || '');
    setProgress(p.progress); setNotes(p.notes || '');
    setProjectColor(p.color || '');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      goalId: goalId || undefined,
      milestoneId: milestoneId || undefined,
      status, priority,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      progress,
      notes: notes.trim() || undefined,
      color: projectColor || undefined,
    };
    if (editingProject) {
      updateProject(editingProject.id, payload);
    } else {
      addProject(payload);
    }
    setModalOpen(false);
  };

  const filteredProjects = projects.filter((p) => {
    if (focusedAreaId) {
      const parentGoal = goals.find((g) => g.id === p.goalId);
      const matchesDirect = p.lifeAreaId === focusedAreaId;
      const matchesGoal = parentGoal?.lifeAreaId === focusedAreaId;
      if (!matchesDirect && !matchesGoal) return false;
    }
    if (statusFilter === 'active' && (p.status === 'completed' || p.status === 'cancelled')) return false;
    if (statusFilter === 'planning' && p.status !== 'planning') return false;
    if (statusFilter === 'completed' && p.status !== 'completed') return false;
    if (goalFilter !== 'all' && p.goalId !== goalFilter) return false;
    if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
    return true;
  });

  const availableMilestones = milestones.filter((m) => !goalId || m.goalId === goalId);

  const goalList = goals.map((g) => ({ id: g.id, title: g.title }));

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Projects &amp; Execution</h1>
          <p className={styles.subtitle}>
            Real creative, technical, and life endeavors you are actively building.
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
            <Plus size={18} /> New Project
          </button>
        </div>
      </header>

      {/* ── Minimalist Unified Project Controls Bar ── */}
      <div className={styles.controlsBar}>
        {/* Left: Status Column Tabs */}
        <div className={styles.tabs} role="tablist" aria-label="Project status tabs">
          {([
            { id: 'active', label: 'Active', count: projects.filter((p) => p.status === 'active' || p.status === 'on-hold').length },
            { id: 'planning', label: 'Planning', count: projects.filter((p) => p.status === 'planning').length },
            { id: 'completed', label: 'Completed', count: projects.filter((p) => p.status === 'completed').length },
            { id: 'all', label: 'All', count: projects.length },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={statusFilter === tab.id}
              className={`${styles.tab} ${statusFilter === tab.id ? styles.activeTab : ''}`}
              onClick={() => setStatusFilter(tab.id)}
            >
              <span>{tab.label}</span>
              <span className={styles.tabBadge}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Right: Compact Filter Pills & View Switcher */}
        <div className={styles.controlsRightGroup}>
          <div className={styles.filtersGroup}>
            {/* Goal Filter Pill */}
            <div className={styles.selectFilterWrap}>
              <select
                className={`${styles.selectFilter} ${goalFilter !== 'all' ? styles.selectFilterActive : ''}`}
                value={goalFilter}
                onChange={(e) => setGoalFilter(e.target.value)}
                title="Filter by Linked Goal"
                aria-label="Filter by Linked Goal"
              >
                <option value="all">All Goals</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    Goal: {g.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={11} className={styles.selectFilterChevron} />
            </div>

            {/* Priority Filter Pill */}
            <div className={styles.selectFilterWrap}>
              <select
                className={`${styles.selectFilter} ${priorityFilter !== 'all' ? styles.selectFilterActive : ''}`}
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                title="Filter by Priority"
                aria-label="Filter by Priority"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <ChevronDown size={11} className={styles.selectFilterChevron} />
            </div>
          </div>

          <div className={styles.toolbarDivider} />

          {/* View Mode Switcher */}
          <div className={styles.viewModeToggleGroup} role="group" aria-label="View Mode">
            {([
              { mode: 'notes' as ViewMode, icon: <LayoutGrid size={13} />, label: 'Notes' },
              { mode: 'list' as ViewMode, icon: <LayoutList size={13} />, label: 'List' },
              { mode: 'board' as ViewMode, icon: <Columns size={13} />, label: 'Board' },
              { mode: 'calendar' as ViewMode, icon: <CalendarDays size={13} />, label: 'Calendar' },
            ]).map(({ mode, icon, label }) => (
              <button
                key={mode}
                type="button"
                className={`${styles.viewModeBtn} ${viewMode === mode ? styles.viewModeBtnActive : ''}`}
                onClick={() => setViewMode(mode)}
                title={`${label} View`}
                aria-label={`${label} View`}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── View Body ── */}
      {viewMode === 'notes' && (
        <NotesView
          projects={filteredProjects}
          goals={goalList}
          onEdit={openEditModal}
          onDelete={deleteProject}
          onProgressChange={updateProjectProgress}
          highlightId={highlightId}
          onAddBridgeTask={openBridgeTask}
        />
      )}

      {viewMode === 'list' && (
        <ListView
          projects={filteredProjects}
          goals={goalList}
          onEdit={openEditModal}
          onDelete={deleteProject}
          onProgressChange={updateProjectProgress}
          highlightId={highlightId}
          onAddBridgeTask={openBridgeTask}
        />
      )}

      {viewMode === 'board' && (
        <BoardView
          projects={filteredProjects}
          goals={goalList}
          onEdit={openEditModal}
          onDelete={deleteProject}
          onProgressChange={updateProjectProgress}
          highlightId={highlightId}
          onAddBridgeTask={openBridgeTask}
        />
      )}

      {viewMode === 'calendar' && (
        <CalendarView
          projects={filteredProjects}
          onEdit={openEditModal}
        />
      )}

      {/* ── Modal ── */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingProject ? 'Edit Project' : 'New Project'}</h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="project-title">Project Title</label>
                <input id="project-title" type="text" className={styles.input}
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Blobbit Game, Blender Learning" required autoFocus />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="project-desc">Description</label>
                <textarea id="project-desc" className={styles.textarea}
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Overview of scope, deliverables, and architecture..." />
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="project-goal">Parent Goal</label>
                  <select id="project-goal" className={styles.select} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                    <option value="">-- Select Goal (Optional) --</option>
                    {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="project-milestone">Parent Milestone</label>
                  <select id="project-milestone" className={styles.select} value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                    <option value="">-- Select Milestone (Optional) --</option>
                    {availableMilestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="project-status">Status</label>
                  <select id="project-status" className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                    <option value="active">Active</option>
                    <option value="planning">Planning</option>
                    <option value="on-hold">On Hold</option>
                    <option value="completed">Completed ✓</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="project-priority">Priority</label>
                  <select id="project-priority" className={styles.select} value={priority} onChange={(e) => setPriority(e.target.value as ProjectPriority)}>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="project-start-date">Start Date</label>
                  <input id="project-start-date" type="date" className={styles.input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="project-due-date">Due Date</label>
                  <input id="project-due-date" type="date" className={styles.input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="project-notes">Execution Notes &amp; Scratchpad</label>
                <textarea id="project-notes" className={styles.textarea}
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Key thoughts, next steps, technical references..." />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Initial Progress ({progress}%)</label>
                <input type="range" min="0" max="100" step="5"
                  className={styles.sliderInput} value={progress}
                  onChange={(e) => setProgress(parseInt(e.target.value))} />
              </div>

              {/* Color Accent */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Accent Color (Optional)</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
                  <button type="button" title="None" onClick={() => setProjectColor('')}
                    style={{
                      height: '28px', padding: '0 10px', borderRadius: '8px', fontSize: '11px',
                      fontWeight: 600, cursor: 'pointer', color: 'var(--color-text-muted)',
                      background: 'var(--color-surface-2)',
                      border: projectColor === '' ? '3px solid white' : '2px solid transparent',
                      outline: projectColor === '' ? '2px solid var(--color-accent)' : 'none',
                      outlineOffset: '2px',
                    }}>None</button>
                  {PROJECT_COLORS.map((c) => (
                    <button key={c} type="button" title={c} onClick={() => setProjectColor(c)}
                      style={{
                        width: '28px', height: '28px', borderRadius: '50%', background: c,
                        border: projectColor === c ? '3px solid white' : '2px solid transparent',
                        outline: projectColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px', cursor: 'pointer', transition: 'all 0.15s',
                      }} />
                  ))}
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.btnCreate}>
                  {editingProject ? 'Save Project' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 1-Click ADHD Quick Bridge Task Modal ── */}
      {quickBridgeTask && (
        <div className={styles.modalOverlay} onClick={() => setQuickBridgeTask(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                  }}
                >
                  Project → Task
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setQuickBridgeTask(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Project: <strong style={{ color: 'var(--color-text)' }}>{quickBridgeTask.title}</strong>
            </div>

            <form onSubmit={handleBridgeTaskSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>15-Minute Action Task</label>
                <input
                  type="text"
                  className={styles.input}
                  value={bridgeTaskTitle}
                  onChange={(e) => setBridgeTaskTitle(e.target.value)}
                  placeholder="e.g. Spend 15 mins drafting notes"
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
                  Instantly creates a 25-minute action task linked to this project and adds it to your Tasks To Do.
                </span>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setQuickBridgeTask(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnCreate}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                  }}
                >
                  Add Task
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
