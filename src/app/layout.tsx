import type { Metadata, Viewport } from 'next';
import AppShell from '@/components/layout/AppShell';
import SkipLink from '@/components/ui/SkipLink';
import PwaRegister from '@/components/pwa/PwaRegister';
import './globals.css';

// Force all pages to render dynamically (never pre-rendered at build time)
// This is required because pages use React Context providers available only at runtime
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sariling Mundo',
  description:
    'Sariling Mundo helps you transform your dreams and ambitions into realistic goals, projects, tasks, and daily actions.',
  keywords: ['goal setting', 'productivity', 'life planning', 'habits', 'focus', 'task management'],
  authors: [{ name: 'Sariling Mundo' }],
  creator: 'Sariling Mundo',
  robots: 'noindex, nofollow',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sariling Mundo',
  },
  icons: {
    icon: [
      { url: '/logo.png?v=3', type: 'image/png', sizes: '512x512' },
      { url: '/favicon-32x32.png?v=3', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png?v=3', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico?v=3', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png?v=3',
    shortcut: '/favicon-32x32.png?v=3',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f4f5f8',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
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

