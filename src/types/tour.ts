export type TourStepPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export type TourStepType = 'info' | 'action';

export interface TourStep {
  id: string;
  target: string; // CSS selector e.g. '[data-tour="nav-inbox"]' or '#ai-chat-float-btn'
  title: string;
  content: string;
  placement?: TourStepPlacement;
  route?: string; // Optional route if step requires viewing a specific page
  type?: TourStepType; // 'info' (default) or 'action' (user clicks highlighted item to advance)
  isAction?: boolean; // Convenience flag: true if step requires clicking target to advance
  actionHint?: string; // e.g. "Click the button to continue"
  fallbackTarget?: string; // Backup selector if target is not on current viewport
}

export interface TourDefinition {
  id: string;
  title: string;
  description?: string;
  badge?: string;
  steps: TourStep[];
}

export interface TourState {
  activeTourId: string | null;
  stepIndex: number;
  isOpen: boolean;
  isWelcomeOpen: boolean;
  isCompletionOpen: boolean;
  completedTours: string[];
  dismissedContextual: string[];
}

export interface TourContextType {
  activeTour: TourDefinition | null;
  currentStep: TourStep | null;
  stepIndex: number;
  totalSteps: number;
  isOpen: boolean;
  isWelcomeOpen: boolean;
  isCompletionOpen: boolean;
  startTour: (tourId?: string, startStep?: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  dismissWelcome: () => void;
  postponeWelcome: () => void;
  restartTour: () => void;
  resetAllTours: () => void;
  dismissContextualTour: (tourId: string) => void;
  isContextualDismissed: (tourId: string) => boolean;
}
