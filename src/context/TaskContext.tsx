'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Task, TaskStatus, TaskPriority, Subtask } from '@/types';
import { loadJsonArray } from '@/lib/localStore';
import { notifyItemDeleted } from './UndoContext';
import { cleanMarkdownText } from '@/utils/textCleaner';

const TASKS_STORAGE_KEY = 'life_os_tasks_v1';

export const DEFAULT_TASKS: Task[] = [
  {
    id: 'task-ui-design',
    title: 'Finish Sariling Mundo UI design (final layout)',
    description: 'Finalize the three-column responsive Sariling Mundo layout matching the modern aesthetic.',
    status: 'doing',
    priority: 'high',
    dueDate: new Date().toISOString().split('T')[0],
    estimatedDuration: 60,
    projectId: 'project-link-or-dare',
    goalId: 'goal-1',
    lifeAreaId: 'area-creative',
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
    goalId: 'goal-5',
    lifeAreaId: 'area-learning',
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
    goalId: 'goal-6',
    lifeAreaId: 'area-health',
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
    projectId: 'project-link-or-dare',
    goalId: 'goal-4',
    lifeAreaId: 'area-creative',
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
    projectId: 'project-gainroot',
    goalId: 'goal-4',
    lifeAreaId: 'area-career',
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
    goalId: 'goal-1',
    lifeAreaId: 'area-creative',
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
    goalId: 'goal-5',
    lifeAreaId: 'area-learning',
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
    goalId: 'goal-2',
    lifeAreaId: 'area-money',
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
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Task;
  updateTask: (id: string, partial: Partial<Task>) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  toggleTaskDone: (id: string) => void;
  toggleTaskReminder: (id: string) => void;
  addSubtask: (taskId: string, title: string, estimatedMinutes?: number) => void;
  breakdownTask: (taskId: string, steps: string[]) => void;
  promoteSubtaskToTask: (taskId: string, subtaskId: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  deleteTask: (id: string) => void;
  clearDoneTasks: () => void;
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
      if (parsed && parsed.length > 0) {
        // Auto-heal / backfill missing projectId or goalId
        const healed = parsed.map((t) => {
          const updated = { ...t };
          const titleLower = (t.title || '').toLowerCase();
          const tagsLower = (t.tags || []).map((tg) => tg.toLowerCase());

          // Match default task by id or title
          const def = DEFAULT_TASKS.find(
            (dt) => dt.id === t.id || dt.title.toLowerCase() === titleLower
          );
          if (def) {
            if (!updated.projectId && def.projectId) updated.projectId = def.projectId;
            if (!updated.goalId && def.goalId) updated.goalId = def.goalId;
            if (!updated.lifeAreaId && def.lifeAreaId) updated.lifeAreaId = def.lifeAreaId;
          }

          // Infer project and goal from tags or title
          if (!updated.projectId) {
            if (
              tagsLower.some((tg) => tg.includes('link or dare')) ||
              titleLower.includes('link or dare') ||
              titleLower.includes('cardmasters') ||
              titleLower.includes('sariling mundo')
            ) {
              updated.projectId = 'project-link-or-dare';
              if (!updated.goalId) updated.goalId = 'goal-4';
              if (!updated.lifeAreaId) updated.lifeAreaId = 'area-creative';
            } else if (
              tagsLower.some((tg) => tg.includes('gainroot')) ||
              titleLower.includes('gainroot')
            ) {
              updated.projectId = 'project-gainroot';
              if (!updated.goalId) updated.goalId = 'goal-4';
              if (!updated.lifeAreaId) updated.lifeAreaId = 'area-career';
            }
          }

          if (!updated.goalId) {
            if (
              titleLower.includes('english') ||
              tagsLower.some((tg) => tg.includes('english') || tg.includes('study'))
            ) {
              updated.goalId = 'goal-5';
              if (!updated.lifeAreaId) updated.lifeAreaId = 'area-learning';
            } else if (
              titleLower.includes('workout') ||
              titleLower.includes('pull ups') ||
              tagsLower.some((tg) => tg.includes('health') || tg.includes('fitness'))
            ) {
              updated.goalId = 'goal-6';
              if (!updated.lifeAreaId) updated.lifeAreaId = 'area-health';
            } else if (
              titleLower.includes('reading') ||
              titleLower.includes('stoic') ||
              tagsLower.some((tg) => tg.includes('reading'))
            ) {
              updated.goalId = 'goal-5';
              if (!updated.lifeAreaId) updated.lifeAreaId = 'area-learning';
            } else if (titleLower.includes('guitar') || titleLower.includes('music')) {
              updated.goalId = 'goal-1';
              if (!updated.lifeAreaId) updated.lifeAreaId = 'area-creative';
            } else if (titleLower.includes('clean') || titleLower.includes('room')) {
              updated.goalId = 'goal-2';
              if (!updated.lifeAreaId) updated.lifeAreaId = 'area-money';
            }
          }

          return updated;
        });
        setTasks(healed);
        try { localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(healed)); } catch {}
      } else {
        setTasks(DEFAULT_TASKS);
        try { localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(DEFAULT_TASKS)); } catch {}
      }
    } catch (err) {
      console.error('Failed to load Life OS tasks:', err);
      setTasks(DEFAULT_TASKS);
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
    const cleanedTitle = cleanMarkdownText(title);
    if (!cleanedTitle) return;

    let inferredProjectId = overrides?.projectId;
    let inferredGoalId = overrides?.goalId;
    let inferredLifeAreaId = overrides?.lifeAreaId;

    const titleLower = cleanedTitle.toLowerCase();
    const tagsLower = (overrides?.tags || []).map((t) => t.toLowerCase());

    if (!inferredProjectId) {
      if (
        tagsLower.some((tg) => tg.includes('link or dare')) ||
        titleLower.includes('link or dare') ||
        titleLower.includes('cardmasters') ||
        titleLower.includes('sariling mundo')
      ) {
        inferredProjectId = 'project-link-or-dare';
        if (!inferredGoalId) inferredGoalId = 'goal-4';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-creative';
      } else if (
        tagsLower.some((tg) => tg.includes('gainroot')) ||
        titleLower.includes('gainroot')
      ) {
        inferredProjectId = 'project-gainroot';
        if (!inferredGoalId) inferredGoalId = 'goal-4';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-career';
      }
    }

    if (!inferredGoalId) {
      if (titleLower.includes('english') || tagsLower.some((tg) => tg.includes('english') || tg.includes('study'))) {
        inferredGoalId = 'goal-5';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-learning';
      } else if (titleLower.includes('workout') || titleLower.includes('pull ups') || tagsLower.some((tg) => tg.includes('health') || tg.includes('fitness'))) {
        inferredGoalId = 'goal-6';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-health';
      } else if (titleLower.includes('reading') || titleLower.includes('stoic') || tagsLower.some((tg) => tg.includes('reading'))) {
        inferredGoalId = 'goal-5';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-learning';
      } else if (titleLower.includes('guitar') || titleLower.includes('music')) {
        inferredGoalId = 'goal-1';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-creative';
      } else if (titleLower.includes('clean') || titleLower.includes('room')) {
        inferredGoalId = 'goal-2';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-money';
      }
    }

    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: cleanedTitle,
      status: 'todo',
      priority: 'medium',
      tags: [],
      subtasks: [],
      ...overrides,
      projectId: inferredProjectId,
      goalId: inferredGoalId,
      lifeAreaId: inferredLifeAreaId,
      description: overrides?.description ? cleanMarkdownText(overrides.description) : overrides?.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveTasks([newTask, ...tasks]);
  };

  const addTask = (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    let inferredProjectId = data.projectId;
    let inferredGoalId = data.goalId;
    let inferredLifeAreaId = data.lifeAreaId;

    const titleLower = (data.title || '').toLowerCase();
    const tagsLower = (data.tags || []).map((t) => t.toLowerCase());

    if (!inferredProjectId) {
      if (
        tagsLower.some((tg) => tg.includes('link or dare')) ||
        titleLower.includes('link or dare') ||
        titleLower.includes('cardmasters') ||
        titleLower.includes('sariling mundo')
      ) {
        inferredProjectId = 'project-link-or-dare';
        if (!inferredGoalId) inferredGoalId = 'goal-4';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-creative';
      } else if (
        tagsLower.some((tg) => tg.includes('gainroot')) ||
        titleLower.includes('gainroot')
      ) {
        inferredProjectId = 'project-gainroot';
        if (!inferredGoalId) inferredGoalId = 'goal-4';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-career';
      }
    }

    if (!inferredGoalId) {
      if (titleLower.includes('english') || tagsLower.some((tg) => tg.includes('english') || tg.includes('study'))) {
        inferredGoalId = 'goal-5';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-learning';
      } else if (titleLower.includes('workout') || titleLower.includes('pull ups') || tagsLower.some((tg) => tg.includes('health') || tg.includes('fitness'))) {
        inferredGoalId = 'goal-6';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-health';
      } else if (titleLower.includes('reading') || titleLower.includes('stoic') || tagsLower.some((tg) => tg.includes('reading'))) {
        inferredGoalId = 'goal-5';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-learning';
      } else if (titleLower.includes('guitar') || titleLower.includes('music')) {
        inferredGoalId = 'goal-1';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-creative';
      } else if (titleLower.includes('clean') || titleLower.includes('room')) {
        inferredGoalId = 'goal-2';
        if (!inferredLifeAreaId) inferredLifeAreaId = 'area-money';
      }
    }

    const newTask: Task = {
      ...data,
      title: cleanMarkdownText(data.title),
      description: data.description ? cleanMarkdownText(data.description) : undefined,
      projectId: inferredProjectId,
      goalId: inferredGoalId,
      lifeAreaId: inferredLifeAreaId,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      completedAt: data.status === 'done' ? (data.completedAt || new Date().toISOString()) : undefined,
      tags: data.tags || [],
      subtasks: data.subtasks || [],
      isCompound: (data.subtasks && data.subtasks.length > 0) || data.isCompound,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveTasks([newTask, ...tasks]);
    return newTask;
  };

  const updateTask = (id: string, partial: Partial<Task>) => {
    const cleanedPartial = {
      ...partial,
      ...(partial.title !== undefined ? { title: cleanMarkdownText(partial.title) } : {}),
      ...(partial.description !== undefined && partial.description !== null
        ? { description: cleanMarkdownText(partial.description) }
        : {}),
    };
    const updated = tasks.map((t) => {
      if (t.id !== id) return t;
      const merged = { ...t, ...cleanedPartial, updatedAt: new Date().toISOString() };
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

  const toggleTaskReminder = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    updateTask(id, { isReminder: !target.isReminder });
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
    const target = tasks.find((t) => t.id === id);
    const updated = tasks.filter((t) => t.id !== id);
    saveTasks(updated);
    if (target) {
      notifyItemDeleted({
        type: 'Task',
        title: target.title,
        restore: () => {
          setTasks((prev) => {
            if (prev.some((t) => t.id === target.id)) return prev;
            const restored = [target, ...prev];
            try { localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(restored)); } catch {}
            return restored;
          });
        },
        redelete: () => {
          deleteTask(id);
        },
      });
    }
  };

  const clearDoneTasks = () => {
    const updated = tasks.filter((t) => t.status !== 'done');
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
        toggleTaskReminder,
        addSubtask,
        breakdownTask,
        promoteSubtaskToTask,
        toggleSubtask,
        deleteSubtask,
        deleteTask,
        clearDoneTasks,
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
