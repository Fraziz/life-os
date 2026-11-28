import type { Metadata, Viewport } from 'next';
import AppShell from '@/components/layout/AppShell';
import SkipLink from '@/components/ui/SkipLink';
import PwaRegister from '@/components/pwa/PwaRegister';
import './globals.css';

// Force all pages to render dynamically (never pre-rendered at build time)
// This is required because pages use React Context providers available only at runtime
export const dynamic = 'force-dynamic';

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: 'Sariling Mundo — Personal Operating System',
    template: '%s | Sariling Mundo',
  },
  description:
    'A calm, ADHD-friendly personal workspace to clear your head, break down overwhelming tasks, and focus on one step at a time.',
  keywords: [
    'ADHD productivity',
    'personal workspace',
    'brain dump',
    'task breakdown',
    'daily routine',
    'focus timer',
    'goal planning',
  ],
  authors: [{ name: 'Sariling Mundo' }],
  creator: 'Sariling Mundo',
  openGraph: {
    type: 'website',
    siteName: 'Sariling Mundo',
    title: 'Sariling Mundo — Calm Personal Operating System',
    description:
      'Clear racing thoughts, shrink overwhelming tasks into tiny steps, and move forward without guilt.',
    images: [{ url: '/logo.png?v=3', width: 512, height: 512, alt: 'Sariling Mundo' }],
  },
  twitter: {
    card: 'summary',
    title: 'Sariling Mundo — Calm Personal Operating System',
    description:
      'Clear racing thoughts, shrink overwhelming tasks into tiny steps, and move forward without guilt.',
    images: ['/logo.png?v=3'],
  },
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

