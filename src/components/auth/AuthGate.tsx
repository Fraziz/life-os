'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { hydrateFromCloud, startCloudSync, stopCloudSync } from '@/lib/cloudStore';
import { AttachmentProvider } from '@/context/AttachmentContext';

export default function AuthGate({
  children,
  shell,
}: {
  children: React.ReactNode;
  shell: (content: React.ReactNode) => React.ReactNode;
}) {
  const { user, ready, cloudWarning } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const syncStarted = useRef(false);

  // Redirect once auth state is known
  useEffect(() => {
    if (!ready) return;
    if (!user && pathname !== '/login') {
      router.replace('/login');
    }
    if (user && pathname === '/login') {
      router.replace('/');
    }
  }, [ready, user, pathname, router]);

  // Cloud sync in background - NEVER blocks rendering
  useEffect(() => {
    if (!user) {
      syncStarted.current = false;
      return;
    }
    if (syncStarted.current) return;
    syncStarted.current = true;

    let cancelled = false;
    (async () => {
      try {
        await hydrateFromCloud(user.uid);
        if (!cancelled) setHydrateError(null);
      } catch (err) {
        if (!cancelled) {
          setHydrateError(err instanceof Error ? err.message : 'Cloud sync not ready.');
        }
      } finally {
        if (!cancelled) startCloudSync(user.uid);
      }
    })();

    return () => {
      cancelled = true;
      void stopCloudSync();
    };
  }, [user]);

  // If not logged in: only render children on /login page where no dashboard providers are needed
  if (!user) {
    if (pathname === '/login') {
      return <>{children}</>;
    }
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0b0d17',
          color: 'rgba(255, 255, 255, 0.7)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '15px',
        }}
      >
        Opening Life OS…
      </div>
    );
  }

  // Logged in: render shell immediately, sync happens in background
  return (
    <AttachmentProvider>
      {shell(
        <>
          {(cloudWarning || hydrateError) && (
            <div style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 12, background: 'var(--color-warning-dim)', color: 'var(--color-warning)', fontSize: 13, lineHeight: 1.4 }}>
              {hydrateError || cloudWarning}
            </div>
          )}
          {children}
        </>
      )}
    </AttachmentProvider>
  );
}
