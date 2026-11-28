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
      id: 'brain-dump-inbox',
      target: '[data-tour="nav-inbox"]',
      title: 'Brain Dump',
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
      id: 'daily-routine',
      target: '[data-tour="nav-calendar"]',
      title: 'Calendar & Routines',
      content:
        'Manage deadlines, focus blocks, and your Daily Routine schedule from one calm place—switch between Calendar and Daily Routine anytime at the top.',
      placement: 'right',
      route: '/routine',
    },
    {
      id: 'planning-hierarchy',
      target: '[data-tour="nav-section-life-management"]',
      fallbackTarget: '[data-tour="nav-projects"]',
      title: 'Life Management',
      content:
        'Connect everyday actions up to Projects and Goals & Vision so daily execution steadily moves your bigger plans forward.',
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
      title: 'Floating AI Bubble: Pop-Up, Pop-Out & Edge Snap',
      content:
        'Click this bubble (or press Ctrl+L) to pop up AI chat beside it, dock it as a side drawer, or pop it out into a standalone window. Drag it toward either side of the screen to snap it cleanly to the edge, or double-click to reset.',
      placement: 'left',
      route: '/',
    },
    {
      id: 'edge-companion',
      target: '[data-tour="desktop-edge-card"]',
      fallbackTarget: '[data-tour="user-profile"]',
      title: 'Screen-Edge Handle & Desktop Floating Bubble',
      content:
        'Keep Sariling Mundo one swipe away on your monitor edge. In the Windows Desktop App, switch the bubble to Edge Line mode (or drag it onto your left or right screen edge), then click or swipe inward to open your Edge Sidebar—with subtle edge blinking when tasks or routines need attention.',
      placement: 'top',
      route: '/settings',
    },
    {
      id: 'settings-control',
      target: '[data-tour="user-profile"]',
      fallbackTarget: '[data-tour="nav-settings"]',
      title: 'Profile Menu, Themes & Tour Replay',
      content:
        'Open your profile menu anytime to trigger the Floating Bubble, switch between Clean Light and Dark themes, toggle Simple Mode, or replay this Interactive Tour whenever you want.',
      placement: 'right',
      route: '/settings',
    },
  ],
};

export const CONTEXTUAL_TOURS: Record<string, TourDefinition> = {
  'edge-companion': {
    id: 'edge-companion',
    title: 'Edge & Floating Bubble Guide',
    badge: 'Screen Edge',
    steps: [
      {
        id: 'edge-ai-bubble',
        target: '[data-tour="ai-assistant-btn"]',
        title: 'Web Floating Bubble & Edge Docking',
        content:
          'Click to pop up the AI card, dock it to the side, or pop it out into its own window. Drag the bubble left or right to snap it cleanly against the screen edge so it never blocks your reading.',
        placement: 'left',
        route: '/',
      },
      {
        id: 'edge-desktop-line',
        target: '[data-tour="desktop-edge-card"]',
        fallbackTarget: '[data-tour="user-profile"]',
        title: 'Desktop Edge Line & Quick Sidebar',
        content:
          'Choose Edge Line mode (or drag the desktop bubble onto your left/right monitor edge) to dock a minimal screen-edge handle. Click or swipe inward anytime to open your Edge Sidebar, and customize or mute Edge Line Blink alerts right here.',
        placement: 'top',
        route: '/settings',
      },
    ],
  },
  'focus-space': {
    id: 'focus-space',
    title: 'Focus Mode Deep Dive',
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
    title: 'Brain Dump Workflow',
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
