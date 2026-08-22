'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReminderItem, ReminderType, ReminderPriority } from '@/types';
import { useSettings } from './SettingsContext';
import { useTasks } from './TaskContext';
import { useGoals } from './GoalContext';
import { useProjects } from './ProjectContext';
import { useMilestones } from './MilestoneContext';
import { useHabits } from './HabitContext';
import { useCalendar } from './CalendarContext';
import { useReview } from './ReviewContext';

const SNOOZE_STORAGE_KEY = 'life_os_snoozed_reminders_v1';
const DISMISSED_STORAGE_KEY = 'life_os_dismissed_reminders_v1';

interface ReminderContextType {
  reminders: ReminderItem[];
  activeReminders: ReminderItem[];
  unreadCount: number;
  isQuietHourNow: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissReminder: (id: string) => void;
  snoozeReminder: (id: string, minutes?: number) => void;
  requestBrowserPermission: () => Promise<boolean>;
}

const ReminderContext = createContext<ReminderContextType | undefined>(undefined);

function isTimeInQuietHours(startTimeStr: string, endTimeStr: string, now: Date = new Date()): boolean {
  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  if (startMinutes <= endMinutes) {
    // Standard window e.g. 01:00 to 06:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight window e.g. 22:00 to 08:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

export function ReminderProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { tasks } = useTasks();
  const { goals } = useGoals();
  const { projects } = useProjects();
  const { milestones } = useMilestones();
  const { habits, isHabitCompletedOnDate } = useHabits();
  const { scheduledBlocks } = useCalendar();
  const { reviews, currentWeekStats } = useReview();

  const [snoozedMap, setSnoozedMap] = useState<Record<string, string>>({});
  const [dismissedSet, setDismissedSet] = useState<Set<string>>(new Set());
  const [readSet, setReadSet] = useState<Set<string>>(new Set());

  // Load snoozed and dismissed states on mount
  useEffect(() => {
    try {
      const savedSnooze = localStorage.getItem(SNOOZE_STORAGE_KEY);
      if (savedSnooze) setSnoozedMap(JSON.parse(savedSnooze));
      const savedDismissed = localStorage.getItem(DISMISSED_STORAGE_KEY);
      if (savedDismissed) setDismissedSet(new Set(JSON.parse(savedDismissed)));
    } catch {
      // localStorage error fallback
    }
  }, []);

  const notifConfig = settings.notifications;

  // Check Quiet Hours status
  const isQuietHourNow = useMemo(() => {
    if (!notifConfig.enabled || !notifConfig.quietHours?.enabled) return false;
    return isTimeInQuietHours(notifConfig.quietHours.start || '22:00', notifConfig.quietHours.end || '08:00');
  }, [notifConfig]);

  // Generate Reminders dynamically based on user data
  const generatedReminders = useMemo(() => {
    if (!notifConfig.enabled) return [];

    const list: ReminderItem[] = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();

    // 1. Task Reminders & Deadlines
    if (notifConfig.taskReminders) {
      tasks.forEach((t) => {
        if (t.status === 'done') return;
        if (t.dueDate) {
          const isOverdue = t.dueDate < todayStr;
          const isDueToday = t.dueDate === todayStr;

          if (isOverdue) {
            list.push({
              id: `task-overdue-${t.id}`,
              type: 'task',
              title: `Task Overdue: ${t.title}`,
              message: `Was due on ${t.dueDate}. Prioritize completing or rescheduling.`,
              entityId: t.id,
              href: '/tasks',
              timeStr: t.dueDate,
              priority: 'urgent',
              isRead: readSet.has(`task-overdue-${t.id}`),
              isDismissed: dismissedSet.has(`task-overdue-${t.id}`),
              createdAt: todayStr,
            });
          } else if (isDueToday) {
            list.push({
              id: `task-due-${t.id}`,
              type: 'task',
              title: `Task Due Today: ${t.title}`,
              message: t.description ? t.description.slice(0, 70) : `Scheduled for today.`,
              entityId: t.id,
              href: '/tasks',
              timeStr: 'Today',
              priority: t.priority === 'urgent' ? 'urgent' : t.priority === 'high' ? 'high' : 'normal',
              isRead: readSet.has(`task-due-${t.id}`),
              isDismissed: dismissedSet.has(`task-due-${t.id}`),
              createdAt: todayStr,
            });
          }
        }
      });
    }

    // 2. Goal & Milestone Deadlines
    if (notifConfig.deadlineAlerts) {
      milestones.forEach((m) => {
        if (m.status === 'completed' || !m.targetDate) return;
        if (m.targetDate <= todayStr) {
          list.push({
            id: `milestone-${m.id}`,
            type: 'deadline',
            title: `Milestone Target Reached: ${m.title}`,
            message: `Target date was ${m.targetDate}. Current progress: ${m.progress}%.`,
            entityId: m.id,
            href: '/milestones',
            timeStr: m.targetDate,
            priority: 'high',
            isRead: readSet.has(`milestone-${m.id}`),
            isDismissed: dismissedSet.has(`milestone-${m.id}`),
            createdAt: todayStr,
          });
        }
      });

      projects.forEach((p) => {
        if (p.status === 'completed' || !p.dueDate) return;
        if (p.dueDate === todayStr || p.dueDate < todayStr) {
          list.push({
            id: `project-${p.id}`,
            type: 'deadline',
            title: `Project Due: ${p.title}`,
            message: `Target completion date ${p.dueDate}. Progress is ${p.progress}%.`,
            entityId: p.id,
            href: '/projects',
            timeStr: p.dueDate,
            priority: 'high',
            isRead: readSet.has(`project-${p.id}`),
            isDismissed: dismissedSet.has(`project-${p.id}`),
            createdAt: todayStr,
          });
        }
      });
    }

    // 3. Calendar Scheduled Work Blocks
    if (notifConfig.scheduledWorkAlerts) {
      scheduledBlocks.forEach((sb) => {
        if (sb.date === todayStr) {
          list.push({
            id: `sched-${sb.id}`,
            type: 'scheduled_work',
            title: `Scheduled Work: ${sb.taskTitle}`,
            message: `Planned block at ${sb.startTime} (${sb.durationMinutes} mins).`,
            entityId: sb.id,
            href: '/calendar',
            timeStr: sb.startTime,
            priority: 'normal',
            isRead: readSet.has(`sched-${sb.id}`),
            isDismissed: dismissedSet.has(`sched-${sb.id}`),
            createdAt: todayStr,
          });
        }
      });
    }

    // 4. Habits Due
    if (notifConfig.habitReminders) {
      habits.forEach((h) => {
        const completedToday = isHabitCompletedOnDate(h.id, todayStr);
        if (!completedToday && h.reminderTime) {
          list.push({
            id: `habit-${h.id}`,
            type: 'habit',
            title: `Habit Practice: ${h.title}`,
            message: h.reminderNote || `Time for daily habit practice (${h.reminderTime}).`,
            entityId: h.id,
            href: '/habits',
            timeStr: h.reminderTime,
            priority: 'normal',
            isRead: readSet.has(`habit-${h.id}`),
            isDismissed: dismissedSet.has(`habit-${h.id}`),
            createdAt: todayStr,
          });
        }
      });
    }

    // 5. Weekly Review (e.g. Sunday or Friday)
    const isWeekReviewed = reviews.some((r) => r.weekStartDate === currentWeekStats.weekStartStr);
    if (notifConfig.weeklyReviewReminders && !isWeekReviewed) {
      const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday
      if (dayOfWeek === 0 || dayOfWeek === 5) {
        list.push({
          id: `review-${todayStr}`,
          type: 'weekly_review',
          title: `Weekly Review Ready`,
          message: `Reflect on your wins, progress, focus time, and set intentions for next week.`,
          href: '/review',
          timeStr: 'Weekly',
          priority: 'normal',
          isRead: readSet.has(`review-${todayStr}`),
          isDismissed: dismissedSet.has(`review-${todayStr}`),
          createdAt: todayStr,
        });
      }
    }

    // Filter out actively snoozed reminders
    const nowIso = now.toISOString();
    return list.map((item) => {
      const snoozeUntil = snoozedMap[item.id];
      if (snoozeUntil && snoozeUntil > nowIso) {
        return { ...item, snoozedUntil: snoozeUntil };
      }
      return item;
    });
  }, [
    notifConfig,
    tasks,
    milestones,
    projects,
    scheduledBlocks,
    habits,
    isHabitCompletedOnDate,
    reviews,
    currentWeekStats,
    readSet,
    dismissedSet,
    snoozedMap,
  ]);

  const activeReminders = useMemo(() => {
    const nowIso = new Date().toISOString();
    return generatedReminders.filter((r) => {
      if (r.isDismissed) return false;
      if (r.snoozedUntil && r.snoozedUntil > nowIso) return false;
      return true;
    });
  }, [generatedReminders]);

  const unreadCount = useMemo(() => {
    return activeReminders.filter((r) => !r.isRead).length;
  }, [activeReminders]);

  const markAsRead = useCallback((id: string) => {
    setReadSet((prev) => new Set([...prev, id]));
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadSet(new Set(generatedReminders.map((r) => r.id)));
  }, [generatedReminders]);

  const dismissReminder = useCallback((id: string) => {
    setDismissedSet((prev) => {
      const next = new Set([...prev, id]);
      try {
        localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch { /* noop */ }
      return next;
    });
  }, []);

  const snoozeReminder = useCallback((id: string, minutes: number = 60) => {
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    setSnoozedMap((prev) => {
      const next = { ...prev, [id]: until };
      try {
        localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(next));
      } catch { /* noop */ }
      return next;
    });
  }, []);

  const requestBrowserPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    }
    return false;
  }, []);

  return (
    <ReminderContext.Provider
      value={{
        reminders: generatedReminders,
        activeReminders,
        unreadCount,
        isQuietHourNow,
        markAsRead,
        markAllAsRead,
        dismissReminder,
        snoozeReminder,
        requestBrowserPermission,
      }}
    >
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const ctx = useContext(ReminderContext);
  if (!ctx) throw new Error('useReminders must be used within ReminderProvider');
  return ctx;
}
