'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { InboxItem, InboxConvertedType } from '@/types';
import { useTasks } from './TaskContext';
import { useProjects } from './ProjectContext';
import { useGoals } from './GoalContext';
import { useDreams } from './DreamContext';
import { useKnowledge } from './KnowledgeContext';
import { loadJsonArray } from '@/lib/localStore';

const INBOX_STORAGE_KEY = 'life_os_inbox_v1';

export const DEFAULT_INBOX_ITEMS: InboxItem[] = [
  {
    id: 'inbox-link-questions',
    content:
      'LINK: CLASSROOM For school-safe questions, teamwork, communication, confidence, and friendship. LINK: TEENS More personal, funny, challenging, and relationship-oriented questions. LINK: AFTER HOURS Your more mature/social version for adults and older audiences.',
    status: 'inbox',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inbox-test-people',
    content: 'Is this good enough to test with real people?',
    status: 'inbox',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inbox-app-ideas',
    content: 'App ideas (inner child / fun)',
    status: 'inbox',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inbox-biz-ideas',
    content: 'Business name ideas (Groovy Club, etc.)',
    status: 'inbox',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inbox-motorcycle',
    content: 'Motorcycle research (XSR155 / Click / ADV)',
    status: 'inbox',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inbox-future-plans',
    content: 'Future plans / graduation anxiety',
    status: 'inbox',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inbox-random',
    content: 'Random ideas / dreams',
    status: 'inbox',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface InboxContextType {
  items: InboxItem[];
  activeItems: InboxItem[];
  convertedItems: InboxItem[];
  somedayItems: InboxItem[];
  quickDump: (content: string) => void;
  bulkDump: (lines: string[]) => void;
  deleteInboxItem: (id: string) => void;
  toggleItemApplied: (id: string) => void;
  convertToTask: (id: string, overrides?: { priority?: 'urgent' | 'high' | 'medium' | 'low'; projectId?: string }) => void;
  convertToProject: (id: string, overrides?: { lifeAreaId?: string; goalId?: string }) => void;
  convertToGoal: (id: string, overrides?: { horizon?: 'yearly' | '90-day' | 'monthly'; dreamId?: string }) => void;
  convertToDream: (id: string, overrides?: { lifeAreaId?: string; whyItMatters?: string }) => void;
  convertToNote: (id: string) => void;
  convertToProblemSolver: (id: string) => void;
  convertToSomeday: (id: string) => void;
  restoreToInbox: (id: string) => void;
  clearInbox: () => void;
  resetToDefaultInbox: () => void;
  isLoaded: boolean;
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const { addTask } = useTasks();
  const { addProject } = useProjects();
  const { addGoal } = useGoals();
  const { addDream } = useDreams();
  const { createProblemSolvingDoc } = useKnowledge();

  const [items, setItems] = useState<InboxItem[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const reloadFromStorage = () => {
    try {
      const parsed = loadJsonArray<InboxItem>(INBOX_STORAGE_KEY);
      setItems(parsed || []);
    } catch (err) {
      console.error('Failed to load inbox items:', err);
    }
  };

  useEffect(() => {
    reloadFromStorage();
    setIsLoaded(true);

    const handleSync = () => reloadFromStorage();
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, []);

  const saveItems = (newItems: InboxItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(newItems));
    } catch (err) {
      console.error('Failed to save inbox items:', err);
    }
  };

  const quickDump = (content: string) => {
    if (!content.trim()) return;
    const newItem: InboxItem = {
      id: `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content: content.trim(),
      status: 'inbox',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveItems([newItem, ...items]);
  };

  const bulkDump = (lines: string[]) => {
    const valid = lines.map((l) => l.trim()).filter(Boolean);
    if (valid.length === 0) return;

    const newItems: InboxItem[] = valid.map((content, idx) => ({
      id: `inbox-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      content,
      status: 'inbox',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    saveItems([...newItems, ...items]);
  };

  const deleteInboxItem = (id: string) => {
    saveItems(items.filter((i) => i.id !== id));
  };

  const updateItemStatus = (id: string, status: InboxItem['status'], convertedTo?: InboxConvertedType, entityId?: string) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        status,
        convertedTo,
        convertedEntityId: entityId,
        updatedAt: new Date().toISOString(),
      };
    });
    saveItems(updated);
  };

  const convertToTask = (id: string, overrides?: { priority?: 'urgent' | 'high' | 'medium' | 'low'; projectId?: string }) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    addTask({
      title: item.content,
      status: 'todo',
      priority: overrides?.priority || 'medium',
      projectId: overrides?.projectId,
      tags: ['from-inbox'],
      subtasks: [],
    });

    updateItemStatus(id, 'converted', 'task');
  };

  const convertToProject = (id: string, overrides?: { lifeAreaId?: string; goalId?: string }) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    addProject({
      title: item.content,
      description: 'Created from Brain Dump Inbox',
      status: 'active',
      priority: 'medium',
      progress: 0,
      goalId: overrides?.goalId,
      notes: item.content,
    });

    updateItemStatus(id, 'converted', 'project');
  };

  const convertToGoal = (id: string, overrides?: { horizon?: 'yearly' | '90-day' | 'monthly'; dreamId?: string }) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    addGoal({
      title: item.content,
      why: 'Transferred from spontaneous thought in Brain Dump',
      horizon: overrides?.horizon || '90-day',
      priority: 'medium',
      status: 'in-progress',
      progress: 0,
      parentDreamId: overrides?.dreamId,
    });

    updateItemStatus(id, 'converted', 'goal');
  };

  const convertToDream = (id: string, overrides?: { lifeAreaId?: string; whyItMatters?: string }) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    addDream({
      title: item.content,
      whyItMatters: overrides?.whyItMatters || 'Captured via Brain Dump',
      status: 'dream',
      lifeAreaId: overrides?.lifeAreaId,
    });

    updateItemStatus(id, 'converted', 'dream');
  };

  const convertToNote = (id: string) => {
    updateItemStatus(id, 'converted', 'note');
  };

  const toggleItemApplied = (id: string) => {
    saveItems(
      items.map((i) =>
        i.id === id
          ? {
              ...i,
              isApplied: !i.isApplied,
              appliedAt: !i.isApplied ? new Date().toISOString() : undefined,
              updatedAt: new Date().toISOString(),
            }
          : i
      )
    );
  };

  const convertToProblemSolver = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;

    const createdDoc = createProblemSolvingDoc(
      target.content.slice(0, 40),
      target.content
    );

    updateItemStatus(id, 'converted', 'note', createdDoc.id);
  };

  const convertToSomeday = (id: string) => {
    updateItemStatus(id, 'someday', 'someday');
  };

  const restoreToInbox = (id: string) => {
    updateItemStatus(id, 'inbox');
  };

  const clearInbox = () => {
    saveItems([]);
  };

  const resetToDefaultInbox = () => {
    saveItems(DEFAULT_INBOX_ITEMS);
  };

  const activeItems = items.filter((i) => i.status === 'inbox');
  const convertedItems = items.filter((i) => i.status === 'converted');
  const somedayItems = items.filter((i) => i.status === 'someday');

  return (
    <InboxContext.Provider
      value={{
        items,
        activeItems,
        convertedItems,
        somedayItems,
        quickDump,
        bulkDump,
        deleteInboxItem,
        toggleItemApplied,
        convertToTask,
        convertToProject,
        convertToGoal,
        convertToDream,
        convertToNote,
        convertToProblemSolver,
        convertToSomeday,
        restoreToInbox,
        clearInbox,
        resetToDefaultInbox,
        isLoaded,
      }}
    >
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox(): InboxContextType {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error('useInbox must be used within an InboxProvider');
  }
  return context;
}
