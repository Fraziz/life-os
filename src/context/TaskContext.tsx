'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Task, TaskStatus, TaskPriority, Subtask } from '@/types';
import { loadJsonArray } from '@/lib/localStore';

const TASKS_STORAGE_KEY = 'life_os_tasks_v1';

export const DEFAULT_TASKS: Task[] = [
  {
    id: 'task-blobbit-env',
    title: 'Create Blobbit environment',
    description: 'Build and assemble the complete starting level environment scene.',
    status: 'doing',
    priority: 'high',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    estimatedDuration: 180,
    actualDuration: 60,
    projectId: 'project-1', // Blobbit Game
    goalId: 'goal-1',
    milestoneId: 'milestone-2',
    isCompound: true,
    tags: ['environment', 'gameplay', 'level-design'],
    subtasks: [
      { id: 'sub-env-1', title: 'Create terrain', completed: true },
      { id: 'sub-env-2', title: 'Add trees', completed: true },
      { id: 'sub-env-3', title: 'Add buildings', completed: false },
      { id: 'sub-env-4', title: 'Add lighting', completed: false },
      { id: 'sub-env-5', title: 'Test environment', completed: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-1',
    title: 'Implement wall-jump vector math and friction curve',
    description: 'Tune the horizontal launch velocity and vertical impulse on wall detach.',
    status: 'doing',
    priority: 'high',
    dueDate: new Date().toISOString().split('T')[0],
    estimatedDuration: 45,
    actualDuration: 30,
    projectId: 'project-1', // Blobbit Game
    goalId: 'goal-1',
    milestoneId: 'milestone-2',
    tags: ['physics', 'gameplay'],
    subtasks: [
      { id: 'sub-1', title: 'Raycast check for wall contact', completed: true },
      { id: 'sub-2', title: 'Apply sliding friction modifier', completed: true },
      { id: 'sub-3', title: 'Add 150ms input detach window', completed: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-2',
    title: 'Gather Fez & Celeste ambient synth audio references',
    description: 'Listen and isolate pad frequencies and tape reverb techniques.',
    status: 'todo',
    priority: 'medium',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    estimatedDuration: 60,
    projectId: 'project-3', // Music Project
    goalId: 'goal-1',
    tags: ['audio', 'inspiration'],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-3',
    title: 'Model low-poly pine trees with vertex colors in Blender',
    description: 'Create 3 variations with stylized branch cones for the diorama scene.',
    status: 'done',
    priority: 'medium',
    estimatedDuration: 90,
    actualDuration: 75,
    projectId: 'project-2', // Blender Learning
    goalId: 'goal-3',
    milestoneId: 'milestone-6',
    tags: ['blender', '3d'],
    subtasks: [
      { id: 'sub-4', title: 'Base cone mesh setup', completed: true },
      { id: 'sub-5', title: 'Randomized jitter modifier', completed: true },
      { id: 'sub-6', title: 'Color palette gradient mapping', completed: true },
    ],
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-4',
    title: 'Draft 10 discovery interview customer questions',
    description: 'Focus on habits, planning bottlenecks, and friction in existing life tools.',
    status: 'backlog',
    priority: 'high',
    estimatedDuration: 30,
    projectId: 'project-4', // Business Project
    goalId: 'goal-4',
    milestoneId: 'milestone-7',
    tags: ['business', 'interviews'],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-5',
    title: 'Review monthly budget allocation and emergency fund transfer',
    description: 'Verify automated savings target transfer arrived in high-yield account.',
    status: 'todo',
    priority: 'high',
    dueDate: new Date().toISOString().split('T')[0],
    estimatedDuration: 15,
    goalId: 'goal-2', // Financial Independence
    milestoneId: 'milestone-5',
    tags: ['finance'],
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
