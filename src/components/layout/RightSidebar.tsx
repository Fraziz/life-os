'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Sun,
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
} from 'lucide-react';

import { useSettings } from '@/context/SettingsContext';
import { useSearch } from '@/context/SearchContext';
import { useReminders } from '@/context/ReminderContext';
import { useTasks } from '@/context/TaskContext';
import { useHabits } from '@/context/HabitContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import styles from './RightSidebar.module.css';

export default function RightSidebar() {
  const { settings, updateSettings } = useSettings();
  const { openSearch } = useSearch();
  const { unreadCount } = useReminders();
  const { tasks } = useTasks();
  const { habits, isHabitCompletedOnDate } = useHabits();
  const { activeProjects } = useProjects();
  const { activeGoals } = useGoals();

  // ── Theme toggle ─────────────────────────────────────────────
  const isDark = settings.theme === 'dark';
  const toggleTheme = () => {
    updateSettings({ theme: isDark ? 'light' : 'dark' });
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
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle theme"
          >
            <Sun size={17} />
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
            const active = isToday(d);
            return (
              <div
                key={`day-${d}`}
                className={`${styles.calDayCell} ${active ? styles.calActiveDay : ''}`}
              >
                <span>{d}</span>
              </div>
            );
          })}
        </div>
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
