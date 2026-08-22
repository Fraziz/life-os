import type {
  Task,
  Goal,
  Project,
  Milestone,
  Habit,
  NextActionRecommendation,
  UserSettings,
} from '@/types';
import { executeOptionalAICall } from './aiEngine';

interface NextActionContext {
  tasks: Task[];
  goals: Goal[];
  projects: Project[];
  milestones: Milestone[];
  habits: Habit[];
  settings: UserSettings;
  snoozedTaskIds?: string[];
  rejectedTaskIds?: string[];
  cycleIndex?: number;
}

/**
 * Deterministic scoring matrix for finding the single best next action.
 */
export function getDeterministicNextAction(ctx: NextActionContext): NextActionRecommendation | null {
  const {
    tasks,
    goals,
    projects,
    milestones,
    snoozedTaskIds = [],
    rejectedTaskIds = [],
    cycleIndex = 0,
  } = ctx;

  const todayStr = new Date().toISOString().split('T')[0];

  // Eligible tasks: not done, not snoozed, not rejected in current session
  const candidates = tasks.filter((t) => {
    if (t.status === 'done') return false;
    if (snoozedTaskIds.includes(t.id)) return false;
    if (rejectedTaskIds.includes(t.id)) return false;
    return true;
  });

  if (candidates.length === 0) {
    // If all tasks done or snoozed, return null
    return null;
  }

  // Score each candidate
  const scored = candidates.map((task) => {
    let score = 0;
    const reasons: string[] = [];

    // 1. Current In-Progress momentum
    if (task.status === 'doing') {
      score += 100;
      reasons.push('You already started this task (in "Doing"). Finishing it clears mental debt.');
    }

    // 2. Priority
    if (task.priority === 'urgent') {
      score += 80;
      reasons.push('Marked as Urgent priority.');
    } else if (task.priority === 'high') {
      score += 50;
      reasons.push('High priority objective.');
    }

    // 3. Due date urgency
    if (task.dueDate) {
      if (task.dueDate < todayStr) {
        score += 90;
        reasons.push(`Overdue since ${task.dueDate}. Finishing it relieves pressure.`);
      } else if (task.dueDate === todayStr) {
        score += 70;
        reasons.push('Due today.');
      }
    }

    // 4. Linked to Active Project with Milestones
    if (task.projectId) {
      const parentProject = projects.find((p) => p.id === task.projectId);
      if (parentProject && parentProject.status === 'active') {
        score += 30;
        reasons.push(`Advances active project "${parentProject.title}" (${parentProject.progress}% complete).`);
      }
    }

    // 5. Linked to Goal
    if (task.goalId) {
      const parentGoal = goals.find((g) => g.id === task.goalId);
      if (parentGoal && parentGoal.status === 'in-progress') {
        score += 25;
        reasons.push(`Directly impacts your goal "${parentGoal.title}".`);
      }
    }

    // 6. Subtask momentum
    if (task.subtasks && task.subtasks.length > 0) {
      const completedCount = task.subtasks.filter((s) => s.completed).length;
      if (completedCount > 0 && completedCount < task.subtasks.length) {
        score += 40;
        reasons.push(`Compound task with ${completedCount}/${task.subtasks.length} subtasks already done.`);
      }
    }

    return {
      task,
      score,
      reasons,
    };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Pick candidate based on cycleIndex
  const pickIndex = cycleIndex % scored.length;
  const picked = scored[pickIndex];

  if (!picked) return null;

  const parentProject = projects.find((p) => p.id === picked.task.projectId);
  const parentGoal = goals.find((g) => g.id === picked.task.goalId);

  const mainWhy = picked.reasons.length > 0
    ? picked.reasons.join(' ')
    : 'This is the clearest, most direct next step available in your active plan.';

  return {
    task: picked.task,
    why: mainWhy,
    estimatedMinutes: picked.task.estimatedDuration || 25,
    priority: picked.task.priority,
    projectTitle: parentProject?.title,
    goalTitle: parentGoal?.title,
    isAIGenerated: false,
    rejectionCount: rejectedTaskIds.length,
  };
}

/**
 * Master recommender: uses AI if enabled and configured; otherwise uses deterministic engine.
 */
export async function getNextActionRecommendation(
  ctx: NextActionContext
): Promise<NextActionRecommendation | null> {
  const { settings } = ctx;
  const aiSettings = settings.aiSettings;

  // 1. Fallback if AI disabled or missing API key
  if (!aiSettings?.enabled || !aiSettings.apiKey) {
    return getDeterministicNextAction(ctx);
  }

  // 2. Optional AI Evaluation
  try {
    const candidateTasks = ctx.tasks
      .filter((t) => t.status !== 'done')
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due: t.dueDate,
        estMinutes: t.estimatedDuration || 25,
      }));

    const systemPrompt = `You are an executive personal Life OS coach. Analyze the user's tasks and select the single highest-impact task to do right now. Format response strictly as JSON with: { "taskId": "string", "why": "1-2 sentence motivating reason why this matters now", "estimatedMinutes": number }`;
    const prompt = `Available tasks: ${JSON.stringify(candidateTasks)}. Choose the best ONE next action.`;

    const { text } = await executeOptionalAICall(prompt, systemPrompt, aiSettings);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const matchedTask = ctx.tasks.find((t) => t.id === parsed.taskId);
      if (matchedTask) {
        const parentProject = ctx.projects.find((p) => p.id === matchedTask.projectId);
        const parentGoal = ctx.goals.find((g) => g.id === matchedTask.goalId);

        return {
          task: matchedTask,
          why: parsed.why || 'Highest impact item aligned with your active priorities.',
          estimatedMinutes: parsed.estimatedMinutes || matchedTask.estimatedDuration || 25,
          priority: matchedTask.priority,
          projectTitle: parentProject?.title,
          goalTitle: parentGoal?.title,
          isAIGenerated: true,
        };
      }
    }

    // If AI output parse failed, fall back
    return getDeterministicNextAction(ctx);
  } catch (err) {
    console.warn('Optional AI recommender error, falling back to deterministic rules:', err);
    return getDeterministicNextAction(ctx);
  }
}
