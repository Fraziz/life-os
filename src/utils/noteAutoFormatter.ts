import { executeOptionalAICall } from './aiEngine';
import type { UserSettings } from '@/types';

/**
 * Intelligent Local Rule-Based Formatter
 * Fixes broken spacing, wraps, raw clutter, and structures raw text into formal study notes.
 */
export function formatNotesLocally(rawText: string, docTitle = 'Study Document'): string {
  if (!rawText || rawText.trim().length === 0) {
    return `
      <h2>1. Executive Summary</h2>
      <p>Start typing or pasting your notes here. Click <strong>✨ AI Format</strong> anytime to automatically organize them.</p>
    `;
  }

  // 1. Strip HTML tags temporarily to work with plain clean text if needed
  let text = rawText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '') // remove remaining HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  // 2. Fix broken spacing, chopped sentences, and PDF artifacts
  text = text
    .replace(/\r\n|\r/g, '\n')
    .replace(/[^\S\n]{2,}/g, ' ')                  // collapse multiple tabs/spaces
    .replace(/([a-z,;])\n([A-Za-z])/g, '$1 $2')   // rejoin mid-sentence broken lines
    .replace(/-\s*\n\s*([a-z])/gi, '$1')           // rejoin hyphenated words
    .replace(/\n{3,}/g, '\n\n');                   // normalize line breaks

  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // 3. Segment into sections
  const paragraphs: string[] = [];
  const bulletItems: string[] = [];
  const keyConcepts: string[] = [];

  for (const line of rawLines) {
    // Detect bullet or numbered items
    if (/^[\u2022\u2013\u2014\-\*\u00b7\d+[.)]]\s/.test(line)) {
      const cleanBullet = line.replace(/^[\u2022\u2013\u2014\-\*\u00b7\d+[.)]]\s+/, '').trim();
      if (cleanBullet) bulletItems.push(cleanBullet);
    } else if (line.length > 20 && (line.toLowerCase().includes('important') || line.toLowerCase().includes('key') || line.toLowerCase().includes('definition') || line.toLowerCase().includes('rule'))) {
      keyConcepts.push(line);
    } else {
      paragraphs.push(line);
    }
  }

  // Extract executive summary
  const summaryPara = paragraphs[0] || 'Comprehensive reference document and study notes.';
  const remainingParas = paragraphs.slice(1);

  // Group remaining paragraphs into topics
  let coreTopicsHtml = '';
  if (remainingParas.length > 0) {
    coreTopicsHtml = remainingParas
      .map((p, idx) => {
        // If short line, treat as subheader
        if (p.length < 50 && !/[.!?]$/.test(p)) {
          return `<h3>${idx + 1}. ${p}</h3>`;
        }
        return `<p>${p}</p>`;
      })
      .join('\n');
  } else {
    coreTopicsHtml = `<p>${summaryPara}</p>`;
  }

  // Key takeaways block
  const takeaways = keyConcepts.length > 0
    ? keyConcepts.slice(0, 3)
    : [
        'Understand the core theoretical foundation and definitions.',
        'Review the practical application and key rules.',
        'Practice self-testing with active recall questions.',
      ];

  const takeawaysHtml = takeaways
    .map((t) => `<li><mark class="highlight-mark" style="background:rgba(253,224,71,0.55);border:1px solid #fbbf24;color:#713f12;border-radius:3px;padding:1px 5px;font-weight:600;">${t}</mark></li>`)
    .join('\n');

  // Bullet points block
  const bulletsHtml = bulletItems.length > 0
    ? `
      <h2>2. Core Concepts &amp; Key Details</h2>
      <ul>
        ${bulletItems.map((b) => `<li>${b}</li>`).join('\n')}
      </ul>
      <hr />
    `
    : '';

  return `
    <h2>1. Executive Summary &amp; Overview</h2>
    <p>${summaryPara}</p>
    <div class="key-idea" style="background:linear-gradient(135deg, rgba(6,182,212,0.12), rgba(99,102,241,0.08));border-left:3.5px solid #06b6d4;border-radius:0 6px 6px 0;padding:10px 14px;margin:14px 0;font-weight:600;">
      💡 <strong>Core Takeaway:</strong> ${takeaways[0] || summaryPara}
    </div>
    <hr />

    ${bulletsHtml}

    <h2>${bulletItems.length > 0 ? '3' : '2'}. Detailed Breakdown &amp; Analysis</h2>
    ${coreTopicsHtml}
    <hr />

    <h2>${bulletItems.length > 0 ? '4' : '3'}. Strategic Insights &amp; Exam Highlights</h2>
    <ul>
      ${takeawaysHtml}
    </ul>
    <p><span class="important-mark" style="background:rgba(244,63,94,0.15);color:#f43f5e;border:1px solid rgba(244,63,94,0.3);border-radius:4px;padding:2px 8px;font-weight:700;">⚡ Must-Know Rule:</span> Pay close attention to definitions, core principles, and testable concepts.</p>
    <hr />

    <h2>${bulletItems.length > 0 ? '5' : '4'}. Action Items &amp; Self-Test Checklist</h2>
    <div class="md-check" style="display:flex;align-items:center;gap:8px;margin:6px 0;"><input type="checkbox" /> <span>Read through the summary and memorize key definitions</span></div>
    <div class="md-check" style="display:flex;align-items:center;gap:8px;margin:6px 0;"><input type="checkbox" /> <span>Highlight important technical vocabulary using color swatches</span></div>
    <div class="md-check" style="display:flex;align-items:center;gap:8px;margin:6px 0;"><input type="checkbox" /> <span>Review notes in Book Mode before test / milestone</span></div>
  `.trim();
}

/**
 * Main AI Note Formatter
 * Uses Cloud Gemini/OpenAI if configured, or falls back to intelligent local formatting.
 */
export async function formatStudyNotesWithAI(
  rawContent: string,
  docTitle: string,
  userSettings?: UserSettings
): Promise<{ formattedHtml: string; isAI: boolean }> {
  const aiSettings = userSettings?.aiSettings;

  if (aiSettings?.apiKey && aiSettings?.provider) {
    try {
      const systemPrompt = `You are an elite study coach and executive document organizer. Your job is to take raw, messy, or unformatted notes/text and turn them into perfectly structured, beautiful, professional study notes in HTML.
Rules:
1. Fix all spacing errors, broken sentence wraps, and messy formatting.
2. Structure with clear semantic HTML (<h2>, <h3>, <p>, <ul>, <li>, <hr>).
3. Include an Executive Summary at the top.
4. Use <div class="key-idea" style="background:linear-gradient(135deg, rgba(6,182,212,0.12), rgba(99,102,241,0.08));border-left:3.5px solid #06b6d4;border-radius:0 6px 6px 0;padding:10px 14px;margin:14px 0;font-weight:600;">💡 <strong>Key Idea:</strong> ...</div> for main takeaways.
5. Use <span class="important-mark" style="background:rgba(244,63,94,0.15);color:#f43f5e;border:1px solid rgba(244,63,94,0.3);border-radius:4px;padding:2px 8px;font-weight:700;">⚡ ...</span> for critical exam/must-know concepts.
6. Use <mark class="highlight-mark" style="background:rgba(253,224,71,0.55);border:1px solid #fbbf24;color:#713f12;border-radius:3px;padding:1px 5px;font-weight:600;">...</mark> to highlight key terms.
7. Include an Action Items & Self-Test Checklist with <div class="md-check" style="display:flex;align-items:center;gap:8px;margin:6px 0;"><input type="checkbox" /> <span>...</span></div>.
8. Output ONLY the clean HTML string without any markdown code blocks (\`\`\`html).`;

      const prompt = `Document Title: "${docTitle}"\n\nRaw Text Content:\n${rawContent}`;
      const result = await executeOptionalAICall(prompt, systemPrompt, aiSettings);

      let cleanHtml = result.text.trim();
      // Remove any markdown fence if the model outputted it
      cleanHtml = cleanHtml.replace(/^```html/i, '').replace(/```$/i, '').trim();

      if (cleanHtml.length > 20) {
        return { formattedHtml: cleanHtml, isAI: true };
      }
    } catch (err) {
      console.warn('Cloud AI Note formatting error, falling back to local organizer:', err);
    }
  }

  // Local rule-based AI organizer
  const localFormatted = formatNotesLocally(rawContent, docTitle);
  return { formattedHtml: localFormatted, isAI: false };
}
