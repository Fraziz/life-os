import type { TourDefinition } from '@/types/tour';

export const MAIN_SYSTEM_TOUR: TourDefinition = {
  id: 'main-system-tour',
  title: 'Welcome to Sariling Mundo',
  description: 'A guided walkthrough of your personal productivity system.',
  badge: 'Getting Started',
  steps: [
    {
      id: 'welcome',
      target: '[data-tour="brand"]',
      title: 'Welcome to Sariling Mundo',
      content:
        'Your personal productivity workspace engineered for clarity, routine discipline, and meaningful execution. Follow this quick walkthrough to see how everything fits together.',
      placement: 'right',
      route: '/',
    },
    {
      id: 'today-dashboard',
      target: '[data-tour="nav-today"]',
      title: 'Today Command Center',
      content:
        'Start your day here. Choose your main daily focus, track progress across today’s tasks and Daily Routine blocks, and review urgent deadlines.',
      placement: 'right',
      route: '/',
    },
    {
      id: 'daily-routine',
      target: '[data-tour="nav-routine"]',
      title: 'Daily Routine Schedule',
      content:
        'Structure your day into clear time blocks with checkable mini-steps so you always know what block is active now without decision fatigue.',
      placement: 'right',
      route: '/routine',
    },
    {
      id: 'brain-dump-inbox',
      target: '[data-tour="nav-inbox"]',
      title: 'Idea Parking & Capture',
      content:
        'Offload sudden thoughts, notes, and reminders before they scatter your focus. Convert anything actionable directly into tasks, projects, or goals.',
      placement: 'right',
      route: '/inbox',
    },
    {
      id: 'tasks-execution',
      target: '[data-tour="nav-tasks"]',
      title: 'Tasks, Subtasks & Priorities',
      content:
        'Break larger work into concrete subtasks, assign priorities and deadlines, and organize execution across Board or List views.',
      placement: 'right',
      route: '/tasks',
    },
    {
      id: 'planning-hierarchy',
      target: '[data-tour="nav-section-planning"]',
      fallbackTarget: '[data-tour="nav-projects"]',
      title: 'Long-Term Life Hierarchy',
      content:
        'Connect everyday actions up to Projects, Goals, and Dreams so daily execution steadily moves your bigger vision forward.',
      placement: 'right',
      route: '/',
    },
    {
      id: 'quick-search-notifications',
      target: '[data-tour="right-utility"]',
      fallbackTarget: '[data-tour="topbar-actions"]',
      title: 'Search, Theme & Live Reminders',
      content:
        'Search anywhere with Ctrl+K, switch between Clean Light Mode and Dark Mode, or review active reminders and unread notifications.',
      placement: 'left',
      route: '/',
    },
    {
      id: 'ai-assistant',
      target: '[data-tour="ai-assistant-btn"]',
      title: 'Always-Ready AI Assistant',
      content:
        'Click this floating button or press Ctrl+L anytime to brainstorm next steps, clarify priorities, or turn rough ideas into concrete tasks.',
      placement: 'left',
      route: '/',
    },
    {
      id: 'settings-control',
      target: '[data-tour="nav-settings"]',
      fallbackTarget: '[data-tour="user-profile"]',
      title: 'Preferences, Desktop Sync & Replay',
      content:
        'Choose White (Light), Black (Dark), or System Auto-Sync, customize Simple Mode or the Windows Desktop edge sidebar, and replay this tour anytime.',
      placement: 'right',
      route: '/settings',
    },
  ],
};

export const CONTEXTUAL_TOURS: Record<string, TourDefinition> = {
  'focus-space': {
    id: 'focus-space',
    title: 'Focus Space Deep Dive',
    badge: 'Focus Mode',
    steps: [
      {
        id: 'focus-timer',
        target: '[data-tour="focus-timer"]',
        title: 'Pomodoro & Flow Timers',
        content:
          'Pick a structured sprint or Flow Mode to build uninterrupted momentum on a single piece of work.',
        placement: 'bottom',
        route: '/focus',
      },
      {
        id: 'focus-audio',
        target: '[data-tour="focus-audio"]',
        title: 'Ambient Soundscapes',
        content:
          'Layer Rain, Brown Noise, or Coffee Shop ambience right inside your workspace without switching apps.',
        placement: 'left',
        route: '/focus',
      },
      {
        id: 'focus-task-select',
        target: '[data-tour="focus-task-select"]',
        title: 'Anchor to One Task',
        content:
          'Bind your session to an active task so every completed minute logs automatically toward your real work.',
        placement: 'top',
        route: '/focus',
      },
    ],
  },
  'idea-parking': {
    id: 'idea-parking',
    title: 'Idea Parking Workflow',
    badge: 'Capture',
    steps: [
      {
        id: 'inbox-capture-bar',
        target: '[data-tour="inbox-capture-bar"]',
        title: 'Instant Brain Dump Bar',
        content:
          'Type any thought, deadline, or reminder in seconds and press Enter so your mind stays clear.',
        placement: 'bottom',
        route: '/inbox',
      },
      {
        id: 'inbox-first-card',
        target: '[data-tour="inbox-first-card"]',
        title: 'Convert Into Real Execution',
        content:
          'Promote captured notes into Tasks, Projects, Goals, or Dreams whenever you are ready to act on them.',
        placement: 'top',
        route: '/inbox',
      },
    ],
  },
};
