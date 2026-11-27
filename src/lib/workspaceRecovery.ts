import { DEFAULT_DREAMS } from '@/context/DreamContext';
import { DEFAULT_GOALS } from '@/context/GoalContext';
import { DEFAULT_MILESTONES } from '@/context/MilestoneContext';
import { DEFAULT_PROJECTS } from '@/context/ProjectContext';
import { DEFAULT_TASKS } from '@/context/TaskContext';
import { DEFAULT_INBOX_ITEMS } from '@/context/InboxContext';
import { DEFAULT_HABITS, generateSeedCheckIns } from '@/context/HabitContext';
import {
  DEFAULT_DAILY_ROUTINE,
  ROUTINE_STORAGE_KEY,
  notifyDailyRoutineUpdated,
} from '@/utils/dailyRoutineReminder';
import { flushCloudNow } from './cloudStore';

// Commit 052a410 timestamp (2026-11-27 16:21:39 +08:00) when sample defaults were cleared for new signups.
const LEGACY_DEFAULT_CUTOFF_MS = Date.parse('2026-11-27T08:21:39.000Z');
const LEGACY_RESTORED_FLAG = 'life_os_legacy_defaults_restored_v1';

const STARTER_ARRAY_SEEDS: Array<{ key: string; getDefaults: () => unknown[] }> = [
  { key: 'life_os_dreams_v1', getDefaults: () => DEFAULT_DREAMS },
  { key: 'life_os_goals_v1', getDefaults: () => DEFAULT_GOALS },
  { key: 'life_os_milestones_v1', getDefaults: () => DEFAULT_MILESTONES },
  { key: 'life_os_projects_v1', getDefaults: () => DEFAULT_PROJECTS },
  { key: 'life_os_tasks_v1', getDefaults: () => DEFAULT_TASKS },
  { key: 'life_os_inbox_v1', getDefaults: () => DEFAULT_INBOX_ITEMS },
  { key: 'life_os_habits_v1', getDefaults: () => DEFAULT_HABITS },
  { key: 'life_os_habit_checkins_v1', getDefaults: () => generateSeedCheckIns() },
  { key: ROUTINE_STORAGE_KEY, getDefaults: () => DEFAULT_DAILY_ROUTINE },
];

function readArrayOrNull(key: string): unknown[] | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isEmptyCollection(key: string): boolean {
  const arr = readArrayOrNull(key);
  return !arr || arr.length === 0;
}

/**
 * Automatically restores GitHub/legacy starter collections once for Firebase accounts created
 * prior to commit 052a410 (2026-11-27T08:21:39Z) whenever those collections are empty/missing
 * after Firestore hydration. Brand-new accounts remain completely clean.
 */
export async function restoreLegacyWorkspaceDefaultsIfNeeded(params: {
  isGuest: boolean;
  creationTime?: string | null;
}): Promise<boolean> {
  if (typeof window === 'undefined' || params.isGuest) return false;
  if (!params.creationTime) return false;

  const createdMs = Date.parse(params.creationTime);
  if (Number.isNaN(createdMs) || createdMs >= LEGACY_DEFAULT_CUTOFF_MS) {
    return false;
  }

  try {
    if (localStorage.getItem(LEGACY_RESTORED_FLAG) === 'true') {
      return false;
    }

    let restoredCount = 0;
    for (const seed of STARTER_ARRAY_SEEDS) {
      if (isEmptyCollection(seed.key)) {
        localStorage.setItem(seed.key, JSON.stringify(seed.getDefaults()));
        restoredCount += 1;
      }
    }

    localStorage.setItem(LEGACY_RESTORED_FLAG, 'true');

    if (restoredCount > 0) {
      await flushCloudNow();
      window.dispatchEvent(new CustomEvent('life_os_cloud_synced'));
      notifyDailyRoutineUpdated();
      return true;
    }

    await flushCloudNow();
    return false;
  } catch (err) {
    console.warn('[LifeOS] Legacy workspace default recovery warning:', err);
    return false;
  }
}

/**
 * Non-destructively restores missing starter items across all core collections
 * (Dreams, Goals, Milestones, Projects, Tasks, Idea Parking, Habits, Daily Routine)
 * by merging missing starter IDs onto existing saved items, then flushes to Firestore.
 */
export async function restoreMissingStarterWorkspace(): Promise<number> {
  if (typeof window === 'undefined') return 0;

  let addedTotal = 0;

  for (const seed of STARTER_ARRAY_SEEDS) {
    const existing = readArrayOrNull(seed.key) || [];
    const existingIds = new Set(
      existing
        .map((item) => (item && typeof item === 'object' && 'id' in item ? String((item as { id: unknown }).id) : ''))
        .filter(Boolean)
    );
    const defaults = seed.getDefaults();
    const missing = defaults.filter((item) => {
      const id = item && typeof item === 'object' && 'id' in item ? String((item as { id: unknown }).id) : '';
      return id ? !existingIds.has(id) : existing.length === 0;
    });

    if (missing.length > 0 || existing.length === 0) {
      const merged = existing.length > 0 ? [...existing, ...missing] : defaults;
      localStorage.setItem(seed.key, JSON.stringify(merged));
      addedTotal += existing.length > 0 ? missing.length : defaults.length;
    }
  }

  localStorage.setItem(LEGACY_RESTORED_FLAG, 'true');
  await flushCloudNow();
  window.dispatchEvent(new CustomEvent('life_os_cloud_synced'));
  notifyDailyRoutineUpdated();
  return addedTotal;
}
