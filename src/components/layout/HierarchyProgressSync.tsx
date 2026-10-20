'use client';

import { useEffect, useRef } from 'react';
import { useTasks } from '@/context/TaskContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useMilestones } from '@/context/MilestoneContext';
import { useDreams } from '@/context/DreamContext';
import {
  calculateProjectProgress,
  calculateMilestoneProgress,
  calculateGoalProgress,
  calculateDreamProgress,
} from '@/utils/hierarchyProgress';

/**
 * Headless synchronization engine that automatically rolls up progress:
 * Tasks -> Projects -> Goals -> Dreams (& Milestones)
 * 
 * Ensures that checking off a task immediately recalculates its parent project,
 * which in turn moves the parent goal, which advances the overarching dream.
 */
export default function HierarchyProgressSync() {
  const { tasks, isLoaded: tasksLoaded } = useTasks();
  const { projects, updateProject, isLoaded: projectsLoaded } = useProjects();
  const { goals, updateGoal, isLoaded: goalsLoaded } = useGoals();
  const { milestones, updateMilestone, isLoaded: msLoaded } = useMilestones();
  const { dreams, updateDream, isLoaded: dreamsLoaded } = useDreams();

  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!tasksLoaded || !projectsLoaded || !goalsLoaded || !msLoaded || !dreamsLoaded) {
      return;
    }
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;

    try {
      // 1. Rollup Tasks -> Projects
      const effectiveProjects = projects.map((project) => {
        const res = calculateProjectProgress(project, tasks);
        if (
          res.isAutomated &&
          (project.progress !== res.progress || project.status !== res.targetStatus)
        ) {
          updateProject(project.id, {
            progress: res.progress,
            status: res.targetStatus,
          });
          return { ...project, progress: res.progress, status: res.targetStatus };
        }
        return res.isAutomated ? { ...project, progress: res.progress, status: res.targetStatus } : project;
      });

      // 2. Rollup Tasks/Projects -> Milestones
      milestones.forEach((ms) => {
        const res = calculateMilestoneProgress(ms, tasks, effectiveProjects);
        if (
          res.isAutomated &&
          (ms.progress !== res.progress || ms.status !== res.targetStatus)
        ) {
          updateMilestone(ms.id, {
            progress: res.progress,
            status: res.targetStatus,
          });
        }
      });

      // 3. Rollup Projects/Tasks -> Goals
      const effectiveGoals = goals.map((goal) => {
        const res = calculateGoalProgress(goal, effectiveProjects, tasks);
        if (
          res.isAutomated &&
          (goal.progress !== res.progress || goal.status !== res.targetStatus)
        ) {
          updateGoal(goal.id, {
            progress: res.progress,
            status: res.targetStatus,
          });
          return { ...goal, progress: res.progress, status: res.targetStatus };
        }
        return res.isAutomated ? { ...goal, progress: res.progress, status: res.targetStatus } : goal;
      });

      // 4. Rollup Goals -> Dreams
      dreams.forEach((dream) => {
        const res = calculateDreamProgress(dream, effectiveGoals);
        if (
          res.isAutomated &&
          (dream.progress !== res.progress || dream.status !== res.targetStatus)
        ) {
          updateDream(dream.id, {
            progress: res.progress,
            status: res.targetStatus,
          });
        }
      });
    } finally {
      isSyncingRef.current = false;
    }
  }, [
    tasks,
    projects,
    goals,
    milestones,
    dreams,
    tasksLoaded,
    projectsLoaded,
    goalsLoaded,
    msLoaded,
    dreamsLoaded,
    updateProject,
    updateMilestone,
    updateGoal,
    updateDream,
  ]);

  return null;
}
