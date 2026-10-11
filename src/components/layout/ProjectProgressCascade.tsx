'use client';

import { useEffect, useRef } from 'react';
import { useTasks } from '@/context/TaskContext';
import { useProjects } from '@/context/ProjectContext';

/**
 * ProjectProgressCascade:
 * Automatically computes and synchronizes Project progress from linked Tasks.
 * Whenever tasks are ticked off or updated, the project's progress percentage
 * and completion status are immediately updated without manual intervention.
 * 
 * Note: Milestones are intentionally excluded per user specification.
 */
export default function ProjectProgressCascade() {
  const { tasks, isLoaded: tasksLoaded } = useTasks();
  const { projects, updateProject, isLoaded: projectsLoaded } = useProjects();
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    if (!tasksLoaded || !projectsLoaded || projects.length === 0 || isUpdatingRef.current) {
      return;
    }

    // Check each project against its linked tasks
    for (const project of projects) {
      const linkedTasks = tasks.filter((t) => {
        if (t.projectId && t.projectId === project.id) return true;
        if (
          t.tags &&
          t.tags.some(
            (tag) => tag.trim().toLowerCase() === project.title.trim().toLowerCase()
          )
        ) {
          return true;
        }
        return false;
      });

      // If project has linked tasks, calculate progress automatically
      if (linkedTasks.length > 0) {
        const doneTasks = linkedTasks.filter((t) => t.status === 'done').length;
        const autoProgress = Math.round((doneTasks / linkedTasks.length) * 100);

        if (project.progress !== autoProgress) {
          isUpdatingRef.current = true;
          if (autoProgress === 100 && project.status !== 'completed') {
            updateProject(project.id, { progress: 100, status: 'completed' });
          } else if (autoProgress < 100 && project.status === 'completed') {
            updateProject(project.id, { progress: autoProgress, status: 'active' });
          } else {
            updateProject(project.id, { progress: autoProgress });
          }
          setTimeout(() => {
            isUpdatingRef.current = false;
          }, 50);
          break; // Let state settle before next check
        }
      }
    }
  }, [tasks, projects, tasksLoaded, projectsLoaded, updateProject]);

  return null;
}
