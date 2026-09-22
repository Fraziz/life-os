import type { NavSection } from '@/types';

/**
 * Single source of truth for Life OS navigation.
 * Matches all ADHD-focused categories and item names exactly.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'daily',
    label: 'DAILY ACTION',
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
        label: 'Focus Space',
        href: '/focus',
        icon: 'focus',
        isAvailable: true,
      },
      {
        id: 'inbox',
        label: 'Brain Dump',
        href: '/inbox',
        icon: 'inbox',
        isAvailable: true,
      },
      {
        id: 'tasks',
        label: 'Tasks',
        href: '/tasks',
        icon: 'tasks',
        isAvailable: true,
      },
      {
        id: 'calendar',
        label: 'Calendar',
        href: '/calendar',
        icon: 'calendar',
        isAvailable: true,
      },
    ],
  },
  {
    id: 'planning',
    label: 'GOALS & PLANS',
    items: [
      {
        id: 'roadmap',
        label: 'Roadmap',
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
        id: 'goals',
        label: 'Goals',
        href: '/goals',
        icon: 'goals',
        isAvailable: true,
      },
      {
        id: 'projects',
        label: 'Projects',
        href: '/projects',
        icon: 'projects',
        isAvailable: true,
      },
    ],
  },
  {
    id: 'growth',
    label: 'KNOWLEDGE & HEALTH',
    items: [
      {
        id: 'knowledge',
        label: 'Knowledge Base',
        href: '/knowledge',
        icon: 'knowledge',
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
        id: 'areas',
        label: 'Life Areas',
        href: '/areas',
        icon: 'areas',
        isAvailable: true,
      },
      {
        id: 'files',
        label: 'Files',
        href: '/files',
        icon: 'files',
        isAvailable: true,
      },
    ],
  },
  {
    id: 'more',
    label: 'REVIEW',
    items: [
      {
        id: 'review',
        label: 'Weekly Review',
        href: '/review',
        icon: 'review',
        isAvailable: true,
      },
      {
        id: 'progress',
        label: 'Progress Analytics',
        href: '/progress',
        icon: 'progress',
        isAvailable: true,
      },
      {
        id: 'reset',
        label: 'Reset Plan',
        href: '/reset',
        icon: 'reset',
        isAvailable: true,
      },
    ],
  },
];