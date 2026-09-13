import type { NavSection } from '@/types';

/**
 * Single source of truth for Life OS navigation.
 * Matches all ADHD-focused categories and item names exactly.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'today',
    label: 'TODAY',
    items: [
      {
        id: 'today',
        label: 'Today',
        href: '/',
        icon: 'today',
        isAvailable: true,
      },
      {
        id: 'focus',
        label: 'Focus Mode',
        href: '/focus',
        icon: 'focus',
        isAvailable: true,
      },
    ],
  },
  {
    id: 'capture',
    label: 'CAPTURE',
    items: [
      {
        id: 'inbox',
        label: 'Brain Dump',
        href: '/inbox',
        icon: 'inbox',
        isAvailable: true,
      },
    ],
  },
  {
    id: 'organize',
    label: 'ORGANIZE',
    items: [
      {
        id: 'goals',
        label: 'Goals',
        href: '/goals',
        icon: 'goals',
        isAvailable: true,
      },
      {
        id: 'milestones',
        label: 'Milestones',
        href: '/milestones',
        icon: 'milestones',
        isAvailable: true,
      },
      {
        id: 'projects',
        label: 'Projects',
        href: '/projects',
        icon: 'projects',
        isAvailable: true,
      },
      {
        id: 'tasks',
        label: 'Tasks',
        href: '/tasks',
        icon: 'tasks',
        isAvailable: true,
      },
    ],
  },
  {
    id: 'direction',
    label: 'DIRECTION',
    items: [
      {
        id: 'roadmap',
        label: 'Life Roadmap',
        href: '/roadmap',
        icon: 'roadmap',
        isAvailable: true,
      },
      {
        id: 'dreams',
        label: 'Dreams & Vision',
        href: '/dreams',
        icon: 'dreams',
        isAvailable: true,
      },
      {
        id: 'areas',
        label: 'Life Areas',
        href: '/areas',
        icon: 'areas',
        isAvailable: true,
      },
    ],
  },
  {
    id: 'more',
    label: 'MORE',
    items: [
      {
        id: 'calendar',
        label: 'Calendar',
        href: '/calendar',
        icon: 'calendar',
        isAvailable: true,
      },
      {
        id: 'progress',
        label: 'Progress & Review',
        href: '/progress',
        icon: 'progress',
        isAvailable: true,
      },
      {
        id: 'review',
        label: 'Weekly Review',
        href: '/review',
        icon: 'review',
        isAvailable: true,
      },
      {
        id: 'reset',
        label: 'Reset Plan',
        href: '/reset',
        icon: 'reset',
        isAvailable: true,
      },
      {
        id: 'habits',
        label: 'Habits',
        href: '/habits',
        icon: 'habits',
        isAvailable: true,
      },
      {
        id: 'workout',
        label: 'Workout',
        href: '/workout',
        icon: 'workout',
        isAvailable: true,
      },
      {
        id: 'knowledge',
        label: 'Knowledge',
        href: '/knowledge',
        icon: 'knowledge',
        isAvailable: true,
      },
      {
        id: 'files',
        label: 'Files',
        href: '/files',
        icon: 'files',
        isAvailable: true,
      },
      {
        id: 'settings',
        label: 'Settings',
        href: '/settings',
        icon: 'settings',
        isAvailable: true,
      },
    ],
  },
];