'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Flag,
  Plus,
  Trash2,
  X,
  ExternalLink,
  Play,
} from 'lucide-react';
import { useCalendar } from '@/context/CalendarContext';
import { useTasks } from '@/context/TaskContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useMilestones } from '@/context/MilestoneContext';
import styles from './page.module.css';
import PageSkeleton from '@/components/ui/PageSkeleton';
import PairedPageSwitcher from '@/components/layout/PairedPageSwitcher';

const CALENDAR_ROUTINE_TABS = [
  { label: 'Calendar', href: '/calendar' },
  { label: 'Daily Routine', href: '/routine' },
];

type CalendarView = 'day' | 'week' | 'month';

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 to 22:00

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CalendarPage() {
  const {
    addEvent,
    deleteEvent,
    scheduleTaskBlock,
    removeScheduledBlock,
    getDeadlinesForDate,
    getScheduledBlocksForDate,
    getEventsForDate,
    isLoaded,
  } = useCalendar();

  const { tasks, quickAddTask, updateTask } = useTasks();
  const { projects, updateProject } = useProjects();
  const { goals, updateGoal } = useGoals();
  const { milestones, updateMilestone } = useMilestones();

  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Modals
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);

  // Form states for scheduling a task block
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [schedDate, setSchedDate] = useState(todayStr);
  const [schedTime, setSchedTime] = useState('19:00');
  const [schedDuration, setSchedDuration] = useState('60');
  const [schedNotes, setSchedNotes] = useState('');

  // Form states for creating a calendar event
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(todayStr);
  const [eventStartTime, setEventStartTime] = useState('14:00');
  const [eventEndTime, setEventEndTime] = useState('15:00');
  const [eventNotes, setEventNotes] = useState('');

  // Form states for Add Deadline modal
  const [dlEntityType, setDlEntityType] = useState<'task' | 'project' | 'goal' | 'milestone' | 'new_task'>('task');
  const [dlEntityId, setDlEntityId] = useState('');
  const [dlNewTaskTitle, setDlNewTaskTitle] = useState('');
  const [dlDate, setDlDate] = useState(todayStr);

  // Single unified New Entry dropdown state & ref
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAddMenuOpen(false);
        setScheduleModalOpen(false);
        setEventModalOpen(false);
        setDeadlineModalOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const formatFullFriendlyDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDayDateString = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  const openAddEvent = (date?: string) => {
    setEventDate(date || selectedDate || todayStr);
    setEventModalOpen(true);
  };

  const openScheduleBlock = (date?: string) => {
    setSchedDate(date || selectedDate || todayStr);
    setScheduleModalOpen(true);
  };

  const openAddDeadline = (date?: string) => {
    setDlDate(date || selectedDate || todayStr);
    setDeadlineModalOpen(true);
  };

  if (!isLoaded) {
    return <PageSkeleton variant="calendar" cardsCount={4} showMetrics={false} showControls={true} />;
  }

  const currentDateStr = toLocalDateStr(currentDate);

  const getDeadlineHref = (sourceType: string, entityId: string) => {
    if (sourceType === 'task') return `/tasks?highlight=${entityId}`;
    if (sourceType === 'project') return `/projects?highlight=${entityId}`;
    if (sourceType === 'goal') return `/goals?highlight=${entityId}`;
    if (sourceType === 'milestone') return `/milestones?highlight=${entityId}`;
    return `/tasks?highlight=${entityId}`;
  };

  // ── Navigation helpers ──
  const navigatePrev = () => {
    const next = new Date(currentDate);
    if (view === 'day') next.setDate(next.getDate() - 1);
    else if (view === 'week') next.setDate(next.getDate() - 7);
    else if (view === 'month') next.setMonth(next.getMonth() - 1);
    setCurrentDate(next);
  };

  const navigateNext = () => {
    const next = new Date(currentDate);
    if (view === 'day') next.setDate(next.getDate() + 1);
    else if (view === 'week') next.setDate(next.getDate() + 7);
    else if (view === 'month') next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const navigateToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(todayStr);
  };

  // Week View dates calculation (Monday to Sunday)
  const getWeekDates = (centerDate: Date) => {
    const start = new Date(centerDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    scheduleTaskBlock(selectedTaskId, schedDate, schedTime, parseInt(schedDuration, 10) || 60, schedNotes);
    setScheduleModalOpen(false);
    setSchedNotes('');
  };

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    addEvent({
      title: eventTitle.trim(),
      date: eventDate,
      startTime: eventStartTime,
      endTime: eventEndTime,
      notes: eventNotes,
    });
    setEventModalOpen(false);
    setEventTitle('');
    setEventNotes('');
  };

  const handleDeadlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dlDate) return;

    if (dlEntityType === 'new_task') {
      if (!dlNewTaskTitle.trim()) return;
      quickAddTask(dlNewTaskTitle.trim(), { dueDate: dlDate, status: 'todo', priority: 'medium' });
    } else if (dlEntityType === 'task') {
      if (!dlEntityId) return;
      updateTask(dlEntityId, { dueDate: dlDate });
    } else if (dlEntityType === 'project') {
      if (!dlEntityId) return;
      updateProject(dlEntityId, { dueDate: dlDate });
    } else if (dlEntityType === 'goal') {
      if (!dlEntityId) return;
      updateGoal(dlEntityId, { targetDate: dlDate });
    } else if (dlEntityType === 'milestone') {
      if (!dlEntityId) return;
      updateMilestone(dlEntityId, { targetDate: dlDate });
    }

    setDeadlineModalOpen(false);
    setDlNewTaskTitle('');
    setDlEntityId('');
  };

  const bannerDateStr = view === 'month' ? selectedDate : currentDateStr;
  const activeDeadlinesForBanner = getDeadlinesForDate(bannerDateStr);

  return (
    <div className={styles.page}>
      <PairedPageSwitcher
        ariaLabel="Calendar and Routines views"
        tabs={CALENDAR_ROUTINE_TABS}
      />

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Calendar &amp; Routines</h1>
          <p className={styles.subtitle}>
            Coordinate focus blocks, events, and target deadlines alongside your daily routines.
          </p>
        </div>

        <div className={styles.actionButtons} ref={addMenuRef}>
          <div className={styles.newEntryDropdownWrap}>
            <button
              type="button"
              className={styles.btnNewEntry}
              onClick={() => setAddMenuOpen((prev) => !prev)}
              aria-expanded={addMenuOpen}
              aria-haspopup="menu"
              title="Create a new event, focus block, or deadline"
            >
              <Plus size={15} strokeWidth={2.25} />
              <span>New Entry</span>
              <ChevronDown size={14} className={`${styles.chevron} ${addMenuOpen ? styles.chevronOpen : ''}`} />
            </button>

            {addMenuOpen && (
              <div className={styles.newEntryDropdownMenu} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={styles.dropdownMenuItem}
                  onClick={() => {
                    setAddMenuOpen(false);
                    openAddEvent();
                  }}
                >
                  <div className={`${styles.menuItemIcon} ${styles.iconEvent}`}>
                    <CalendarIcon size={15} />
                  </div>
                  <div className={styles.menuItemText}>
                    <span className={styles.menuItemTitle}>Event</span>
                    <span className={styles.menuItemDesc}>Meeting, appointment, or external commitment</span>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className={styles.dropdownMenuItem}
                  onClick={() => {
                    setAddMenuOpen(false);
                    openScheduleBlock();
                  }}
                >
                  <div className={`${styles.menuItemIcon} ${styles.iconBlock}`}>
                    <Clock size={15} />
                  </div>
                  <div className={styles.menuItemText}>
                    <span className={styles.menuItemTitle}>Focus Block</span>
                    <span className={styles.menuItemDesc}>Allocate dedicated focus time for a task</span>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className={styles.dropdownMenuItem}
                  onClick={() => {
                    setAddMenuOpen(false);
                    openAddDeadline();
                  }}
                >
                  <div className={`${styles.menuItemIcon} ${styles.iconDeadline}`}>
                    <Flag size={15} />
                  </div>
                  <div className={styles.menuItemText}>
                    <span className={styles.menuItemTitle}>Deadline</span>
                    <span className={styles.menuItemDesc}>Target due date for task, project, or goal</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── View Controls Bar ── */}
      <div className={styles.controlsBar}>
        <div className={styles.dateNavGroup}>
          <button
            type="button"
            className={styles.navIconBtn}
            onClick={navigatePrev}
            aria-label={`Previous ${view}`}
            title={`Previous ${view}`}
          >
            <ChevronLeft size={16} />
          </button>
          <button type="button" className={styles.btnSecondary} onClick={navigateToday}>
            Today
          </button>
          <button
            type="button"
            className={styles.navIconBtn}
            onClick={navigateNext}
            aria-label={`Next ${view}`}
            title={`Next ${view}`}
          >
            <ChevronRight size={16} />
          </button>

          <span className={styles.currentDateLabel}>
            {view === 'month'
              ? currentDate.toLocaleDateString([], { month: 'long', year: 'numeric' })
              : currentDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div className={styles.viewTabs} role="tablist" aria-label="Calendar view">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'day'}
            className={`${styles.viewTab} ${view === 'day' ? styles.activeViewTab : ''}`}
            onClick={() => setView('day')}
          >
            Day
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'week'}
            className={`${styles.viewTab} ${view === 'week' ? styles.activeViewTab : ''}`}
            onClick={() => setView('week')}
          >
            Week
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'month'}
            className={`${styles.viewTab} ${view === 'month' ? styles.activeViewTab : ''}`}
            onClick={() => setView('month')}
          >
            Month
          </button>
        </div>
      </div>

      {/* ── Active Deadlines Alert Banner (Progressive Disclosure: hidden when none due) ── */}
      {activeDeadlinesForBanner.length > 0 && (
        <section className={styles.deadlinesBanner} aria-label="Active deadlines due">
          <div className={styles.deadlinesHeader}>
            <span className={styles.deadlinesTitle}>
              <Flag size={13} style={{ color: 'var(--color-danger)' }} />
              <span>
                Obligations Due — {formatFullFriendlyDate(bannerDateStr)} ({activeDeadlinesForBanner.length})
              </span>
            </span>
            <span className={styles.deadlinesSubtitle}>
              Select any obligation to navigate directly to its record
            </span>
          </div>

          <div className={styles.deadlinesChipList}>
            {activeDeadlinesForBanner.map((dl) => (
              <Link
                key={dl.id}
                href={getDeadlineHref(dl.sourceType, dl.entityId)}
                className={styles.deadlineChip}
                title={`Open ${dl.title} in ${dl.sourceType}`}
              >
                <Flag size={12} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                <span>{dl.title}</span>
                <span className={styles.deadlineSourceBadge}>{dl.sourceType}</span>
                <ExternalLink size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── DAY VIEW ── */}
      {view === 'day' && (
        <div className={styles.dayViewContainer}>
          <div className={styles.timelineGrid}>
            {HOURS.map((hour) => {
              const hourStr = `${String(hour).padStart(2, '0')}:00`;

              const blocksInHour = getScheduledBlocksForDate(currentDateStr).filter((b) => {
                const bHour = parseInt(b.startTime.split(':')[0], 10);
                return bHour === hour;
              });

              const eventsInHour = getEventsForDate(currentDateStr).filter((e) => {
                if (!e.startTime) return false;
                const eHour = parseInt(e.startTime.split(':')[0], 10);
                return eHour === hour;
              });

              return (
                <div key={hour} className={styles.timelineHourRow}>
                  <div className={styles.hourLabel}>{hourStr}</div>
                  <div className={styles.hourSlot}>
                    {eventsInHour.map((evt) => (
                      <div key={evt.id} className={styles.eventCard}>
                        <div className={styles.cardMainContent}>
                          <CalendarIcon size={13} style={{ color: 'var(--color-info)', flexShrink: 0 }} />
                          <strong>{evt.title}</strong>
                          <span className={styles.cardMetaTime}>
                            {evt.startTime}
                            {evt.endTime ? ` – ${evt.endTime}` : ''}
                          </span>
                          {evt.notes && <span className={styles.cardSubtleNote}>({evt.notes})</span>}
                        </div>
                        <button
                          type="button"
                          className={styles.iconActionBtn}
                          onClick={() => deleteEvent(evt.id)}
                          aria-label={`Delete event ${evt.title}`}
                          title="Delete event"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}

                    {blocksInHour.map((block) => (
                      <div key={block.id} className={styles.scheduledWorkCard}>
                        <div className={styles.cardMainContent}>
                          <Clock size={13} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                          <Link href={`/tasks?highlight=${block.taskId}`} className={styles.cardInlineLink}>
                            <span>Focus Block: {block.taskTitle}</span>
                            <ExternalLink size={11} style={{ color: 'var(--color-text-muted)' }} />
                          </Link>
                          <span className={styles.cardMetaTime}>
                            {block.startTime} · {block.durationMinutes}m
                          </span>
                          {block.notes && <span className={styles.cardSubtleNote}>&ldquo;{block.notes}&rdquo;</span>}
                        </div>
                        <div className={styles.cardActionsRow}>
                          <Link
                            href={`/focus?taskId=${block.taskId}`}
                            className={styles.focusNowBtn}
                            title="Start Focus Session for this block"
                          >
                            <Play size={11} />
                            <span>Focus Now</span>
                          </Link>
                          <button
                            type="button"
                            className={styles.iconActionBtn}
                            onClick={() => removeScheduledBlock(block.id)}
                            aria-label={`Remove block ${block.taskTitle}`}
                            title="Remove scheduled block"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {view === 'week' && (
        <div className={styles.gridScrollWrap}>
          <div className={styles.weekGrid}>
            {getWeekDates(currentDate).map((dayDate, idx) => {
              const dayStr = toLocalDateStr(dayDate);
              const isToday = dayStr === todayStr;
              const dayDeadlines = getDeadlinesForDate(dayStr);
              const dayBlocks = getScheduledBlocksForDate(dayStr);
              const dayEvents = getEventsForDate(dayStr);

              return (
                <div key={idx} className={styles.weekCol}>
                  <div className={`${styles.weekColHeader} ${isToday ? styles.weekColToday : ''}`}>
                    <div className={styles.weekDayName}>
                      {dayDate.toLocaleDateString([], { weekday: 'short' })}
                    </div>
                    <div className={styles.weekDayNum}>{dayDate.getDate()}</div>
                  </div>

                  <div className={styles.weekColBody}>
                    {dayDeadlines.map((dl) => (
                      <Link
                        key={dl.id}
                        href={getDeadlineHref(dl.sourceType, dl.entityId)}
                        className={styles.weekDeadlineBadge}
                        title={`View ${dl.title} in ${dl.sourceType}`}
                      >
                        <Flag size={11} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                        <span>{dl.title}</span>
                      </Link>
                    ))}

                    {dayEvents.map((evt) => (
                      <div key={evt.id} className={`${styles.eventCard} ${styles.weekCardCompact}`}>
                        <div className={styles.weekCardCompactTop}>
                          <strong style={{ fontSize: 'var(--text-xs)' }}>{evt.title}</strong>
                          <button
                            type="button"
                            className={styles.iconActionBtn}
                            onClick={() => deleteEvent(evt.id)}
                            aria-label={`Delete event ${evt.title}`}
                            title="Delete event"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className={styles.cardMetaTime}>{evt.startTime}</div>
                      </div>
                    ))}

                    {dayBlocks.map((block) => (
                      <div key={block.id} className={`${styles.scheduledWorkCard} ${styles.weekCardCompact}`}>
                        <div className={styles.weekCardCompactTop}>
                          <Link href={`/tasks?highlight=${block.taskId}`} className={styles.cardInlineLink}>
                            <Clock size={11} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                            <span>{block.taskTitle}</span>
                          </Link>
                          <div className={styles.cardActionsRow}>
                            <Link
                              href={`/focus?taskId=${block.taskId}`}
                              className={styles.iconActionBtn}
                              aria-label={`Focus on ${block.taskTitle}`}
                              title="Focus Now"
                            >
                              <Play size={12} />
                            </Link>
                            <button
                              type="button"
                              className={styles.iconActionBtn}
                              onClick={() => removeScheduledBlock(block.id)}
                              aria-label={`Remove block ${block.taskTitle}`}
                              title="Remove block"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div className={styles.cardMetaTime}>
                          {block.startTime} ({block.durationMinutes}m)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MONTH VIEW: Executive Grid & Aligned Daily Agenda Panel ── */}
      {view === 'month' && (() => {
        const monthYear = currentDate.getFullYear();
        const monthIdx = currentDate.getMonth();
        const firstDayOfMonthIdx = new Date(monthYear, monthIdx, 1).getDay();
        const totalDaysInMonth = new Date(monthYear, monthIdx + 1, 0).getDate();

        const monthCalendarDays: (number | null)[] = [];
        for (let i = 0; i < firstDayOfMonthIdx; i++) {
          monthCalendarDays.push(null);
        }
        for (let d = 1; d <= totalDaysInMonth; d++) {
          monthCalendarDays.push(d);
        }
        while (monthCalendarDays.length % 7 !== 0) {
          monthCalendarDays.push(null);
        }

        const selectedDeadlines = getDeadlinesForDate(selectedDate);
        const selectedEvents = getEventsForDate(selectedDate);
        const selectedBlocks = getScheduledBlocksForDate(selectedDate);
        const totalSelectedItems = selectedDeadlines.length + selectedEvents.length + selectedBlocks.length;

        return (
          <div className={styles.monthViewSplit}>
            {/* Left Column: Month Grid */}
            <div className={styles.monthCard}>
              <div className={styles.calDaysHeader}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className={styles.calDayLabel}>
                    {d}
                  </div>
                ))}
              </div>

              <div className={styles.calGridDays}>
                {monthCalendarDays.map((d, index) => {
                  if (d === null) {
                    return <div key={`empty-${index}`} className={styles.calEmptyCell} aria-hidden="true" />;
                  }

                  const dayDateStr = formatDayDateString(monthYear, monthIdx, d);
                  const dayDeadlines = getDeadlinesForDate(dayDateStr);
                  const dayEvents = getEventsForDate(dayDateStr);
                  const dayBlocks = getScheduledBlocksForDate(dayDateStr);

                  const hasDeadline = dayDeadlines.length > 0;
                  const hasEvent = dayEvents.length > 0;
                  const hasBlock = dayBlocks.length > 0;
                  const dayTotal = dayDeadlines.length + dayEvents.length + dayBlocks.length;
                  const isSelected = dayDateStr === selectedDate;
                  const isToday = dayDateStr === todayStr;

                  const tooltipParts: string[] = [];
                  if (hasEvent) tooltipParts.push(`${dayEvents.length} Event(s)`);
                  if (hasDeadline) tooltipParts.push(`${dayDeadlines.length} Deadline(s)`);
                  if (hasBlock) tooltipParts.push(`${dayBlocks.length} Focus Block(s)`);
                  const tooltipText = tooltipParts.length > 0 ? `${dayDateStr} — ${tooltipParts.join(', ')}` : dayDateStr;

                  return (
                    <button
                      key={`day-${d}`}
                      type="button"
                      onClick={() => setSelectedDate(dayDateStr)}
                      className={`${styles.calDayCell} ${isToday ? styles.calActiveDay : ''} ${isSelected ? styles.calSelectedDay : ''}`}
                      title={tooltipText}
                      aria-pressed={isSelected}
                      aria-label={`${dayDateStr} ${tooltipParts.join('. ')}`}
                    >
                      <div className={styles.calDayTop}>
                        <span className={styles.calDayNumber}>{d}</span>
                        {dayTotal > 0 && <span className={styles.calDayCountBadge}>{dayTotal}</span>}
                      </div>
                      <div className={styles.calDotsRow}>
                        {hasDeadline && <span className={`${styles.calDot} ${styles.calDotDeadline}`} />}
                        {hasEvent && <span className={`${styles.calDot} ${styles.calDotEvent}`} />}
                        {hasBlock && <span className={`${styles.calDot} ${styles.calDotBlock}`} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className={styles.calLegendRow}>
                <div className={styles.legendGroup}>
                  <span className={styles.legendItem}>
                    <span className={`${styles.calDot} ${styles.calDotDeadline}`} />
                    <span>Deadline</span>
                  </span>
                  <span className={styles.legendItem}>
                    <span className={`${styles.calDot} ${styles.calDotEvent}`} />
                    <span>Event</span>
                  </span>
                  <span className={styles.legendItem}>
                    <span className={`${styles.calDot} ${styles.calDotBlock}`} />
                    <span>Focus Block</span>
                  </span>
                </div>
                <span className={styles.legendHint}>Select any date to inspect its agenda</span>
              </div>
            </div>

            {/* Right Column: Selected Date Agenda Panel (No duplicate entry triggers) */}
            <aside className={styles.sideDetailPanel} aria-label="Selected date agenda">
              <div className={styles.sideDetailHeader}>
                <div className={styles.sideDetailHeadingGroup}>
                  <div className={styles.sideDetailTitleRow}>
                    <span className={styles.sideDetailDate}>{formatFullFriendlyDate(selectedDate)}</span>
                    {selectedDate === todayStr && <span className={styles.todayBadge}>Today</span>}
                  </div>
                  <span className={styles.sideDetailMetaCount}>
                    {totalSelectedItems === 0
                      ? 'Clear schedule'
                      : `${totalSelectedItems} scheduled ${totalSelectedItems === 1 ? 'entry' : 'entries'}`}
                  </span>
                </div>

                {selectedDate !== todayStr && (
                  <button
                    type="button"
                    className={styles.jumpTodayBtn}
                    onClick={() => {
                      setSelectedDate(todayStr);
                      setCurrentDate(new Date());
                    }}
                  >
                    Today
                  </button>
                )}
              </div>

              <div className={`${styles.sideSectionsList} ${totalSelectedItems === 0 ? styles.sideSectionsListEmpty : ''}`}>
                {totalSelectedItems === 0 ? (
                  <div className={styles.emptyDayNotice}>
                    <CalendarIcon size={24} className={styles.emptyDayIcon} />
                    <p className={styles.emptyDayTitle}>No Scheduled Entries</p>
                    <p className={styles.emptyDayText}>
                      Nothing is planned for this date. Use <strong>New Entry</strong> in the header to add an event, focus block, or deadline.
                    </p>
                  </div>
                ) : (
                  <>
                    {selectedEvents.length > 0 && (
                      <div className={styles.sideSectionGroup}>
                        <div className={styles.sideSectionTitle}>
                          <CalendarIcon size={13} style={{ color: 'var(--color-info)' }} />
                          <span>Events ({selectedEvents.length})</span>
                        </div>
                        {selectedEvents.map((evt) => (
                          <div key={evt.id} className={styles.sideDetailCard}>
                            <div className={styles.sideCardTop}>
                              <span className={styles.sideCardTitle}>{evt.title}</span>
                              <button
                                type="button"
                                className={styles.sideCardDeleteBtn}
                                onClick={() => deleteEvent(evt.id)}
                                title="Delete event"
                                aria-label={`Delete event ${evt.title}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className={styles.sideCardMeta}>
                              <Clock size={12} />
                              <span>
                                {evt.startTime}
                                {evt.endTime ? ` – ${evt.endTime}` : ''}
                              </span>
                            </div>
                            {evt.notes && <p className={styles.sideCardNotes}>{evt.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedBlocks.length > 0 && (
                      <div className={styles.sideSectionGroup}>
                        <div className={styles.sideSectionTitle}>
                          <Clock size={13} style={{ color: 'var(--color-success)' }} />
                          <span>Focus Blocks ({selectedBlocks.length})</span>
                        </div>
                        {selectedBlocks.map((block) => (
                          <div key={block.id} className={styles.sideDetailCard}>
                            <div className={styles.sideCardTop}>
                              <Link
                                href={`/tasks?highlight=${block.taskId}`}
                                className={styles.sideCardTitleLink}
                                title="Open task in tasks tab"
                              >
                                {block.taskTitle}
                              </Link>
                              <button
                                type="button"
                                className={styles.sideCardDeleteBtn}
                                onClick={() => removeScheduledBlock(block.id)}
                                title="Remove scheduled block"
                                aria-label={`Remove block ${block.taskTitle}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className={styles.sideCardMeta}>
                              <Clock size={12} />
                              <span>{block.startTime}</span>
                              <span>·</span>
                              <span>{block.durationMinutes}m</span>
                              <Link
                                href={`/focus?taskId=${block.taskId}`}
                                className={styles.focusNowBtn}
                                title="Start focus timer"
                              >
                                <Play size={10} />
                                <span>Focus</span>
                              </Link>
                            </div>
                            {block.notes && <p className={styles.sideCardNotes}>{block.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedDeadlines.length > 0 && (
                      <div className={styles.sideSectionGroup}>
                        <div className={styles.sideSectionTitle}>
                          <Flag size={13} style={{ color: 'var(--color-danger)' }} />
                          <span>Obligations Due ({selectedDeadlines.length})</span>
                        </div>
                        {selectedDeadlines.map((dl) => (
                          <Link
                            key={dl.id}
                            href={getDeadlineHref(dl.sourceType, dl.entityId)}
                            className={styles.sideDetailCard}
                            title={`Jump to ${dl.sourceType}: ${dl.title}`}
                          >
                            <div className={styles.sideCardTop}>
                              <div className={styles.sideCardTitleGroup}>
                                <Flag size={13} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                                <span className={styles.sideCardTitle}>{dl.title}</span>
                              </div>
                              <ExternalLink size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                            </div>
                            <div className={styles.sideCardMeta}>
                              <span className={styles.sourceBadge}>{dl.sourceType}</span>
                              {dl.priority && <span className={styles.priorityBadge}>{dl.priority}</span>}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </aside>
          </div>
        );
      })()}

      {/* ── Modal: Add Deadline to Calendar ── */}
      {deadlineModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setDeadlineModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deadline-modal-title"
        >
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 id="deadline-modal-title" className={styles.modalTitle}>
                <Flag size={16} style={{ color: 'var(--color-danger)' }} />
                <span>Add Deadline to Calendar</span>
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setDeadlineModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <p className={styles.modalDesc}>
              Assign a target due date to a Task, Project, Goal, or Milestone to track key obligations on your calendar.
            </p>

            <form onSubmit={handleDeadlineSubmit} className={styles.modalForm}>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="dl-entity-type">
                  Item Type
                </label>
                <select
                  id="dl-entity-type"
                  className={styles.formSelect}
                  value={dlEntityType}
                  onChange={(e) => {
                    setDlEntityType(e.target.value as 'task' | 'project' | 'goal' | 'milestone' | 'new_task');
                    setDlEntityId('');
                  }}
                >
                  <option value="task">Task</option>
                  <option value="project">Project</option>
                  <option value="goal">Goal</option>
                  <option value="milestone">Milestone</option>
                  <option value="new_task">+ Create New Quick Task</option>
                </select>
              </div>

              {dlEntityType === 'new_task' ? (
                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="dl-new-task-title">
                    New Task Title
                  </label>
                  <input
                    id="dl-new-task-title"
                    className={styles.formInput}
                    type="text"
                    value={dlNewTaskTitle}
                    onChange={(e) => setDlNewTaskTitle(e.target.value)}
                    placeholder="e.g. Submit quarterly review"
                    required
                  />
                </div>
              ) : (
                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="dl-entity-select">
                    Select {dlEntityType.charAt(0).toUpperCase() + dlEntityType.slice(1)}
                  </label>
                  <select
                    id="dl-entity-select"
                    className={styles.formSelect}
                    value={dlEntityId}
                    onChange={(e) => setDlEntityId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose {dlEntityType} --</option>
                    {dlEntityType === 'task' &&
                      tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} {t.dueDate ? `(Current: ${t.dueDate})` : '(No Date)'}
                        </option>
                      ))}
                    {dlEntityType === 'project' &&
                      projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} {p.dueDate ? `(Current: ${p.dueDate})` : '(No Date)'}
                        </option>
                      ))}
                    {dlEntityType === 'goal' &&
                      goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title} {g.targetDate ? `(Current: ${g.targetDate})` : '(No Date)'}
                        </option>
                      ))}
                    {dlEntityType === 'milestone' &&
                      milestones.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} {m.targetDate ? `(Current: ${m.targetDate})` : '(No Date)'}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="dl-date">
                  Target Deadline Date
                </label>
                <div className={styles.quickDateRow}>
                  <button
                    type="button"
                    className={styles.quickDateBtn}
                    onClick={() => setDlDate(toLocalDateStr(new Date()))}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={styles.quickDateBtn}
                    onClick={() => setDlDate(toLocalDateStr(new Date(Date.now() + 86400000)))}
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    className={styles.quickDateBtn}
                    onClick={() => setDlDate(toLocalDateStr(new Date(Date.now() + 86400000 * 7)))}
                  >
                    Next Week
                  </button>
                </div>
                <input
                  id="dl-date"
                  className={styles.formInput}
                  type="date"
                  value={dlDate}
                  onChange={(e) => setDlDate(e.target.value)}
                  required
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setDeadlineModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnSchedule}>
                  Save Deadline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Schedule Task Focus Block ── */}
      {scheduleModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setScheduleModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
        >
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 id="schedule-modal-title" className={styles.modalTitle}>
                <Clock size={16} style={{ color: 'var(--color-success)' }} />
                <span>Schedule Focus Block</span>
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setScheduleModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <p className={styles.modalDesc}>
              Reserve a dedicated time block on your calendar to execute focused work on a specific task.
            </p>

            <form onSubmit={handleScheduleSubmit} className={styles.modalForm}>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="sched-task">
                  Select Task
                </label>
                <select
                  id="sched-task"
                  className={styles.formSelect}
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  required
                >
                  <option value="">-- Choose a task --</option>
                  {tasks
                    .filter((t) => t.status !== 'done')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} {t.estimatedDuration ? `(${t.estimatedDuration}m)` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div className={styles.formGridTwo}>
                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="sched-date">
                    Date
                  </label>
                  <input
                    id="sched-date"
                    className={styles.formInput}
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="sched-time">
                    Start Time
                  </label>
                  <input
                    id="sched-time"
                    className={styles.formInput}
                    type="time"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="sched-duration">
                  Duration (Minutes)
                </label>
                <input
                  id="sched-duration"
                  className={styles.formInput}
                  type="number"
                  min="15"
                  max="300"
                  step="15"
                  value={schedDuration}
                  onChange={(e) => setSchedDuration(e.target.value)}
                  required
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setScheduleModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnSchedule}>
                  Add to Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add Calendar Event ── */}
      {eventModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setEventModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-modal-title"
        >
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 id="event-modal-title" className={styles.modalTitle}>
                <CalendarIcon size={16} style={{ color: 'var(--color-info)' }} />
                <span>Add Calendar Event</span>
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setEventModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEventSubmit} className={styles.modalForm}>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="event-title">
                  Event Title
                </label>
                <input
                  id="event-title"
                  className={styles.formInput}
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. Client Briefing, Team Sync, Appointment"
                  required
                />
              </div>

              <div className={styles.formGridThree}>
                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="event-date">
                    Date
                  </label>
                  <input
                    id="event-date"
                    className={styles.formInput}
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="event-start">
                    Start Time
                  </label>
                  <input
                    id="event-start"
                    className={styles.formInput}
                    type="time"
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="event-end">
                    End Time
                  </label>
                  <input
                    id="event-end"
                    className={styles.formInput}
                    type="time"
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setEventModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnSchedule}>
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
