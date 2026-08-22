'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { Task, FocusModeType, FocusSession } from '@/types';
import { useTasks } from './TaskContext';
import { useSettings } from './SettingsContext';

const FOCUS_HISTORY_KEY = 'life_os_focus_history_v1';

export const DEFAULT_FOCUS_HISTORY: FocusSession[] = [
  {
    id: 'foc-1',
    taskId: 'task-blobbit-env',
    taskTitle: 'Create Blobbit environment — Terrain & Trees',
    durationMinutes: 45,
    mode: 'pomodoro',
    startedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 1.25).toISOString(),
    notes: 'Modeled procedural low-poly terrain mesh and planted pine tree clusters.',
  },
  {
    id: 'foc-2',
    taskId: 'task-1',
    taskTitle: 'Implement wall-jump vector math and friction curve',
    durationMinutes: 30,
    mode: 'custom',
    startedAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 86400000 + 1800000).toISOString(),
    notes: 'Refactored detachment impulse velocity.',
  },
];

interface FocusContextType {
  activeTask: Task | null;
  customTaskTitle: string;
  mode: FocusModeType;
  timerDurationSeconds: number;
  secondsRemaining: number;
  secondsElapsed: number;
  isRunning: boolean;
  isZenMode: boolean;
  focusHistory: FocusSession[];
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  finishSession: (notes?: string, markTaskCompleted?: boolean) => void;
  selectFocusTask: (task: Task | null, customTitle?: string) => void;
  setTimerMode: (newMode: FocusModeType, customMinutes?: number) => void;
  toggleZenMode: () => void;
  clearFocusHistory: () => void;
  resetToDefaultHistory: () => void;
  isLoaded: boolean;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const { tasks, updateTask, toggleTaskDone } = useTasks();
  const { settings } = useSettings();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [customTaskTitle, setCustomTaskTitle] = useState<string>('Create Blobbit environment');
  const [mode, setMode] = useState<FocusModeType>('pomodoro');
  const [timerDurationSeconds, setTimerDurationSeconds] = useState<number>(25 * 60);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(25 * 60);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [focusHistory, setFocusHistory] = useState<FocusSession[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const sessionStartRef = useRef<string | null>(null);

  // Load focus history and default active task on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FOCUS_HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setFocusHistory(parsed);
      }
    } catch (err) {
      console.error('Failed to load focus history:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Sync default active task from tasks list
  useEffect(() => {
    if (!activeTask && tasks.length > 0) {
      const candidate = tasks.find((t) => t.status === 'doing') || tasks[0];
      if (candidate) {
        setActiveTask(candidate);
        setCustomTaskTitle(candidate.title);
      }
    }
  }, [tasks, activeTask]);

  const saveHistory = (newHistory: FocusSession[]) => {
    setFocusHistory(newHistory);
    try {
      localStorage.setItem(FOCUS_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (err) {
      console.error('Failed to save focus history:', err);
    }
  };

  // Timer Tick Interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning) {
      if (!sessionStartRef.current) {
        sessionStartRef.current = new Date().toISOString();
      }

      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);

        if (mode === 'flow') {
          // Flow mode counts up indefinitely
          setSecondsRemaining((prev) => prev + 1);
        } else {
          setSecondsRemaining((prev) => {
            if (prev <= 1) {
              // Timer finished
              setIsRunning(false);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, mode]);

  const startTimer = () => {
    if (!sessionStartRef.current) {
      sessionStartRef.current = new Date().toISOString();
    }
    setIsRunning(true);
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setSecondsRemaining(timerDurationSeconds);
    setSecondsElapsed(0);
    sessionStartRef.current = null;
  };

  const setTimerMode = (newMode: FocusModeType, customMinutes?: number) => {
    setIsRunning(false);
    setMode(newMode);
    sessionStartRef.current = null;
    setSecondsElapsed(0);

    let durationSec = 25 * 60;
    if (newMode === 'pomodoro') {
      const prefPomo = settings?.focusPreferences?.pomodoroDuration || 25;
      durationSec = prefPomo * 60;
    } else if (newMode === 'short_break') {
      const prefBreak = settings?.focusPreferences?.shortBreakDuration || 5;
      durationSec = prefBreak * 60;
    } else if (newMode === 'long_break') {
      const prefLong = settings?.focusPreferences?.longBreakDuration || 15;
      durationSec = prefLong * 60;
    } else if (newMode === 'custom') {
      durationSec = (customMinutes || 30) * 60;
    } else if (newMode === 'flow') {
      durationSec = 0;
    }

    setTimerDurationSeconds(durationSec);
    setSecondsRemaining(durationSec);
  };

  const selectFocusTask = (task: Task | null, customTitle?: string) => {
    setActiveTask(task);
    if (task) {
      setCustomTaskTitle(task.title);
      if (task.estimatedDuration && task.estimatedDuration > 0) {
        setTimerMode('custom', task.estimatedDuration);
      }
    } else if (customTitle) {
      setCustomTaskTitle(customTitle);
    }
  };

  const finishSession = (notes?: string, markTaskCompleted = false) => {
    const elapsedMinutes = Math.max(1, Math.round(secondsElapsed / 60));
    const title = activeTask ? activeTask.title : customTaskTitle || 'Focus Session';

    const newSession: FocusSession = {
      id: `foc-${Date.now()}`,
      taskId: activeTask?.id,
      taskTitle: title,
      durationMinutes: elapsedMinutes,
      mode,
      startedAt: sessionStartRef.current || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      notes: notes || undefined,
    };

    saveHistory([newSession, ...focusHistory]);

    // Update actual duration on task if linked
    if (activeTask) {
      const currentActual = activeTask.actualDuration || 0;
      updateTask(activeTask.id, {
        actualDuration: currentActual + elapsedMinutes,
        status: markTaskCompleted ? 'done' : 'doing',
        completedAt: markTaskCompleted ? new Date().toISOString() : undefined,
      });
    }

    resetTimer();
  };

  const toggleZenMode = () => {
    setIsZenMode((prev) => !prev);
  };

  const clearFocusHistory = () => {
    saveHistory([]);
  };

  const resetToDefaultHistory = () => {
    saveHistory(DEFAULT_FOCUS_HISTORY);
  };

  return (
    <FocusContext.Provider
      value={{
        activeTask,
        customTaskTitle,
        mode,
        timerDurationSeconds,
        secondsRemaining,
        secondsElapsed,
        isRunning,
        isZenMode,
        focusHistory,
        startTimer,
        pauseTimer,
        resetTimer,
        finishSession,
        selectFocusTask,
        setTimerMode,
        toggleZenMode,
        clearFocusHistory,
        resetToDefaultHistory,
        isLoaded,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus(): FocusContextType {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
}
