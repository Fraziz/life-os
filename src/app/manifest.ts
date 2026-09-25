import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Life OS — Personal Operating System',
    short_name: 'Life OS',
    description: 'Executive Personal Operating System for Tasks, Goals, Roadmap, Habits, and Focus.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a160f',
    theme_color: '#2d3748',
    orientation: 'portrait-primary',
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
        purpose: 'maskable',
      },
    ],
  };
}
