const LAST_ACTIVE_DAY_KEY = 'life_os_last_active_day_v1';
const WELCOME_SESSION_KEY = 'life_os_welcome_back_session_v1';

interface WelcomeBackSession {
  daysAway: number;
  shownForDate: string;
  dismissed: boolean;
}

export function getLocalTodayDateStr(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDayMs(dateStr: string): number | null {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).getTime();
}

export function computeDaysBetween(earlierDateStr: string, laterDateStr: string): number {
  const startMs = parseLocalDayMs(earlierDateStr);
  const endMs = parseLocalDayMs(laterDateStr);
  if (startMs === null || endMs === null) return 0;
  return Math.round((endMs - startMs) / 86_400_000);
}

/**
 * Checks if the user is returning after 2+ days of inactivity and records today's visit.
 * Never shames or penalizes missed days.
 */
export function evaluateWelcomeBackState(now = new Date()): {
  shouldShow: boolean;
  daysAway: number;
} {
  if (typeof window === 'undefined') {
    return { shouldShow: false, daysAway: 0 };
  }

  const todayStr = getLocalTodayDateStr(now);

  try {
    const rawSession = localStorage.getItem(WELCOME_SESSION_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as Partial<WelcomeBackSession>;
      if (parsed.shownForDate === todayStr) {
        localStorage.setItem(LAST_ACTIVE_DAY_KEY, todayStr);
        return {
          shouldShow: !parsed.dismissed && (parsed.daysAway || 0) >= 2,
          daysAway: parsed.daysAway || 0,
        };
      }
    }

    const prevActive = localStorage.getItem(LAST_ACTIVE_DAY_KEY);
    localStorage.setItem(LAST_ACTIVE_DAY_KEY, todayStr);

    if (prevActive && prevActive !== todayStr) {
      const gap = computeDaysBetween(prevActive, todayStr);
      if (gap >= 2) {
        const nextSession: WelcomeBackSession = {
          daysAway: gap,
          shownForDate: todayStr,
          dismissed: false,
        };
        localStorage.setItem(WELCOME_SESSION_KEY, JSON.stringify(nextSession));
        return { shouldShow: true, daysAway: gap };
      }
    }
  } catch {
    // Ignore storage unavailability
  }

  return { shouldShow: false, daysAway: 0 };
}

export function dismissWelcomeBackBanner(now = new Date()): void {
  if (typeof window === 'undefined') return;
  const todayStr = getLocalTodayDateStr(now);
  try {
    const nextSession: WelcomeBackSession = {
      daysAway: 0,
      shownForDate: todayStr,
      dismissed: true,
    };
    localStorage.setItem(WELCOME_SESSION_KEY, JSON.stringify(nextSession));
    localStorage.setItem(LAST_ACTIVE_DAY_KEY, todayStr);
  } catch {
    // Ignore storage unavailability
  }
}
