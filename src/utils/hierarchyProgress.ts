import type { Task, Project, Goal, Milestone, Dream, ProjectStatus, GoalStatus, MilestoneStatus, DreamStatus } from '@/types';

export interface ProjectProgressResult {
  progress: number;
  isAutomated: boolean;
  totalTasks: number;
  doneTasks: number;
  targetStatus: ProjectStatus;
}

export interface MilestoneProgressResult {
  progress: number;
  isAutomated: boolean;
  totalItems: number;
  doneItems: number;
  targetStatus: MilestoneStatus;
}

export interface GoalProgressResult {
  progress: number;
  isAutomated: boolean;
  linkedProjectsCount: number;
  completedProjectsCount: number;
  directTasksCount: number;
  doneDirectTasksCount: number;
  targetStatus: GoalStatus;
}

export interface DreamProgressResult {
  progress: number;
  isAutomated: boolean;
  totalGoals: number;
  completedGoals: number;
  targetStatus: DreamStatus;
}

/**
 * Calculates a project's progress automatically based on its connected tasks.
 * Matches both `task.projectId === project.id` and tasks tagged with the project title.
 */
export function calculateProjectProgress(
  project: Project,
  tasks: Task[]
): ProjectProgressResult {
  const linkedTasks = tasks.filter(
    (t) =>
      t.projectId === project.id ||
      (t.tags && t.tags.some((tag) => tag.trim().toLowerCase() === project.title.trim().toLowerCase()))
  );

  if (linkedTasks.length === 0) {
    return {
      progress: project.progress,
      isAutomated: false,
      totalTasks: 0,
      doneTasks: 0,
      targetStatus: project.status,
    };
  }

  const doneTasks = linkedTasks.filter((t) => t.status === 'done').length;
  const progress = Math.round((doneTasks / linkedTasks.length) * 100);

  let targetStatus = project.status;
  if (progress === 100) {
    targetStatus = 'completed';
  } else if (project.status === 'completed' && progress < 100) {
    targetStatus = 'active';
  }

  return {
    progress,
    isAutomated: true,
    totalTasks: linkedTasks.length,
    doneTasks,
    targetStatus,
  };
}

/**
 * Calculates a milestone's progress automatically based on connected tasks and projects.
 */
export function calculateMilestoneProgress(
  milestone: Milestone,
  tasks: Task[],
  projects: Project[]
): MilestoneProgressResult {
  const msTasks = tasks.filter((t) => t.milestoneId === milestone.id);
  const msProjects = projects.filter((p) => p.milestoneId === milestone.id);

  const totalItems = msTasks.length + msProjects.length;
  if (totalItems === 0) {
    return {
      progress: milestone.progress,
      isAutomated: false,
      totalItems: 0,
      doneItems: 0,
      targetStatus: milestone.status,
    };
  }

  let totalScore = 0;
  let doneCount = 0;

  if (msTasks.length > 0) {
    const taskDone = msTasks.filter((t) => t.status === 'done').length;
    doneCount += taskDone;
    totalScore += (taskDone / msTasks.length) * 100 * msTasks.length;
  }

  if (msProjects.length > 0) {
    const projDone = msProjects.filter((p) => p.status === 'completed' || p.progress === 100).length;
    doneCount += projDone;
    const projSum = msProjects.reduce((sum, p) => sum + (p.progress || 0), 0);
    totalScore += projSum;
  }

  const progress = Math.round(totalScore / totalItems);

  let targetStatus = milestone.status;
  if (progress === 100) {
    targetStatus = 'completed';
  } else if (milestone.status === 'completed' && progress < 100) {
    targetStatus = 'in-progress';
  }

  return {
    progress,
    isAutomated: true,
    totalItems,
    doneItems: doneCount,
    targetStatus,
  };
}

/**
 * Calculates a goal's progress automatically based on its connected projects and direct tasks.
 */
export function calculateGoalProgress(
  goal: Goal,
  projects: Project[],
  tasks: Task[]
): GoalProgressResult {
  const linkedProjects = projects.filter((p) => p.goalId === goal.id);
  const directTasks = tasks.filter((t) => t.goalId === goal.id && !t.projectId);

  const totalEntities = linkedProjects.length + directTasks.length;
  if (totalEntities === 0) {
    return {
      progress: goal.progress,
      isAutomated: false,
      linkedProjectsCount: 0,
      completedProjectsCount: 0,
      directTasksCount: 0,
      doneDirectTasksCount: 0,
      targetStatus: goal.status,
    };
  }

  let totalScore = 0;
  const completedProjectsCount = linkedProjects.filter(
    (p) => p.status === 'completed' || p.progress === 100
  ).length;
  const doneDirectTasksCount = directTasks.filter((t) => t.status === 'done').length;

  if (linkedProjects.length > 0) {
    const projScore = linkedProjects.reduce((sum, p) => sum + (p.progress || 0), 0);
    totalScore += projScore;
  }

  if (directTasks.length > 0) {
    const taskScore = directTasks.reduce((sum, t) => sum + (t.status === 'done' ? 100 : 0), 0);
    totalScore += taskScore;
  }

  const progress = Math.round(totalScore / totalEntities);

  let targetStatus = goal.status;
  if (progress === 100) {
    targetStatus = 'completed';
  } else if (goal.status === 'completed' && progress < 100) {
    targetStatus = 'in-progress';
  }

  return {
    progress,
    isAutomated: true,
    linkedProjectsCount: linkedProjects.length,
    completedProjectsCount,
    directTasksCount: directTasks.length,
    doneDirectTasksCount,
    targetStatus,
  };
}

/**
 * Calculates a dream's progress automatically based on its connected goals.
 */
export function calculateDreamProgress(
  dream: Dream,
  goals: Goal[]
): DreamProgressResult {
  const linkedGoals = goals.filter((g) => g.parentDreamId === dream.id);

  if (linkedGoals.length === 0) {
    return {
      progress: dream.progress ?? (dream.status === 'achieved' ? 100 : 0),
      isAutomated: false,
      totalGoals: 0,
      completedGoals: 0,
      targetStatus: dream.status,
    };
  }

  const completedGoals = linkedGoals.filter(
    (g) => g.status === 'completed' || g.progress === 100
  ).length;
  const goalsSum = linkedGoals.reduce((sum, g) => sum + (g.progress || 0), 0);
  const progress = Math.round(goalsSum / linkedGoals.length);

  let targetStatus = dream.status;
  if (progress === 100 && completedGoals === linkedGoals.length) {
    targetStatus = 'achieved';
  } else if (dream.status === 'achieved' && progress < 100) {
    targetStatus = 'active';
  }

  return {
    progress,
    isAutomated: true,
    totalGoals: linkedGoals.length,
    completedGoals,
    targetStatus,
  };
}
