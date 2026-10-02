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
    // CRITICAL: Start cloud sync FIRST so localStorage.setItem is patched
    // immediately. Any writes (task toggles, brain dumps) during hydration
    // will be captured and queued to Firebase.
    startCloudSync(user.uid);

    (async () => {
      try {
        await hydrateFromCloud(user.uid);
        if (!cancelled) setHydrateError(null);
      } catch (err) {
        if (!cancelled) {
          setHydrateError(err instanceof Error ? err.message : 'Cloud sync not ready.');
        }
      }
    })();

    return () => {
      cancelled = true;
      void stopCloudSync();
    };
  }, [user]);

  const [takingLong, setTakingLong] = useState(false);

  // Safety timer: if auth takes more than 2.5s, give user a direct responsive button
  useEffect(() => {
    const timer = setTimeout(() => {
      setTakingLong(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // If not logged in: only render children on /login page where no dashboard providers are needed
  if (!user) {
    if (pathname === '/login') {
      return <>{children}</>;
    }
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          background: '#0b0d17',
          color: 'rgba(255, 255, 255, 0.85)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '15px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.15)',
            borderTopColor: '#38bdf8',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `,
          }}
        />
        <div style={{ fontWeight: 500, letterSpacing: '0.01em' }}>
          Opening Sariling Mundo…
        </div>

        {takingLong && (
          <button
            type="button"
            onClick={() => router.replace('/login')}
            style={{
              marginTop: '8px',
              padding: '8px 20px',
              borderRadius: '999px',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
          >
            Taking longer than usual? Click to open Login →
          </button>
        )}
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
