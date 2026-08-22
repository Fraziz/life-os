import type { Task, Project } from '@/types';

export interface CategoryTimeInsight {
  categoryName: string;
  taskCount: number;
  avgEstimatedMins: number;
  avgActualMins: number;
  variancePercentage: number; // positive = takes longer than estimated, negative = takes less time
  insightMessage: string;
}

export interface TimeIntelligenceReport {
  totalAnalyzedTasks: number;
  overallAvgEstimatedMins: number;
  overallAvgActualMins: number;
  overallAccuracyRate: number; // percentage
  categoryInsights: CategoryTimeInsight[];
  topInsight: string | null;
}

/**
 * Analyzes historical task data to compare estimated vs actual time.
 * Strict rule: Does not make conclusions from too little data (requires >= 3 tasks per category).
 */
export function analyzeTaskTimePatterns(tasks: Task[], projects: Project[]): TimeIntelligenceReport {
  // Filter tasks that have both estimated and actual duration recorded
  const validTasks = tasks.filter(
    (t) => t.estimatedDuration && t.estimatedDuration > 0 && t.actualDuration && t.actualDuration > 0
  );

  if (validTasks.length === 0) {
    return {
      totalAnalyzedTasks: 0,
      overallAvgEstimatedMins: 0,
      overallAvgActualMins: 0,
      overallAccuracyRate: 100,
      categoryInsights: [],
      topInsight: null,
    };
  }

  // ── Overall Calculations ──
  const totalEstimated = validTasks.reduce((acc, t) => acc + (t.estimatedDuration || 0), 0);
  const totalActual = validTasks.reduce((acc, t) => acc + (t.actualDuration || 0), 0);
  const overallAvgEstimatedMins = Math.round(totalEstimated / validTasks.length);
  const overallAvgActualMins = Math.round(totalActual / validTasks.length);

  const overallAccuracyRate = totalActual > 0
    ? Math.max(0, Math.min(100, Math.round((1 - Math.abs(totalActual - totalEstimated) / totalActual) * 100)))
    : 100;

  // ── Group by Project ──
  const projectGroups: Record<string, Task[]> = {};
  validTasks.forEach((t) => {
    if (t.projectId) {
      if (!projectGroups[t.projectId]) projectGroups[t.projectId] = [];
      projectGroups[t.projectId].push(t);
    }
  });

  const categoryInsights: CategoryTimeInsight[] = [];

  Object.entries(projectGroups).forEach(([projectId, pTasks]) => {
    // Only generate conclusions when >= 3 tasks exist in this category
    if (pTasks.length >= 3) {
      const proj = projects.find((p) => p.id === projectId);
      const categoryName = proj ? proj.title : 'Project Tasks';

      const estSum = pTasks.reduce((acc, t) => acc + (t.estimatedDuration || 0), 0);
      const actSum = pTasks.reduce((acc, t) => acc + (t.actualDuration || 0), 0);

      const avgEst = Math.round(estSum / pTasks.length);
      const avgAct = Math.round(actSum / pTasks.length);
      const diff = avgAct - avgEst;
      const variancePercentage = avgEst > 0 ? Math.round((diff / avgEst) * 100) : 0;

      let message = '';
      if (Math.abs(variancePercentage) <= 15) {
        message = `Your estimates for ${categoryName} are highly calibrated (${avgEst}m est vs ${avgAct}m actual).`;
      } else if (variancePercentage > 15) {
        message = `You usually estimate ${categoryName} tasks at ${avgEst} minutes, but they take around ${avgAct} minutes (+${variancePercentage}%).`;
      } else {
        message = `You usually complete ${categoryName} tasks faster than expected (${avgAct}m actual vs ${avgEst}m est).`;
      }

      categoryInsights.push({
        categoryName,
        taskCount: pTasks.length,
        avgEstimatedMins: avgEst,
        avgActualMins: avgAct,
        variancePercentage,
        insightMessage: message,
      });
    }
  });

  // Pick top insight if available
  const topInsight = categoryInsights.length > 0 ? categoryInsights[0].insightMessage : null;

  return {
    totalAnalyzedTasks: validTasks.length,
    overallAvgEstimatedMins,
    overallAvgActualMins,
    overallAccuracyRate,
    categoryInsights,
    topInsight,
  };
}
