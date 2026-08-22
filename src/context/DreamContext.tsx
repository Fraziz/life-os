'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Dream, DreamStatus } from '@/types';
import { loadJsonArray } from '@/lib/localStore';

const DREAMS_STORAGE_KEY = 'life_os_dreams_v1';

export const DEFAULT_DREAMS: Dream[] = [
  {
    id: 'dream-1',
    title: 'Build my own game',
    description: 'Design and develop an indie game with immersive atmosphere, unique mechanics, and rich storytelling.',
    whyItMatters: 'Express creative freedom, build digital worlds from scratch, and fulfill a lifelong childhood ambition.',
    lifeAreaId: 'area-creative',
    targetDate: '2027-12-31',
    status: 'dream',
    notes: 'Inspirations: Journey, Hollow Knight, Celeste. Focus on smooth movement & atmospheric sound design.',
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dream-2',
    title: 'Become financially independent',
    description: 'Build sustainable income streams and savings so work is driven by passion rather than necessity.',
    whyItMatters: 'Achieve complete autonomy over my time and schedule, allowing full peace of mind and freedom of choice.',
    lifeAreaId: 'area-money',
    targetDate: '2029-06-30',
    status: 'active',
    notes: 'Keep savings rate high, invest in diversified index funds, build assets.',
    imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dream-3',
    title: 'Learn 3D modeling & animation',
    description: 'Master Blender and 3D design fundamentals to craft environments, characters, and motion graphics.',
    whyItMatters: 'Unlock a new dimensional medium for self-expression and bring concept art to life.',
    lifeAreaId: 'area-learning',
    targetDate: '2026-12-31',
    status: 'planning',
    notes: 'Complete Blender Donut tutorial, study lighting and geometry nodes.',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dream-4',
    title: 'Build a creative business',
    description: 'Establish a self-sustaining creative venture delivering products & tools directly to people who value them.',
    whyItMatters: 'Create economic value while working on high-impact projects I genuinely care about.',
    lifeAreaId: 'area-career',
    targetDate: '2028-01-01',
    status: 'dream',
    notes: 'Focus on quality over volume. Build in public.',
    imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface DreamContextType {
  dreams: Dream[];
  activeDreams: Dream[];
  achievedDreams: Dream[];
  addDream: (dream: Omit<Dream, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateDream: (id: string, partial: Partial<Dream>) => void;
  updateDreamStatus: (id: string, status: DreamStatus) => void;
  deleteDream: (id: string) => void;
  resetToDefaultDreams: () => void;
  isLoaded: boolean;
}

const DreamContext = createContext<DreamContextType | undefined>(undefined);

export function DreamProvider({ children }: { children: React.ReactNode }) {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    try {
      const parsed = loadJsonArray<Dream>(DREAMS_STORAGE_KEY);
      if (parsed) setDreams(parsed);
    } catch (err) {
      console.error('Failed to load Life OS dreams:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveDreams = (newDreams: Dream[]) => {
    setDreams(newDreams);
    try {
      localStorage.setItem(DREAMS_STORAGE_KEY, JSON.stringify(newDreams));
    } catch (err) {
      console.error('Failed to save Life OS dreams:', err);
    }
  };

  const activeDreams = dreams.filter((d) => d.status !== 'achieved' && d.status !== 'archived');
  const achievedDreams = dreams.filter((d) => d.status === 'achieved');

  const addDream = (data: Omit<Dream, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newDream: Dream = {
      ...data,
      id: `dream-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveDreams([newDream, ...dreams]);
  };

  const updateDream = (id: string, partial: Partial<Dream>) => {
    const updated = dreams.map((d) =>
      d.id === id ? { ...d, ...partial, updatedAt: new Date().toISOString() } : d
    );
    saveDreams(updated);
  };

  const updateDreamStatus = (id: string, status: DreamStatus) => {
    updateDream(id, { status });
  };

  const deleteDream = (id: string) => {
    const updated = dreams.filter((d) => d.id !== id);
    saveDreams(updated);
  };

  const resetToDefaultDreams = () => {
    saveDreams(DEFAULT_DREAMS);
  };

  return (
    <DreamContext.Provider
      value={{
        dreams,
        activeDreams,
        achievedDreams,
        addDream,
        updateDream,
        updateDreamStatus,
        deleteDream,
        resetToDefaultDreams,
        isLoaded,
      }}
    >
      {children}
    </DreamContext.Provider>
  );
}

export function useDreams(): DreamContextType {
  const context = useContext(DreamContext);
  if (!context) {
    throw new Error('useDreams must be used within a DreamProvider');
  }
  return context;
}
