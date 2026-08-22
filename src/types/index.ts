// Core domain types for Life OS
// These are stubs that will be expanded in later phases.
// Phase 2 adds User/auth types, Phase 3 adds database-backed shapes, etc.

// ── Identity ──────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Personal Profile & Settings (Phase 2) ───────────────────

export type PlanningStyle =
  | 'time-blocking'
  | 'eisenhower'
  | 'gtd'
  | 'kanban'
  | 'weekly-focus';

export type AppTheme = 'dark' | 'light' | 'system';

export interface WorkingHours {
  start: string;       // e.g. "09:00"
  end: string;         // e.g. "17:00"
  workDays: number[];  // [1, 2, 3, 4, 5] (1 = Mon, 7 = Sun)
}

export interface FocusPreferences {
  pomodoroDuration: number;     // minutes (e.g. 25)
  shortBreakDuration: number;   // minutes (e.g. 5)
  longBreakDuration: number;    // minutes (e.g. 15)
  autoStartBreaks: boolean;
}

export interface QuietHours {
  enabled: boolean;
  start: string; // e.g. "22:00"
  end: string;   // e.g. "08:00"
}

export interface NotificationPreferences {
  enabled: boolean;             // Master toggle
  taskReminders: boolean;       // Due/scheduled tasks
  deadlineAlerts: boolean;      // Goals & milestones approaching deadline
  scheduledWorkAlerts: boolean; // Calendar scheduled work start alerts
  habitReminders: boolean;      // Habit cue notifications
  weeklyReviewReminders: boolean;// Sunday/Friday review reminder
  quietHours: QuietHours;       // Silence alerts during quiet time
  browserNotifications: boolean;// Use desktop Notification API
  reminderAdvanceMinutes: number; // e.g. 15 mins before
}

export interface UserProfile {
  id: string;
  name: string;
  displayName: string;
  avatarInitials: string;
}

export interface AISettings {
  enabled: boolean;
  provider: 'gemini' | 'openai' | 'anthropic' | 'custom';
  apiKey?: string;
  apiEndpoint?: string;
  model: string;
  monthlyBudgetUSD: number;
  spentBudgetUSD: number;
  totalTokensUsed: number;
  temperature: number;
}

export interface UserSettings {
  profile: UserProfile;
  timeZone: string;
  workingHours: WorkingHours;
  availableHoursPerDay: number;
  planningStyle: PlanningStyle;
  defaultTaskDuration: number;  // in minutes (15, 30, 45, 60)
  focusPreferences: FocusPreferences;
  notifications: NotificationPreferences;
  aiSettings?: AISettings;
  theme: AppTheme;
  updatedAt: string;
}

// ── Life Areas ─────────────────────────────────────────────

export interface LifeArea {
  id: string;
  name: string;
  color: string;       // Hex or CSS color string (e.g. '#a594ff')
  icon: string;        // Lucide icon identifier (e.g. 'User', 'Briefcase')
  description?: string;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Dreams (Phase 4) ──────────────────────────────────────

export type DreamStatus =
  | 'dream'
  | 'planning'
  | 'active'
  | 'paused'
  | 'achieved'
  | 'archived';

export interface Dream {
  id: string;
  title: string;
  description?: string;
  whyItMatters: string;       // Core motivation behind this dream
  lifeAreaId?: string;        // Linked Life Area ID
  targetDate?: string;        // Target date e.g. "2027-12-31"
  status: DreamStatus;
  notes?: string;             // Inspiration notes & thoughts
  imageUrl?: string;          // Optional vision board cover photo
  createdAt: string;
  updatedAt: string;
}

// ── Goals (Phase 5) ─────────────────────────────────────────

export type GoalHorizon =
  | 'long-term'
  | 'yearly'
  | '90-day'
  | 'monthly'
  | 'custom';

export type GoalStatus =
  | 'not-started'
  | 'in-progress'
  | 'completed'
  | 'paused'
  | 'archived';

export type GoalPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  why: string;                 // Why this goal matters toward the dream
  parentDreamId?: string;      // Linked Parent Dream ID
  lifeAreaId?: string;         // Linked Life Area ID
  color?: string;              // Custom accent color e.g. '#bd93f9'
  horizon: GoalHorizon;
  targetDate?: string;         // e.g. "2026-12-31"
  priority: GoalPriority;
  status: GoalStatus;
  progress: number;            // 0–100 percentage
  createdAt: string;
  updatedAt: string;
}

// ── Milestones (Phase 6) ───────────────────────────────────

export type MilestoneStatus = 'upcoming' | 'in-progress' | 'completed' | 'missed' | 'archived';

export interface Milestone {
  id: string;
  goalId: string;              // Parent Goal ID
  title: string;
  description?: string;
  status: MilestoneStatus;
  progress: number;            // 0–100%
  targetDate?: string;         // e.g. "2026-10-15"
  sortOrder: number;           // For manual ordering
  createdAt: string;
  updatedAt: string;
}

// ── Projects (Phase 7) ─────────────────────────────────────

export type ProjectStatus = 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
export type ProjectPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface Project {
  id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate?: string;
  dueDate?: string;
  progress: number;            // 0–100%
  goalId?: string;             // Parent Goal ID
  milestoneId?: string;        // Parent Milestone ID
  color?: string;              // Custom project color e.g. '#38bdf8'
  notes?: string;              // Execution notes & scratchpad
  createdAt: string;
  updatedAt: string;
}

// ── Tasks & Breakdown (Phase 8 & 9) ─────────────────────────

export type TaskStatus = 'backlog' | 'todo' | 'doing' | 'done';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  estimatedMinutes?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;            // e.g. "2026-08-20"
  estimatedDuration?: number;  // in minutes (e.g. 25, 45, 90)
  actualDuration?: number;     // in minutes
  projectId?: string;          // Parent Project ID
  goalId?: string;             // Parent Goal ID
  milestoneId?: string;        // Parent Milestone ID
  parentTaskId?: string;       // Linked Parent Task (if nested)
  isCompound?: boolean;        // Large / compound task requiring breakdown
  color?: string;              // Custom accent line color e.g. '#bd93f9', '#f59e0b', '#38bdf8'
  tags: string[];              // Tag labels e.g. ['physics', 'gameplay']
  subtasks: Subtask[];
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Focus Mode (Phase 12) ──────────────────────────────────

export type FocusModeType = 'pomodoro' | 'custom' | 'short_break' | 'long_break' | 'flow';

export interface FocusSession {
  id: string;
  taskId?: string;
  taskTitle: string;
  durationMinutes: number;
  mode: FocusModeType;
  startedAt: string;
  completedAt: string;
  notes?: string;
}

// ── Brain Dump & Inbox (Phase 13) ──────────────────────────

export type InboxItemStatus = 'inbox' | 'converted' | 'someday' | 'archived';
export type InboxConvertedType = 'task' | 'project' | 'goal' | 'dream' | 'note' | 'someday';

export interface InboxItem {
  id: string;
  content: string;
  status: InboxItemStatus;
  convertedTo?: InboxConvertedType;
  convertedEntityId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Calendar & Scheduling (Phase 15) ────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;               // YYYY-MM-DD
  startTime?: string;         // HH:mm (e.g. "14:00")
  endTime?: string;           // HH:mm (e.g. "15:00")
  allDay?: boolean;
  color?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledWorkBlock {
  id: string;
  taskId: string;
  taskTitle: string;
  date: string;               // YYYY-MM-DD
  startTime: string;          // HH:mm (e.g. "19:00")
  durationMinutes: number;    // in minutes (e.g. 90)
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Habits (Phase 16) ──────────────────────────────────────

export type HabitFrequency = 'daily' | 'weekly' | 'weekdays' | 'weekends' | 'custom';

export interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: HabitFrequency;
  targetCount: number;         // e.g. 1 per day, 3 per week
  customDays?: number[];       // 0=Sun, 1=Mon, ..., 6=Sat
  parentGoalId?: string;       // Connected parent Goal ID
  lifeAreaId?: string;         // Connected Life Area ID
  reminderTime?: string;       // e.g. "08:00" or "20:00"
  reminderNote?: string;
  color?: string;
  icon?: string;
  isOptional?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HabitCheckIn {
  id: string;
  habitId: string;
  date: string;                // YYYY-MM-DD
  count: number;               // Number of completions on this day (e.g. 1)
  completed: boolean;
  notes?: string;
  createdAt: string;
}

// ── Weekly Review (Phase 18) ───────────────────────────────

export interface WeeklyReview {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  completedTaskCount: number;
  openTaskCount: number;
  focusMinutesLogged: number;
  goalsProgressedCount: number;
  projectsProgressedCount: number;
  habitsConsistencyRate: number; // percentage
  importantWins: string[];
  wentWell: string;
  didNotGoWell: string;
  shouldChange: string;
  nextWeekFocus: string;
  createdAt: string;
  updatedAt: string;
}

// ── Knowledge / Documents (Phase 23) ───────────────────────

export type DocumentStatus = 'draft' | 'active' | 'archived';

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;        // Markdown/rich text (stored as plain markdown)
  status: DocumentStatus;
  linkedDreamId?: string;
  linkedGoalId?: string;
  linkedProjectId?: string;
  linkedTaskId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Reminders & Notifications (Phase 24) ───────────────────

export type ReminderType = 'task' | 'deadline' | 'scheduled_work' | 'habit' | 'weekly_review';
export type ReminderPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface ReminderItem {
  id: string;
  type: ReminderType;
  title: string;
  message: string;
  entityId?: string;
  href?: string;
  timeStr?: string;
  priority: ReminderPriority;
  isRead: boolean;
  isDismissed: boolean;
  snoozedUntil?: string; // ISO string
  createdAt: string;
}

// ── AI Assistant & Suggestions (Phase 26) ──────────────────

export type AISuggestionType = 'breakdown' | 'day_plan' | 'task_suggestion' | 'review' | 'blockers';

export interface SuggestedAction {
  id: string;
  type: 'create_task' | 'create_subtask' | 'schedule_block' | 'update_priority' | 'breakdown';
  label: string;
  payload: any;
  selected?: boolean;
}

export interface AISuggestion {
  id: string;
  type: AISuggestionType;
  title: string;
  explanation: string;
  actions: SuggestedAction[];
  isDeterministicFallback?: boolean;
  createdAt: string;
}

// ── "I Don't Know What To Do" (Phase 27) ───────────────────

export interface NextActionRecommendation {
  task: Task;
  why: string;
  estimatedMinutes: number;
  priority: TaskPriority;
  projectTitle?: string;
  goalTitle?: string;
  isAIGenerated?: boolean;
  rejectionCount?: number;
}

// ── Navigation ─────────────────────────────────────────────

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  phase?: number;           // Which phase builds this feature
  isAvailable: boolean;     // False = show "Coming Soon"
  badge?: string | number;
  children?: NavItem[];
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

// ── UI State ───────────────────────────────────────────────

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: LoadingState;
  error: string | null;
}

// ── Files / Attachments ────────────────────────────────────

export type FileEntityType =
  | 'goal'
  | 'dream'
  | 'project'
  | 'task'
  | 'milestone'
  | 'area'
  | 'inbox'
  | 'knowledge'
  | 'habit'
  | 'vault';

export type FileKind = 'image' | 'video' | 'document' | 'other';

export interface LifeFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: FileKind;
  folder: string;
  storagePath: string;
  downloadUrl: string;
  entityType: FileEntityType;
  entityId: string;
  entityTitle: string;
  createdAt: string;
}


