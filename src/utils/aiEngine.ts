import type {
  Goal,
  Project,
  Task,
  AISettings,
  AISuggestion,
  SuggestedAction,
  UserSettings,
  Habit,
  CalendarEvent,
  KnowledgeDocument,
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
 * AI-Powered Goal Breakdown (uses Cloud AI when configured, else falls back)
 */
export async function generateAIBreakdown(
  goal: Goal,
  projects: Project[],
  aiSettings?: AISettings,
  customConstraint?: string
): Promise<AISuggestion> {
  const fallback = generateDeterministicBreakdown(goal, projects);
  if (!aiSettings?.enabled || !aiSettings.apiKey) {
    return fallback;
  }

  try {
    const systemPrompt = `You are a world-class strategic execution coach in Life OS.
Break down the given high-level goal into 3 to 5 realistic, high-impact, actionable tasks.
Respond ONLY with a valid JSON object matching this schema:
{
  "title": string,
  "explanation": string,
  "tasks": [
    {
      "title": string,
      "priority": "urgent" | "high" | "medium" | "low",
      "estimatedDuration": number (in minutes, e.g. 15, 30, 45, 60),
      "tags": string[] (1-3 tags e.g. ["planning", "execution", "mvp"])
    }
  ]
}
No markdown code fences. Keep explanation to 2 crisp, inspiring sentences.`;

    const prompt = `Goal: "${goal.title}"
Why: "${goal.why || 'Not specified'}"
Horizon: ${goal.horizon}
Target Date: ${goal.targetDate || 'Flexible'}
Priority: ${goal.priority}
Current Progress: ${goal.progress ?? 0}%
Linked Projects: ${projects.filter((p) => p.goalId === goal.id).map((p) => p.title).join(', ') || 'None yet'}
${customConstraint ? `User Constraint / Note: "${customConstraint}"` : ''}`;

    const { text } = await executeOptionalAICall(prompt, systemPrompt, aiSettings);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        const actions: SuggestedAction[] = parsed.tasks.map((t: any, idx: number) => ({
          id: `ai-act-${goal.id}-${idx}-${Date.now()}`,
          type: 'create_task',
          label: `${t.title} (${t.estimatedDuration || 30}m · [${(t.priority || 'medium').toUpperCase()}])`,
          payload: {
            title: t.title,
            priority: t.priority || 'medium',
            estimatedDuration: t.estimatedDuration || 30,
            goalId: goal.id,
            tags: Array.isArray(t.tags) && t.tags.length > 0 ? t.tags : ['ai-breakdown'],
          },
          selected: true,
        }));

        return {
          id: `sug-ai-breakdown-${goal.id}-${Date.now()}`,
          type: 'breakdown',
          title: parsed.title || `AI Strategy: ${goal.title}`,
          explanation: parsed.explanation || fallback.explanation,
          actions,
          isDeterministicFallback: false,
          createdAt: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn('AI Breakdown call failed, using deterministic fallback:', err);
  }

  return fallback;
}

/**
 * AI-Powered Day Plan Generator (uses Cloud AI when configured, else falls back)
 */
export async function generateAIDayPlan(
  tasks: Task[],
  settings: UserSettings,
  aiSettings?: AISettings
): Promise<AISuggestion> {
  const fallback = generateDeterministicDayPlan(tasks, settings);
  if (!aiSettings?.enabled || !aiSettings.apiKey) {
    return fallback;
  }

  try {
    const activeTasks = tasks
      .filter((t) => t.status !== 'done')
      .slice(0, 15)
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        duration: t.estimatedDuration || 30,
        due: t.dueDate,
      }));

    const systemPrompt = `You are an elite productivity executive. Given the user's available tasks and daily capacity, select and order the 4-6 highest ROI tasks to execute today.
Respond ONLY with a valid JSON object matching this schema:
{
  "title": string,
  "explanation": string,
  "selectedTaskIds": string[]
}
No markdown fences.`;

    const prompt = `Available daily capacity: ${settings.availableHoursPerDay || 8} hours.
Planning style: ${settings.planningStyle || 'time-blocking'}.
Tasks: ${JSON.stringify(activeTasks, null, 2)}`;

    const { text } = await executeOptionalAICall(prompt, systemPrompt, aiSettings);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed.selectedTaskIds) && parsed.selectedTaskIds.length > 0) {
        const chosenTasks = parsed.selectedTaskIds
          .map((id: string) => tasks.find((t) => t.id === id))
          .filter(Boolean) as Task[];

        if (chosenTasks.length > 0) {
          const totalMinutes = chosenTasks.reduce((acc, t) => acc + (t.estimatedDuration || 30), 0);
          const actions: SuggestedAction[] = chosenTasks.map((t, idx) => ({
            id: `ai-plan-${t.id}`,
            type: 'schedule_block',
            label: `${idx + 1}. [${t.priority.toUpperCase()}] ${t.title} (${t.estimatedDuration || 30}m)`,
            payload: {
              taskId: t.id,
              title: t.title,
              duration: t.estimatedDuration || 30,
            },
            selected: true,
          }));

          return {
            id: `sug-ai-dayplan-${Date.now()}`,
            type: 'day_plan',
            title: parsed.title || `AI Focus Plan (${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}m)`,
            explanation: parsed.explanation || fallback.explanation,
            actions,
            isDeterministicFallback: false,
            createdAt: new Date().toISOString(),
          };
        }
      }
    }
  } catch (err) {
    console.warn('AI Day Plan call failed, using deterministic fallback:', err);
  }

  return fallback;
}

/**
 * AI-Powered Blocker & Friction Analysis
 */
export async function generateAIBlockerAnalysis(
  tasks: Task[],
  projects: Project[],
  aiSettings?: AISettings
): Promise<AISuggestion> {
  const fallback = generateDeterministicBlockerAnalysis(tasks, projects);
  if (!aiSettings?.enabled || !aiSettings.apiKey) {
    return fallback;
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
    const stalledProjects = projects.filter((p) => p.status === 'active' && p.progress === 0);

    const systemPrompt = `You are a peak-performance friction auditor.
Analyze the user's overdue tasks and stalled projects to identify hidden blockers and prescribe 15-minute unsticking actions.
Respond ONLY with a valid JSON object matching:
{
  "title": string,
  "explanation": string,
  "actions": [
    {
      "label": string,
      "taskTitle": string,
      "priority": "high" | "urgent" | "medium",
      "estimatedDuration": number,
      "projectId": string (optional)
    }
  ]
}
No markdown fences.`;

    const prompt = `Today's date: ${todayStr}
Overdue tasks (${overdueTasks.length}): ${JSON.stringify(overdueTasks.slice(0, 6).map((t) => ({ id: t.id, title: t.title, due: t.dueDate })))}
Stalled projects (${stalledProjects.length}): ${JSON.stringify(stalledProjects.slice(0, 4).map((p) => ({ id: p.id, title: p.title })))}`;

    const { text } = await executeOptionalAICall(prompt, systemPrompt, aiSettings);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
        const actions: SuggestedAction[] = parsed.actions.map((act: any, idx: number) => ({
          id: `ai-blocker-${idx}-${Date.now()}`,
          type: 'create_task',
          label: act.label || act.taskTitle,
          payload: {
            title: act.taskTitle || act.label,
            priority: act.priority || 'high',
            estimatedDuration: act.estimatedDuration || 15,
            projectId: act.projectId,
            tags: ['unblock', 'friction-remover'],
          },
          selected: true,
        }));

        return {
          id: `sug-ai-blockers-${Date.now()}`,
          type: 'blockers',
          title: parsed.title || 'AI Friction & Blocker Analysis',
          explanation: parsed.explanation || fallback.explanation,
          actions,
          isDeterministicFallback: false,
          createdAt: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn('AI Blocker call failed, using deterministic fallback:', err);
  }

  return fallback;
}

/**
 * Test AI API connection with a lightweight ping
 */
export async function testAIConnection(aiSettings: AISettings): Promise<{
  success: boolean;
  message: string;
  latencyMs: number;
  modelUsed?: string;
}> {
  if (!aiSettings.apiKey && aiSettings.provider !== 'custom') {
    return {
      success: false,
      message: 'API key is missing. Please enter your API key.',
      latencyMs: 0,
    };
  }

  const startTime = Date.now();
  try {
    const systemPrompt = 'You are a test ping responder for Life OS. Respond with a concise greeting of 5 words or fewer.';
    const prompt = 'Ping! Respond with: "Life OS AI Connected!"';
    const result = await executeOptionalAICall(prompt, systemPrompt, aiSettings);
    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      message: result.text.trim() || 'Connected successfully!',
      latencyMs,
      modelUsed: aiSettings.model || (aiSettings.provider === 'gemini' ? 'gemini-2.0-flash' : 'default'),
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      message: err?.message || 'Connection failed. Please verify your API key and network.',
      latencyMs,
    };
  }
}

/**
 * Optional Cloud AI Call with strictly controlled token limits, cost tracking, and error handling.
 * Supports Google Gemini, OpenAI, Anthropic, and Custom OpenAI-compatible endpoints (Groq, OpenRouter, Ollama).
 */
export async function executeOptionalAICall(
  prompt: string,
  systemPrompt: string,
  aiSettings: AISettings
): Promise<{ text: string; tokensUsed: number; costUSD: number }> {
  if (!aiSettings.apiKey && aiSettings.provider !== 'custom') {
    throw new Error('API key is missing. Please configure your API key in Settings.');
  }

  // Budget safeguard
  if (aiSettings.spentBudgetUSD >= aiSettings.monthlyBudgetUSD) {
    throw new Error(
      `Monthly AI budget limit ($${aiSettings.monthlyBudgetUSD.toFixed(2)}) reached. Falling back to local rules.`
    );
  }

  // 1. Google Gemini API
  if (aiSettings.provider === 'gemini') {
    const rawModel = aiSettings.model?.trim() || 'gemini-2.0-flash';
    const initialCleanModel = rawModel.replace(/^models\//, '');
    
    // Candidates to attempt in order if the specified model returns 404 or retired
    const candidateModels = Array.from(new Set([
      initialCleanModel,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.5-pro',
    ]));

    // Multi-key Pool for Auto-failover & Auto-switching when quota/limit is low
    const candidateKeys: string[] = [];
    if (aiSettings.apiKey?.trim()) {
      candidateKeys.push(aiSettings.apiKey.trim());
    }
    if (aiSettings.savedKeys && aiSettings.savedKeys.length > 0) {
      for (const k of aiSettings.savedKeys) {
        const clean = k.apiKey?.trim();
        if (clean && !candidateKeys.includes(clean)) {
          candidateKeys.push(clean);
        }
      }
    }

    if (candidateKeys.length === 0) {
      throw new Error('API key is missing. Please configure your API key in Settings.');
    }

    let lastError: Error | null = null;

    // Iterate through available API keys in pool (Auto-Failover)
    for (let keyIdx = 0; keyIdx < candidateKeys.length; keyIdx++) {
      const currentKey = candidateKeys[keyIdx];
      const hasBackupKeys = keyIdx < candidateKeys.length - 1;

      for (const cleanModel of candidateModels) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${currentKey}`;

        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(6000),
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
              contents: [
                {
                  role: 'user',
                  parts: [{ text: prompt }],
                },
              ],
              generationConfig: {
                temperature: aiSettings.temperature ?? 0.7,
                maxOutputTokens: 2048,
              },
            }),
          });
        } catch {
          // If systemInstruction wasn't supported by older endpoint, retry with combined prompt
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(6000),
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${systemPrompt}\n\n${prompt}` }],
                },
              ],
              generationConfig: {
                temperature: aiSettings.temperature ?? 0.7,
                maxOutputTokens: 2048,
              },
            }),
          });
        }

        if (response.ok) {
          const data = await response.json();
          const text =
            data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ||
            data.candidates?.[0]?.content?.parts?.[0]?.text ||
            '';
          const totalTokens = data.usageMetadata?.totalTokenCount || 400;
          const costUSD = (totalTokens / 1_000_000) * 0.075;

          return { text, tokensUsed: totalTokens, costUSD };
        }

        const errJson = await response.json().catch(() => ({}));
        const rawErrMsg = errJson.error?.message || `Gemini API error (${response.status})`;

        const isKeyInvalid =
          response.status === 400 &&
          (rawErrMsg.toLowerCase().includes('api key not valid') ||
           rawErrMsg.toLowerCase().includes('api_key_invalid') ||
           rawErrMsg.toLowerCase().includes('invalid api key') ||
           rawErrMsg.toLowerCase().includes('key not valid') ||
           rawErrMsg.toLowerCase().includes('api key expired'));

        const isQuotaOrLimit =
          response.status === 429 ||
          rawErrMsg.includes('RESOURCE_EXHAUSTED') ||
          rawErrMsg.toLowerCase().includes('quota') ||
          rawErrMsg.toLowerCase().includes('rate limit');

        if (isKeyInvalid || isQuotaOrLimit) {
          if (hasBackupKeys) {
            console.warn(`[Life OS AI] Key #${keyIdx + 1} failed (${rawErrMsg}). Auto-switching to backup key in pool...`);
            lastError = new Error(`Key #${keyIdx + 1} unavailable. Switched to backup key.`);
            break; // Break inner model loop to try NEXT KEY in candidateKeys
          }
          if (isQuotaOrLimit) {
            throw new Error('Gemini quota limit reached on all saved keys. Please add a backup key in Settings or try later.');
          }
          if (isKeyInvalid) {
            throw new Error('Invalid Gemini API key. Please check your API key in Settings (Google AI Studio).');
          }
        }

        if (
          response.status === 404 ||
          rawErrMsg.toLowerCase().includes('not found') ||
          rawErrMsg.toLowerCase().includes('no longer available') ||
          rawErrMsg.toLowerCase().includes('high demand')
        ) {
          // Try next candidate model
          lastError = new Error(`Gemini model "${cleanModel}" unavailable: ${rawErrMsg}`);
          continue;
        }

        throw new Error(rawErrMsg);
      }
    }

    throw lastError || new Error(`Gemini models not available for this API key. Please check your API key in Settings.`);
  }

  // 2. Anthropic Claude API
  if (aiSettings.provider === 'anthropic') {
    const endpoint = aiSettings.apiEndpoint || 'https://api.anthropic.com/v1/messages';
    const modelName = aiSettings.model?.trim() || 'claude-3-5-sonnet-20241022';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': aiSettings.apiKey?.trim() || '',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        temperature: aiSettings.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Anthropic API error (${response.status})`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const totalTokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) || 450;
    const costUSD = (totalTokens / 1_000_000) * 3.0;

    return { text, tokensUsed: totalTokens, costUSD };
  }

  // 3. Cohere Chat v2 API
  if (aiSettings.provider === 'cohere') {
    const endpoint = aiSettings.apiEndpoint || 'https://api.cohere.com/v2/chat';
    const modelName = aiSettings.model?.trim() || 'command-r';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiSettings.apiKey?.trim() || ''}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: aiSettings.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.message || `Cohere API error (${response.status})`);
    }

    const data = await response.json();
    const text = data.message?.content?.[0]?.text || data.text || '';
    const totalTokens = (data.usage?.tokens?.input_tokens || 0) + (data.usage?.tokens?.output_tokens || 0) || 400;
    const costUSD = (totalTokens / 1_000_000) * 0.15;

    return { text, tokensUsed: totalTokens, costUSD };
  }

  // 4. OpenAI-Compatible Providers (OpenRouter, Groq, DeepSeek, Mistral, HuggingFace, OpenAI, Custom/Ollama)
  let endpoint = 'https://api.openai.com/v1/chat/completions';
  let defaultModel = 'gpt-4o-mini';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (aiSettings.apiKey?.trim()) {
    headers['Authorization'] = `Bearer ${aiSettings.apiKey.trim()}`;
  }

  if (aiSettings.provider === 'openrouter') {
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    defaultModel = 'google/gemini-2.0-flash-exp:free';
    headers['HTTP-Referer'] = 'https://lifeos.app';
    headers['X-Title'] = 'Life OS';
  } else if (aiSettings.provider === 'groq') {
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    defaultModel = 'llama-3.3-70b-versatile';
  } else if (aiSettings.provider === 'deepseek') {
    endpoint = 'https://api.deepseek.com/v1/chat/completions';
    defaultModel = 'deepseek-chat';
  } else if (aiSettings.provider === 'mistral') {
    endpoint = 'https://api.mistral.ai/v1/chat/completions';
    defaultModel = 'mistral-small-latest';
  } else if (aiSettings.provider === 'huggingface') {
    endpoint = 'https://api-inference.huggingface.co/v1/chat/completions';
    defaultModel = 'meta-llama/Llama-3.2-3B-Instruct';
  } else if (aiSettings.provider === 'custom') {
    endpoint = aiSettings.apiEndpoint?.trim() || 'http://localhost:11434/v1/chat/completions';
    defaultModel = 'llama3';
  }

  if (aiSettings.apiEndpoint?.trim()) {
    endpoint = aiSettings.apiEndpoint.trim();
  }

  const modelName = aiSettings.model?.trim() || defaultModel;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: aiSettings.temperature ?? 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const rawErrMsg = errJson.error?.message || errJson.message || `API error (${response.status})`;
    if (response.status === 401) {
      throw new Error(`Invalid API key for ${aiSettings.provider.toUpperCase()}. Please verify your key.`);
    }
    if (response.status === 429) {
      throw new Error(`Rate limit or quota reached for ${aiSettings.provider.toUpperCase()}. Please wait or check your balance.`);
    }
    throw new Error(rawErrMsg);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const totalTokens = data.usage?.total_tokens || 450;
  const costUSD = (totalTokens / 1_000_000) * 0.15;

  return { text, tokensUsed: totalTokens, costUSD };
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
    docs?: KnowledgeDocument[];
    currentDoc?: KnowledgeDocument;
  },
  aiSettings?: AISettings
): Promise<string> {
  const { tasks, goals, projects, habits, userName, docs = [], currentDoc } = context;

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

    if (/note|doc|knowledge|reading|book|study/.test(q)) {
      if (currentDoc) {
        return `📖 You are currently viewing **"${currentDoc.title}"** (${currentDoc.category || 'General'}${currentDoc.readProgress != null ? `, ${currentDoc.readProgress}% completed` : ''}).\n\nTips for this note:\n• Use **AI Format** to structure paragraphs and headings.\n• Highlight key definitions with the colored highlighter.\n• Connect this note to a Goal or Project in Properties for structured review.`;
      }
      if (docs.length > 0) {
        const pinned = docs.filter(d => d.isPinned);
        const topDocs = (pinned.length > 0 ? pinned : docs).slice(0, 4);
        return `📚 You have **${docs.length} document(s)** in your Knowledge Base:\n${topDocs.map(d => `• **"${d.title}"** (${d.category || 'general'}${d.readProgress ? ` — ${d.readProgress}%` : ''})`).join('\n')}\n\nSelect any document in Knowledge Base to study, highlight, or auto-format with AI!`;
      }
      return `You don't have any notes in your Knowledge Base yet. Tap **+ New Document** or **Import File** in Knowledge Base to start! 📝`;
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

    return `Hi ${userName}! I'm your Life OS assistant. I have live context on your tasks, goals, habits, and knowledge base notes. Try asking: "What should I focus on?", "Summarize my notes", or "What did I accomplish today?" 🤖\n\n*Tip: Add a Gemini or OpenAI API key in Settings → AI for real AI responses.*`;
  }

  // Real AI chat with full user context
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const contextSummary = {
      user: userName,
      currentDate: todayStr,
      activeTasks: tasks
        .filter((t) => t.status !== 'done')
        .slice(0, 10)
        .map((t) => ({ id: t.id, title: t.title, priority: t.priority, due: t.dueDate, duration: t.estimatedDuration })),
      goals: goals
        .filter((g) => g.status === 'in-progress')
        .slice(0, 5)
        .map((g) => ({ title: g.title, progress: `${g.progress ?? 0}%`, horizon: g.horizon, why: g.why })),
      projects: projects
        .filter((p) => p.status === 'active')
        .slice(0, 5)
        .map((p) => ({ title: p.title, progress: `${p.progress ?? 0}%` })),
      habits: habits.slice(0, 6).map((h) => ({ title: h.title, frequency: h.frequency })),
      knowledgeDocs: docs.slice(0, 6).map(d => ({
        title: d.title,
        category: d.category,
        readProgress: d.readProgress,
        tags: d.tags,
      })),
      ...(currentDoc ? {
        activeNoteBeingViewed: {
          title: currentDoc.title,
          category: currentDoc.category,
          readProgress: currentDoc.readProgress,
          excerpt: currentDoc.content.replace(/<[^>]+>/g, ' ').slice(0, 600),
        },
      } : {}),
    };

    const historyMessages = history
      .slice(-8)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const systemPrompt = `You are the executive AI Life OS Assistant for ${userName}.
You have direct, real-time visibility into their tasks, goals, active projects, habits, deadlines, and knowledge base documents.

Your Mission:
1. Provide concise, ultra-clear, highly actionable advice tailored specifically to their live context.
2. Structure recommendations with bold highlights, bullet points, or step numbers when helpful.
3. If they ask what to work on, select specific tasks from their actual active backlog.
4. If they ask about their notes or documents, reference their actual knowledge base documents.
5. If they need to create new tasks or break something down, suggest clean concrete action items.
6. Keep tone supportive, sharp, focused, and free of fluff.
7. Today's date is ${todayStr}.

Current User Life OS Data:
${JSON.stringify(contextSummary, null, 2)}`;

    const prompt = historyMessages
      ? `Recent Conversation:\n${historyMessages}\n\nUser: ${userMessage}`
      : userMessage;

    const { text } = await executeOptionalAICall(prompt, systemPrompt, aiSettings);
    return text.trim() || 'I generated an empty response. Please try asking in a different way.';
  } catch (err: any) {
    console.warn('AI chat error (fallback):', err);
    return `⚠️ AI Error: ${err?.message || 'Could not connect to AI provider'}.\n\nPlease check your API key in Settings → AI Assistant.`;
  }
}

/**
 * AI Document Executive Summary & Key Takeaways Generator
 */
export async function summarizeDocumentWithAI(
  docTitle: string,
  docContent: string,
  userSettings?: UserSettings
): Promise<{ summary: string; keyPoints: string[]; actionItems: string[]; isAI: boolean }> {
  const plainText = docContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const aiSettings = userSettings?.aiSettings;
  const isAI = Boolean(aiSettings?.enabled && aiSettings?.apiKey);

  if (isAI && aiSettings) {
    try {
      const systemPrompt = `You are an executive knowledge architect. Analyze the given document notes and generate a high-impact summary.
Respond strictly in valid JSON with this exact structure:
{
  "summary": "1-3 concise sentences summarizing core premise and conclusion",
  "keyPoints": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3"],
  "actionItems": ["Actionable next step 1", "Actionable next step 2"]
}
Keep each point punchy, clear, and actionable. No markdown fences.`;

      const prompt = `Title: "${docTitle}"\n\nContent:\n${plainText.slice(0, 3000)}`;
      const { text } = await executeOptionalAICall(prompt, systemPrompt, aiSettings);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.summary && Array.isArray(parsed.keyPoints)) {
          return {
            summary: parsed.summary,
            keyPoints: parsed.keyPoints,
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
            isAI: true,
          };
        }
      }
    } catch (err) {
      console.warn('AI Document summary failed, using fallback:', err);
    }
  }

  // Deterministic Fallback Summary
  const sentences = plainText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  const summary = sentences.slice(0, 2).join('. ') + (sentences.length > 0 ? '.' : 'Core notes on ' + docTitle);
  const keyPoints = sentences.slice(2, 6).length > 0
    ? sentences.slice(2, 6)
    : [`Key concept covered in "${docTitle}"`, 'Core principles and definitions documented'];
  const actionItems = [
    `Review key terms in "${docTitle}"`,
    'Apply core insight to active roadmap projects',
  ];

  return { summary, keyPoints, actionItems, isAI: false };
}

/**
 * AI Study Quiz & Flashcards Generator for Active Recall
 */
export async function generateStudyQuizWithAI(
  docTitle: string,
  docContent: string,
  userSettings?: UserSettings
): Promise<{ questions: { question: string; answer: string }[]; isAI: boolean }> {
  const plainText = docContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const aiSettings = userSettings?.aiSettings;
  const isAI = Boolean(aiSettings?.enabled && aiSettings?.apiKey);

  if (isAI && aiSettings) {
    try {
      const systemPrompt = `You are a learning science expert specializing in active recall and spaced repetition.
Generate 3 to 4 high-yield study questions with concise, accurate answers from the provided notes.
Respond strictly in valid JSON:
{
  "questions": [
    { "question": "Clear testing question", "answer": "Clear, direct answer explaining the concept" }
  ]
}
No markdown fences.`;

      const prompt = `Document Title: "${docTitle}"\n\nNotes Content:\n${plainText.slice(0, 3000)}`;
      const { text } = await executeOptionalAICall(prompt, systemPrompt, aiSettings);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return { questions: parsed.questions, isAI: true };
        }
      }
    } catch (err) {
      console.warn('AI Quiz generation failed, using fallback:', err);
    }
  }

  // Deterministic Active Recall Questions
  return {
    questions: [
      {
        question: `What is the core premise or objective of "${docTitle}"?`,
        answer: plainText.slice(0, 180) || `The foundational concepts explored in ${docTitle}.`,
      },
      {
        question: `How does the insight in "${docTitle}" apply to your current goals?`,
        answer: 'Identify 1 practical scenario where this concept resolves an execution roadblock.',
      },
      {
        question: `What is the most critical rule or formula from this note?`,
        answer: 'Refer to highlighted key ideas and formulas in the document text.',
      },
    ],
    isAI: false,
  };
}

/**
 * Generates an Executive Morning Briefing or Evening Reflection
 */
export async function generateDailyBriefing(
  mode: 'morning' | 'evening',
  context: {
    userName: string;
    tasks: Task[];
    goals: Goal[];
    projects: Project[];
    habits: Habit[];
    todayCompletedTasks?: Task[];
    todayHabitCount?: number;
  },
  aiSettings?: AISettings
): Promise<string> {
  const { userName, tasks, goals, projects, habits, todayCompletedTasks = [], todayHabitCount = 0 } = context;
  const todayStr = new Date().toISOString().split('T')[0];
  const pendingTasks = tasks.filter((t) => t.status !== 'done');
  const urgentTasks = pendingTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high');

  // Deterministic Fallback generator (Formal, Executive Style)
  const getDeterministicBriefing = () => {
    if (mode === 'morning') {
      const top3List = (urgentTasks.length > 0 ? urgentTasks : pendingTasks).slice(0, 3);
      const habitsList = habits.slice(0, 3).map((h) => `• **${h.title}** (${h.frequency})`).join('\n');
      const topTasksText = top3List.length > 0
        ? top3List.map((t, i) => `${i + 1}. **${t.title}** — ${t.priority.toUpperCase()} (${t.estimatedDuration || 25} min)`).join('\n')
        : '• Backlog is clear. Ready to plan new strategic goals.';

      return `## Morning Briefing: ${userName}

**${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}**

### Strategic Priorities
${topTasksText}

### Habit Focus
${habitsList || '• No daily habits scheduled.'}

### Focus Principle
> *"Disciplined execution on core priorities drives compound results. Direct your primary focus toward high-impact objectives today."*`;
    } else {
      const doneList = todayCompletedTasks.length > 0
        ? todayCompletedTasks.map((t) => `• **${t.title}**`).join('\n')
        : '• No tasks recorded as completed today.';
      const pendingCount = pendingTasks.length;

      return `## Evening Debrief: ${userName}

**${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}**

### Completed Deliverables (${todayCompletedTasks.length})
${doneList}

### Habit Consistency
• Checked in **${todayHabitCount} of ${habits.length}** scheduled habits today.

### Queue Status
${pendingCount > 0 ? `• **${pendingCount} pending task(s)** queued for tomorrow's execution.` : '• All task queues are currently cleared.'}

### Executive Review
> *"Review completed milestones, recalibrate priorities, and set clear focus for tomorrow."*`;
    }
  };

  const isAIConfigured = aiSettings?.enabled && (aiSettings.apiKey || aiSettings.provider === 'custom');
  if (!isAIConfigured) {
    return getDeterministicBriefing();
  }

  try {
    const summaryData = {
      user: userName,
      date: todayStr,
      mode,
      activePendingTasks: pendingTasks.slice(0, 8).map(t => ({ title: t.title, priority: t.priority, duration: t.estimatedDuration })),
      completedToday: todayCompletedTasks.map(t => t.title),
      habits: habits.map(h => ({ title: h.title, frequency: h.frequency })),
      habitsDoneTodayCount: todayHabitCount,
      activeGoals: goals.filter(g => g.status === 'in-progress').map(g => ({ title: g.title, progress: `${g.progress || 0}%` })),
    };

    const systemPrompt = `You are a formal executive Chief of Staff and strategic advisor for ${userName}.
Your task is to generate a structured, professional ${mode === 'morning' ? 'Executive Morning Briefing' : 'Evening Performance Debrief'}.

CRITICAL STYLE & FORMATTING INSTRUCTIONS:
- Strictly DO NOT include emojis, playful icons, or informal jargon anywhere in the output.
- Keep the tone formal, direct, articulate, professional, and concise.
- Use clean Markdown with headers (##, ###), bullet points (•), and bold identifiers (**Title**).
- Be specific to the user's live roadmap tasks, goals, and habits.
- Structure for ${mode === 'morning' ? 'Morning Briefing' : 'Evening Debrief'}:
  ${mode === 'morning' 
    ? '1. Executive overview header\n2. Strategic Priorities (Top 3 prioritized tasks with estimated duration)\n3. Habit Focus\n4. Executive Directive / Strategic Principle'
    : '1. Executive summary of achievements\n2. Completed Deliverables\n3. Habit Consistency & Execution Status\n4. Queue Status & Forward Outlook'
  }`;

    const userPrompt = `Generate my ${mode === 'morning' ? 'Morning Briefing' : 'Evening Reflection'} based on my live dashboard state:\n${JSON.stringify(summaryData, null, 2)}`;

    const { text } = await executeOptionalAICall(userPrompt, systemPrompt, aiSettings);
    return text.trim() || getDeterministicBriefing();
  } catch (err) {
    console.warn('AI Briefing fallback active:', err);
    return getDeterministicBriefing();
  }
}

export interface OptimizedScheduleBlock {
  id: string;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "10:30"
  type: 'deep_work' | 'secondary_focus' | 'habit' | 'admin' | 'break';
  title: string;
  taskId?: string;
  durationMinutes: number;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  rationale: string;
}

export interface OptimizedDaySchedule {
  date: string;
  totalPlannedMinutes: number;
  mainFocusTaskId: string | null;
  mainFocusTitle: string;
  executiveSummary: string;
  blocks: OptimizedScheduleBlock[];
}

function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTimeString(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 1-Click AI "Optimize My Day" Time-Block Engine
 * Intelligently analyzes priority tasks, habit anchors, and capacity to build an hourly execution plan.
 */
export async function optimizeMyDaySchedule(
  context: {
    tasks: Task[];
    habits: Habit[];
    goals: Goal[];
    calendarEvents?: CalendarEvent[];
    startHour?: number; // default 9
    availableHours?: number; // default 8
    userName?: string;
  },
  aiSettings?: AISettings
): Promise<OptimizedDaySchedule> {
  const {
    tasks,
    habits,
    goals,
    calendarEvents = [],
    startHour = 9,
    availableHours = 8,
    userName = 'User',
  } = context;

  const todayStr = new Date().toISOString().split('T')[0];
  const pendingTasks = tasks.filter((t) => t.status !== 'done');
  
  // Sort tasks by priority (urgent > high > medium > low) and deadline proximity
  const sortedTasks = [...pendingTasks].sort((a, b) => {
    const pWeight: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    const wA = pWeight[a.priority] || 2;
    const wB = pWeight[b.priority] || 2;
    if (wA !== wB) return wB - wA;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    return 0;
  });

  const mainFocus = sortedTasks[0] || null;

  // Deterministic Schedule Generator
  const generateDeterministicSchedule = (): OptimizedDaySchedule => {
    const blocks: OptimizedScheduleBlock[] = [];
    let currentMin = startHour * 60;
    const maxEndMin = currentMin + (availableHours * 60);
    const activeHabits = habits.slice(0, 3);

    // 1. Morning Kickoff / Habit Anchor
    if (activeHabits.length > 0) {
      const habitDuration = 20;
      const end = currentMin + habitDuration;
      blocks.push({
        id: `block-habit-morning`,
        startTime: minutesToTimeString(currentMin),
        endTime: minutesToTimeString(end),
        type: 'habit',
        title: `Habit Anchor: ${activeHabits[0].title}`,
        durationMinutes: habitDuration,
        rationale: 'Prime physical and mental focus before deep work.',
      });
      currentMin = end;
    }

    // 2. High-Impact Deep Work Block (Main Priority)
    if (mainFocus) {
      const duration = Math.min(mainFocus.estimatedDuration || 90, 120);
      const end = currentMin + duration;
      blocks.push({
        id: `block-task-${mainFocus.id}`,
        startTime: minutesToTimeString(currentMin),
        endTime: minutesToTimeString(end),
        type: 'deep_work',
        title: mainFocus.title,
        taskId: mainFocus.id,
        durationMinutes: duration,
        priority: mainFocus.priority,
        rationale: 'Highest-leverage strategic priority during peak morning cognitive energy.',
      });
      currentMin = end;
    }

    // 3. Cognitive Rest & Buffer (15 min)
    if (currentMin + 15 <= maxEndMin) {
      const end = currentMin + 15;
      blocks.push({
        id: `block-rest-1`,
        startTime: minutesToTimeString(currentMin),
        endTime: minutesToTimeString(end),
        type: 'break',
        title: 'Buffer & Cognitive Reset',
        durationMinutes: 15,
        rationale: 'Decompress and reset focus before secondary execution.',
      });
      currentMin = end;
    }

    // 4. Secondary Tasks
    const secondaryTasks = sortedTasks.slice(1, 4);
    for (const t of secondaryTasks) {
      const dur = t.estimatedDuration || 45;
      if (currentMin + dur > maxEndMin) break;

      const end = currentMin + dur;
      blocks.push({
        id: `block-task-${t.id}`,
        startTime: minutesToTimeString(currentMin),
        endTime: minutesToTimeString(end),
        type: 'secondary_focus',
        title: t.title,
        taskId: t.id,
        durationMinutes: dur,
        priority: t.priority,
        rationale: `Strategic deliverable for ${t.priority.toUpperCase()} priority item.`,
      });
      currentMin = end;
    }

    // 5. Afternoon Admin / Daily Review Block
    if (currentMin + 30 <= maxEndMin) {
      const end = currentMin + 30;
      blocks.push({
        id: `block-admin-wrap`,
        startTime: minutesToTimeString(currentMin),
        endTime: minutesToTimeString(end),
        type: 'admin',
        title: 'Daily Review & Inbox Zero',
        durationMinutes: 30,
        rationale: 'Review completed deliverables, check remaining habits, and set clean slate for tomorrow.',
      });
      currentMin = end;
    }

    const totalMinutes = blocks.reduce((acc, b) => acc + b.durationMinutes, 0);

    return {
      date: todayStr,
      totalPlannedMinutes: totalMinutes,
      mainFocusTaskId: mainFocus?.id || null,
      mainFocusTitle: mainFocus?.title || 'Daily Strategic Focus',
      executiveSummary: `Optimized ${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}m schedule with ${blocks.filter(b => b.type === 'deep_work' || b.type === 'secondary_focus').length} priority task blocks and habit anchors structured for peak circadian efficiency.`,
      blocks,
    };
  };

  const isAIConfigured = aiSettings?.enabled && (aiSettings.apiKey || aiSettings.provider === 'custom');
  if (!isAIConfigured) {
    return generateDeterministicSchedule();
  }

  try {
    const summaryData = {
      user: userName,
      date: todayStr,
      startHour,
      availableHours,
      tasks: sortedTasks.slice(0, 8).map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        estimatedDuration: t.estimatedDuration || 30,
      })),
      habits: habits.slice(0, 4).map((h) => ({ id: h.id, title: h.title, frequency: h.frequency })),
      goals: goals.filter((g) => g.status === 'in-progress').slice(0, 3).map((g) => g.title),
      calendarEvents: calendarEvents.map((e) => ({ title: e.title, start: e.startTime, end: e.endTime })),
    };

    const systemPrompt = `You are a world-class executive time-blocking engine and productivity architect for ${userName}.
Your task is to generate an optimized, realistic hour-by-hour schedule for today in strictly valid JSON.

RULES:
- Respect start hour: ${startHour}:00.
- Place the #1 highest-leverage task in peak morning focus.
- Schedule realistic task blocks with transition buffers.
- Return ONLY a JSON object with this exact shape:
{
  "mainFocusTaskId": "task-id or null",
  "mainFocusTitle": "string",
  "executiveSummary": "1-sentence formal summary of why this schedule is optimal",
  "blocks": [
    {
      "id": "string",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "type": "deep_work" | "secondary_focus" | "habit" | "admin" | "break",
      "title": "string",
      "taskId": "task-id if matching a task or omit",
      "durationMinutes": number,
      "priority": "urgent" | "high" | "medium" | "low",
      "rationale": "short formal rationale"
    }
  ]
}`;

    const userPrompt = `Build an optimized daily time-block schedule for today:\n${JSON.stringify(summaryData, null, 2)}`;

    const { text } = await executeOptionalAICall(userPrompt, systemPrompt, aiSettings);
    
    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        const totalMinutes = parsed.blocks.reduce((acc: number, b: any) => acc + (b.durationMinutes || 30), 0);
        return {
          date: todayStr,
          totalPlannedMinutes: totalMinutes,
          mainFocusTaskId: parsed.mainFocusTaskId || mainFocus?.id || null,
          mainFocusTitle: parsed.mainFocusTitle || mainFocus?.title || 'Daily Strategic Focus',
          executiveSummary: parsed.executiveSummary || 'AI-optimized daily time-block schedule.',
          blocks: parsed.blocks.map((b: any, i: number) => ({
            id: b.id || `ai-block-${i}`,
            startTime: b.startTime || '09:00',
            endTime: b.endTime || '10:00',
            type: b.type || 'deep_work',
            title: b.title || 'Scheduled Item',
            taskId: b.taskId || undefined,
            durationMinutes: b.durationMinutes || 30,
            priority: b.priority || undefined,
            rationale: b.rationale || 'Scheduled priority block.',
          })),
        };
      }
    }

    return generateDeterministicSchedule();
  } catch (err) {
    console.warn('AI Optimizer fallback active:', err);
    return generateDeterministicSchedule();
  }
}


