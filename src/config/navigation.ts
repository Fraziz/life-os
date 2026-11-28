import type { NavSection } from '@/types';

/**
 * Single source of truth for Sariling Mundo navigation.
 * Designed around cognitive clarity and low decision fatigue:
 *  1. Primary (always visible): Start, dump thoughts, manage tasks, focus.
 *  2. Life Management (collapsible, open by default): Calendar & Routines, Projects, Goals & Vision.
 *  3. More (collapsible, collapsed by default): Books & Lessons, Files, Weekly Review.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'primary',
    label: 'Primary',
    collapsible: false,
    hideHeader: true,
    items: [
      {
        id: 'today',
        label: 'Today',
        href: '/',
        icon: 'today',
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
        id: 'focus',
        label: 'Focus Mode',
        href: '/focus',
        icon: 'focus',
        isAvailable: true,
      },
    ],
  },
  {
    id: 'life-management',
    label: 'Life Management',
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id: 'calendar',
        label: 'Calendar & Routines',
        href: '/calendar',
        activePaths: ['/calendar', '/routine'],
        icon: 'calendar',
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
        id: 'goals',
        label: 'Goals & Vision',
        href: '/goals',
        activePaths: ['/goals', '/dreams'],
        icon: 'goals',
        isAvailable: true,
      },
    ],
  },
  {
    id: 'more',
    label: 'More',
    collapsible: true,
    defaultOpen: false,
    items: [
      {
        id: 'knowledge',
        label: 'Books & Lessons',
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
        id: 'review',
        label: 'Weekly Review',
        href: '/review',
        icon: 'review',
        isAvailable: true,
      },
    ],
  },
];
