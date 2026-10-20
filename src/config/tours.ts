import type { TourDefinition } from '@/types/tour';

/**
 * Main System Onboarding Tour
 * Introduces new users to the core architecture and navigation of Life OS.
 */
export const MAIN_SYSTEM_TOUR: TourDefinition = {
  id: 'main-tour',
  title: 'System Tour',
  description: 'Learn the core features of your Life OS in 2 minutes.',
  badge: 'Getting Started',
  steps: [
    {
      id: 'brand',
      target: '[data-tour="brand"]',
      title: 'Welcome to Sariling Mundo',
      content:
        'Your calm, distraction-free Life Operating System. Thoughtfully designed to transform overwhelming thoughts into effortless daily momentum.',
      placement: 'right',
      fallbackTarget: 'header',
    },
    {
      id: 'today',
      target: '[data-tour="nav-today"]',
      title: 'Today Dashboard',
      content:
        'Your daily cockpit. Check your daily focus, mark off habits, and optimize your hourly schedule with 1-click AI time blocking.',
      placement: 'right',
      route: '/',
    },
    {
      id: 'inbox',
      target: '[data-tour="nav-inbox"]',
      title: 'Idea Parking',
      content:
        'Capture thoughts, ideas, and flashes of inspiration in seconds with zero friction. Park them here immediately, then organize into Tasks, Projects, or Goals later.',
      placement: 'right',
      isAction: true,
      actionHint: 'Click to explore Idea Parking',
    },
    {
      id: 'tasks',
      target: '[data-tour="nav-tasks"]',
      title: 'Tasks & Execution',
      content:
        'Your daily execution engine. Move tasks across Backlog, To Do, Doing, and Done with smooth drag-and-drop, duration tracking, and Dopamine rewards.',
      placement: 'right',
    },
    {
      id: 'planning',
      target: '[data-tour="nav-section-planning"]',
      title: 'Goals, Projects & Dreams',
      content:
        'Your natural hierarchy. Everyday Tasks connect to active Projects, which drive your quarterly Goals, turning your lifelong Dreams into tangible reality.',
      placement: 'right',
      fallbackTarget: '[data-tour="nav-projects"]',
    },
    {
      id: 'topbar-actions',
      target: '[data-tour="topbar-actions"]',
      title: 'Decision Compass & Sync Status',
      content:
        'When you feel overwhelmed or unsure what to do next, tap the Compass for an instant smart decision prompt. The sync indicator confirms your data is saved in real time.',
      placement: 'bottom',
    },
    {
      id: 'ai-assistant',
      target: '[data-tour="ai-assistant-btn"]',
      title: 'AI Cognitive Assistant (Ctrl+L)',
      content:
        'Your personal AI companion. Click or press Ctrl+L to chat, break down overwhelming tasks, draft outlines, or plan your week.',
      placement: 'left',
      fallbackTarget: '#ai-chat-float-btn',
    },
    {
      id: 'settings',
      target: '[data-tour="nav-settings"]',
      title: 'Themes & Personalization',
      content:
        'Personalize your space. Switch between 4 themes (Warm Paper, Dark Charcoal, Forest Nature, Cyber Glow), configure AI models, or restart this tour anytime.',
      placement: 'top',
      fallbackTarget: '[data-tour="user-profile"]',
    },
  ],
};

/**
 * Contextual Feature Tours for complex modules
 */
export const CONTEXTUAL_TOURS: Record<string, TourDefinition> = {
  'focus-space': {
    id: 'focus-space',
    title: 'Focus Space Tour',
    description: 'Master deep work with Pomodoro intervals and ambient soundscapes.',
    badge: 'Feature Guide',
    steps: [
      {
        id: 'timer',
        target: '[data-tour="focus-timer"]',
        title: 'Deep Work Timer',
        content: 'Work in focused Pomodoro intervals (25m / 50m) or switch to Stopwatch mode for open-ended flow.',
        placement: 'bottom',
      },
      {
        id: 'audio',
        target: '[data-tour="focus-audio"]',
        title: 'Ambient Soundscapes',
        content: 'Calm background frequencies, binaural beats, and nature sounds engineered for focus.',
        placement: 'top',
      },
      {
        id: 'task-select',
        target: '[data-tour="focus-task-select"]',
        title: 'Single-Task Anchor',
        content: 'Select the one task you are working on right now to prevent multitasking and context switching.',
        placement: 'top',
      },
    ],
  },
  'idea-parking': {
    id: 'idea-parking',
    title: 'Idea Parking Guide',
    description: 'Learn fast capture and convert ideas into real projects.',
    badge: 'Feature Guide',
    steps: [
      {
        id: 'capture-bar',
        target: '[data-tour="inbox-capture-bar"]',
        title: 'Frictionless Capture',
        content: 'Type an idea directly and press Enter. Support for voice dictation and quick color tagging.',
        placement: 'bottom',
      },
      {
        id: 'convert-card',
        target: '[data-tour="inbox-first-card"]',
        title: 'Transform with 1-Click',
        content: 'Hover over any parked note to instantly convert it into a Task, Project, Goal, or Knowledge book.',
        placement: 'top',
      },
    ],
  },
};
