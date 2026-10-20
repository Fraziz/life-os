import type { Task, Project, Goal, Milestone } from '@/types';

export interface ResolvedHierarchy {
  parentProject: Project | null;
  parentGoal: Goal | null;
  parentMilestone: Milestone | null;
}

/**
 * Robustly resolves the parent Project, Goal, and Milestone for any Task.
 * Handles exact UUID matches, legacy title strings, tag associations, and keyword fallbacks.
 */
export function resolveTaskHierarchy(
  task: Task,
  projects: Project[] = [],
  goals: Goal[] = [],
  milestones: Milestone[] = []
): ResolvedHierarchy {
  if (!task) {
    return { parentProject: null, parentGoal: null, parentMilestone: null };
  }

  const titleLower = (task.title || '').toLowerCase();
  const tagsLower = (task.tags || []).map((t) => t.toLowerCase());

  // 1. Resolve Parent Project
  let parentProject: Project | null = null;
  if (task.projectId) {
    parentProject =
      projects.find(
        (p) =>
          p.id === task.projectId ||
          p.title.toLowerCase() === task.projectId?.toLowerCase()
      ) || null;
  }

  // Fallback project matching via tags or task title
  if (!parentProject && projects.length > 0) {
    // Check tags
    parentProject =
      projects.find((p) => {
        const pTitleLower = p.title.toLowerCase();
        return tagsLower.some(
          (tag) => tag === pTitleLower || pTitleLower.includes(tag) || tag.includes(pTitleLower)
        );
      }) || null;

    // Check task title
    if (!parentProject) {
      parentProject =
        projects.find((p) => {
          const pTitleLower = p.title.toLowerCase();
          if (titleLower.includes(pTitleLower)) return true;
          if (pTitleLower.includes('link or dare') && (titleLower.includes('cardmasters') || titleLower.includes('sariling mundo'))) {
            return true;
          }
          return false;
        }) || null;
    }
  }

  // 2. Resolve Parent Goal
  let parentGoal: Goal | null = null;
  const directGoalId = task.goalId || parentProject?.goalId;

  if (directGoalId) {
    parentGoal =
      goals.find(
        (g) =>
          g.id === directGoalId ||
          g.title.toLowerCase() === directGoalId.toLowerCase()
      ) || null;
  }

  // Fallback goal matching via parent project
  if (!parentGoal && parentProject?.goalId) {
    parentGoal = goals.find((g) => g.id === parentProject.goalId) || null;
  }

  // Fallback goal matching via tags or task title keywords
  if (!parentGoal && goals.length > 0) {
    if (
      titleLower.includes('english') ||
      tagsLower.some((t) => t.includes('english') || t.includes('grammar') || t.includes('study'))
    ) {
      parentGoal =
        goals.find((g) => g.title.toLowerCase().includes('english') || g.id === 'goal-5' || g.id === 'goal-3') ||
        goals[0] ||
        null;
    } else if (
      titleLower.includes('workout') ||
      titleLower.includes('pull ups') ||
      titleLower.includes('exercise') ||
      tagsLower.some((t) => t.includes('health') || t.includes('fitness'))
    ) {
      parentGoal =
        goals.find((g) => g.title.toLowerCase().includes('fitness') || g.title.toLowerCase().includes('physical') || g.id === 'goal-6' || g.id === 'goal-2') ||
        goals[1] ||
        null;
    } else if (
      titleLower.includes('reading') ||
      titleLower.includes('stoic') ||
      tagsLower.some((t) => t.includes('reading') || t.includes('mindset'))
    ) {
      parentGoal =
        goals.find((g) => g.title.toLowerCase().includes('english') || g.title.toLowerCase().includes('3d') || g.id === 'goal-5' || g.id === 'goal-3') ||
        null;
    } else if (
      titleLower.includes('gainroot') ||
      titleLower.includes('link or dare') ||
      titleLower.includes('cardmasters') ||
      tagsLower.some((t) => t.includes('business') || t.includes('product'))
    ) {
      parentGoal =
        goals.find((g) => g.title.toLowerCase().includes('mvp') || g.id === 'goal-4') ||
        null;
    } else if (
      titleLower.includes('ui') ||
      titleLower.includes('design') ||
      titleLower.includes('sariling mundo') ||
      tagsLower.some((t) => t.includes('design') || t.includes('school'))
    ) {
      parentGoal =
        goals.find((g) => g.title.toLowerCase().includes('prototype') || g.id === 'goal-1') ||
        null;
    }
  }

  // 3. Resolve Parent Milestone
  let parentMilestone: Milestone | null = null;
  const milestoneId = task.milestoneId || parentProject?.milestoneId;
  if (milestoneId) {
    parentMilestone = milestones.find((m) => m.id === milestoneId) || null;
  }

  return {
    parentProject,
    parentGoal,
    parentMilestone,
  };
}
