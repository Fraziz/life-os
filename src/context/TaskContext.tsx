'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Task, TaskStatus, TaskPriority, Subtask } from '@/types';
import { loadJsonArray } from '@/lib/localStore';

const TASKS_STORAGE_KEY = 'life_os_tasks_v1';

export const DEFAULT_TASKS: Task[] = [
  {
    id: 'task-ui-design',
    title: 'Finish Life OS UI design (final layout)',
    description: 'Finalize the three-column responsive Life OS layout matching the modern aesthetic.',
    status: 'doing',
    priority: 'high',
    dueDate: new Date().toISOString().split('T')[0],
    estimatedDuration: 60,
    tags: ['School', 'UI', 'Design'],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-study-english',
    title: 'Study English (SVO + parts of speech)',
    description: 'A1 - B2 grammar practice and sentence structures.',
    status: 'todo',
    priority: 'high',
    dueDate: new Date().toISOString().split('T')[0],
    estimatedDuration: 45,
    tags: ['Study', 'English'],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-workout',
    title: 'Workout (full body / pull ups)',
    description: 'Upper body, pull ups and core routine.',
    status: 'todo',
    priority: 'high',
    dueDate: new Date().toISOString().split('T')[0],
    estimatedDuration: 45,
    tags: ['Health', 'Fitness'],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-cardmasters',
    title: 'Reply to CardMasters inquiry (research other PH printers)',
    description: 'Compare printing quote and quality for card deck prototyping.',
    status: 'todo',
    priority: 'medium',
    tags: ['LINK OR DARE', 'Business'],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-gainroot',
    title: 'Work on GAINROOT product plan',
    description: 'Structure nutritional specs and FDA compliance.',
    status: 'todo',
    priority: 'medium',
    tags: ['GAINROOT', 'Product'],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-guitar',
    title: 'Practice guitar (30 mins)',
    description: 'Fingerpicking and chord transitions.',
    status: 'todo',
    priority: 'medium',
    tags: ['Hobby', 'Music'],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-reading',
    title: 'Read 5 pages (philosophy / Stoicism)',
    description: 'Meditations or Letters from a Stoic daily reading.',
    status: 'todo',
    priority: 'medium',
    tags: ['Mindset', 'Reading'],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-clean-room',
    title: 'Clean room / organize files',
    description: 'Declutter physical workspace and digital folder structures.',
    status: 'todo',
    priority: 'low',
    tags: ['Personal'],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface TaskContextType {
  tasks: Task[];
  activeTasks: Task[];
  todoTasks: Task[];
  doingTasks: Task[];
  backlogTasks: Task[];
  doneTasks: Task[];
  quickAddTask: (title: string, overrides?: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, partial: Partial<Task>) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  toggleTaskDone: (id: string) => void;
  addSubtask: (taskId: string, title: string, estimatedMinutes?: number) => void;
  breakdownTask: (taskId: string, steps: string[]) => void;
  promoteSubtaskToTask: (taskId: string, subtaskId: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  deleteTask: (id: string) => void;
  resetToDefaultTasks: () => void;
  isLoaded: boolean;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const reloadFromStorage = () => {
    try {
      const parsed = loadJsonArray<Task>(TASKS_STORAGE_KEY);
      if (parsed && parsed.length > 0) setTasks(parsed);
      else if (!parsed) setTasks(DEFAULT_TASKS);
    } catch (err) {
      console.error('Failed to load Life OS tasks:', err);
    }
  };

  useEffect(() => {
    reloadFromStorage();
    setIsLoaded(true);

    const handleSync = () => reloadFromStorage();
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, []);

  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(newTasks));
    } catch (err) {
      console.error('Failed to save Life OS tasks:', err);
    }
  };

  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const todoTasks = tasks.filter((t) => t.status === 'todo');
  const doingTasks = tasks.filter((t) => t.status === 'doing');
  const backlogTasks = tasks.filter((t) => t.status === 'backlog');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  const quickAddTask = (
    title: string,
    overrides?: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>
  ) => {
    if (!title.trim()) return;
    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      status: 'todo',
      priority: 'medium',
      tags: [],
      subtasks: [],
      ...overrides,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveTasks([newTask, ...tasks]);
  };

  const addTask = (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...data,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tags: data.tags || [],
      subtasks: data.subtasks || [],
      isCompound: (data.subtasks && data.subtasks.length > 0) || data.isCompound,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveTasks([newTask, ...tasks]);
  };

  const updateTask = (id: string, partial: Partial<Task>) => {
    const updated = tasks.map((t) => {
      if (t.id !== id) return t;
      const merged = { ...t, ...partial, updatedAt: new Date().toISOString() };
      if (merged.subtasks && merged.subtasks.length > 0) {
        merged.isCompound = true;
      }
      if (merged.status === 'done' && !t.completedAt) {
        merged.completedAt = new Date().toISOString();
      } else if (merged.status !== 'done') {
        merged.completedAt = undefined;
      }
      return merged;
    });
    saveTasks(updated);
  };

  const updateTaskStatus = (id: string, status: TaskStatus) => {
    updateTask(id, { status });
  };

  const toggleTaskDone = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const isNowDone = target.status !== 'done';
    updateTask(id, {
      status: isNowDone ? 'done' : 'todo',
      completedAt: isNowDone ? new Date().toISOString() : undefined,
    });
  };

  const addSubtask = (taskId: string, title: string, estimatedMinutes?: number) => {
    if (!title.trim()) return;
    const updated = tasks.map((t) => {
      if (t.id !== taskId) return t;
      const newSub: Subtask = {
        id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: title.trim(),
        completed: false,
        estimatedMinutes,
      };
      return {
        ...t,
        isCompound: true,
        subtasks: [...t.subtasks, newSub],
        updatedAt: new Date().toISOString(),
      };
    });
    saveTasks(updated);
  };

  const breakdownTask = (taskId: string, steps: string[]) => {
    const validSteps = steps.map((s) => s.trim()).filter(Boolean);
    if (validSteps.length === 0) return;

    const newSubtasks: Subtask[] = validSteps.map((title, idx) => ({
      id: `sub-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      title,
      completed: false,
    }));

    const updated = tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        isCompound: true,
        subtasks: [...t.subtasks, ...newSubtasks],
        updatedAt: new Date().toISOString(),
      };
    });
    saveTasks(updated);
  };

  const promoteSubtaskToTask = (taskId: string, subtaskId: string) => {
    const parent = tasks.find((t) => t.id === taskId);
    if (!parent) return;
    const targetSub = parent.subtasks.find((s) => s.id === subtaskId);
    if (!targetSub) return;

    const promotedTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: targetSub.title,
      status: targetSub.completed ? 'done' : 'todo',
      priority: parent.priority,
      projectId: parent.projectId,
      goalId: parent.goalId,
      milestoneId: parent.milestoneId,
      parentTaskId: parent.id,
      tags: parent.tags ? [...parent.tags] : [],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const remainingSubs = parent.subtasks.filter((s) => s.id !== subtaskId);
    const updated = tasks
      .map((t) => (t.id === taskId ? { ...t, subtasks: remainingSubs, updatedAt: new Date().toISOString() } : t))
      .concat(promotedTask);

    saveTasks(updated);
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    const updated = tasks.map((t) => {
      if (t.id !== taskId) return t;
      const subs = t.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, completed: !s.completed } : s
      );
      // Auto complete parent task if all subtasks are done
      const allDone = subs.length > 0 && subs.every((s) => s.completed);
      const nextStatus: TaskStatus = allDone
        ? 'done'
        : t.status === 'done'
        ? 'doing'
        : t.status;
      return {
        ...t,
        subtasks: subs,
        status: nextStatus,
        completedAt: allDone ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      };
    });
    saveTasks(updated);
  };

  const deleteSubtask = (taskId: string, subtaskId: string) => {
    const updated = tasks.map((t) => {
      if (t.id !== taskId) return t;
      const subs = t.subtasks.filter((s) => s.id !== subtaskId);
      return {
        ...t,
        subtasks: subs,
        isCompound: subs.length > 0,
        updatedAt: new Date().toISOString(),
      };
    });
    saveTasks(updated);
  };

  const deleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    saveTasks(updated);
  };

  const resetToDefaultTasks = () => {
    saveTasks(DEFAULT_TASKS);
  };

  return (
    <TaskContext.Provider
      value={{
        tasks,
        activeTasks,
        todoTasks,
        doingTasks,
        backlogTasks,
        doneTasks,
        quickAddTask,
        addTask,
        updateTask,
        updateTaskStatus,
        toggleTaskDone,
        addSubtask,
        breakdownTask,
        promoteSubtaskToTask,
        toggleSubtask,
        deleteSubtask,
        deleteTask,
        resetToDefaultTasks,
        isLoaded,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks(): TaskContextType {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
