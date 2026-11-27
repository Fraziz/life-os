'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from 'firebase/auth';
import type { TourContextType, TourDefinition, TourStep } from '@/types/tour';
import { MAIN_SYSTEM_TOUR, CONTEXTUAL_TOURS } from '@/config/tours';
import { useAuth, type AppUser } from '@/context/AuthContext';

const USER_DATA_ARRAY_KEYS = [
  'life_os_tasks_v1',
  'life_os_goals_v1',
  'life_os_dreams_v1',
  'life_os_projects_v1',
  'life_os_milestones_v1',
  'life_os_inbox_v1',
  'life_os_weekly_reviews_v1',
  'life_os_focus_history_v1',
  'life_os_calendar_events_v1',
  'life_os_study_sessions_v1',
];

function hasExistingWorkspaceData(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    for (const key of USER_DATA_ARRAY_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return true;
    }

    const rawPlan = localStorage.getItem('life_os_today_plan_v1');
    if (rawPlan) {
      const plan = JSON.parse(rawPlan);
      if (
        plan &&
        (Boolean(plan.mainFocusTaskId) ||
          (typeof plan.dailyActionText === 'string' && plan.dailyActionText.trim().length > 0))
      ) {
        return true;
      }
    }

    const rawProg = localStorage.getItem('life_os_daily_routine_progress_v1');
    if (rawProg) {
      const prog = JSON.parse(rawProg);
      if (
        prog &&
        ((Array.isArray(prog.completedBlockIds) && prog.completedBlockIds.length > 0) ||
          (Array.isArray(prog.completedStepKeys) && prog.completedStepKeys.length > 0))
      ) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function isReturningFirebaseAccount(authUser: (User | AppUser) | null, isGuest: boolean): boolean {
  if (!authUser || isGuest) return false;
  if (!('metadata' in authUser) || !authUser.metadata?.creationTime) return false;
  const createdMs = Date.parse(authUser.metadata.creationTime);
  const lastSignInMs = Date.parse(authUser.metadata.lastSignInTime || authUser.metadata.creationTime);
  if (Number.isNaN(createdMs) || Number.isNaN(lastSignInMs)) return false;
  const isRepeatSession = lastSignInMs - createdMs > 5 * 60 * 1000;
  const isOldAccount = Date.now() - createdMs > 12 * 60 * 60 * 1000;
  return isRepeatSession || isOldAccount;
}

const STORAGE_KEYS = {
  COMPLETED: 'life_os_tour_completed',
  SKIPPED: 'life_os_tour_skipped',
  CURRENT_STEP: 'life_os_tour_step',
  POSTPONED: 'life_os_tour_postponed',
  DISMISSED_CONTEXTUAL: 'life_os_contextual_dismissed',
};

const TourContext = createContext<TourContextType | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isGuest, ready: authReady } = useAuth();

  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(false);
  const [isCompletionOpen, setIsCompletionOpen] = useState<boolean>(false);
  const [dismissedContextual, setDismissedContextual] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Active tour object
  const activeTour: TourDefinition | null = useMemo(() => {
    if (!activeTourId) return null;
    if (activeTourId === MAIN_SYSTEM_TOUR.id) return MAIN_SYSTEM_TOUR;
    return CONTEXTUAL_TOURS[activeTourId] || null;
  }, [activeTourId]);

  const currentStep: TourStep | null = useMemo(() => {
    if (!activeTour || !activeTour.steps[stepIndex]) return null;
    return activeTour.steps[stepIndex];
  }, [activeTour, stepIndex]);

  const totalSteps = activeTour?.steps.length || 0;

  // Initialize persisted contextual dismissals on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedContextual = localStorage.getItem(STORAGE_KEYS.DISMISSED_CONTEXTUAL);
      if (savedContextual) {
        setDismissedContextual(JSON.parse(savedContextual));
      }
    } catch {}
    setIsInitialized(true);
  }, []);

  // Only offer Welcome dialog automatically to genuinely brand-new users
  useEffect(() => {
    if (typeof window === 'undefined' || !authReady || !user) return;
    if (pathname === '/login' || pathname === '/register') return;

    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (showTimer) clearTimeout(showTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      window.removeEventListener('life_os_cloud_synced', onCloudSynced);
    };

    const evaluateWelcomeEligibility = () => {
      if (settled) return;
      settled = true;
      try {
        const isCompleted = localStorage.getItem(STORAGE_KEYS.COMPLETED) === 'true';
        const isSkipped = localStorage.getItem(STORAGE_KEYS.SKIPPED) === 'true';
        const isPostponed = sessionStorage.getItem(STORAGE_KEYS.POSTPONED) === 'true';
        if (isCompleted || isSkipped || isPostponed) return;

        if (isReturningFirebaseAccount(user, isGuest) || hasExistingWorkspaceData()) {
          localStorage.setItem(STORAGE_KEYS.COMPLETED, 'true');
          return;
        }

        showTimer = setTimeout(() => {
          setIsWelcomeOpen(true);
        }, 1200);
      } catch {}
    };

    const onCloudSynced = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      evaluateWelcomeEligibility();
    };

    try {
      const isCompleted = localStorage.getItem(STORAGE_KEYS.COMPLETED) === 'true';
      const isSkipped = localStorage.getItem(STORAGE_KEYS.SKIPPED) === 'true';
      const isPostponed = sessionStorage.getItem(STORAGE_KEYS.POSTPONED) === 'true';
      if (isCompleted || isSkipped || isPostponed) return;

      if (isReturningFirebaseAccount(user, isGuest)) {
        localStorage.setItem(STORAGE_KEYS.COMPLETED, 'true');
        return;
      }
    } catch {
      return;
    }

    if (isGuest) {
      evaluateWelcomeEligibility();
      return cleanup;
    }

    const hydratedUid = (window as Window & { __lifeOsCloudHydratedUid?: string }).__lifeOsCloudHydratedUid;
    if (hydratedUid === user.uid) {
      evaluateWelcomeEligibility();
      return cleanup;
    }

    window.addEventListener('life_os_cloud_synced', onCloudSynced);
    fallbackTimer = setTimeout(evaluateWelcomeEligibility, 3800);

    return cleanup;
  }, [authReady, user, isGuest, pathname]);

  // Listen for global custom events to start or reset tour from anywhere
  useEffect(() => {
    const handleStartTourEvent = (e: Event) => {
      const custom = e as CustomEvent<{ tourId?: string; step?: number }>;
      const id = custom.detail?.tourId || MAIN_SYSTEM_TOUR.id;
      const step = custom.detail?.step || 0;
      startTour(id, step);
    };

    const handleResetToursEvent = () => {
      resetAllTours();
    };

    window.addEventListener('start-guided-tour', handleStartTourEvent);
    window.addEventListener('reset-guided-tours', handleResetToursEvent);

    return () => {
      window.removeEventListener('start-guided-tour', handleStartTourEvent);
      window.removeEventListener('reset-guided-tours', handleResetToursEvent);
    };
  }, []);

  // Start Tour
  const startTour = useCallback((tourId: string = MAIN_SYSTEM_TOUR.id, startStep: number = 0) => {
    setIsWelcomeOpen(false);
    setIsCompletionOpen(false);
    setActiveTourId(tourId);
    setStepIndex(startStep);
    setIsOpen(true);

    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_STEP, String(startStep));
    } catch {}

    // Check if step requires expanding sidebar
    window.dispatchEvent(new CustomEvent('tour-expand-sidebar'));
  }, []);

  // Route synchronization when step specifies a target page
  useEffect(() => {
    if (isOpen && currentStep?.route && pathname !== currentStep.route) {
      router.push(currentStep.route);
    }
  }, [isOpen, currentStep, pathname, router]);

  // Next step
  const nextStep = useCallback(() => {
    if (!activeTour) return;

    if (stepIndex + 1 < activeTour.steps.length) {
      const nextIdx = stepIndex + 1;
      setStepIndex(nextIdx);
      try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_STEP, String(nextIdx));
      } catch {}
    } else {
      // Completed the tour!
      completeTour();
    }
  }, [activeTour, stepIndex]);

  // Previous step
  const prevStep = useCallback(() => {
    if (stepIndex > 0) {
      const prevIdx = stepIndex - 1;
      setStepIndex(prevIdx);
      try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_STEP, String(prevIdx));
      } catch {}
    }
  }, [stepIndex]);

  // Complete tour
  const completeTour = useCallback(() => {
    setIsOpen(false);
    setIsCompletionOpen(true);

    if (activeTourId === MAIN_SYSTEM_TOUR.id) {
      try {
        localStorage.setItem(STORAGE_KEYS.COMPLETED, 'true');
        localStorage.removeItem(STORAGE_KEYS.CURRENT_STEP);
      } catch {}
    } else if (activeTourId) {
      dismissContextualTour(activeTourId);
    }
  }, [activeTourId]);

  // Skip tour
  const skipTour = useCallback(() => {
    setIsOpen(false);
    setIsWelcomeOpen(false);
    setIsCompletionOpen(false);

    if (activeTourId === MAIN_SYSTEM_TOUR.id) {
      try {
        localStorage.setItem(STORAGE_KEYS.SKIPPED, 'true');
        localStorage.removeItem(STORAGE_KEYS.CURRENT_STEP);
      } catch {}
    }
  }, [activeTourId]);

  // Dismiss welcome dialog (won't show again unless restarted)
  const dismissWelcome = useCallback(() => {
    setIsWelcomeOpen(false);
    try {
      localStorage.setItem(STORAGE_KEYS.SKIPPED, 'true');
    } catch {}
  }, []);

  // Postpone welcome dialog (maybe later during this session)
  const postponeWelcome = useCallback(() => {
    setIsWelcomeOpen(false);
    try {
      sessionStorage.setItem(STORAGE_KEYS.POSTPONED, 'true');
    } catch {}
  }, []);

  // Restart tour
  const restartTour = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.COMPLETED);
      localStorage.removeItem(STORAGE_KEYS.SKIPPED);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_STEP);
    } catch {}
    startTour(MAIN_SYSTEM_TOUR.id, 0);
  }, [startTour]);

  // Reset all tour data
  const resetAllTours = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.COMPLETED);
      localStorage.removeItem(STORAGE_KEYS.SKIPPED);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_STEP);
      localStorage.removeItem(STORAGE_KEYS.DISMISSED_CONTEXTUAL);
      sessionStorage.removeItem(STORAGE_KEYS.POSTPONED);
      setDismissedContextual([]);
    } catch {}
    setIsOpen(false);
    setIsWelcomeOpen(false);
    setIsCompletionOpen(false);
  }, []);

  // Contextual tour dismissal
  const dismissContextualTour = useCallback((tourId: string) => {
    setDismissedContextual((prev) => {
      if (prev.includes(tourId)) return prev;
      const next = [...prev, tourId];
      try {
        localStorage.setItem(STORAGE_KEYS.DISMISSED_CONTEXTUAL, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isContextualDismissed = useCallback(
    (tourId: string) => dismissedContextual.includes(tourId),
    [dismissedContextual]
  );

  const value = useMemo(
    () => ({
      activeTour,
      currentStep,
      stepIndex,
      totalSteps,
      isOpen,
      isWelcomeOpen,
      isCompletionOpen,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      completeTour,
      dismissWelcome,
      postponeWelcome,
      restartTour,
      resetAllTours,
      dismissContextualTour,
      isContextualDismissed,
    }),
    [
      activeTour,
      currentStep,
      stepIndex,
      totalSteps,
      isOpen,
      isWelcomeOpen,
      isCompletionOpen,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      completeTour,
      dismissWelcome,
      postponeWelcome,
      restartTour,
      resetAllTours,
      dismissContextualTour,
      isContextualDismissed,
    ]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
