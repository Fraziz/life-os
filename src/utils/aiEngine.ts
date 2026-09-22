import type {
  Goal,
  Project,
  Task,
  AISettings,
  AISuggestion,
  SuggestedAction,
  UserSettings,
  Habit,
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

// ── Types for new AI features ─────────────────────────────────────────────

export interface BrainDumpClassification {
  itemId: string;
  text: string;
  suggestedType: 'task' | 'goal' | 'project' | 'dream' | 'idea' | 'note';
  suggestedPriority?: 'urgent' | 'high' | 'medium' | 'low';
  suggestedTags?: string[];
  reasoning: string;
}

export interface GoalCoachResult {
  assessment: string;       // e.g. "40% done in 60% of the time"
  status: 'on-track' | 'behind' | 'ahead' | 'stalled';
  nextSteps: string[];
  motivation: string;
}

export interface WeeklyReviewDraft {
  wentWell: string;
  didNotGoWell: string;
  shouldChange: string;
  nextWeekFocus: string;
}

export interface ProblemAnalysis {
  facts: string[];
  assumptions: string[];
  rootCauses: string[];
  successMetrics: string[];
  nextSteps: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ── Feature 1: AI Brain Dump Batch Processor ─────────────────────────────

/** Keywords that suggest a type (local fallback) */
function classifyItemLocally(text: string): BrainDumpClassification['suggestedType'] {
  const t = text.toLowerCase();
  if (/build|create|launch|develop|make|ship|release/.test(t)) return 'project';
  if (/dream|someday|vision|life|imagine|when i|one day/.test(t)) return 'dream';
  if (/goal|achieve|by|target|reach|complete|finish by/.test(t)) return 'goal';
  if (/buy|call|email|send|book|schedule|fix|clean|write|review/.test(t)) return 'task';
  if (/idea|what if|maybe|could|might|concept|thought/.test(t)) return 'idea';
  return 'note';
}

function priorityFromText(text: string): 'urgent' | 'high' | 'medium' | 'low' {
  const t = text.toLowerCase();
  if (/urgent|asap|immediately|now|critical|emergency/.test(t)) return 'urgent';
  if (/important|soon|this week|high/.test(t)) return 'high';
  if (/low|someday|eventually|whenever/.test(t)) return 'low';
  return 'medium';
}

export async function processBrainDumpWithAI(
  items: Array<{ id: string; text: string }>,
  aiSettings?: AISettings
): Promise<BrainDumpClassification[]> {
  // Always generate local results first as base
  const local: BrainDumpClassification[] = items.map((item) => ({
    itemId: item.id,
    text: item.text,
    suggestedType: classifyItemLocally(item.text),
    suggestedPriority: priorityFromText(item.text),
    suggestedTags: [],
    reasoning: 'Classified by keyword analysis.',
  }));

  if (!aiSettings?.enabled || !aiSettings.apiKey || items.length === 0) {
    return local;
  }

  try {
    const systemPrompt = `You are a Life OS productivity assistant. Classify each brain dump item.
Respond ONLY with a valid JSON array. Each element: { "itemId": string, "suggestedType": "task"|"goal"|"project"|"dream"|"idea"|"note", "suggestedPriority": "urgent"|"high"|"medium"|"low", "suggestedTags": string[], "reasoning": string }
Keep reasoning to 1 short sentence. No markdown fences.`;
    const prompt = `Classify these items:\n${items.map(i => `ID:${i.id} TEXT:"${i.text}"`).join('\n')}`;
    const { text } = await executeOptionalAICall(prompt, systemPrompt, aiSettings);
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed: BrainDumpClassification[] = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fall through to local
  }
  return local;
}

// ── Feature 2: AI Goal Coach ──────────────────────────────────────────────

export async function coachGoalWithAI(
  goal: Goal,
  relatedTasks: Task[],
  aiSettings?: AISettings
): Promise<GoalCoachResult> {
  const totalTasks = relatedTasks.length;
  const doneTasks = relatedTasks.filter(t => t.status === 'done').length;
  const progress = goal.progress ?? (totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0);

  // Deterministic assessment
  const daysLeft = goal.targetDate
    ? Math.max(0, Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000))
    : null;

  let status: GoalCoachResult['status'] = 'on-track';
  if (progress < 20 && daysLeft !== null && daysLeft < 14) status = 'stalled';
  else if (progress >= 80) status = 'ahead';
  else if (daysLeft !== null && daysLeft < 7 && progress < 50) status = 'behind';

  const local: GoalCoachResult = {
    assessment: `You are ${progress}% complete${daysLeft !== null ? ` with ${daysLeft} days remaining` : ''}.`,
    status,
    nextSteps: [
      `Complete 1 high-priority task linked to "${goal.title}" today.`,
      doneTasks < totalTasks
        ? `You have ${totalTasks - doneTasks} tasks left. Focus on the smallest one first.`
        : `Add 2–3 new actionable tasks to keep momentum going.`,
      goal.why ? `Remember your why: "${goal.why}"` : 'Revisit why this goal matters to you.',
    ],
    motivation: goal.why
      ? `"${goal.why}" — This is your anchor. One step at a time.`
      : 'Progress over perfection. Every task done is momentum.',
  };

  if (!aiSettings?.enabled || !aiSettings.apiKey) return local;

  try {
    const systemPrompt = `You are an executive life coach. Analyze the user's goal and give a personalized coaching report. Respond ONLY with valid JSON: { "assessment": string, "status": "on-track"|"behind"|"ahead"|"stalled", "nextSteps": string[], "motivation": string }. No markdown fences.`;
    const prompt = `Goal: "${goal.title}" | Why: "${goal.why || 'not specified'}" | Progress: ${progress}% | Tasks done: ${doneTasks}/${totalTasks} | Days left: ${daysLeft ?? 'unknown'} | Horizon: ${goal.horizon}`;
    const { text } = await executeOptionalAICall(prompt, systemPrompt, aiSettings);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.assessment && parsed.nextSteps) return parsed as GoalCoachResult;
    }
  } catch {
    // fall through
  }
  return local;
}

// ── Feature 3: AI Weekly Review Drafter ──────────────────────────────────

export async function draftWeeklyReviewWithAI(
  stats: {
    completedTaskCount: number;
    completedTaskTitles: string[];
    focusMinutes: number;
    habitStreak: number;
    activeGoalCount: number;
    topGoalTitle?: string;
  },
  aiSettings?: AISettings
): Promise<WeeklyReviewDraft> {
  const local: WeeklyReviewDraft = {
    wentWell: stats.completedTaskCount > 0
      ? `Completed ${stats.completedTaskCount} tasks this week${stats.completedTaskTitles.length > 0 ? `, including: ${stats.completedTaskTitles.slice(0, 3).join(', ')}` : ''}.`
      : 'Showed up and made progress on active goals.',
    didNotGoWell: stats.completedTaskCount < 3
      ? 'Task completion was lower than expected. Some items stayed in backlog longer than planned.'
      : 'A few tasks spilled into next week due to scope or distractions.',
    shouldChange: 'Break tasks into smaller 15–30 minute pieces for easier execution. Schedule deep work blocks in the calendar.',
    nextWeekFocus: stats.topGoalTitle
      ? `Prioritize momentum on "${stats.topGoalTitle}" and aim to complete at least 5 tasks.`
      : 'Pick the single most important goal and take 3 concrete actions toward it.',
  };

  if (!aiSettings?.enabled || !aiSettings.apiKey) return local;

  try {
    const systemPrompt = `You are a thoughtful productivity coach helping a user write their weekly review. Write in first person as if the user is writing about themselves. Be honest, specific, and motivating. Respond ONLY with valid JSON: { "wentWell": string, "didNotGoWell": string, "shouldChange": string, "nextWeekFocus": string }. Each field should be 1-2 sentences. No markdown fences.`;
    const prompt = `Weekly data: Completed ${stats.completedTaskCount} tasks (${stats.completedTaskTitles.slice(0, 5).join(', ')}). Focus sessions: ${Math.round(stats.focusMinutes / 60)}h. Habit streak: ${stats.habitStreak} days. Active goals: ${stats.activeGoalCount}. Top goal: "${stats.topGoalTitle || 'N/A'}".`;
    const { text } = await executeOptionalAICall(prompt, systemPrompt, aiSettings);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.wentWell) return parsed as WeeklyReviewDraft;
    }
  } catch {
    // fall through
  }
  return local;
}

// ── Feature 4: AI Problem Solver ─────────────────────────────────────────

export async function analyzeProblemWithAI(
  problemStatement: string,
  aiSettings?: AISettings
): Promise<ProblemAnalysis> {
  const local: ProblemAnalysis = {
    facts: [
      'The problem is occurring in the current system.',
      'It has a measurable or observable effect.',
    ],
    assumptions: [
      'The root cause has not yet been fully identified.',
      'The problem can be solved with the right approach.',
    ],
    rootCauses: [
      'Why is this happening? (investigate further)',
      'What process or system allowed this to occur?',
      'What is the underlying constraint or gap?',
    ],
    successMetrics: [
      'The problem no longer occurs.',
      'A clear, documented solution is in place.',
    ],
    nextSteps: [
      `Investigate: "${problemStatement.slice(0, 60)}"`,
      'Gather 2–3 concrete facts about the situation.',
      'Try 1 potential solution and measure the result.',
    ],
  };

  if (!aiSettings?.enabled || !aiSettings.apiKey || !problemStatement.trim()) return local;

  try {
    const systemPrompt = `You are a world-class problem-solving consultant. Analyze the problem and produce a structured breakdown. Respond ONLY with valid JSON: { "facts": string[], "assumptions": string[], "rootCauses": string[], "successMetrics": string[], "nextSteps": string[] }. Each array should have 2–4 items. Be specific and actionable. No markdown fences.`;
    const prompt = `Problem: "${problemStatement}"`;
    const { text } = await executeOptionalAICall(prompt, systemPrompt, aiSettings);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.facts && parsed.nextSteps) return parsed as ProblemAnalysis;
    }
  } catch {
    // fall through
  }
  return local;
}

// ── Feature 5: AI Life OS Chat Assistant ─────────────────────────────────

export async function chatWithAssistant(
  userMessage: string,
  history: ChatMessage[],
  context: {
    tasks: Task[];
    goals: Goal[];
    projects: Project[];
    habits: Habit[];
    userName: string;
  },
  aiSettings?: AISettings
): Promise<string> {
  const { tasks, goals, projects, habits, userName } = context;

  // Smart deterministic responses for common questions (no API key needed)
  const q = userMessage.toLowerCase();

  if (!aiSettings?.enabled || !aiSettings.apiKey) {
    const todayStr = new Date().toISOString().split('T')[0];
    const activeTasks = tasks.filter(t => t.status !== 'done');
    const urgent = activeTasks.filter(t => t.priority === 'urgent');
    const overdue = activeTasks.filter(t => t.dueDate && t.dueDate < todayStr);
    const activeGoals = goals.filter(g => g.status === 'in-progress');
    const doneToday = tasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(todayStr));

    if (/focus|do now|next|what should/.test(q)) {
      const top = urgent[0] || activeTasks.find(t => t.priority === 'high') || activeTasks[0];
      return top
        ? `🎯 Right now I'd recommend: **"${top.title}"** — it's ${top.priority} priority. Set a 25-minute timer and go!`
        : `✅ You're all caught up, ${userName}! No pending tasks. Add something new or take a well-earned break.`;
    }

    if (/behind|progress|goal/.test(q)) {
      if (activeGoals.length === 0) return `You have no active goals right now. Head to Goals → Add one to get started! 🎯`;
      return `📊 You have **${activeGoals.length} active goal(s)**:\n${activeGoals.slice(0, 3).map(g => `• "${g.title}" — ${g.progress ?? 0}% complete`).join('\n')}\n\nKeep pushing! Consistency beats intensity.`;
    }

    if (/overdue|late|missed/.test(q)) {
      return overdue.length > 0
        ? `⚠️ You have **${overdue.length} overdue task(s)**:\n${overdue.slice(0, 3).map(t => `• "${t.title}" (due ${t.dueDate})`).join('\n')}\n\nTackle the smallest one first to regain momentum.`
        : `🎉 No overdue tasks! You're on top of things, ${userName}.`;
    }

    if (/done|completed|today|accomplish/.test(q)) {
      return doneToday.length > 0
        ? `✅ Today you've completed **${doneToday.length} task(s)**:\n${doneToday.slice(0, 3).map(t => `• "${t.title}"`).join('\n')}\n\nGreat work! Keep the momentum going.`
        : `No tasks completed yet today. Let's change that — pick one task and just start! 💪`;
    }

    if (/habit/.test(q)) {
      return habits.length > 0
        ? `🔥 You have **${habits.length} habit(s)**: ${habits.map(h => h.title).join(', ')}. Check them off in the Habits page!`
        : `You don't have any habits set up yet. Head to Habits to start building your streak! 🔥`;
    }

    return `Hi ${userName}! I'm your Life OS assistant. I can answer questions about your tasks, goals, habits, and progress. Try asking: "What should I focus on?", "Am I behind on any goals?", or "What did I accomplish today?" 🤖\n\n*Tip: Add a Gemini or OpenAI API key in Settings → AI for real AI responses.*`;
  }

  // Real AI chat with context
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const contextSummary = {
      user: userName,
      date: todayStr,
      activeTasks: tasks.filter(t => t.status !== 'done').slice(0, 8).map(t => ({ title: t.title, priority: t.priority, due: t.dueDate })),
      goals: goals.filter(g => g.status === 'in-progress').slice(0, 5).map(g => ({ title: g.title, progress: g.progress, horizon: g.horizon })),
      projects: projects.filter(p => p.status === 'active').slice(0, 4).map(p => ({ title: p.title, progress: p.progress })),
      habits: habits.slice(0, 5).map(h => h.title),
    };

    const historyMessages = history.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

    const systemPrompt = `You are a friendly, insightful AI Life OS coach for ${userName}. You know their full productivity system. Be concise (2–4 sentences max), warm, and actionable. Use emojis sparingly. Never make up data not in the context. Today is ${todayStr}.

User's current context:
${JSON.stringify(contextSummary, null, 2)}`;

    const prompt = historyMessages ? `Conversation so far:\n${historyMessages}\n\nUser: ${userMessage}` : userMessage;
    const { text } = await executeOptionalAICall(prompt, systemPrompt, aiSettings);
    return text.trim() || 'I had trouble generating a response. Please try again.';
  } catch {
    return `I encountered an error. Please check your API key in Settings → AI. In the meantime, I can answer basic questions about your tasks and goals without AI.`;
  }
}
