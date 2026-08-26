import type { Metadata, Viewport } from 'next';
import AppShell from '@/components/layout/AppShell';
import SkipLink from '@/components/ui/SkipLink';
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
    'Life OS helps you transform your dreams and ambitions into realistic goals, projects, tasks, and daily actions. Your ADHD-friendly personal operating system for life.',
  keywords: ['goal setting', 'productivity', 'life planning', 'habits', 'focus', 'task management', 'adhd'],
  authors: [{ name: 'Life OS' }],
  creator: 'Life OS',
  robots: 'noindex, nofollow', // Private app — not for search indexing
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0d17',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        {/* Skip to main content — accessibility (Client Component for event handlers) */}
        <SkipLink />

        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
