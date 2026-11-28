'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { hydrateFromCloud, startCloudSync, stopCloudSync } from '@/lib/cloudStore';
import { readSystemConfig } from '@/lib/systemConfig';
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
  const lastSyncedUid = useRef<string | null>(null);
  const sessionMountedAt = useRef(0);

  useEffect(() => {
    sessionMountedAt.current = Date.now();
  }, []);

  const isAuthOnlyRoute = pathname === '/login' || pathname === '/register';
  const isLegalRoute = pathname === '/privacy' || pathname === '/terms';
  const isPublicRoute = isAuthOnlyRoute || isLegalRoute;

  // Redirect once auth state is known
  useEffect(() => {
    if (!ready) return;
    if (!user && !isPublicRoute) {
      router.replace('/login');
    }
    if (user && isAuthOnlyRoute) {
      router.replace('/');
    }
  }, [ready, user, isPublicRoute, isAuthOnlyRoute, router]);

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

  // Ask browser/OS to keep IndexedDB & local storage persistent under storage pressure
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => false);
    }
  }, []);

  const activeAuthUid = user && !isGuest ? user.uid : null;

  // Cloud sync in background - NEVER blocks rendering - Firebase users only
  useEffect(() => {
    if (!activeAuthUid) {
      lastSyncedUid.current = null;
      if (isGuest && typeof window !== 'undefined') {
        (window as Window & {
          sarilingDesktop?: { notifyWorkspaceReady?: () => void };
        }).sarilingDesktop?.notifyWorkspaceReady?.();
      }
      return;
    }
    if (lastSyncedUid.current === activeAuthUid) return;
    lastSyncedUid.current = activeAuthUid;

    let cancelled = false;

    (async () => {
      try {
        // Hydrate from Firestore first so mount-time defaults do not race ahead of existing cloud data
        await hydrateFromCloud(activeAuthUid);
        if (cancelled) return;
        startCloudSync(activeAuthUid);
        setHydrateError(null);
      } catch (err) {
        if (!cancelled) {
          startCloudSync(activeAuthUid);
          setHydrateError(err instanceof Error ? err.message : 'Cloud sync not ready.');
        }
      }
    })();

    return () => {
      cancelled = true;
      lastSyncedUid.current = null;
      void stopCloudSync();
    };
  }, [activeAuthUid, isGuest]);

  const [takingLong, setTakingLong] = useState(false);
  const [allowGuestMode, setAllowGuestMode] = useState(true);

  // Safety timer: if auth takes more than 1 second, give user responsive bypass buttons
  useEffect(() => {
    const timer = setTimeout(() => {
      setTakingLong(true);
      void readSystemConfig().then((cfg) => {
        setAllowGuestMode(cfg.allowGuestMode);
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // If not logged in: render children on public pages (/login, /register, /privacy, /terms)
  if (!user) {
    if (isPublicRoute) {
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
          background: 'var(--color-bg, #f4f5f8)',
          color: 'var(--color-text, #0d0f14)',
          fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
          fontSize: '15px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '3px solid var(--color-border, #d0d4df)',
            borderTopColor: 'var(--color-accent, #0d0f14)',
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
        <div style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
          Opening Sariling Mundo…
        </div>

        {takingLong && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              style={{
                minHeight: '44px',
                padding: '0 18px',
                borderRadius: '10px',
                border: '1px solid var(--color-border, #d0d4df)',
                background: 'var(--color-surface, #ffffff)',
                color: 'var(--color-text, #0d0f14)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign In
            </button>
            {allowGuestMode && (
              <button
                type="button"
                onClick={continueAsGuest}
                style={{
                  minHeight: '44px',
                  padding: '0 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-accent, #0d0f14)',
                  background: 'var(--color-surface-2, #eaedf2)',
                  color: 'var(--color-text, #0d0f14)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Continue in Local Mode
              </button>
            )}
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
