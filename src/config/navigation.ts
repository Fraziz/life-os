import type { NavSection } from '@/types';

/**
 * Navigation configuration for the Life OS sidebar.
 *
 * ADHD-friendly structure:
 * - TODAY      → What matters right now
 * - CAPTURE    → Get thoughts out of your head
 * - ORGANIZE   → Turn thoughts into actionable work
 * - DIRECTION  → Connect daily work to your bigger life
 * - MORE       → Secondary tools that don't need to compete for attention
 *
 * This is the single source of truth for navigation.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'today',
    label: 'Today',
    items: [
      {
        id: 'today',
        label: 'Today',
        href: '/',
        icon: 'today',
        isAvailable: true,
        phase: 1,
      },
      {
        id: 'focus',
        label: 'Focus Mode',
        href: '/focus',
        icon: 'focus',
        isAvailable: true,
        phase: 12,
      },
    ],
  },

  {
    id: 'capture',
    label: 'Capture',
    items: [
      {
        id: 'inbox',
        label: 'Brain Dump',
        href: '/inbox',
        icon: 'inbox',
        isAvailable: true,
        phase: 13,
      },
    ],
  },

  {
    id: 'organize',
    label: 'Organize',
    items: [
      {
        id: 'tasks',
        label: 'Tasks',
        href: '/tasks',
        icon: 'tasks',
        isAvailable: true,
        phase: 8,
      },
      {
        id: 'projects',
        label: 'Projects',
        href: '/projects',
        icon: 'projects',
        isAvailable: true,
        phase: 7,
      },
      {
        id: 'goals',
        label: 'Goals',
        href: '/goals',
        icon: 'goals',
        isAvailable: true,
        phase: 5,
      },
      {
        id: 'milestones',
        label: 'Milestones',
        href: '/milestones',
        icon: 'milestones',
        isAvailable: true,
        phase: 6,
      },
    ],
  },

  {
    id: 'direction',
    label: 'Direction',
    items: [
      {
        id: 'roadmap',
        label: 'Life Roadmap',
        href: '/roadmap',
        icon: 'roadmap',
        isAvailable: true,
        phase: 30,
      },
      {
        id: 'dreams',
        label: 'Dreams & Vision',
        href: '/dreams',
        icon: 'dreams',
        isAvailable: true,
        phase: 4,
      },
      {
        id: 'areas',
        label: 'Life Areas',
        href: '/areas',
        icon: 'areas',
        isAvailable: true,
        phase: 3,
      },
    ],
  },

  {
    id: 'more',
    label: 'More',
    items: [
      {
        id: 'calendar',
        label: 'Calendar',
        href: '/calendar',
        icon: 'calendar',
        isAvailable: true,
        phase: 15,
      },
      {
        id: 'progress',
        label: 'Progress & Review',
        href: '/progress',
        icon: 'progress',
        isAvailable: true,
        phase: 17,
      },
      {
        id: 'review',
        label: 'Weekly Review',
        href: '/review',
        icon: 'review',
        isAvailable: true,
        phase: 18,
      },
      {
        id: 'reset',
        label: 'Reset Plan',
        href: '/reset',
        icon: 'reset',
        isAvailable: true,
        phase: 14,
      },
      {
        id: 'habits',
        label: 'Habits',
        href: '/habits',
        icon: 'habits',
        isAvailable: true,
        phase: 16,
      },
      {
        id: 'knowledge',
        label: 'Knowledge',
        href: '/knowledge',
        icon: 'knowledge',
        isAvailable: true,
        phase: 23,
      },
      {
        id: 'files',
        label: 'Files',
        href: '/files',
        icon: 'files',
        isAvailable: true,
        phase: 31,
      },
      {
        id: 'settings',
        label: 'Settings',
        href: '/settings',
        icon: 'settings',
        isAvailable: true,
        phase: 2,
      },
    ],
  },
];