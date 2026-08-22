// ============================================================
// ADHD 1-CLICK MAGIC MICRO-BREAKDOWN ENGINE
// Deconstructs intimidating tasks into tiny 2-to-5 minute starter steps
// Solves ADHD Task Initiation Paralysis & Executive Dysfunction
// ============================================================

export interface MicroStep {
  title: string;
  estimatedMinutes?: number;
}

/**
 * Intelligently generates 3 to 5 low-friction physical starter steps
 * based on task title semantics and natural language keywords.
 */
export function generateMicroBreakdown(taskTitle: string, description?: string): string[] {
  const text = `${taskTitle} ${description || ''}`.toLowerCase();

  // 1. Coding / Bug / Tech / Game Development
  if (
    text.includes('code') ||
    text.includes('bug') ||
    text.includes('fix') ||
    text.includes('build') ||
    text.includes('implement') ||
    text.includes('game') ||
    text.includes('physics') ||
    text.includes('api') ||
    text.includes('component') ||
    text.includes('frontend') ||
    text.includes('backend')
  ) {
    return [
      '1. Open IDE & isolate the exact file or component needed (2m)',
      '2. Reproduce or write down the 1 expected input/output in notes (3m)',
      '3. Write the first 5 lines of logic or prototype function (5m)',
      '4. Run a quick local test/preview to verify initial change (3m)',
      '5. Clean up any edge cases and save progress (5m)',
    ];
  }

  // 2. Learning / Studying / Research / Reading
  if (
    text.includes('learn') ||
    text.includes('study') ||
    text.includes('read') ||
    text.includes('research') ||
    text.includes('tutorial') ||
    text.includes('course') ||
    text.includes('blender') ||
    text.includes('watch')
  ) {
    return [
      '1. Open learning resource and close all unrelated browser tabs (2m)',
      '2. Skim table of contents / chapter headers for 2 minutes (2m)',
      '3. Read or watch the first 5-minute section without pressure (5m)',
      '4. Jot down 2 key takeaways or try 1 hands-on action in software (5m)',
    ];
  }

  // 3. Writing / Email / Pitch / Documentation / Messages
  if (
    text.includes('write') ||
    text.includes('draft') ||
    text.includes('email') ||
    text.includes('pitch') ||
    text.includes('document') ||
    text.includes('message') ||
    text.includes('send') ||
    text.includes('post')
  ) {
    return [
      '1. Open a blank doc & write 3 bullet points with zero formatting (2m)',
      '2. Draft a "terrible first draft" sentence for each bullet (4m)',
      '3. Read through once to fix clarity and add 1 call to action (3m)',
      '4. Quick spellcheck & press send or save (2m)',
    ];
  }

  // 4. Cleaning / Organizing / Physical Space
  if (
    text.includes('clean') ||
    text.includes('organize') ||
    text.includes('room') ||
    text.includes('desk') ||
    text.includes('laundry') ||
    text.includes('dishes') ||
    text.includes('trash')
  ) {
    return [
      '1. Put on 1 favorite upbeat song (1m)',
      '2. Pick up and throw away all visible trash/wrappers (3m)',
      '3. Clear just 1 surface (e.g. your desk or coffee table) (4m)',
      '4. Put 5 out-of-place items back in their general room (3m)',
    ];
  }

  // 5. Design / 3D / Art / Visuals
  if (
    text.includes('design') ||
    text.includes('model') ||
    text.includes('draw') ||
    text.includes('ui') ||
    text.includes('art') ||
    text.includes('texture') ||
    text.includes('scene') ||
    text.includes('logo')
  ) {
    return [
      '1. Gather 2 inspirational image references into a folder (3m)',
      '2. Create new canvas/file & block out primitive grey shapes (5m)',
      '3. Pick a 3-color palette and apply base flat tones (4m)',
      '4. Refine 1 primary focal point asset (5m)',
    ];
  }

  // 6. Administrative / Calls / Finance / Bills
  if (
    text.includes('call') ||
    text.includes('pay') ||
    text.includes('bill') ||
    text.includes('account') ||
    text.includes('tax') ||
    text.includes('schedule') ||
    text.includes('book') ||
    text.includes('finance')
  ) {
    return [
      '1. Log into the account portal or find the phone number (2m)',
      '2. Write down your 1 primary question or invoice amount on a sticky note (2m)',
      '3. Dial number or click "Pay / Submit" (3m)',
      '4. Save confirmation receipt or jot down next follow-up date (1m)',
    ];
  }

  // 7. General Universal ADHD Starter Flow
  return [
    `1. Set a 5-minute timer & open necessary tools for "${taskTitle.slice(0, 30)}" (2m)`,
    '2. Do the absolute easiest 10% of this task first (4m)',
    '3. Review progress and decide if you want to keep rolling (1m)',
  ];
}
