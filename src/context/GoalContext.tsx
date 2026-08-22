'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Goal, GoalStatus } from '@/types';
import { loadJsonArray } from '@/lib/localStore';

const GOALS_STORAGE_KEY = 'life_os_goals_v1';

export const DEFAULT_GOALS: Goal[] = [
  {
    id: 'goal-1',
    title: 'Develop 2D Movement & Physics Prototype',
    description: 'Build a responsive player controller with fluid jump physics, wall sliding, and collision detection.',
    why: 'Establish satisfying core mechanics before creating levels, ensuring the foundation of the game is fun.',
    parentDreamId: 'dream-1',
    lifeAreaId: 'area-creative',
    horizon: '90-day',
    targetDate: '2026-11-30',
    priority: 'high',
    status: 'in-progress',
    progress: 45,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'goal-2',
    title: 'Build 6-Month Emergency & Independence Fund',
    description: 'Save 6 months of essential living expenses into a high-yield account.',
    why: 'Create financial resilience and peace of mind, freeing mental capacity for ambitious long-term goals.',
    parentDreamId: 'dream-2',
    lifeAreaId: 'area-money',
    horizon: 'yearly',
    targetDate: '2026-12-31',
    priority: 'high',
    status: 'in-progress',
    progress: 70,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'goal-3',
    title: 'Complete 3D Fundamentals & Low-Poly Scene',
    description: 'Model, texture, and light a full stylized low-poly environment in Blender.',
    why: 'Master 3D hotkeys, modifier workflows, and basic shaders to build confidence for future projects.',
    parentDreamId: 'dream-3',
    lifeAreaId: 'area-learning',
    horizon: 'monthly',
    targetDate: '2026-09-30',
    priority: 'medium',
    status: 'in-progress',
    progress: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'goal-4',
    title: 'Validate MVP Concept with 10 Beta Users',
    description: 'Conduct interviews, deploy an early prototype, and iterate based on structured feedback.',
    why: 'Confirm genuine demand and user excitement before investing months in full production.',
    parentDreamId: 'dream-4',
    lifeAreaId: 'area-career',
    horizon: 'long-term',
    targetDate: '2027-03-31',
    priority: 'medium',
    status: 'not-started',
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface GoalContextType {
  goals: Goal[];
  activeGoals: Goal[];
  completedGoals: Goal[];
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateGoal: (id: string, partial: Partial<Goal>) => void;
  updateGoalProgress: (id: string, progress: number) => void;
  updateGoalStatus: (id: string, status: GoalStatus) => void;
  deleteGoal: (id: string) => void;
  resetToDefaultGoals: () => void;
  isLoaded: boolean;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

export function GoalProvider({ children }: { children: React.ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const reloadFromStorage = () => {
    try {
      const parsed = loadJsonArray<Goal>(GOALS_STORAGE_KEY);
      if (parsed && parsed.length > 0) setGoals(parsed);
      else if (!parsed) setGoals(DEFAULT_GOALS);
    } catch (err) {
      console.error('Failed to load Life OS goals:', err);
    }
  };

  useEffect(() => {
    reloadFromStorage();
    setIsLoaded(true);

    const handleSync = () => reloadFromStorage();
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, []);

  const saveGoals = (newGoals: Goal[]) => {
    setGoals(newGoals);
    try {
      localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(newGoals));
    } catch (err) {
      console.error('Failed to save Life OS goals:', err);
    }
  };

  const activeGoals = goals.filter((g) => g.status !== 'completed' && g.status !== 'archived');
  const completedGoals = goals.filter((g) => g.status === 'completed');

  const addGoal = (data: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newGoal: Goal = {
      ...data,
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveGoals([newGoal, ...goals]);
  };

  const updateGoal = (id: string, partial: Partial<Goal>) => {
    const updated = goals.map((g) => {
      if (g.id !== id) return g;
      const merged = { ...g, ...partial, updatedAt: new Date().toISOString() };
      // Auto-set status if progress hits 100
      if (merged.progress === 100 && merged.status !== 'completed') {
        merged.status = 'completed';
      }
      return merged;
    });
    saveGoals(updated);
  };

  const updateGoalProgress = (id: string, progress: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    updateGoal(id, {
      progress: clamped,
      status: clamped === 100 ? 'completed' : clamped > 0 ? 'in-progress' : 'not-started',
    });
  };

  const updateGoalStatus = (id: string, status: GoalStatus) => {
    updateGoal(id, {
      status,
      progress: status === 'completed' ? 100 : undefined,
    });
  };

  const deleteGoal = (id: string) => {
    const updated = goals.filter((g) => g.id !== id);
    saveGoals(updated);
  };

  const resetToDefaultGoals = () => {
    saveGoals(DEFAULT_GOALS);
  };

  return (
    <GoalContext.Provider
      value={{
        goals,
        activeGoals,
        completedGoals,
        addGoal,
        updateGoal,
        updateGoalProgress,
        updateGoalStatus,
        deleteGoal,
        resetToDefaultGoals,
        isLoaded,
      }}
    >
      {children}
    </GoalContext.Provider>
  );
}

export function useGoals(): GoalContextType {
  const context = useContext(GoalContext);
  if (!context) {
    throw new Error('useGoals must be used within a GoalProvider');
  }
  return context;
}
