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
    default: 'Life OS — Turn Dreams Into Action',
    template: '%s | Life OS',
  },
  description:
    'Life OS helps you transform your dreams and ambitions into realistic goals, projects, tasks, and daily actions.',
  keywords: ['goal setting', 'productivity', 'life planning', 'habits', 'focus', 'task management'],
  authors: [{ name: 'Life OS' }],
  creator: 'Life OS',
  robots: 'noindex, nofollow',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Life OS',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
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
    <html lang="en">
      <body>
        {/* PWA Service Worker Registration */}
        <PwaRegister />

        {/* Skip to main content — accessibility */}
        <SkipLink />

        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

