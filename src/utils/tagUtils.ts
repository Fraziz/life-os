/**
 * tagUtils.ts
 * Clean formatting and semantic categorization for tag badges across Life OS.
 */

const ACRONYMS: Record<string, string> = {
  ai: 'AI',
  ui: 'UI',
  ux: 'UX',
  bsit: 'BSIT',
  mvp: 'MVP',
  api: 'API',
  id: 'ID',
  os: 'OS',
};

/**
 * Formats raw tags (e.g., 'project-action', 'ai-breakdown', 'bsit')
 * into human-readable, beautifully capitalized labels ('Project Action', 'AI Breakdown', 'BSIT').
 */
export function formatTagLabel(tag: string): string {
  if (!tag) return '';
  const trimmed = tag.trim();

  // If already uppercase (e.g. "LINK OR DARE", "GAINROOT") with more than 1 character, preserve it
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length > 2) {
    return trimmed;
  }

  // If tag contains hyphens or underscores
  if (/[-_]/.test(trimmed)) {
    return trimmed
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => {
        const lower = part.toLowerCase();
        if (ACRONYMS[lower]) return ACRONYMS[lower];
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join(' ');
  }

  // Single word checks for acronyms
  const lower = trimmed.toLowerCase();
  if (ACRONYMS[lower]) return ACRONYMS[lower];

  // Capitalize first letter of each word if separated by spaces
  return trimmed
    .split(/\s+/)
    .map((word) => {
      const wLower = word.toLowerCase();
      if (ACRONYMS[wLower]) return ACRONYMS[wLower];
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export type TagCategory = 'project' | 'goal' | 'dream' | 'school' | 'health' | 'ai' | 'doitnow' | 'default';

/**
 * Returns the semantic category of a tag for consistent styling across themes.
 */
export function getTagCategory(tag: string): TagCategory {
  if (!tag) return 'default';
  const t = tag.toLowerCase();

  if (/do-it-now|doitnow|^now$/i.test(t)) {
    return 'doitnow';
  }
  if (/project|action|task|build|dev|feature|work|code|pipeline/i.test(t)) {
    return 'project';
  }
  if (/goal|milestone|target|objective|key-result/i.test(t)) {
    return 'goal';
  }
  if (/dream|vision|mindset|idea|thought|philosophy/i.test(t)) {
    return 'dream';
  }
  if (/school|class|bsit|study|reading|book|learn|academic/i.test(t)) {
    return 'school';
  }
  if (/health|workout|fitness|gym|diet|run|exercise|wellness/i.test(t)) {
    return 'health';
  }
  if (/ai|bot|breakdown|automated/i.test(t)) {
    return 'ai';
  }

  return 'default';
}
