import type {
  Goal,
  Project,
  Task,
  AISettings,
  AISuggestion,
  SuggestedAction,
  UserSettings,
} from '@/types';

/**
 * Deterministic rules engine when AI is disabled or offline.
 * Produces structured, explainable suggestions from existing graph relations.
 */
export function generateDeterministicBreakdown(goal: Goal, projects: Project[]): AISuggestion {
  const linkedProjects = projects.filter((p) => p.goalId === goal.id);

  const actions: SuggestedAction[] = [
    {
      id: `act-step-1`,
      type: 'create_task',
      label: `Define first actionable milestone for "${goal.title}"`,
      payload: {
        title: `Draft execution roadmap for ${goal.title}`,
        priority: goal.priority,
        estimatedDuration: 30,
        goalId: goal.id,
        tags: ['planning', 'milestone'],
      },
      selected: true,
    },
    {
      id: `act-step-2`,
      type: 'create_task',
      label: `Audit tools, assets, and prerequisites needed`,
      payload: {
        title: `Prerequisites check: ${goal.title}`,
        priority: 'medium',
        estimatedDuration: 25,
        goalId: goal.id,
        tags: ['research', 'setup'],
      },
      selected: true,
    },
    {
      id: `act-step-3`,
      type: 'create_task',
      label: `Execute first prototype or foundation step`,
      payload: {
        title: `Build MVP foundation: ${goal.title}`,
        priority: 'high',
        estimatedDuration: 60,
        goalId: goal.id,
        tags: ['execution', 'mvp'],
      },
      selected: true,
    },
  ];

  return {
    id: `sug-breakdown-${goal.id}-${Date.now()}`,
    type: 'breakdown',
    title: `Step-by-Step Breakdown: ${goal.title}`,
    explanation: `Based on your ${goal.horizon} horizon and "${goal.why || 'stated ambition'}", breaking this down into an initial roadmap, prerequisites audit, and foundational build step ensures consistent momentum.`,
    actions,
    isDeterministicFallback: true,
    createdAt: new Date().toISOString(),
  };
}

export function generateDeterministicDayPlan(
  tasks: Task[],
  settings: UserSettings
): AISuggestion {
  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const urgentTasks = activeTasks.filter((t) => t.priority === 'urgent');
  const highTasks = activeTasks.filter((t) => t.priority === 'high');
  const otherTasks = activeTasks.filter((t) => t.priority !== 'urgent' && t.priority !== 'high');

  const selectedForToday = [...urgentTasks, ...highTasks, ...otherTasks].slice(0, 5);

  const actions: SuggestedAction[] = selectedForToday.map((t, idx) => ({
    id: `act-plan-${t.id}`,
    type: 'schedule_block',
    label: `${idx + 1}. [${t.priority.toUpperCase()}] ${t.title} (${t.estimatedDuration || 30}m)`,
    payload: {
      taskId: t.id,
      title: t.title,
      duration: t.estimatedDuration || 30,
    },
    selected: true,
  }));

  const totalMinutes = selectedForToday.reduce((acc, t) => acc + (t.estimatedDuration || 30), 0);

  return {
    id: `sug-dayplan-${Date.now()}`,
    type: 'day_plan',
    title: `Optimized Daily Focus Plan (${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}m)`,
    explanation: `Prioritizing ${urgentTasks.length} urgent and ${highTasks.length} high-priority tasks first, tailored to your ${settings.availableHoursPerDay || 8}h planned daily capacity.`,
    actions,
    isDeterministicFallback: true,
    createdAt: new Date().toISOString(),
  };
}

export function generateDeterministicBlockerAnalysis(
  tasks: Task[],
  projects: Project[]
): AISuggestion {
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
  const stalledProjects = projects.filter((p) => p.status === 'active' && p.progress === 0);

  const actions: SuggestedAction[] = [];

  if (overdueTasks.length > 0) {
    actions.push({
      id: `act-blocker-resched`,
      type: 'update_priority',
      label: `Reschedule or downscale ${overdueTasks.length} overdue task(s)`,
      payload: { taskIds: overdueTasks.map((t) => t.id) },
      selected: true,
    });
  }

  stalledProjects.forEach((p) => {
    actions.push({
      id: `act-stalled-${p.id}`,
      type: 'create_task',
      label: `Create 15-minute unblock task for project "${p.title}"`,
      payload: {
        title: `15-min restart: define immediate next move on ${p.title}`,
        priority: 'high',
        estimatedDuration: 15,
        projectId: p.id,
      },
      selected: true,
    });
  });

  return {
    id: `sug-blockers-${Date.now()}`,
    type: 'blockers',
    title: `Friction & Blocker Detection`,
    explanation: overdueTasks.length > 0 || stalledProjects.length > 0
      ? `Identified ${overdueTasks.length} overdue item(s) and ${stalledProjects.length} stalled project(s). Small 15-minute bite-sized steps help eliminate friction without overwhelm.`
      : `Zero critical blockers detected! Your active backlog and projects are progressing smoothly.`,
    actions,
    isDeterministicFallback: true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Optional Cloud AI Call with strictly controlled token limits, cost tracking, and error handling.
 */
export async function executeOptionalAICall(
  prompt: string,
  systemPrompt: string,
  aiSettings: AISettings
): Promise<{ text: string; tokensUsed: number; costUSD: number }> {
  if (!aiSettings.apiKey) {
    throw new Error('API key is missing. Please configure your API key in Settings.');
  }

  // Budget safeguard
  if (aiSettings.spentBudgetUSD >= aiSettings.monthlyBudgetUSD) {
    throw new Error(`Monthly AI budget limit ($${aiSettings.monthlyBudgetUSD.toFixed(2)}) reached. Falling back to local rules.`);
  }

  // Mock-safe Gemini / OpenAI / Anthropic format
  if (aiSettings.provider === 'gemini') {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${aiSettings.model || 'gemini-1.5-flash'}:generateContent?key=${aiSettings.apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }
        ],
        generationConfig: {
          temperature: aiSettings.temperature || 0.7,
          maxOutputTokens: 1000,
        },
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Gemini API error (${response.status})`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const totalTokens = data.usageMetadata?.totalTokenCount || 400;
    const costUSD = (totalTokens / 1_000_000) * 0.075; // Approx Gemini Flash pricing

    return { text, tokensUsed: totalTokens, costUSD };
  } else {
    // OpenAI-compatible endpoint
    const endpoint = aiSettings.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiSettings.apiKey}`,
      },
      body: JSON.stringify({
        model: aiSettings.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: aiSettings.temperature || 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `API error (${response.status})`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const totalTokens = data.usage?.total_tokens || 450;
    const costUSD = (totalTokens / 1_000_000) * 0.15;

    return { text, tokensUsed: totalTokens, costUSD };
  }
}
