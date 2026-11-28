'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Project, ProjectStatus, ProjectPriority } from '@/types';
import { loadJsonArray } from '@/lib/localStore';
import { notifyItemDeleted } from './UndoContext';

const PROJECTS_STORAGE_KEY = 'life_os_projects_v1';

export const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'project-personal-reset',
    title: 'Home & Digital Workspace Reset',
    description: 'Declutter desk, organize cloud folders, and simplify daily environment.',
    status: 'active',
    priority: 'high',
    progress: 50,
    goalId: 'goal-2',
    lifeAreaId: 'area-personal',
    notes: 'Focus on one small area or folder at a time.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'project-flagship-build',
    title: 'Personal Portfolio & Skill Project',
    description: 'Design, build, and share one meaningful creative or career project step by step.',
    status: 'active',
    priority: 'medium',
    progress: 35,
    goalId: 'goal-4',
    lifeAreaId: 'area-career',
    notes: 'Keep scope small and ship an early version first.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface ProjectContextType {
  projects: Project[];
  activeProjects: Project[];
  completedProjects: Project[];
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Project;
  updateProject: (id: string, partial: Partial<Project>) => void;
  updateProjectProgress: (id: string, progress: number) => void;
  updateProjectStatus: (id: string, status: ProjectStatus) => void;
  toggleProjectReminder: (id: string) => void;
  deleteProject: (id: string) => void;
  resetToDefaultProjects: () => void;
  isLoaded: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const reloadFromStorage = () => {
    try {
      const parsed = loadJsonArray<Project>(PROJECTS_STORAGE_KEY);
      setProjects(parsed && parsed.length > 0 ? parsed : []);
    } catch (err) {
      console.error('Failed to load Life OS projects:', err);
      setProjects([]);
    }
  };

  useEffect(() => {
    reloadFromStorage();
    setIsLoaded(true);

    const handleSync = () => reloadFromStorage();
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, []);

  const saveProjects = (newProjects: Project[]) => {
    setProjects(newProjects);
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(newProjects));
    } catch (err) {
      console.error('Failed to save Life OS projects:', err);
    }
  };

  const activeProjects = projects.filter((p) => p.status !== 'completed' && p.status !== 'cancelled');
  const completedProjects = projects.filter((p) => p.status === 'completed');

  const addProject = (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project => {
    const newProject: Project = {
      ...data,
      id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveProjects([newProject, ...projects]);
    return newProject;
  };

  const updateProject = (id: string, partial: Partial<Project>) => {
    const updated = projects.map((p) => {
      if (p.id !== id) return p;
      const merged = { ...p, ...partial, updatedAt: new Date().toISOString() };
      if (merged.progress === 100 && merged.status !== 'completed') {
        merged.status = 'completed';
      }
      return merged;
    });
    saveProjects(updated);
  };

  const updateProjectProgress = (id: string, progress: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    updateProject(id, {
      progress: clamped,
      status: clamped === 100 ? 'completed' : clamped > 0 ? 'active' : 'planning',
    });
  };

  const updateProjectStatus = (id: string, status: ProjectStatus) => {
    updateProject(id, {
      status,
      progress: status === 'completed' ? 100 : undefined,
    });
  };

  const toggleProjectReminder = (id: string) => {
    const target = projects.find((p) => p.id === id);
    if (!target) return;
    updateProject(id, { isReminder: !target.isReminder });
  };

  const deleteProject = (id: string) => {
    const target = projects.find((p) => p.id === id);
    const updated = projects.filter((p) => p.id !== id);
    saveProjects(updated);
    if (target) {
      notifyItemDeleted({
        type: 'Project',
        title: target.title,
        restore: () => {
          setProjects((prev) => {
            if (prev.some((p) => p.id === target.id)) return prev;
            const restored = [target, ...prev];
            try { localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(restored)); } catch { }
            return restored;
          });
        },
        redelete: () => {
          deleteProject(id);
        },
      });
    }
  };

  const resetToDefaultProjects = () => {
    saveProjects(DEFAULT_PROJECTS);
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProjects,
        completedProjects,
        addProject,
        updateProject,
        updateProjectProgress,
        updateProjectStatus,
        toggleProjectReminder,
        deleteProject,
        resetToDefaultProjects,
        isLoaded,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}
