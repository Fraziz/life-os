'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type {
  Interest,
  InterestLevel,
  CommitmentSprint,
  WeeklyCheckpoint,
  FinalEvaluation,
  GrowthReflection,
} from '@/types/growth';
import { loadJsonArray, loadJsonObject, saveJson, touchUpdateMeta } from '@/lib/localStore';

const INTERESTS_STORAGE_KEY = 'life_os_growth_interests_v1';
const SPRINTS_STORAGE_KEY = 'life_os_growth_sprints_v1';
const REFLECTION_STORAGE_KEY = 'life_os_growth_reflection_v1';

export const DEFAULT_INTERESTS: Interest[] = [
  {
    id: 'interest-1',
    title: 'Full-Stack Software Architecture & Systems Design',
    level: 'primary',
    category: 'Engineering',
    notes: 'Allocating 70%+ of deep work time toward high-craft engineering and system mastery.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'interest-2',
    title: 'Guitar Mastery & Music Theory',
    level: 'secondary',
    category: 'Creative',
    notes: '20-30 minutes of deliberate fretboard and rhythm practice daily without guilt.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'interest-3',
    title: 'Strength Conditioning & Mobility',
    level: 'secondary',
    category: 'Health',
    notes: 'Sustained energy and physical resilience through regular workouts.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'interest-4',
    title: '3D Procedural Shaders & Blender',
    level: 'exploration',
    category: 'Design & Graphics',
    notes: 'Curiosity sandbox: weekend afternoons only. Zero pressure to produce or monetize.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'interest-5',
    title: 'Cognitive Science & Executive Function Systems',
    level: 'exploration',
    category: 'Psychology',
    notes: 'Casual reading on behavioral psychology and ADHD-friendly productivity.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function generate13Checkpoints(startDateStr: string): WeeklyCheckpoint[] {
  const start = new Date(startDateStr);
  const checkpoints: WeeklyCheckpoint[] = [];
  for (let i = 1; i <= 13; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + (i * 7));
    checkpoints.push({
      week: i,
      completed: i <= 2, // Example: first 2 weeks completed
      notes: i === 1 ? 'Solid setup and momentum established' : undefined,
    });
  }
  return checkpoints;
}

export const DEFAULT_SPRINT: CommitmentSprint = {
  id: 'sprint-1',
  title: '90-Day Mastery: Production Software Craft',
  startDate: new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0],
  endDate: new Date(Date.now() + 76 * 86400000).toISOString().split('T')[0],
  why: 'Break the habit of jumping to new projects when things get tough. Prove consistency over 90 continuous days.',
  weeklyCheckpoints: generate13Checkpoints(
    new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]
  ),
  milestones: [
    { id: 'sm-1', title: 'Complete core architectural primitives and state models', completed: true, targetWeek: 3 },
    { id: 'sm-2', title: 'Build out full responsive UI and verify edge cases', completed: true, targetWeek: 6 },
    { id: 'sm-3', title: 'Run user testing session and polish UX details', completed: false, targetWeek: 10 },
    { id: 'sm-4', title: 'Complete 90-day evaluation and celebrate milestone', completed: false, targetWeek: 13 },
  ],
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_REFLECTION: GrowthReflection = {
  struggle: 'shiny_object',
  aspirationalIdentity: 'synthesizer',
  reflectionAdvice:
    'You thrive at connecting disparate disciplines, but new ideas threaten your active work. Anchor yourself with the 1-Primary focus rule and park all exciting new ideas into your Exploration sandbox.',
  personalNotes: 'Remember: an idea parked in Exploration is not an idea abandoned; it is an idea protected for when you have real bandwidth.',
  updatedAt: new Date().toISOString(),
};

interface GrowthContextType {
  interests: Interest[];
  primaryInterests: Interest[];
  secondaryInterests: Interest[];
  explorationInterests: Interest[];
  addInterest: (interest: Omit<Interest, 'id' | 'createdAt' | 'updatedAt'>) => { success: boolean; error?: string };
  setPrimaryMastery: (data: { title: string; category?: string; notes?: string; linkedGoalId?: string }) => void;
  updateInterest: (id: string, updates: Partial<Interest>) => void;
  deleteInterest: (id: string) => void;
  moveInterestLevel: (id: string, newLevel: InterestLevel) => { success: boolean; error?: string };
  resetInterests: (fresh?: boolean) => void;
  sprints: CommitmentSprint[];
  activeSprint: CommitmentSprint | null;
  createSprint: (sprint: Omit<CommitmentSprint, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSprint: (id: string, updates: Partial<CommitmentSprint>) => void;
  toggleCheckpoint: (sprintId: string, week: number, notes?: string) => void;
  toggleMilestone: (sprintId: string, milestoneId: string) => void;
  evaluateSprint: (sprintId: string, evaluation: FinalEvaluation) => void;
  deleteSprint: (sprintId: string) => void;
  reflection: GrowthReflection | null;
  saveReflection: (reflection: GrowthReflection) => void;
  isLoaded: boolean;
}

const GrowthContext = createContext<GrowthContextType | undefined>(undefined);

export function GrowthProvider({ children }: { children: React.ReactNode }) {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [sprints, setSprints] = useState<CommitmentSprint[]>([]);
  const [reflection, setReflection] = useState<GrowthReflection | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const storedInterests = loadJsonArray<Interest>(INTERESTS_STORAGE_KEY);
      setInterests(storedInterests && storedInterests.length > 0 ? storedInterests : DEFAULT_INTERESTS);

      const storedSprints = loadJsonArray<CommitmentSprint>(SPRINTS_STORAGE_KEY);
      setSprints(storedSprints && storedSprints.length > 0 ? storedSprints : [DEFAULT_SPRINT]);

      const storedReflection = loadJsonObject<GrowthReflection>(REFLECTION_STORAGE_KEY);
      setReflection(storedReflection || DEFAULT_REFLECTION);
    } catch {
      setInterests(DEFAULT_INTERESTS);
      setSprints([DEFAULT_SPRINT]);
      setReflection(DEFAULT_REFLECTION);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveInterests = (next: Interest[]) => {
    setInterests(next);
    saveJson(INTERESTS_STORAGE_KEY, next);
    touchUpdateMeta(INTERESTS_STORAGE_KEY);
  };

  const saveSprints = (next: CommitmentSprint[]) => {
    setSprints(next);
    saveJson(SPRINTS_STORAGE_KEY, next);
    touchUpdateMeta(SPRINTS_STORAGE_KEY);
  };

  const primaryInterests = interests.filter((i) => i.level === 'primary');
  const secondaryInterests = interests.filter((i) => i.level === 'secondary');
  const explorationInterests = interests.filter((i) => i.level === 'exploration');

  const addInterest = (data: Omit<Interest, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (data.level === 'primary' && primaryInterests.length >= 1) {
      return {
        success: false,
        error: 'Primary Focus is strictly limited to 1 interest at a time. Move your existing Primary to Secondary or Exploration first to maintain deliberate focus.',
      };
    }
    if (data.level === 'secondary' && secondaryInterests.length >= 2) {
      return {
        success: false,
        error: 'Secondary Focus is limited to at most 2 interests. Move an existing interest to Exploration first.',
      };
    }

    const newInterest: Interest = {
      ...data,
      id: `interest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveInterests([...interests, newInterest]);
    return { success: true };
  };

  const updateInterest = (id: string, updates: Partial<Interest>) => {
    const next = interests.map((item) =>
      item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
    );
    saveInterests(next);
  };

  const deleteInterest = (id: string) => {
    saveInterests(interests.filter((i) => i.id !== id));
  };

  const moveInterestLevel = (id: string, newLevel: InterestLevel) => {
    const target = interests.find((i) => i.id === id);
    if (!target) return { success: false, error: 'Interest not found' };
    if (target.level === newLevel) return { success: true };

    if (newLevel === 'primary') {
      // Smooth auto-swap: If a primary already exists, demote it to secondary (if room) or exploration
      const existingPrimary = interests.find((i) => i.level === 'primary');
      const next = interests.map((item) => {
        if (item.id === id) {
          return { ...item, level: 'primary' as InterestLevel, updatedAt: new Date().toISOString() };
        }
        if (existingPrimary && item.id === existingPrimary.id) {
          const currentSecCount = interests.filter((i) => i.level === 'secondary' && i.id !== id).length;
          const demotedLevel: InterestLevel = currentSecCount < 2 ? 'secondary' : 'exploration';
          return { ...item, level: demotedLevel, updatedAt: new Date().toISOString() };
        }
        return item;
      });
      saveInterests(next);
      return { success: true };
    }

    if (newLevel === 'secondary' && secondaryInterests.length >= 2) {
      return {
        success: false,
        error: 'Secondary Focus is limited to 2 interests. Demote one to Exploration first.',
      };
    }

    const next = interests.map((item) =>
      item.id === id ? { ...item, level: newLevel, updatedAt: new Date().toISOString() } : item
    );
    saveInterests(next);
    return { success: true };
  };

  const setPrimaryMastery = (data: {
    title: string;
    category?: string;
    notes?: string;
    linkedGoalId?: string;
  }) => {
    const currentPrimary = interests.find((i) => i.level === 'primary');
    if (currentPrimary) {
      const next = interests.map((item) =>
        item.id === currentPrimary.id
          ? {
              ...item,
              title: data.title.trim(),
              category: data.category?.trim() || undefined,
              notes: data.notes?.trim() || undefined,
              linkedGoalId: data.linkedGoalId || undefined,
              updatedAt: new Date().toISOString(),
            }
          : item
      );
      saveInterests(next);
    } else {
      const newPrimary: Interest = {
        id: `interest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: data.title.trim(),
        level: 'primary',
        category: data.category?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        linkedGoalId: data.linkedGoalId || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveInterests([newPrimary, ...interests]);
    }
  };

  const resetInterests = (fresh?: boolean) => {
    if (fresh) {
      saveInterests([]);
    } else {
      saveInterests(DEFAULT_INTERESTS);
    }
  };

  const activeSprint = sprints.find((s) => s.status === 'active') || null;

  const createSprint = (data: Omit<CommitmentSprint, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newSprint: CommitmentSprint = {
      ...data,
      id: `sprint-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Mark previous active sprints as completed/paused
    const next = sprints.map((s) =>
      s.status === 'active' ? { ...s, status: 'paused' as const } : s
    );
    saveSprints([newSprint, ...next]);
  };

  const updateSprint = (id: string, updates: Partial<CommitmentSprint>) => {
    const next = sprints.map((s) =>
      s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
    );
    saveSprints(next);
  };

  const toggleCheckpoint = (sprintId: string, week: number, notes?: string) => {
    const next = sprints.map((s) => {
      if (s.id !== sprintId) return s;
      const updatedCheckpoints = s.weeklyCheckpoints.map((cp) => {
        if (cp.week !== week) return cp;
        return {
          ...cp,
          completed: !cp.completed,
          notes: notes !== undefined ? notes : cp.notes,
          updatedAt: new Date().toISOString(),
        };
      });
      return { ...s, weeklyCheckpoints: updatedCheckpoints, updatedAt: new Date().toISOString() };
    });
    saveSprints(next);
  };

  const toggleMilestone = (sprintId: string, milestoneId: string) => {
    const next = sprints.map((s) => {
      if (s.id !== sprintId) return s;
      const updatedMilestones = s.milestones.map((m) =>
        m.id === milestoneId ? { ...m, completed: !m.completed } : m
      );
      return { ...s, milestones: updatedMilestones, updatedAt: new Date().toISOString() };
    });
    saveSprints(next);
  };

  const evaluateSprint = (sprintId: string, evaluation: FinalEvaluation) => {
    const next = sprints.map((s) => {
      if (s.id !== sprintId) return s;
      return {
        ...s,
        status: 'evaluated' as const,
        finalEvaluation: evaluation,
        updatedAt: new Date().toISOString(),
      };
    });
    saveSprints(next);
  };

  const deleteSprint = (sprintId: string) => {
    saveSprints(sprints.filter((s) => s.id !== sprintId));
  };

  const handleSaveReflection = (newRef: GrowthReflection) => {
    setReflection(newRef);
    saveJson(REFLECTION_STORAGE_KEY, newRef);
    touchUpdateMeta(REFLECTION_STORAGE_KEY);
  };

  return (
    <GrowthContext.Provider
      value={{
        interests,
        primaryInterests,
        secondaryInterests,
        explorationInterests,
        addInterest,
        setPrimaryMastery,
        updateInterest,
        deleteInterest,
        moveInterestLevel,
        resetInterests,
        sprints,
        activeSprint,
        createSprint,
        updateSprint,
        toggleCheckpoint,
        toggleMilestone,
        evaluateSprint,
        deleteSprint,
        reflection,
        saveReflection: handleSaveReflection,
        isLoaded,
      }}
    >
      {children}
    </GrowthContext.Provider>
  );
}

export function useGrowth() {
  const ctx = useContext(GrowthContext);
  if (!ctx) {
    throw new Error('useGrowth must be used within a GrowthProvider');
  }
  return ctx;
}

