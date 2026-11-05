// Types for The Growth System module

export type InterestLevel = 'primary' | 'secondary' | 'exploration';

export interface Interest {
  id: string;
  title: string;
  level: InterestLevel;
  category?: string;
  notes?: string;
  linkedGoalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyCheckpoint {
  week: number; // 1 - 13 (approx. 90 days)
  completed: boolean;
  notes?: string;
  updatedAt?: string;
}

export interface SprintMilestone {
  id: string;
  title: string;
  completed: boolean;
  targetWeek?: number;
}

export type SprintStatus = 'active' | 'completed' | 'evaluated' | 'paused';

export interface FinalEvaluation {
  reflection: string;
  decision: 'continue' | 'adjust' | 'pivot';
  rating: number; // 1 - 5 stars
  evaluatedAt: string;
}

export interface CommitmentSprint {
  id: string;
  title: string;
  linkedGoalId?: string;
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string;   // ISO date string (YYYY-MM-DD)
  why: string;
  weeklyCheckpoints: WeeklyCheckpoint[];
  milestones: SprintMilestone[];
  status: SprintStatus;
  finalEvaluation?: FinalEvaluation;
  createdAt: string;
  updatedAt: string;
}

export type StruggleOption =
  | 'shiny_object'      // I get excited about something new and abandon my current goals
  | 'too_many'          // I pursue too many things simultaneously
  | 'inconsistency'     // I struggle with consistency
  | 'fear_wrong_path'   // I'm afraid of choosing the wrong path
  | 'guilt_unproductive'; // I feel guilty when I'm not learning or improving

export type IdentityOption =
  | 'specialist'   // Someone exceptionally good at a few things
  | 'polymath'     // A multidisciplinary person with knowledge across many fields
  | 'synthesizer'  // Someone who builds meaningful things using multiple skills
  | 'explorer';    // Someone discovering their true passions

export interface GrowthReflection {
  struggle: StruggleOption;
  aspirationalIdentity: IdentityOption;
  reflectionAdvice: string;
  personalNotes?: string;
  updatedAt: string;
}

