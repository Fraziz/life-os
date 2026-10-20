'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { TourContextType, TourDefinition, TourStep } from '@/types/tour';
import { MAIN_SYSTEM_TOUR, CONTEXTUAL_TOURS } from '@/config/tours';

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

  // Initialize and check whether to prompt new users with Welcome dialog
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const isCompleted = localStorage.getItem(STORAGE_KEYS.COMPLETED) === 'true';
      const isSkipped = localStorage.getItem(STORAGE_KEYS.SKIPPED) === 'true';
      const isPostponed = sessionStorage.getItem(STORAGE_KEYS.POSTPONED) === 'true';

      const savedContextual = localStorage.getItem(STORAGE_KEYS.DISMISSED_CONTEXTUAL);
      if (savedContextual) {
        setDismissedContextual(JSON.parse(savedContextual));
      }

      setIsInitialized(true);

      // If user has never completed, skipped, or postponed, offer welcome dialog after 1.4s
      if (!isCompleted && !isSkipped && !isPostponed) {
        const timer = setTimeout(() => {
          setIsWelcomeOpen(true);
        }, 1400);
        return () => clearTimeout(timer);
      }
    } catch {
      setIsInitialized(true);
    }
  }, []);

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
