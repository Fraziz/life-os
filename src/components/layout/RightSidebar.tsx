'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Bell } from 'lucide-react';

import { useSearch } from '@/context/SearchContext';
import { useReminders } from '@/context/ReminderContext';
import { useTasks } from '@/context/TaskContext';
import { useCalendar } from '@/context/CalendarContext';
import { useDailyRoutineReminder } from '@/utils/dailyRoutineReminder';
import ThemeOrbButton from './ThemeOrbButton';
import styles from './RightSidebar.module.css';

interface RightSidebarProps {
  onOpenWrapUp?: (e: React.MouseEvent) => void;
  overdueCount?: number;
}

export default function RightSidebar({ onOpenWrapUp, overdueCount = 0 }: RightSidebarProps) {
  const { openSearch } = useSearch();
  const { unreadCount } = useReminders();
  const { tasks } = useTasks();
  const { getDeadlinesForDate, getEventsForDate, getScheduledBlocksForDate } = useCalendar();
  const dailyRoutine = useDailyRoutineReminder();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(new Date());

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
  for (let i = 0; i < firstDayIndex; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const isToday = (d: number | null) => {
    if (!d) return false;
    const today = new Date();
    return (
      d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
    );
  };

  const completedTodayCount = tasks.filter((t) => {
    if (t.status !== 'done') return false;
    if (t.completedAt) return t.completedAt.split('T')[0] === todayStr;
    if (t.updatedAt) return t.updatedAt.split('T')[0] === todayStr;
    return false;
  }).length;
  const dueOrActiveToday = tasks.filter(
    (t) => t.status !== 'done' && (t.dueDate === todayStr || t.tags?.includes('do-it-now'))
  ).length;
  const totalTodayTarget = Math.max(
    1,
    completedTodayCount + dueOrActiveToday + dailyRoutine.totalCount
  );
  const doneTodayTarget = completedTodayCount + dailyRoutine.completedCount;
  const rhythmPercent = Math.min(100, Math.round((doneTodayTarget / totalTodayTarget) * 100));

  const hasNotifications = unreadCount > 0;
  const bellTooltip = hasNotifications
    ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
    : 'Notifications';

  const selectedDeadlines = getDeadlinesForDate(selectedDate);
  const selectedEvents = getEventsForDate(selectedDate);
  const selectedBlocks = getScheduledBlocksForDate(selectedDate);
  const totalSelectedMarks =
    selectedDeadlines.length + selectedEvents.length + selectedBlocks.length;

  return (
    <aside className={styles.rightSidebar} aria-label="Today companion rail">
      {/* ── Top Utility Search & Icon Actions ── */}
      <div className={styles.topUtilityRow} data-tour="right-utility">
        <div
          className={styles.searchBox}
          onClick={openSearch}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') openSearch();
          }}
          role="button"
          tabIndex={0}
        >
          <Search size={15} className={styles.searchIcon} />
          <span className={styles.searchPlaceholder}>Search...</span>
        </div>

        <div className={styles.utilityIcons}>
          <ThemeOrbButton size={17} />

          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => window.dispatchEvent(new CustomEvent('open-reminders'))}
            title={bellTooltip}
            aria-label={bellTooltip}
          >
            <Bell size={17} />
            {hasNotifications && (
              <span
                className={styles.notificationBadge}
                aria-label={`${unreadCount} unread notifications`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Schedule & Collapsible Month Grid ── */}
      <div className={styles.widgetCard}>
        <div className={styles.calendarHeader} style={{ marginBottom: 4 }}>
          <span className={styles.calendarTitle}>Schedule</span>
          <button
            type="button"
            className={styles.jumpTodayBtn}
            onClick={() => setCalendarExpanded((v) => !v)}
            aria-expanded={calendarExpanded}
          >
            {calendarExpanded ? 'Hide month' : 'Month'}
          </button>
        </div>

        {calendarExpanded && (
          <div style={{ marginTop: 8, marginBottom: 6 }}>
            <div className={styles.monthNavRow}>
              <span className={styles.monthName}>{monthName}</span>
              <div className={styles.navArrows}>
                <button
                  type="button"
                  onClick={prevMonth}
                  className={styles.arrowBtn}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className={styles.arrowBtn}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
            </div>

            <div className={styles.calendarGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                <div key={`${d}-${idx}`} className={styles.calDayLabel}>
                  {d}
                </div>
              ))}

              {calendarDays.map((d, index) => {
                if (d === null) {
                  return <div key={`empty-${index}`} className={styles.calEmptyCell} />;
                }

                const dayDateStr = formatDayDateStr(year, month, d);
                const hasDeadline = getDeadlinesForDate(dayDateStr).length > 0;
                const hasEvent = getEventsForDate(dayDateStr).length > 0;
                const hasBlock = getScheduledBlocksForDate(dayDateStr).length > 0;
                const isSelected = dayDateStr === selectedDate;
                const active = isToday(d);

                return (
                  <div
                    key={`day-${d}`}
                    onClick={() => setSelectedDate(dayDateStr)}
                    className={`${styles.calDayCell} ${active ? styles.calActiveDay : ''} ${
                      isSelected ? styles.calSelectedDay : ''
                    } ${hasDeadline ? styles.calHasDeadline : ''}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedDate(dayDateStr);
                    }}
                  >
                    <span className={styles.calDayNumber}>{d}</span>
                    <div className={styles.calDotsRow}>
                      {hasDeadline && (
                        <span className={`${styles.calDot} ${styles.calDotDeadline}`} />
                      )}
                      {hasEvent && <span className={`${styles.calDot} ${styles.calDotEvent}`} />}
                      {hasBlock && <span className={`${styles.calDot} ${styles.calDotBlock}`} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div
          className={styles.selectedDayAgenda}
          style={!calendarExpanded ? { marginTop: 6, paddingTop: 8 } : undefined}
        >
          <div className={styles.agendaHeader}>
            <div className={styles.agendaDateTitle}>
              <span>{formatFriendlyDate(selectedDate)}</span>
              {selectedDate === todayStr && <span className={styles.todayBadge}>Today</span>}
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
                Today
              </button>
            )}
          </div>

          <div className={styles.agendaItemsList}>
            {selectedDeadlines.map((dl) => {
              const href =
                dl.sourceType === 'project'
                  ? `/projects?highlight=${dl.entityId}`
                  : dl.sourceType === 'goal'
                  ? `/goals?highlight=${dl.entityId}`
                  : dl.sourceType === 'milestone'
                  ? `/milestones?highlight=${dl.entityId}`
                  : `/tasks?highlight=${dl.entityId}`;
              return (
                <Link
                  key={dl.id}
                  href={href}
                  className={styles.agendaItem}
                  style={{ textDecoration: 'none' }}
                >
                  <span
                    className={`${styles.calDot} ${styles.calDotDeadline}`}
                    style={{ marginTop: 6 }}
                  />
                  <div className={styles.agendaItemContent}>
                    <span className={styles.agendaItemTitle}>{dl.title}</span>
                    <div className={styles.agendaItemMetaRow}>
                      <span className={styles.agendaSourceBadge}>{dl.sourceType}</span>
                    </div>
                  </div>
                </Link>
              );
            })}

            {selectedEvents.map((evt) => (
              <Link
                key={evt.id}
                href="/calendar"
                className={styles.agendaItem}
                style={{ textDecoration: 'none' }}
              >
                <span
                  className={`${styles.calDot} ${styles.calDotEvent}`}
                  style={{ marginTop: 6 }}
                />
                <div className={styles.agendaItemContent}>
                  <span className={styles.agendaItemTitle}>{evt.title}</span>
                  <div className={styles.agendaItemMetaRow}>
                    <span>
                      {evt.startTime}
                      {evt.endTime ? ` – ${evt.endTime}` : ''}
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            {selectedBlocks.map((blk) => (
              <Link
                key={blk.id}
                href={`/tasks?highlight=${blk.taskId}`}
                className={styles.agendaItem}
                style={{ textDecoration: 'none' }}
              >
                <span
                  className={`${styles.calDot} ${styles.calDotBlock}`}
                  style={{ marginTop: 6 }}
                />
                <div className={styles.agendaItemContent}>
                  <span className={styles.agendaItemTitle}>{blk.taskTitle}</span>
                  <div className={styles.agendaItemMetaRow}>
                    <span>
                      {blk.startTime} ({blk.durationMinutes}m)
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            {totalSelectedMarks === 0 && (
              <div className={styles.agendaEmptyState}>No deadlines today</div>
            )}
          </div>

          <Link href="/calendar" className={styles.openCalendarLink}>
            Open Calendar
          </Link>
        </div>
      </div>

      {/* ── Quiet Daily Rhythm ── */}
      <div className={styles.momentumCard}>
        <div className={styles.momentumHeader}>
          <span className={styles.momentumTitle}>Daily Rhythm</span>
          <span className={styles.momentumBadge}>
            {completedTodayCount} done · {dailyRoutine.completedCount}/{dailyRoutine.totalCount}{' '}
            routine
          </span>
        </div>

        <div className={styles.momentumProgressTrack}>
          <div
            className={styles.momentumProgressFill}
            style={{ width: `${rhythmPercent}%` }}
          />
        </div>

        {overdueCount > 0 && (
          <Link
            href="/reset"
            className={styles.shortcutLinkItem}
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border-subtle)',
              padding: '8px 12px',
            }}
          >
            <span>{overdueCount} from earlier · Mental Reset</span>
          </Link>
        )}

        {onOpenWrapUp && (
          <button
            type="button"
            onClick={onOpenWrapUp}
            className={styles.shortcutLinkItem}
            style={{
              width: '100%',
              background: 'var(--color-control-bg, var(--color-surface))',
              border: '1px solid var(--color-border)',
              padding: '8px 12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span>Wrap up day</span>
          </button>
        )}
      </div>
    </aside>
  );
}
