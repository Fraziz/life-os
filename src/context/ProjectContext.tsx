'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Project, ProjectStatus, ProjectPriority } from '@/types';
import { loadJsonArray } from '@/lib/localStore';

const PROJECTS_STORAGE_KEY = 'life_os_projects_v1';

export const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'project-1',
    title: 'Blobbit Game',
    description: 'Active development of the core gameplay prototype, character movement mechanics, and physics demo.',
    status: 'active',
    priority: 'high',
    startDate: '2026-08-01',
    dueDate: '2026-11-30',
    progress: 50,
    goalId: 'goal-1', // Develop 2D Movement Prototype
    milestoneId: 'milestone-2', // Wall-Slide & Dash
    notes: 'Next focus: fine-tune wall jump force vectors and dash acceleration curve.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'project-2',
    title: 'Blender Learning',
    description: 'Hands-on practice modeling stylized low-poly environmental assets and studying material nodes.',
    status: 'active',
    priority: 'medium',
    startDate: '2026-08-15',
    dueDate: '2026-10-01',
    progress: 35,
    goalId: 'goal-3', // Complete 3D Fundamentals
    milestoneId: 'milestone-6', // Model Base Terrain
    notes: 'Working on tree generators and water ripple shaders in EEVEE.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'project-3',
    title: 'Music Project',
    description: 'Composition and synthesis of atmospheric ambient soundtracks for the game universe.',
    status: 'planning',
    priority: 'low',
    startDate: '2026-09-01',
    dueDate: '2026-12-15',
    progress: 10,
    goalId: 'goal-1', // Link to creative game vision
    notes: 'Gather synth references: Disasterpeace (Fez), Lena Raine (Celeste).',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'project-4',
    title: 'Business Project',
    description: 'Structure MVP value proposition, build landing page, and prepare discovery interview pipeline.',
    status: 'planning',
    priority: 'high',
    startDate: '2026-09-15',
    dueDate: '2027-01-31',
    progress: 20,
    goalId: 'goal-4', // Validate MVP
    milestoneId: 'milestone-7', // User interviews
    notes: 'Draft interview questions around time management friction and weekly review consistency.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface ProjectContextType {
  projects: Project[];
  activeProjects: Project[];
  completedProjects: Project[];
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
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

  useEffect(() => {
    try {
      const parsed = loadJsonArray<Project>(PROJECTS_STORAGE_KEY);
      if (parsed) setProjects(parsed);
    } catch (err) {
      console.error('Failed to load Life OS projects:', err);
    } finally {
      setIsLoaded(true);
    }
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

  const addProject = (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProject: Project = {
      ...data,
      id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveProjects([newProject, ...projects]);
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
