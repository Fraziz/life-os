import type { AISettings } from '@/types';
import { executeOptionalAICall } from './aiEngine';
import { cleanMarkdownText } from './textCleaner';

/**
 * Instant, zero-latency micro-step generator tailored for ADHD task initiation.
 * Always begins with a tiny 2-minute physical setup step to bypass activation friction.
 */
export function generateSmartMicroSteps(title: string, description?: string): string[] {
  const cleanTitle = cleanMarkdownText(title).trim() || 'this task';
  const shortTitle = cleanTitle.length > 48 ? `${cleanTitle.slice(0, 45)}…` : cleanTitle;
  const combined = `${cleanTitle} ${description || ''}`.toLowerCase();

  if (/\b(study|read|learn|lesson|course|book|chapter|english|grammar|review notes)\b/.test(combined)) {
    return [
      `Open the material for "${shortTitle}" and put distractions aside (2m)`,
      'Read or study just one small section for 10 minutes',
      'Jot down 2 key takeaways in plain words',
      'Bookmark where to continue next time',
    ];
  }

  if (/\b(reply|email|message|inquir|write|draft|essay|report|letter|post)\b/.test(combined)) {
    return [
      `Open the message or document for "${shortTitle}" (2m)`,
      'Write 3 rough bullet points of what needs to be said (5m)',
      'Turn the bullets into a short draft without worrying about perfection (10m)',
      'Read once for clarity and send or save',
    ];
  }

  if (/\b(code|build|fix|debug|ui|design|layout|implement|feature|refactor|prototype)\b/.test(combined)) {
    return [
      `Open the workspace and locate the exact file or screen for "${shortTitle}" (3m)`,
      'Define the single smallest piece to build or fix first',
      'Complete that one small piece and test it (15m)',
      'Save your progress and note the next small step',
    ];
  }

  if (/\b(clean|organize|declutter|tidy|room|folder|files|desk|laundry)\b/.test(combined)) {
    return [
      'Pick just one small corner, surface, or folder to start with (2m)',
      'Clear obvious clutter or duplicates for 5 minutes',
      'Put the remaining items back in a simple home (10m)',
      'Stop after one area—progress counts',
    ];
  }

  if (/\b(workout|exercise|pull\s?up|gym|run|walk|stretch|fitness|train)\b/.test(combined)) {
    return [
      'Get dressed and keep water nearby (2m)',
      'Do 2 minutes of easy warm-up movement',
      'Complete the first set or 10 minutes at a steady pace',
      'Cool down and mark the session done',
    ];
  }

  return [
    `Open or gather only what you need to start "${shortTitle}" (2m)`,
    'Do the easiest 5-minute starter action first',
    'Focus on one core chunk without aiming for perfection (15m)',
    'Save where you stopped and note the next step',
  ];
}

/**
 * Generates 3–5 tiny, non-intimidating micro-steps for an overwhelming task.
 * Uses workspace AI when enabled/connected and falls back seamlessly to smart local steps.
 */
export async function makeTaskEasierSteps(
  task: { title: string; description?: string },
  aiSettings?: AISettings
): Promise<{ steps: string[]; usedAI: boolean }> {
  const fallback = generateSmartMicroSteps(task.title, task.description);

  if (aiSettings?.enabled === false) {
    return { steps: fallback, usedAI: false };
  }

  try {
    const systemPrompt = `You are a supportive, ADHD-informed executive function coach inside Sariling Mundo.
Break the user's task into 4 tiny, concrete, low-friction micro-steps that make starting effortless.
Rules:
- Step 1 MUST take 2 minutes or less (a physical starter action like opening a file, setting out one item, or writing 2 bullets).
- Keep each step concise (under 75 characters), clear, and free of guilt or pressure.
- Respond ONLY with valid JSON: {"steps": ["Step 1", "Step 2", "Step 3", "Step 4"]}`;

    const userPrompt = `Task: "${task.title}"${
      task.description ? `\nContext: "${task.description}"` : ''
    }`;

    const { text } = await executeOptionalAICall(userPrompt, systemPrompt, aiSettings);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { steps?: unknown };
      if (Array.isArray(parsed.steps)) {
        const cleaned = parsed.steps
          .map((s) => cleanMarkdownText(String(s || '')).trim())
          .filter((s) => s.length > 0)
          .slice(0, 5);
        if (cleaned.length >= 2) {
          return { steps: cleaned, usedAI: true };
        }
      }
    }
  } catch {
    // Gracefully use instant local steps when offline or AI unavailable
  }

  return { steps: fallback, usedAI: false };
}
