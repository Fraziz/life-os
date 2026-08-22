'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Habit, HabitCheckIn } from '@/types';
import { useGoals } from './GoalContext';
import { loadJsonArray } from '@/lib/localStore';

const HABITS_STORAGE_KEY = 'life_os_habits_v1';
const CHECKINS_STORAGE_KEY = 'life_os_habit_checkins_v1';

export const DEFAULT_HABITS: Habit[] = [
  {
    id: 'habit-blender',
    title: 'Practice Blender',
    description: '3D modeling, hard surface, shader nodes, and lighting experiments.',
    frequency: 'weekly',
    targetCount: 4,
    parentGoalId: 'goal-2',
    color: '#f59e0b',
    icon: 'box',
    isOptional: true,
    reminderTime: '18:30',
    reminderNote: 'Fire up Blender for 30 minutes of low-poly sculpt or UV mapping.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'habit-read',
    title: 'Read 20 mins',
    description: 'Books on game design, philosophy, programming architecture, or business.',
    frequency: 'daily',
    targetCount: 1,
    color: '#38bdf8',
    icon: 'book',
    isOptional: true,
    reminderTime: '21:30',
    reminderNote: 'Wind down with 20 pages of quiet reading.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'habit-game',
    title: 'Work on game',
    description: 'Push 1 tangible commit or feature to Blobbit mechanics daily.',
    frequency: 'daily',
    targetCount: 1,
    parentGoalId: 'goal-1',
    color: '#7c6aff',
    icon: 'gamepad',
    isOptional: true,
    reminderTime: '09:00',
    reminderNote: 'Morning development sprint on core physics and controls.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'habit-music',
    title: 'Practice music',
    description: 'Synthesizer sound design, chord progressions, and ambient arrangements.',
    frequency: 'custom',
    targetCount: 3,
    customDays: [1, 3, 5], // Mon, Wed, Fri
    parentGoalId: 'goal-3',
    color: '#ec4899',
    icon: 'music',
    isOptional: true,
    reminderTime: '20:00',
    reminderNote: 'Explore atmospheric textures and modular synth patches.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Seed recent check-ins over the past week
export function generateSeedCheckIns(): HabitCheckIn[] {
  const checkIns: HabitCheckIn[] = [];
  const today = new Date();

  // Blender: checked 3 times this week (yesterday, 3 days ago, 5 days ago)
  [1, 3, 5].forEach((daysAgo) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().split('T')[0];
    checkIns.push({
      id: `chk-bld-${dateStr}`,
      habitId: 'habit-blender',
      date: dateStr,
      count: 1,
      completed: true,
      createdAt: d.toISOString(),
    });
  });

  // Read: checked 5 of last 6 days
  [0, 1, 2, 4, 5].forEach((daysAgo) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().split('T')[0];
    checkIns.push({
      id: `chk-read-${dateStr}`,
      habitId: 'habit-read',
      date: dateStr,
      count: 1,
      completed: true,
      createdAt: d.toISOString(),
    });
  });

  // Game: checked yesterday and today
  [0, 1, 2, 3].forEach((daysAgo) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().split('T')[0];
    checkIns.push({
      id: `chk-game-${dateStr}`,
      habitId: 'habit-game',
      date: dateStr,
      count: 1,
      completed: true,
      createdAt: d.toISOString(),
    });
  });

  // Music: checked 2 days ago
  [2, 4].forEach((daysAgo) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().split('T')[0];
    checkIns.push({
      id: `chk-mus-${dateStr}`,
      habitId: 'habit-music',
      date: dateStr,
      count: 1,
      completed: true,
      createdAt: d.toISOString(),
    });
  });

  return checkIns;
}

interface HabitContextType {
  habits: Habit[];
  checkIns: HabitCheckIn[];
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateHabit: (id: string, partial: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitCheckIn: (habitId: string, dateStr?: string) => void;
  isHabitCompletedOnDate: (habitId: string, dateStr: string) => boolean;
  getWeeklyCompletionsCount: (habitId: string) => number;
  getTotalCompletionsCount: (habitId: string) => number;
  getPast7DaysStatus: (habitId: string) => { date: string; dayName: string; completed: boolean }[];
  resetToDefaultHabits: () => void;
  isLoaded: boolean;
}

const HabitContext = createContext<HabitContextType | undefined>(undefined);

export function HabitProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded: goalsLoaded } = useGoals();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkIns, setCheckIns] = useState<HabitCheckIn[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const reloadFromStorage = () => {
    try {
      const parsedHabits = loadJsonArray<Habit>(HABITS_STORAGE_KEY);
      if (parsedHabits && parsedHabits.length > 0) setHabits(parsedHabits);
      else if (!parsedHabits) setHabits(DEFAULT_HABITS);

      const parsedCheckIns = loadJsonArray<HabitCheckIn>(CHECKINS_STORAGE_KEY);
      if (parsedCheckIns) setCheckIns(parsedCheckIns);
      else setCheckIns(generateSeedCheckIns());
    } catch (err) {
      console.error('Failed to load Habits data:', err);
    }
  };

  useEffect(() => {
    reloadFromStorage();
    setIsLoaded(true);

    const handleSync = () => reloadFromStorage();
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, []);

  const saveHabits = (newHabits: Habit[]) => {
    setHabits(newHabits);
    try {
      localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(newHabits));
    } catch (err) {
      console.error('Failed to save habits:', err);
    }
  };

  const saveCheckIns = (newCheckIns: HabitCheckIn[]) => {
    setCheckIns(newCheckIns);
    try {
      localStorage.setItem(CHECKINS_STORAGE_KEY, JSON.stringify(newCheckIns));
    } catch (err) {
      console.error('Failed to save habit check-ins:', err);
    }
  };

  const addHabit = (data: Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newHabit: Habit = {
      ...data,
      id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveHabits([newHabit, ...habits]);
  };

  const updateHabit = (id: string, partial: Partial<Habit>) => {
    const updated = habits.map((h) =>
      h.id === id ? { ...h, ...partial, updatedAt: new Date().toISOString() } : h
    );
    saveHabits(updated);
  };

  const deleteHabit = (id: string) => {
    saveHabits(habits.filter((h) => h.id !== id));
    saveCheckIns(checkIns.filter((c) => c.habitId !== id));
  };

  const toggleHabitCheckIn = (habitId: string, dateStr?: string) => {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const existingIndex = checkIns.findIndex(
      (c) => c.habitId === habitId && c.date === targetDate
    );

    if (existingIndex >= 0) {
      // Toggle off / remove check-in
      const updated = checkIns.filter((_, idx) => idx !== existingIndex);
      saveCheckIns(updated);
    } else {
      // Add check-in
      const newCheckIn: HabitCheckIn = {
        id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        habitId,
        date: targetDate,
        count: 1,
        completed: true,
        createdAt: new Date().toISOString(),
      };
      saveCheckIns([newCheckIn, ...checkIns]);
    }
  };

  const isHabitCompletedOnDate = (habitId: string, dateStr: string) => {
    return checkIns.some((c) => c.habitId === habitId && c.date === dateStr && c.completed);
  };

  const getWeeklyCompletionsCount = (habitId: string) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekStartStr = startOfWeek.toISOString().split('T')[0];

    return checkIns.filter(
      (c) => c.habitId === habitId && c.completed && c.date >= weekStartStr
    ).length;
  };

  const getTotalCompletionsCount = (habitId: string) => {
    return checkIns.filter((c) => c.habitId === habitId && c.completed).length;
  };

  const getPast7DaysStatus = (habitId: string) => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i)); // 6 days ago up to today
      const dateStr = d.toISOString().split('T')[0];
      return {
        date: dateStr,
        dayName: d.toLocaleDateString([], { weekday: 'narrow' }),
        completed: isHabitCompletedOnDate(habitId, dateStr),
      };
    });
  };

  const resetToDefaultHabits = () => {
    saveHabits(DEFAULT_HABITS);
    const seedCheckIns = generateSeedCheckIns();
    saveCheckIns(seedCheckIns);
  };

  return (
    <HabitContext.Provider
      value={{
        habits,
        checkIns,
        addHabit,
        updateHabit,
        deleteHabit,
        toggleHabitCheckIn,
        isHabitCompletedOnDate,
        getWeeklyCompletionsCount,
        getTotalCompletionsCount,
        getPast7DaysStatus,
        resetToDefaultHabits,
        isLoaded: isLoaded && goalsLoaded,
      }}
    >
      {children}
    </HabitContext.Provider>
  );
}

export function useHabits(): HabitContextType {
  const context = useContext(HabitContext);
  if (!context) {
    throw new Error('useHabits must be used within a HabitProvider');
  }
  return context;
}
