'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { LifeArea } from '@/types';
import { loadJsonArray } from '@/lib/localStore';

const AREAS_STORAGE_KEY = 'life_os_areas_v1';

export const DEFAULT_LIFE_AREAS: LifeArea[] = [
  {
    id: 'area-personal',
    name: 'Personal',
    color: '#a594ff',
    icon: 'User',
    description: 'Self-care, personal wellbeing, life goals, and daily reflection.',
    sortOrder: 1,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'area-career',
    name: 'Career & Business',
    color: '#3b82f6',
    icon: 'Briefcase',
    description: 'Professional growth, work projects, business ventures, and skills.',
    sortOrder: 2,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'area-money',
    name: 'Money & Wealth',
    color: '#10b981',
    icon: 'Wallet',
    description: 'Financial independence, budgeting, investments, and savings.',
    sortOrder: 3,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'area-learning',
    name: 'Learning & Growth',
    color: '#f59e0b',
    icon: 'BookOpen',
    description: 'Books, courses, skills, intellectual curiosity, and mental models.',
    sortOrder: 4,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'area-creative',
    name: 'Creative & Projects',
    color: '#ec4899',
    icon: 'Palette',
    description: 'Side projects, writing, design, music, and maker pursuits.',
    sortOrder: 5,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'area-health',
    name: 'Health & Vitality',
    color: '#f43f5e',
    icon: 'Heart',
    description: 'Fitness, nutrition, sleep, energy, and physical wellness.',
    sortOrder: 6,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'area-family',
    name: 'Family & Relationships',
    color: '#6366f1',
    icon: 'Users',
    description: 'Relationships with family, friends, community, and loved ones.',
    sortOrder: 7,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface LifeAreaContextType {
  areas: LifeArea[];
  activeAreas: LifeArea[];
  archivedAreas: LifeArea[];
  addArea: (area: Omit<LifeArea, 'id' | 'sortOrder' | 'isArchived' | 'createdAt' | 'updatedAt'>) => void;
  updateArea: (id: string, partial: Partial<LifeArea>) => void;
  reorderArea: (id: string, direction: 'up' | 'down') => void;
  toggleArchiveArea: (id: string) => void;
  deleteArea: (id: string) => void;
  resetToDefaultAreas: () => void;
  isLoaded: boolean;
}

const LifeAreaContext = createContext<LifeAreaContextType | undefined>(undefined);

export function LifeAreaProvider({ children }: { children: React.ReactNode }) {
  const [areas, setAreas] = useState<LifeArea[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const reloadFromStorage = () => {
    try {
      const parsed = loadJsonArray<LifeArea>(AREAS_STORAGE_KEY);
      if (parsed && parsed.length > 0) setAreas(parsed);
      else if (!parsed) setAreas(DEFAULT_LIFE_AREAS);
    } catch (err) {
      console.error('Failed to load Life Areas:', err);
    }
  };

  useEffect(() => {
    reloadFromStorage();
    setIsLoaded(true);

    const handleSync = () => reloadFromStorage();
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, []);

  // Save to localStorage whenever areas change
  const saveAreas = (newAreas: LifeArea[]) => {
    // Sort by sortOrder
    const sorted = [...newAreas].sort((a, b) => a.sortOrder - b.sortOrder);
    setAreas(sorted);
    try {
      localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(sorted));
    } catch (err) {
      console.error('Failed to save Life Areas:', err);
    }
  };

  const activeAreas = areas.filter((a) => !a.isArchived).sort((a, b) => a.sortOrder - b.sortOrder);
  const archivedAreas = areas.filter((a) => a.isArchived).sort((a, b) => a.sortOrder - b.sortOrder);

  const addArea = (data: Omit<LifeArea, 'id' | 'sortOrder' | 'isArchived' | 'createdAt' | 'updatedAt'>) => {
    const maxSort = areas.reduce((max, a) => Math.max(max, a.sortOrder), 0);
    const newArea: LifeArea = {
      ...data,
      id: `area-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sortOrder: maxSort + 1,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveAreas([...areas, newArea]);
  };

  const updateArea = (id: string, partial: Partial<LifeArea>) => {
    const updated = areas.map((a) =>
      a.id === id ? { ...a, ...partial, updatedAt: new Date().toISOString() } : a
    );
    saveAreas(updated);
  };

  const reorderArea = (id: string, direction: 'up' | 'down') => {
    const sortedActive = [...activeAreas];
    const index = sortedActive.findIndex((a) => a.id === id);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedActive.length) return;

    // Swap sortOrders
    const currentArea = sortedActive[index];
    const targetArea = sortedActive[targetIndex];

    const tempOrder = currentArea.sortOrder;
    currentArea.sortOrder = targetArea.sortOrder;
    targetArea.sortOrder = tempOrder;

    const updated = areas.map((a) => {
      if (a.id === currentArea.id) return { ...a, sortOrder: currentArea.sortOrder };
      if (a.id === targetArea.id) return { ...a, sortOrder: targetArea.sortOrder };
      return a;
    });

    saveAreas(updated);
  };

  const toggleArchiveArea = (id: string) => {
    const updated = areas.map((a) =>
      a.id === id
        ? { ...a, isArchived: !a.isArchived, updatedAt: new Date().toISOString() }
        : a
    );
    saveAreas(updated);
  };

  const deleteArea = (id: string) => {
    const updated = areas.filter((a) => a.id !== id);
    saveAreas(updated);
  };

  const resetToDefaultAreas = () => {
    saveAreas(DEFAULT_LIFE_AREAS);
  };

  return (
    <LifeAreaContext.Provider
      value={{
        areas,
        activeAreas,
        archivedAreas,
        addArea,
        updateArea,
        reorderArea,
        toggleArchiveArea,
        deleteArea,
        resetToDefaultAreas,
        isLoaded,
      }}
    >
      {children}
    </LifeAreaContext.Provider>
  );
}

export function useLifeAreas(): LifeAreaContextType {
  const context = useContext(LifeAreaContext);
  if (!context) {
    throw new Error('useLifeAreas must be used within a LifeAreaProvider');
  }
  return context;
}
