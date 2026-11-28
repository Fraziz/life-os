'use client';

import { useState, useEffect, useCallback } from 'react';

export interface RoutineBlock {
  id: string;
  timeRange: string;
  title: string;
  subLabel?: string;
  steps: string[];
  color?: string;
  /** Start and end minutes from midnight (0-1440) for highlighting the active block. */
  startMinute?: number;
  endMinute?: number;
}

export interface DailyProgressState {
  date: string;
  completedStepKeys: string[];
  completedBlockIds: string[];
}

export const ROUTINE_STORAGE_KEY = 'life_os_daily_routine_blocks_v1';
export const PROGRESS_STORAGE_KEY = 'life_os_daily_routine_progress_v1';
export const ROUTINE_REMINDER_DONE_DATE_KEY = 'life_os_daily_routine_reminder_done_date_v1';
export const ROUTINE_REMINDER_EVENT = 'life_os_daily_routine_reminder_updated';

export const DEFAULT_DAILY_ROUTINE: RoutineBlock[] = [
  {
    id: 'routine-1',
    timeRange: '7:00 – 8:00 AM',
    title: 'Morning reset',
    startMinute: 7 * 60,
    endMinute: 8 * 60,
    steps: [
      'Wake up and make your bed',
      'Brush teeth, wash face',
      'Drink water and eat breakfast',
      'Avoid scrolling on your phone',
    ],
  },
  {
    id: 'routine-2',
    timeRange: '8:00 – 9:00 AM',
    title: 'Exercise',
    startMinute: 8 * 60,
    endMinute: 9 * 60,
    steps: [
      'Push-ups, squats, pull-ups or walking',
      'Stretch',
      'Build strength consistently',
    ],
  },
  {
    id: 'routine-3',
    timeRange: '9:00 – 10:00 AM',
    title: 'Learning & skill practice',
    startMinute: 9 * 60,
    endMinute: 10 * 60,
    steps: [
      'Read one short chapter or article',
      'Practice a core skill for 20 minutes',
      'Write 2 quick takeaways in your own words',
    ],
  },
  {
    id: 'routine-4',
    timeRange: '10:00 – 12:00 PM',
    title: 'Main priority',
    startMinute: 10 * 60,
    endMinute: 12 * 60,
    steps: [
      'Work, studies, or your #1 responsibility',
      'Focus on one task at a time',
    ],
  },
  {
    id: 'routine-5',
    timeRange: '1:00 – 2:00 PM',
    title: 'Creative or hobby block',
    startMinute: 13 * 60,
    endMinute: 14 * 60,
    steps: [
      '10 minutes: warm up without pressure',
      '30 minutes: hands-on creative practice',
      '15 minutes: enjoy making something freely',
    ],
  },
  {
    id: 'routine-6',
    timeRange: '2:00 – 4:00 PM',
    title: 'Build useful skills',
    subLabel: 'Rotate between:',
    startMinute: 14 * 60,
    endMinute: 16 * 60,
    steps: [
      'Business and money',
      'Technology and projects',
      'Practical knowledge',
    ],
  },
  {
    id: 'routine-7',
    timeRange: '4:00 – 5:00 PM',
    title: 'Personal time',
    startMinute: 16 * 60,
    endMinute: 17 * 60,
    steps: ['Walk, relax, socialize or enjoy a hobby.'],
  },
  {
    id: 'routine-8',
    timeRange: '7:00 – 8:00 PM',
    title: 'Learning and reflection',
    startMinute: 19 * 60,
    endMinute: 20 * 60,
    steps: [
      'Read about philosophy or Stoicism',
      'Review what you learned',
      'Write down your thoughts',
    ],
  },
  {
    id: 'routine-9',
    timeRange: '8:00 – 9:00 PM',
    title: 'Prepare for tomorrow',
    startMinute: 20 * 60,
    endMinute: 21 * 60,
    steps: [
      'Organize your things',
      'Review unfinished tasks',
      "Write tomorrow's most important task",
      'Sleep at a consistent time',
    ],
  },
];

export function getTodayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface DailyRoutineSnapshot {
  today: string;
  blocks: RoutineBlock[];
  completedCount: number;
  totalCount: number;
  isDoneToday: boolean;
  isActiveToday: boolean;
  activeBlock: RoutineBlock | null;
  nextBlock: RoutineBlock | null;
  subtitle: string;
}

export function getDailyRoutineSnapshot(): DailyRoutineSnapshot {
  const today = getTodayDateKey();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let blocks: RoutineBlock[] = [];
  let completedIds: string[] = [];
  let doneDate: string | null = null;

  if (typeof window !== 'undefined') {
    try {
      const savedBlocks = localStorage.getItem(ROUTINE_STORAGE_KEY);
      if (savedBlocks) {
        const parsed = JSON.parse(savedBlocks);
        if (Array.isArray(parsed)) {
          blocks = parsed;
        }
      }
    } catch {}

    try {
      const savedProg = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (savedProg) {
        const parsed: DailyProgressState = JSON.parse(savedProg);
        if (parsed && parsed.date === today && Array.isArray(parsed.completedBlockIds)) {
          completedIds = parsed.completedBlockIds;
        }
      }
    } catch {}

    try {
      doneDate = localStorage.getItem(ROUTINE_REMINDER_DONE_DATE_KEY);
    } catch {}
  }

  const totalCount = blocks.length;
  const completedCount = blocks.filter((b) => completedIds.includes(b.id)).length;
  const allBlocksDone = totalCount > 0 && completedCount >= totalCount;
  const isDoneToday = doneDate === today || allBlocksDone;
  const isActiveToday = totalCount > 0 && !isDoneToday;

  const activeBlock =
    blocks.find(
      (b) =>
        !completedIds.includes(b.id) &&
        typeof b.startMinute === 'number' &&
        typeof b.endMinute === 'number' &&
        nowMinutes >= b.startMinute &&
        nowMinutes < b.endMinute
    ) || null;

  const nextBlock =
    blocks.find(
      (b) =>
        !completedIds.includes(b.id) &&
        typeof b.startMinute === 'number' &&
        b.startMinute >= nowMinutes
    ) ||
    blocks.find((b) => !completedIds.includes(b.id)) ||
    null;

  const focusBlock = activeBlock || nextBlock;
  const progressLabel = `${completedCount}/${totalCount} done`;
  const subtitle = totalCount === 0
    ? 'No routine blocks yet'
    : activeBlock
    ? `Now: ${activeBlock.title} (${activeBlock.timeRange}) • ${progressLabel}`
    : focusBlock
    ? `Next: ${focusBlock.title} (${focusBlock.timeRange}) • ${progressLabel}`
    : `${progressLabel} • Repeats daily`;

  return {
    today,
    blocks,
    completedCount,
    totalCount,
    isDoneToday,
    isActiveToday,
    activeBlock,
    nextBlock,
    subtitle,
  };
}

export function notifyDailyRoutineUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ROUTINE_REMINDER_EVENT));
  }
}

export function markDailyRoutineReminderDoneToday(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ROUTINE_REMINDER_DONE_DATE_KEY, getTodayDateKey());
  } catch {}
  notifyDailyRoutineUpdated();
}

export function clearDailyRoutineReminderDoneToday(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ROUTINE_REMINDER_DONE_DATE_KEY);
  } catch {}
  notifyDailyRoutineUpdated();
}

/**
 * Live hook synced across tabs, midnight rollovers, and routine checkoffs.
 * Automatically re-activates on every new calendar day.
 */
export function useDailyRoutineReminder() {
  const [snapshot, setSnapshot] = useState<DailyRoutineSnapshot>(() => ({
    today: getTodayDateKey(),
    blocks: [],
    completedCount: 0,
    totalCount: 0,
    isDoneToday: false,
    isActiveToday: false,
    activeBlock: null,
    nextBlock: null,
    subtitle: 'No routine blocks yet',
  }));

  const refresh = useCallback(() => {
    setSnapshot(getDailyRoutineSnapshot());
  }, []);

  useEffect(() => {
    refresh();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener(ROUTINE_REMINDER_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('life_os_cloud_synced', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);

    // Refresh every minute so current/next time block & midnight rollover auto-update
    const interval = setInterval(refresh, 60000);

    return () => {
      window.removeEventListener(ROUTINE_REMINDER_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('life_os_cloud_synced', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [refresh]);

  return {
    ...snapshot,
    markDoneToday: markDailyRoutineReminderDoneToday,
    refresh,
  };
}
