'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Milestone, MilestoneStatus } from '@/types';
import { loadJsonArray } from '@/lib/localStore';

const MILESTONES_STORAGE_KEY = 'life_os_milestones_v1';

export const DEFAULT_MILESTONES: Milestone[] = [
  {
    id: 'milestone-1',
    goalId: 'goal-1', // Develop 2D Movement Prototype
    title: 'Character Controller & Fluid Jump Physics',
    description: 'Implement responsive kinematic body with variable jump height and ground detection.',
    status: 'completed',
    progress: 100,
    targetDate: '2026-09-15',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'milestone-2',
    goalId: 'goal-1', // Develop 2D Movement Prototype
    title: 'Wall-Slide, Wall-Jump & Dash Mechanics',
    description: 'Add state machine for aerial maneuvers, friction handling, and dash cooldown.',
    status: 'in-progress',
    progress: 60,
    targetDate: '2026-10-15',
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'milestone-3',
    goalId: 'goal-1', // Develop 2D Movement Prototype
    title: 'Input Buffer, Coyote Time & Game Feel Polish',
    description: 'Fine-tune input forgiving windows and squash/stretch animations.',
    status: 'upcoming',
    progress: 0,
    targetDate: '2026-11-15',
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'milestone-4',
    goalId: 'goal-2', // Emergency & Independence Fund
    title: 'Reach $15,000 Baseline Emergency Reserve',
    description: 'First 3 months of essential buffer in high-yield account.',
    status: 'completed',
    progress: 100,
    targetDate: '2026-08-01',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'milestone-5',
    goalId: 'goal-2', // Emergency & Independence Fund
    title: 'Reach Full $30,000 Independence Target',
    description: 'Full 6-month safety net establishing total financial runway.',
    status: 'in-progress',
    progress: 50,
    targetDate: '2026-12-31',
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'milestone-6',
    goalId: 'goal-3', // 3D Fundamentals
    title: 'Model Base Terrain & Isometric Diorama',
    description: 'Create low-poly island with stylized foliage, rocks, and water shaders.',
    status: 'in-progress',
    progress: 75,
    targetDate: '2026-09-10',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'milestone-7',
    goalId: 'goal-4', // Validate MVP
    title: 'Interview 10 Potential Users & Document Pain Points',
    description: 'Conduct structured 30-minute interviews to map workflow bottlenecks.',
    status: 'in-progress',
    progress: 40,
    targetDate: '2026-11-01',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface MilestoneContextType {
  milestones: Milestone[];
  activeMilestones: Milestone[];
  upcomingMilestones: Milestone[];
  addMilestone: (milestone: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>) => void;
  updateMilestone: (id: string, partial: Partial<Milestone>) => void;
  updateMilestoneProgress: (id: string, progress: number) => void;
  updateMilestoneStatus: (id: string, status: MilestoneStatus) => void;
  reorderMilestone: (id: string, direction: 'up' | 'down') => void;
  deleteMilestone: (id: string) => void;
  resetToDefaultMilestones: () => void;
  isLoaded: boolean;
}

const MilestoneContext = createContext<MilestoneContextType | undefined>(undefined);

export function MilestoneProvider({ children }: { children: React.ReactNode }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const reloadFromStorage = () => {
    try {
      const parsed = loadJsonArray<Milestone>(MILESTONES_STORAGE_KEY);
      if (parsed && parsed.length > 0) setMilestones(parsed);
      else if (!parsed) setMilestones(DEFAULT_MILESTONES);
    } catch (err) {
      console.error('Failed to load Life OS milestones:', err);
    }
  };

  useEffect(() => {
    reloadFromStorage();
    setIsLoaded(true);

    const handleSync = () => reloadFromStorage();
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, []);

  const saveMilestones = (newMilestones: Milestone[]) => {
    setMilestones(newMilestones);
    try {
      localStorage.setItem(MILESTONES_STORAGE_KEY, JSON.stringify(newMilestones));
    } catch (err) {
      console.error('Failed to save Life OS milestones:', err);
    }
  };

  const activeMilestones = milestones.filter((m) => m.status !== 'archived').sort((a, b) => a.sortOrder - b.sortOrder);
  const upcomingMilestones = milestones
    .filter((m) => m.status === 'upcoming' || m.status === 'in-progress')
    .sort((a, b) => {
      if (!a.targetDate) return 1;
      if (!b.targetDate) return -1;
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });

  const addMilestone = (data: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>) => {
    const goalMilestones = milestones.filter((m) => m.goalId === data.goalId);
    const maxSort = goalMilestones.reduce((max, m) => Math.max(max, m.sortOrder), 0);
    const newMilestone: Milestone = {
      ...data,
      id: `milestone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sortOrder: maxSort + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveMilestones([...milestones, newMilestone]);
  };

  const updateMilestone = (id: string, partial: Partial<Milestone>) => {
    const updated = milestones.map((m) => {
      if (m.id !== id) return m;
      const merged = { ...m, ...partial, updatedAt: new Date().toISOString() };
      if (merged.progress === 100 && merged.status !== 'completed') {
        merged.status = 'completed';
      }
      return merged;
    });
    saveMilestones(updated);
  };

  const updateMilestoneProgress = (id: string, progress: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    updateMilestone(id, {
      progress: clamped,
      status: clamped === 100 ? 'completed' : clamped > 0 ? 'in-progress' : 'upcoming',
    });
  };

  const updateMilestoneStatus = (id: string, status: MilestoneStatus) => {
    updateMilestone(id, {
      status,
      progress: status === 'completed' ? 100 : undefined,
    });
  };

  const reorderMilestone = (id: string, direction: 'up' | 'down') => {
    const target = milestones.find((m) => m.id === id);
    if (!target) return;

    const goalMilestones = milestones
      .filter((m) => m.goalId === target.goalId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const index = goalMilestones.findIndex((m) => m.id === id);
    if (index === -1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= goalMilestones.length) return;

    const swapTarget = goalMilestones[swapIndex];
    const tempOrder = target.sortOrder;
    target.sortOrder = swapTarget.sortOrder;
    swapTarget.sortOrder = tempOrder;

    const updated = milestones.map((m) => {
      if (m.id === target.id) return { ...m, sortOrder: target.sortOrder };
      if (m.id === swapTarget.id) return { ...m, sortOrder: swapTarget.sortOrder };
      return m;
    });

    saveMilestones(updated);
  };

  const deleteMilestone = (id: string) => {
    const updated = milestones.filter((m) => m.id !== id);
    saveMilestones(updated);
  };

  const resetToDefaultMilestones = () => {
    saveMilestones(DEFAULT_MILESTONES);
  };

  return (
    <MilestoneContext.Provider
      value={{
        milestones,
        activeMilestones,
        upcomingMilestones,
        addMilestone,
        updateMilestone,
        updateMilestoneProgress,
        updateMilestoneStatus,
        reorderMilestone,
        deleteMilestone,
        resetToDefaultMilestones,
        isLoaded,
      }}
    >
      {children}
    </MilestoneContext.Provider>
  );
}

export function useMilestones(): MilestoneContextType {
  const context = useContext(MilestoneContext);
  if (!context) {
    throw new Error('useMilestones must be used within a MilestoneProvider');
  }
  return context;
}
