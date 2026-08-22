'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTasks } from './TaskContext';
import { useSettings } from './SettingsContext';
import type { Task } from '@/types';

const TODAY_PLAN_STORAGE_KEY = 'life_os_today_plan_v1';

export interface TodayPlanState {
  availableMinutes: number;            // e.g. 120 (2 hours)
  mainFocusTaskId: string | null;       // ID of selected Main Focus
  customMainFocus?: string;             // Custom text if not linked to a task
  selectedTaskIds: string[];            // Curated tasks for today
  scheduledSlots: Record<string, string>; // taskId -> "10:00 AM - 11:00 AM"
  date: string;                         // YYYY-MM-DD
}

export function formatMinutesToHuman(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  
  if (h === 0) return `${m} minute${m === 1 ? '' : 's'}`;
  if (m === 0) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${h} hour${h === 1 ? '' : 's'} ${m} minute${m === 1 ? '' : 's'}`;
}

export const DEFAULT_TODAY_PLAN: TodayPlanState = {
  availableMinutes: 120,
  mainFocusTaskId: null,
  customMainFocus: '',
  selectedTaskIds: [],
  scheduledSlots: {},
  date: new Date().toISOString().split('T')[0],
};

interface TodayPlanContextType {
  todayPlan: TodayPlanState;
  availableMinutes: number;
  mainFocusTask: Task | null;
  customMainFocus: string;
  importantTasks: Task[];
  smallTasks: Task[];
  scheduledTasks: { task: Task; slot: string }[];
  completedTodayTasks: Task[];
  todayTasks: Task[];
  totalSelectedMinutes: number;
  remainingMinutes: number;
  isOverallocated: boolean;
  overallocatedDifference: number;
  formattedAvailable: string;
  formattedSelected: string;
  formattedRemaining: string;
  setAvailableMinutes: (minutes: number) => void;
  setMainFocus: (taskId: string | null, customText?: string) => void;
  addToToday: (taskId: string) => void;
  removeFromToday: (taskId: string) => void;
  setScheduledTime: (taskId: string, slot: string) => void;
  clearScheduledTime: (taskId: string) => void;
  resetToDefaultPlan: () => void;
  isLoaded: boolean;
}

const TodayPlanContext = createContext<TodayPlanContextType | undefined>(undefined);

export function TodayPlanProvider({ children }: { children: React.ReactNode }) {
  const { tasks, isLoaded: tasksLoaded } = useTasks();
  const { settings } = useSettings();
  const [todayPlan, setTodayPlan] = useState<TodayPlanState>(DEFAULT_TODAY_PLAN);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TODAY_PLAN_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTodayPlan(parsed);
      } else if (settings?.availableHoursPerDay) {
        setTodayPlan({
          ...DEFAULT_TODAY_PLAN,
          availableMinutes: settings.availableHoursPerDay * 60,
        });
      }
    } catch (err) {
      console.error('Failed to load Today Plan:', err);
    } finally {
      setIsLoaded(true);
    }
  }, [settings?.availableHoursPerDay]);

  const savePlan = (newPlan: TodayPlanState) => {
    setTodayPlan(newPlan);
    try {
      localStorage.setItem(TODAY_PLAN_STORAGE_KEY, JSON.stringify(newPlan));
    } catch (err) {
      console.error('Failed to save Today Plan:', err);
    }
  };

  const setAvailableMinutes = (minutes: number) => {
    savePlan({ ...todayPlan, availableMinutes: Math.max(15, minutes) });
  };

  const setMainFocus = (taskId: string | null, customText?: string) => {
    let newSelected = [...todayPlan.selectedTaskIds];
    if (taskId && !newSelected.includes(taskId)) {
      newSelected.push(taskId);
    }
    savePlan({
      ...todayPlan,
      mainFocusTaskId: taskId,
      customMainFocus: customText || '',
      selectedTaskIds: newSelected,
    });
  };

  const addToToday = (taskId: string) => {
    if (!todayPlan.selectedTaskIds.includes(taskId)) {
      savePlan({
        ...todayPlan,
        selectedTaskIds: [...todayPlan.selectedTaskIds, taskId],
      });
    }
  };

  const removeFromToday = (taskId: string) => {
    savePlan({
      ...todayPlan,
      selectedTaskIds: todayPlan.selectedTaskIds.filter((id) => id !== taskId),
      mainFocusTaskId: todayPlan.mainFocusTaskId === taskId ? null : todayPlan.mainFocusTaskId,
    });
  };

  const setScheduledTime = (taskId: string, slot: string) => {
    addToToday(taskId);
    savePlan({
      ...todayPlan,
      scheduledSlots: {
        ...todayPlan.scheduledSlots,
        [taskId]: slot,
      },
    });
  };

  const clearScheduledTime = (taskId: string) => {
    const slots = { ...todayPlan.scheduledSlots };
    delete slots[taskId];
    savePlan({
      ...todayPlan,
      scheduledSlots: slots,
    });
  };

  const resetToDefaultPlan = () => {
    savePlan(DEFAULT_TODAY_PLAN);
  };

  // Resolved Task Categories for Today
  const todayTasks = tasks.filter((t) => todayPlan.selectedTaskIds.includes(t.id));
  
  const mainFocusTask = todayPlan.mainFocusTaskId
    ? tasks.find((t) => t.id === todayPlan.mainFocusTaskId) || null
    : null;

  const completedTodayTasks = todayTasks.filter((t) => t.status === 'done');
  
  // Non-completed tasks for sorting
  const activeTodayTasks = todayTasks.filter(
    (t) => t.status !== 'done' && t.id !== todayPlan.mainFocusTaskId
  );

  // Scheduled tasks
  const scheduledTasks = Object.entries(todayPlan.scheduledSlots)
    .map(([taskId, slot]) => {
      const task = tasks.find((t) => t.id === taskId);
      return task ? { task, slot } : null;
    })
    .filter((item): item is { task: Task; slot: string } => Boolean(item));

  const scheduledIds = new Set(scheduledTasks.map((s) => s.task.id));

  // Important tasks: High or Urgent priority not already scheduled or main focus
  const importantTasks = activeTodayTasks.filter(
    (t) => (t.priority === 'urgent' || t.priority === 'high') && !scheduledIds.has(t.id)
  );

  // Small tasks: Duration <= 25 mins or Medium/Low priority not in important/scheduled
  const smallTasks = activeTodayTasks.filter(
    (t) =>
      !importantTasks.some((it) => it.id === t.id) &&
      !scheduledIds.has(t.id) &&
      ((t.estimatedDuration && t.estimatedDuration <= 25) || t.priority === 'low' || t.priority === 'medium')
  );

  // Time Calculations (Phase 11)
  const defaultDuration = settings?.defaultTaskDuration || 30;
  
  // Total minutes for active tasks selected for today (including Main Focus)
  const totalSelectedMinutes = todayTasks
    .filter((t) => t.status !== 'done')
    .reduce((acc, t) => acc + (t.estimatedDuration || defaultDuration), 0);

  const remainingMinutes = todayPlan.availableMinutes - totalSelectedMinutes;
  const isOverallocated = remainingMinutes < 0;
  const overallocatedDifference = Math.abs(remainingMinutes);

  const formattedAvailable = formatMinutesToHuman(todayPlan.availableMinutes);
  const formattedSelected = formatMinutesToHuman(totalSelectedMinutes);
  const formattedRemaining = isOverallocated
    ? `${formatMinutesToHuman(overallocatedDifference)} over`
    : `${formatMinutesToHuman(remainingMinutes)} remaining`;

  return (
    <TodayPlanContext.Provider
      value={{
        todayPlan,
        availableMinutes: todayPlan.availableMinutes,
        mainFocusTask,
        customMainFocus: todayPlan.customMainFocus || '',
        importantTasks,
        smallTasks,
        scheduledTasks,
        completedTodayTasks,
        todayTasks,
        totalSelectedMinutes,
        remainingMinutes,
        isOverallocated,
        overallocatedDifference,
        formattedAvailable,
        formattedSelected,
        formattedRemaining,
        setAvailableMinutes,
        setMainFocus,
        addToToday,
        removeFromToday,
        setScheduledTime,
        clearScheduledTime,
        resetToDefaultPlan,
        isLoaded: isLoaded && tasksLoaded,
      }}
    >
      {children}
    </TodayPlanContext.Provider>
  );
}

export function useTodayPlan(): TodayPlanContextType {
  const context = useContext(TodayPlanContext);
  if (!context) {
    throw new Error('useTodayPlan must be used within a TodayPlanProvider');
  }
  return context;
}
