'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { hydrateFromCloud, startCloudSync, stopCloudSync } from '@/lib/cloudStore';
import { AttachmentProvider } from '@/context/AttachmentContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { startDeviceSessionTracking } from '@/lib/deviceSessions';

export default function AuthGate({
  children,
  shell,
}: {
  children: React.ReactNode;
  shell: (content: React.ReactNode) => React.ReactNode;
}) {
  const { user, ready, cloudWarning, logout, isGuest, continueAsGuest } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const syncStarted = useRef(false);
  const sessionMountedAt = useRef(Date.now());

  const isAuthRoute = pathname === '/login' || pathname === '/register';

  // Redirect once auth state is known
  useEffect(() => {
    if (!ready) return;
    if (!user && !isAuthRoute) {
      router.replace('/login');
    }
    if (user && isAuthRoute) {
      router.replace('/');
    }
  }, [ready, user, isAuthRoute, router]);

  // Session revocation listener (for "Log out of all devices" - Firebase users only)
  useEffect(() => {
    if (!user || isGuest) return;
    try {
      const sessionDocRef = doc(getFirebaseDb(), 'users', user.uid, 'meta', 'session');
      const unsub = onSnapshot(sessionDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const lastRevocation = Number(data?.lastRevocation) || 0;
          if (lastRevocation > sessionMountedAt.current) {
            console.warn('[LifeOS] Session was revoked from another device. Logging out...');
            void logout();
          }
        }
      });
      return () => unsub();
    } catch {
      // offline/firestore failsafe
    }
  }, [user, isGuest, logout]);

  // Per-device session record (shown in Settings → Active Sessions & Devices - Firebase users only)
  useEffect(() => {
    if (!user || isGuest) return;
    return startDeviceSessionTracking(user.uid, () => {
      console.warn('[SarilingMundo] This device was signed out from another device.');
      void logout();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isGuest]);

  // Cloud sync in background - NEVER blocks rendering - Firebase users only
  useEffect(() => {
    if (!user || isGuest) {
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
  }, [user, isGuest]);

  const [takingLong, setTakingLong] = useState(false);

  // Safety timer: if auth takes more than 1 second, give user responsive bypass buttons
  useEffect(() => {
    const timer = setTimeout(() => {
      setTakingLong(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // If not logged in: render children on auth pages (/login and /register)
  if (!user) {
    if (isAuthRoute) {
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
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              style={{
                padding: '8px 18px',
                borderRadius: '999px',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Sign In →
            </button>
            <button
              type="button"
              onClick={continueAsGuest}
              style={{
                padding: '8px 18px',
                borderRadius: '999px',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Continue in Local Mode
            </button>
          </div>
        )}
      </div>
    );
  }

  // Logged in: render shell immediately, sync happens in background
  return (
    <AttachmentProvider>
      {shell(
        <>
          {(cloudWarning || hydrateError) && !isGuest && (
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
