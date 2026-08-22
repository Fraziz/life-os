'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { WeeklyReview } from '@/types';
import { useTasks } from './TaskContext';
import { useGoals } from './GoalContext';
import { useProjects } from './ProjectContext';
import { useFocus } from './FocusContext';
import { useHabits } from './HabitContext';
import { useMilestones } from './MilestoneContext';

const REVIEWS_STORAGE_KEY = 'life_os_weekly_reviews_v1';

export const DEFAULT_WEEKLY_REVIEWS: WeeklyReview[] = [
  {
    id: 'rev-prev-week',
    weekStartDate: new Date(Date.now() - 86400000 * 14).toISOString().split('T')[0],
    weekEndDate: new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0],
    completedTaskCount: 8,
    openTaskCount: 3,
    focusMinutesLogged: 320,
    goalsProgressedCount: 2,
    projectsProgressedCount: 2,
    habitsConsistencyRate: 85,
    importantWins: [
      'Completed player movement controller and jump velocity curve',
      'Modeled low-poly terrain mesh and tree assets',
      'Consistent Blender practice 4x this week',
    ],
    wentWell: 'Deep focus blocks in the morning were extremely productive. 45-minute focus timers kept momentum high without burning out.',
    didNotGoWell: 'Underestimated environment lighting setup time. Got sidetracked on shader node tweaks on Wednesday.',
    shouldChange: 'Break compound 3D environment tasks into smaller 20-minute chunks before starting.',
    nextWeekFocus: 'Finish Blobbit interactive level blockout and test character physics jump feel.',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];

interface CurrentWeekStats {
  weekStartStr: string;
  weekEndStr: string;
  completedTasks: { id: string; title: string; completedAt?: string }[];
  openTasks: { id: string; title: string }[];
  focusMinutes: number;
  goalsProgressed: { id: string; title: string; progress: number }[];
  projectsProgressed: { id: string; title: string; progress: number }[];
  habitsConsistency: number;
  importantWins: string[];
}

interface ReviewContextType {
  reviews: WeeklyReview[];
  currentWeekStats: CurrentWeekStats;
  saveWeeklyReview: (data: Omit<WeeklyReview, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deleteWeeklyReview: (id: string) => void;
  resetToDefaultReviews: () => void;
  isLoaded: boolean;
}

const ReviewContext = createContext<ReviewContextType | undefined>(undefined);

export function ReviewProvider({ children }: { children: React.ReactNode }) {
  const { tasks, isLoaded: tasksLoaded } = useTasks();
  const { goals, isLoaded: goalsLoaded } = useGoals();
  const { projects, isLoaded: projectsLoaded } = useProjects();
  const { milestones, isLoaded: milestonesLoaded } = useMilestones();
  const { focusHistory, isLoaded: focusLoaded } = useFocus();
  const { habits, getWeeklyCompletionsCount, isLoaded: habitsLoaded } = useHabits();

  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setReviews(parsed);
      }
    } catch (err) {
      console.error('Failed to load weekly reviews:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveReviews = (newReviews: WeeklyReview[]) => {
    setReviews(newReviews);
    try {
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(newReviews));
    } catch (err) {
      console.error('Failed to save weekly reviews:', err);
    }
  };

  const saveWeeklyReview = (data: Omit<WeeklyReview, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newRev: WeeklyReview = {
      ...data,
      id: `rev-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveReviews([newRev, ...reviews]);
  };

  const deleteWeeklyReview = (id: string) => {
    saveReviews(reviews.filter((r) => r.id !== id));
  };

  const resetToDefaultReviews = () => {
    saveReviews(DEFAULT_WEEKLY_REVIEWS);
  };

  // ── Compute current week roll-up ──
  const today = new Date();
  const startOfWeek = new Date(today);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const weekStartStr = startOfWeek.toISOString().split('T')[0];
  const weekEndStr = new Date(startOfWeek.getTime() + 86400000 * 6).toISOString().split('T')[0];

  const completedTasksThisWeek = tasks.filter(
    (t) => t.status === 'done' && (!t.completedAt || t.completedAt >= weekStartStr)
  );

  const openTasksThisWeek = tasks.filter((t) => t.status !== 'done');

  const focusMinutesThisWeek = focusHistory
    .filter((s) => s.completedAt >= weekStartStr)
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  const goalsProgressed = goals.filter((g) => g.progress > 0);
  const projectsProgressed = projects.filter((p) => p.progress > 0);

  // Habits consistency
  let habitTotalExpected = 0;
  let habitTotalDone = 0;
  habits.forEach((h) => {
    habitTotalExpected += h.targetCount;
    habitTotalDone += getWeeklyCompletionsCount(h.id);
  });
  const habitsConsistency = habitTotalExpected > 0 ? Math.min(100, Math.round((habitTotalDone / habitTotalExpected) * 100)) : 100;

  // Important wins from completed milestones and tasks
  const importantWins: string[] = [];
  milestones.filter((m) => m.status === 'completed').forEach((m) => importantWins.push(`Milestone completed: ${m.title}`));
  completedTasksThisWeek.slice(0, 4).forEach((t) => importantWins.push(t.title));

  const currentWeekStats: CurrentWeekStats = {
    weekStartStr,
    weekEndStr,
    completedTasks: completedTasksThisWeek.map((t) => ({ id: t.id, title: t.title, completedAt: t.completedAt })),
    openTasks: openTasksThisWeek.map((t) => ({ id: t.id, title: t.title })),
    focusMinutes: focusMinutesThisWeek,
    goalsProgressed: goalsProgressed.map((g) => ({ id: g.id, title: g.title, progress: g.progress })),
    projectsProgressed: projectsProgressed.map((p) => ({ id: p.id, title: p.title, progress: p.progress })),
    habitsConsistency,
    importantWins: importantWins.length > 0 ? importantWins : ['Made tangible forward progress on active projects'],
  };

  return (
    <ReviewContext.Provider
      value={{
        reviews,
        currentWeekStats,
        saveWeeklyReview,
        deleteWeeklyReview,
        resetToDefaultReviews,
        isLoaded: isLoaded && tasksLoaded && goalsLoaded && projectsLoaded && milestonesLoaded && focusLoaded && habitsLoaded,
      }}
    >
      {children}
    </ReviewContext.Provider>
  );
}

export function useReview(): ReviewContextType {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReview must be used within a ReviewProvider');
  }
  return context;
}
