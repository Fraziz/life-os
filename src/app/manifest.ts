import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Sariling Mundo',
    short_name: 'Sariling Mundo',
    description: 'Executive Personal Operating System for Tasks, Goals, Roadmap, Habits, and Focus.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    background_color: '#f4f5f8',
    theme_color: '#f4f5f8',
    orientation: 'any',
    categories: ['productivity', 'lifestyle'],
    prefer_related_applications: false,
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Today',
        short_name: 'Today',
        description: 'Open Today dashboard and reminders',
        url: '/',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Daily Routine',
        short_name: 'Routine',
        description: 'Open Daily Routine checklist',
        url: '/routine',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Tasks',
        short_name: 'Tasks',
        description: 'Open Tasks manager',
        url: '/tasks',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Idea Parking',
        short_name: 'Inbox',
        description: 'Capture quick thoughts and reminders',
        url: '/inbox',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
