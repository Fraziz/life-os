'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Sun,
  Moon,
  Leaf,
  Bell,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Zap,
  CheckCircle2,
  FolderKanban,
  Repeat,
  ArrowRight,
  Flame,
  BatteryCharging,
  BatteryMedium,
  Battery,
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

  // ── Theme toggle (cycles: light → dark → nature → light) ────
  const currentTheme = settings.theme;
  const toggleTheme = () => {
    const cycle: Record<string, 'dark' | 'light' | 'nature'> = {
      light: 'dark',
      dark: 'nature',
      nature: 'light',
      system: 'dark',
    };
    updateSettings({ theme: cycle[currentTheme] ?? 'dark' });
  };
  const themeIcon =
    currentTheme === 'dark' ? <Moon size={17} /> :
    currentTheme === 'nature' ? <Leaf size={17} /> :
    <Sun size={17} />;
  const themeTitle =
    currentTheme === 'light' ? 'Switch to Dark Theme' :
    currentTheme === 'dark' ? 'Switch to Nature Theme' :
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

  // ── ADHD Energy Check-In ──────────────────────────────────────
  const [energyLevel, setEnergyLevel] = useState<'low' | 'normal' | 'high'>('normal');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('life_os_energy_level');
      if (saved === 'low' || saved === 'normal' || saved === 'high') {
        setEnergyLevel(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const selectEnergy = (lvl: 'low' | 'normal' | 'high') => {
    setEnergyLevel(lvl);
    try {
      localStorage.setItem('life_os_energy_level', lvl);
      window.dispatchEvent(new CustomEvent('life_os_energy_changed', { detail: lvl }));
    } catch {
      // ignore
    }
  };

  const energyTips = {
    low: '🔋 Low Energy Mode: Pick just 1 tiny task. Momentum beats perfection today.',
    normal: '⚡ Steady Focus: Work in 25-minute Pomodoro sprints with real rest breaks.',
    high: '🔥 High Energy: Tackle your #1 hardest priority right now while focus is sharp.',
  };

  return (
    <aside className={styles.rightSidebar} aria-label="Secondary widgets">
      {/* ── Top Utility Search & Actions ───────────────────────── */}
      <div className={styles.topUtilityRow}>
        <div className={styles.searchBox} onClick={openSearch} role="button" tabIndex={0}>
          <Search size={15} className={styles.searchIcon} />
          <span className={styles.searchPlaceholder}>Search... (⌘K)</span>
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
            title="Notifications & Alerts"
            aria-label="Alerts"
          >
            <Bell size={17} />
            {unreadCount > 0 && <span className={styles.notificationDot} />}
          </button>
        </div>
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
                `🚩 ${dayDeadlines.length} deadline${dayDeadlines.length > 1 ? 's' : ''}: ${dayDeadlines.map((i) => i.title).join(', ')}`
              );
            }
            if (hasEvent) {
              tooltipParts.push(
                `📅 ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}: ${dayEvents.map((i) => i.title).join(', ')}`
              );
            }
            if (hasBlock) {
              tooltipParts.push(
                `⏳ ${dayBlocks.length} focus block${dayBlocks.length > 1 ? 's' : ''}: ${dayBlocks.map((i) => i.taskTitle).join(', ')}`
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
                {selectedDeadlines.map((dl) => (
                  <div
                    key={dl.id}
                    className={`${styles.agendaItem} ${styles.agendaDeadlineItem}`}
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
                  </div>
                ))}

                {selectedEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className={`${styles.agendaItem} ${styles.agendaEventItem}`}
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
                  </div>
                ))}

                {selectedBlocks.map((blk) => (
                  <div
                    key={blk.id}
                    className={`${styles.agendaItem} ${styles.agendaBlockItem}`}
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
                  </div>
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

      {/* ── ADHD Energy Check-In ───────────────────────────────── */}
      <div className={styles.energyCard}>
        <div className={styles.momentumHeader}>
          <div className={styles.momentumTitle}>
            <Zap size={16} style={{ color: '#eab308' }} />
            <span>Today&apos;s Energy</span>
          </div>
        </div>

        <div className={styles.energyBtnRow}>
          <button
            type="button"
            className={`${styles.energyBtn} ${energyLevel === 'low' ? styles.energyBtnActive : ''}`}
            onClick={() => selectEnergy('low')}
          >
            <Battery size={16} />
            <span>Low</span>
          </button>
          <button
            type="button"
            className={`${styles.energyBtn} ${energyLevel === 'normal' ? styles.energyBtnActive : ''}`}
            onClick={() => selectEnergy('normal')}
          >
            <BatteryMedium size={16} />
            <span>Steady</span>
          </button>
          <button
            type="button"
            className={`${styles.energyBtn} ${energyLevel === 'high' ? styles.energyBtnActive : ''}`}
            onClick={() => selectEnergy('high')}
          >
            <BatteryCharging size={16} />
            <span>High</span>
          </button>
        </div>

        <div className={styles.energyTipText}>
          {energyTips[energyLevel]}
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
              <span>Focus Mode</span>
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
