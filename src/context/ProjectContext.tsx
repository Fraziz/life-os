'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Project, ProjectStatus, ProjectPriority } from '@/types';
import { loadJsonArray } from '@/lib/localStore';

const PROJECTS_STORAGE_KEY = 'life_os_projects_v1';

export const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'project-link-or-dare',
    title: 'LINK OR DARE',
    description: 'Social card game development, question decks, and card prototyping.',
    status: 'active',
    priority: 'high',
    progress: 100,
    notes: 'Next: Finalize card designs. 75 / 75 cards ready.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'project-gainroot',
    title: 'GAINROOT',
    description: 'Sweet potato nutrition product planning, shelf life research, and FDA registration.',
    status: 'active',
    priority: 'high',
    progress: 40,
    notes: 'Next: Finalize packaging design. Product Plan in progress.',
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
      if (parsed && parsed.length > 0) setProjects(parsed);
      else if (!parsed) setProjects(DEFAULT_PROJECTS);
    } catch (err) {
      console.error('Failed to load Life OS projects:', err);
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

  const deleteProject = (id: string) => {
    const updated = projects.filter((p) => p.id !== id);
    saveProjects(updated);
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
