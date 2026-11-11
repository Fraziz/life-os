import type { Metadata, Viewport } from 'next';
import AppShell from '@/components/layout/AppShell';
import SkipLink from '@/components/ui/SkipLink';
import PwaRegister from '@/components/pwa/PwaRegister';
import './globals.css';

// Force all pages to render dynamically (never pre-rendered at build time)
// This is required because pages use React Context providers available only at runtime
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'Sariling Mundo — Turn Dreams Into Action',
    template: '%s | Sariling Mundo',
  },
  description:
    'Sariling Mundo helps you transform your dreams and ambitions into realistic goals, projects, tasks, and daily actions.',
  keywords: ['goal setting', 'productivity', 'life planning', 'habits', 'focus', 'task management'],
  authors: [{ name: 'Sariling Mundo' }],
  creator: 'Sariling Mundo',
  robots: 'noindex, nofollow',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sariling Mundo',
  },
  icons: {
    icon: [
      { url: '/icon.svg?v=2', type: 'image/svg+xml' },
      { url: '/favicon.ico?v=2', sizes: 'any' },
      { url: '/favicon-32x32.png?v=2', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png?v=2', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png?v=2',
    shortcut: '/icon.svg?v=2',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#12141a',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body suppressHydrationWarning>
        {/* PWA Service Worker Registration */}
        <PwaRegister />

        {/* Skip to main content — accessibility */}
        <SkipLink />

        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

