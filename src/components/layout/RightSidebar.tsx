'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Sun,
  Moon,
  Leaf,
  Sparkles,
  Bell,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Zap,
  CheckCircle2,
  Check,
  Repeat,
  ArrowRight,
  Flame,
  Flag,
  Clock,
} from 'lucide-react';

import { useSettings } from '@/context/SettingsContext';
import { useSearch } from '@/context/SearchContext';
import { useReminders } from '@/context/ReminderContext';
import { useTasks } from '@/context/TaskContext';
import { useHabits } from '@/context/HabitContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useCalendar } from '@/context/CalendarContext';
import { useInbox } from '@/context/InboxContext';
import { playSuccessChime } from '@/utils/soundAndDopamine';
import styles from './RightSidebar.module.css';

export default function RightSidebar() {
  const { settings, updateSettings } = useSettings();
  const { openSearch } = useSearch();
  const { unreadCount } = useReminders();
  const { tasks } = useTasks();
  const { habits, isHabitCompletedOnDate } = useHabits();
  const { activeProjects } = useProjects();
  const { activeGoals } = useGoals();
  const { getDeadlinesForDate, getEventsForDate, getScheduledBlocksForDate } = useCalendar();
  const { activeReminders: inboxReminders, toggleItemApplied } = useInbox();

  const activeInboxReminders = React.useMemo(() => {
    return inboxReminders.filter(
      (r) =>
        r.id !== 'daily-mandate-ticker' &&
        r.id !== 'inbox-accomplish-now' &&
        !r.content.toLowerCase().includes('what you need to accomplish today')
    );
  }, [inboxReminders]);

  // ── Theme toggle (cycles: light → dark → nature → cyber → light) ────
  const currentTheme = settings.theme;
  const toggleTheme = () => {
    const cycle: Record<string, 'dark' | 'light' | 'nature' | 'cyber'> = {
      light: 'dark',
      dark: 'nature',
      nature: 'cyber',
      cyber: 'light',
      system: 'dark',
    };
    updateSettings({ theme: cycle[currentTheme] ?? 'dark' });
  };
  const themeIcon =
    currentTheme === 'dark' ? <Moon size={17} /> :
    currentTheme === 'nature' ? <Leaf size={17} /> :
    currentTheme === 'cyber' ? <Sparkles size={17} /> :
    <Sun size={17} />;
  const themeTitle =
    currentTheme === 'light' ? 'Switch to Dark Theme' :
    currentTheme === 'dark' ? 'Switch to Nature Theme' :
    currentTheme === 'nature' ? 'Switch to Cyber Glow Theme' :
    'Switch to Light Theme';

  // ── Selected Date for Agenda Inspection ──────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );

  const formatDayDateStr = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  const formatFriendlyDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // ── Calendar Month Navigation ────────────────────────────────
  const [viewDate, setViewDate] = useState<Date>(new Date());

  const prevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const monthName = viewDate.toLocaleDateString([], { month: 'long', year: 'numeric' });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  const isToday = (d: number | null) => {
    if (!d) return false;
    const today = new Date();
    return (
      d === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  // ── Live Real Stats & Momentum ────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  const tasksDone = tasks.filter((t) => t.status === 'done').length;
  const totalTasks = tasks.length;
  const habitsDone = habits.filter((h) => isHabitCompletedOnDate(h.id, todayStr)).length;
  const totalHabits = habits.length;

  const totalActions = totalTasks + totalHabits;
  const completedActions = tasksDone + habitsDone;
  const momentumPercent = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

  // ── Notification State (Strictly focused on notifications, not reminders) ──
  const hasNotifications = unreadCount > 0;
  const bellTooltip = hasNotifications
    ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
    : 'Notifications';

  return (
    <aside className={styles.rightSidebar} aria-label="Secondary widgets">
      {/* ── Top Utility Search & Actions ───────────────────────── */}
      <div className={styles.topUtilityRow}>
        <div className={styles.searchBox} onClick={openSearch} role="button" tabIndex={0}>
          <Search size={15} className={styles.searchIcon} />
          <span className={styles.searchPlaceholder}>Search...</span>
        </div>

        <div className={styles.utilityIcons}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggleTheme}
            title={themeTitle}
            aria-label="Toggle theme"
          >
            {themeIcon}
          </button>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => window.dispatchEvent(new CustomEvent('open-reminders'))}
            title={bellTooltip}
            aria-label={bellTooltip}
          >
            <Bell size={17} />

            {hasNotifications && (
              <span className={styles.notificationBadge} aria-label={`${unreadCount} unread notifications`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Active Reminders Card (On Top of Calendar) ── */}
      <div className={styles.widgetCard}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderLeft}>
            <Bell size={15} style={{ color: '#f59e0b' }} />
            <span className={styles.cardTitle}>Reminders</span>
            {activeInboxReminders.length > 0 && (
              <span className={styles.reminderBadgeCount}>{activeInboxReminders.length}</span>
            )}
          </div>
          <button
            type="button"
            className={styles.viewAllBtn}
            onClick={() => window.dispatchEvent(new CustomEvent('open-reminders'))}
            title="Open full notifications and reminders drawer"
          >
            Drawer →
          </button>
        </div>

        {activeInboxReminders.length > 0 ? (
          <div className={styles.sidebarRemindersList}>
            {activeInboxReminders.map((r) => (
              <div key={r.id} className={styles.sidebarReminderItem}>
                <div className={styles.sidebarReminderBody}>
                  <span className={styles.sidebarReminderText} title={r.content}>
                    {r.content}
                  </span>
                  {r.reminderTime && (
                    <span className={styles.sidebarReminderTime}>{r.reminderTime}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.sidebarReminderDoneBtn}
                  onClick={() => {
                    toggleItemApplied(r.id);
                    playSuccessChime();
                  }}
                  title="Mark reminder as done"
                  aria-label="Mark reminder done"
                >
                  <Check size={12} />
                  <span>Done</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.sidebarRemindersEmpty}>
            <span className={styles.emptyCheckDot}>✓</span>
            <span>All reminders clear</span>
          </div>
        )}
      </div>

      {/* ── Mini Calendar Card ─────────────────────────────────── */}
      <div className={styles.widgetCard}>
        <div className={styles.calendarHeader}>
          <div className={styles.calendarTitle}>
            <CalendarIcon size={16} />
            <span>Calendar</span>
          </div>
        </div>

        <div className={styles.monthNavRow}>
          <span className={styles.monthName}>{monthName}</span>
          <div className={styles.navArrows}>
            <button type="button" onClick={prevMonth} className={styles.arrowBtn} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={nextMonth} className={styles.arrowBtn} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className={styles.calendarGrid}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className={styles.calDayLabel}>
              {d}
            </div>
          ))}

          {calendarDays.map((d, index) => {
            if (d === null) {
              return <div key={`empty-${index}`} className={styles.calEmptyCell} />;
            }

            const dayDateStr = formatDayDateStr(year, month, d);
            const dayDeadlines = getDeadlinesForDate(dayDateStr);
            const dayEvents = getEventsForDate(dayDateStr);
            const dayBlocks = getScheduledBlocksForDate(dayDateStr);

            const hasDeadline = dayDeadlines.length > 0;
            const hasEvent = dayEvents.length > 0;
            const hasBlock = dayBlocks.length > 0;
            const isSelected = dayDateStr === selectedDate;
            const active = isToday(d);

            const tooltipParts: string[] = [];
            if (hasDeadline) {
              tooltipParts.push(
                `[Deadline] ${dayDeadlines.length} deadline${dayDeadlines.length > 1 ? 's' : ''}: ${dayDeadlines.map((i) => i.title).join(', ')}`
              );
            }
            if (hasEvent) {
              tooltipParts.push(
                `[Event] ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}: ${dayEvents.map((i) => i.title).join(', ')}`
              );
            }
            if (hasBlock) {
              tooltipParts.push(
                `[Focus Block] ${dayBlocks.length} focus block${dayBlocks.length > 1 ? 's' : ''}: ${dayBlocks.map((i) => i.taskTitle).join(', ')}`
              );
            }
            const tooltipText = tooltipParts.length > 0 ? tooltipParts.join('\n') : undefined;

            return (
              <div
                key={`day-${d}`}
                onClick={() => setSelectedDate(dayDateStr)}
                className={`${styles.calDayCell} ${active ? styles.calActiveDay : ''} ${isSelected ? styles.calSelectedDay : ''} ${hasDeadline ? styles.calHasDeadline : ''}`}
                title={tooltipText}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedDate(dayDateStr);
                  }
                }}
                aria-label={`${dayDateStr} ${tooltipParts.join('. ')}`}
              >
                <span className={styles.calDayNumber}>{d}</span>
                <div className={styles.calDotsRow}>
                  {hasDeadline && <span className={`${styles.calDot} ${styles.calDotDeadline}`} />}
                  {hasEvent && <span className={`${styles.calDot} ${styles.calDotEvent}`} />}
                  {hasBlock && <span className={`${styles.calDot} ${styles.calDotBlock}`} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Legend ── */}
        <div className={styles.calLegendRow}>
          <span className={styles.legendItem}>
            <span className={`${styles.calDot} ${styles.calDotDeadline}`} /> Deadline
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.calDot} ${styles.calDotEvent}`} /> Event
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.calDot} ${styles.calDotBlock}`} /> Focus
          </span>
        </div>

        {/* ── Selected Day Marks & Agenda ── */}
        {(() => {
          const selectedDeadlines = getDeadlinesForDate(selectedDate);
          const selectedEvents = getEventsForDate(selectedDate);
          const selectedBlocks = getScheduledBlocksForDate(selectedDate);
          const totalSelectedMarks =
            selectedDeadlines.length + selectedEvents.length + selectedBlocks.length;

          return (
            <div className={styles.selectedDayAgenda}>
              <div className={styles.agendaHeader}>
                <div className={styles.agendaDateTitle}>
                  <span>{formatFriendlyDate(selectedDate)}</span>
                  {selectedDate === todayStr && (
                    <span className={styles.todayBadge}>Today</span>
                  )}
                </div>
                {selectedDate !== todayStr && (
                  <button
                    type="button"
                    className={styles.jumpTodayBtn}
                    onClick={() => {
                      setSelectedDate(todayStr);
                      setViewDate(new Date());
                    }}
                  >
                    Jump to Today
                  </button>
                )}
              </div>

              <div className={styles.agendaItemsList}>
                {selectedDeadlines.map((dl) => {
                  const href =
                    dl.sourceType === 'task' ? `/tasks?highlight=${dl.entityId}` :
                    dl.sourceType === 'project' ? `/projects?highlight=${dl.entityId}` :
                    dl.sourceType === 'goal' ? `/goals?highlight=${dl.entityId}` :
                    dl.sourceType === 'milestone' ? `/milestones?highlight=${dl.entityId}` :
                    `/tasks?highlight=${dl.entityId}`;
                  return (
                    <Link
                      key={dl.id}
                      href={href}
                      className={`${styles.agendaItem} ${styles.agendaDeadlineItem}`}
                      style={{ textDecoration: 'none', cursor: 'pointer' }}
                      title={`Go to ${dl.sourceType}: ${dl.title}`}
                    >
                      <div className={styles.agendaItemIconWrap}>
                        <Flag size={12} className={styles.deadlineIcon} />
                      </div>
                      <div className={styles.agendaItemContent}>
                        <span className={styles.agendaItemTitle} title={dl.title}>
                          {dl.title}
                        </span>
                        <div className={styles.agendaItemMetaRow}>
                          <span className={styles.agendaSourceBadge}>{dl.sourceType}</span>
                          {dl.priority && (
                            <span style={{ textTransform: 'capitalize' }}>{dl.priority}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {selectedEvents.map((evt) => (
                  <Link
                    key={evt.id}
                    href="/calendar"
                    className={`${styles.agendaItem} ${styles.agendaEventItem}`}
                    style={{ textDecoration: 'none', cursor: 'pointer' }}
                    title={`Open calendar: ${evt.title}`}
                  >
                    <div className={styles.agendaItemIconWrap}>
                      <CalendarIcon size={12} className={styles.eventIcon} />
                    </div>
                    <div className={styles.agendaItemContent}>
                      <span className={styles.agendaItemTitle} title={evt.title}>
                        {evt.title}
                      </span>
                      <div className={styles.agendaItemMetaRow}>
                        <span>
                          {evt.startTime}
                          {evt.endTime ? ` - ${evt.endTime}` : ''}
                        </span>
                        {evt.notes && <span>• {evt.notes}</span>}
                      </div>
                    </div>
                  </Link>
                ))}

                {selectedBlocks.map((blk) => (
                  <Link
                    key={blk.id}
                    href={`/tasks?highlight=${blk.taskId}`}
                    className={`${styles.agendaItem} ${styles.agendaBlockItem}`}
                    style={{ textDecoration: 'none', cursor: 'pointer' }}
                    title={`Go to task: ${blk.taskTitle}`}
                  >
                    <div className={styles.agendaItemIconWrap}>
                      <Clock size={12} className={styles.blockIcon} />
                    </div>
                    <div className={styles.agendaItemContent}>
                      <span className={styles.agendaItemTitle} title={blk.taskTitle}>
                        {blk.taskTitle}
                      </span>
                      <div className={styles.agendaItemMetaRow}>
                        <span>
                          {blk.startTime} ({blk.durationMinutes}m)
                        </span>
                        {blk.notes && <span>• {blk.notes}</span>}
                      </div>
                    </div>
                  </Link>
                ))}

                {totalSelectedMarks === 0 && (
                  <div className={styles.agendaEmptyState}>
                    No deadlines or scheduled marks on this date
                  </div>
                )}
              </div>

              <Link href="/calendar" className={styles.openCalendarLink}>
                <span>Open Full Calendar</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          );
        })()}
      </div>

      {/* ── Daily Momentum Card (Real Synced Data) ─────────────── */}
      <div className={styles.momentumCard}>
        <div className={styles.momentumHeader}>
          <div className={styles.momentumTitle}>
            <TrendingUp size={16} style={{ color: '#6366f1' }} />
            <span>Daily Momentum</span>
          </div>
          <span className={styles.momentumBadge}>{momentumPercent}%</span>
        </div>

        <div className={styles.momentumProgressTrack}>
          <div
            className={styles.momentumProgressFill}
            style={{ width: `${momentumPercent}%` }}
          />
        </div>

        <div className={styles.momentumGrid}>
          <div className={styles.momentumCell}>
            <span className={styles.momentumCellLabel}>Tasks Done</span>
            <span className={styles.momentumCellValue}>{tasksDone} / {totalTasks}</span>
          </div>

          <div className={styles.momentumCell}>
            <span className={styles.momentumCellLabel}>Habits Kept</span>
            <span className={styles.momentumCellValue}>{habitsDone} / {totalHabits}</span>
          </div>

          <div className={styles.momentumCell}>
            <span className={styles.momentumCellLabel}>Projects</span>
            <span className={styles.momentumCellValue}>{activeProjects.length} Active</span>
          </div>

          <div className={styles.momentumCell}>
            <span className={styles.momentumCellLabel}>Goals</span>
            <span className={styles.momentumCellValue}>{activeGoals.length} Active</span>
          </div>
        </div>
      </div>

      {/* ── Quick ADHD Shortcuts ───────────────────────────────── */}
      <div className={styles.shortcutsCard}>
        <div className={styles.momentumHeader}>
          <div className={styles.momentumTitle}>
            <span>Quick Shortcuts</span>
          </div>
        </div>

        <div className={styles.shortcutLinksList}>
          <Link href="/focus" className={styles.shortcutLinkItem}>
            <div className={styles.shortcutItemLeft}>
              <Flame size={14} style={{ color: '#ef4444' }} />
              <span>Focus Space</span>
            </div>
            <ArrowRight size={13} />
          </Link>

          <Link href="/review" className={styles.shortcutLinkItem}>
            <div className={styles.shortcutItemLeft}>
              <Repeat size={14} style={{ color: '#6366f1' }} />
              <span>Weekly Review</span>
            </div>
            <ArrowRight size={13} />
          </Link>

          <Link href="/reset" className={styles.shortcutLinkItem}>
            <div className={styles.shortcutItemLeft}>
              <CheckCircle2 size={14} style={{ color: '#10b981' }} />
              <span>Reset Plan</span>
            </div>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
