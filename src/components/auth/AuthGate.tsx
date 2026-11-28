'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from '@/context/AuthContext';
import { hydrateFromCloud, startCloudSync, stopCloudSync } from '@/lib/cloudStore';
import {
  DEFAULT_SYSTEM_CONFIG,
  readSystemConfig,
  subscribeSystemConfig,
  type SystemConfig,
} from '@/lib/systemConfig';
import { AttachmentProvider } from '@/context/AttachmentContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { startDeviceSessionTracking } from '@/lib/deviceSessions';
import statusStyles from '@/app/status.module.css';

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
  const [sysConfig, setSysConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [suspensionInfo, setSuspensionInfo] = useState<{ suspended: boolean; reason?: string } | null>(null);
  const [adminBypass, setAdminBypass] = useState<{ uid: string | null; checked: boolean; allowed: boolean }>({
    uid: null,
    checked: false,
    allowed: false,
  });
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  useEffect(() => {
    sessionMountedAt.current = Date.now();
    return subscribeSystemConfig((cfg) => {
      setSysConfig(cfg);
    });
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

  // Real-time account status enforcement (Admin Suspend / Restore)
  useEffect(() => {
    if (!user || isGuest) {
      setSuspensionInfo(null);
      return;
    }
    try {
      const userDocRef = doc(getFirebaseDb(), 'users', user.uid);
      const unsub = onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { accountStatus?: string; suspensionReason?: string };
          if (data?.accountStatus === 'suspended') {
            setSuspensionInfo({
              suspended: true,
              reason: data.suspensionReason || undefined,
            });
            void stopCloudSync({ flushWrites: false });
          } else {
            setSuspensionInfo(null);
          }
        } else {
          setSuspensionInfo(null);
        }
      });
      return () => unsub();
    } catch {
      // ignore offline failsafe
    }
  }, [user, isGuest]);

  // Verify admin bypass only when maintenanceMode or strict email verification is enabled
  useEffect(() => {
    const needsPolicyBypassCheck = Boolean(sysConfig.maintenanceMode || sysConfig.requireVerifiedEmail);
    if (!needsPolicyBypassCheck || !user || isGuest) {
      setAdminBypass({ uid: user?.uid || null, checked: true, allowed: false });
      return;
    }
    let active = true;
    setAdminBypass({ uid: user.uid, checked: false, allowed: false });
    (async () => {
      try {
        const fbUser = getFirebaseAuth().currentUser;
        const token = fbUser ? await fbUser.getIdToken() : null;
        if (!token) {
          if (active) setAdminBypass({ uid: user.uid, checked: true, allowed: false });
          return;
        }
        const resp = await fetch('/api/admin/session', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!resp.ok) {
          if (active) setAdminBypass({ uid: user.uid, checked: true, allowed: false });
          return;
        }
        const payload = (await resp.json()) as { authorized?: boolean };
        if (active) setAdminBypass({ uid: user.uid, checked: true, allowed: Boolean(payload?.authorized) });
      } catch {
        if (active) setAdminBypass({ uid: user.uid, checked: true, allowed: false });
      }
    })();
    return () => {
      active = false;
    };
  }, [sysConfig.maintenanceMode, sysConfig.requireVerifiedEmail, user, isGuest]);

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

  // Enforce account suspension set from Admin Console
  if (suspensionInfo?.suspended && !isPublicRoute) {
    return (
      <main className={statusStyles.wrap}>
        <section className={statusStyles.card}>
          <div className={statusStyles.kicker}>
            <span className={statusStyles.dot} aria-hidden="true" />
            <span>Access Restricted</span>
          </div>
          <h1 className={statusStyles.title}>Your account access is suspended</h1>
          <p className={statusStyles.desc}>
            {suspensionInfo.reason ||
              'Access to this workspace has been temporarily paused by an administrator.'}
          </p>
          <div className={statusStyles.actions}>
            <button
              type="button"
              className={statusStyles.primaryBtn}
              onClick={() => void logout()}
            >
              Sign Out
            </button>
          </div>
        </section>
      </main>
    );
  }

  const isAdminRoute = pathname === '/admin';
  const hasAdminBypass = adminBypass.uid === user.uid && adminBypass.checked && adminBypass.allowed;
  const checkingPolicyBypass =
    (sysConfig.maintenanceMode || sysConfig.requireVerifiedEmail) &&
    !isGuest &&
    !isAdminRoute &&
    !isPublicRoute &&
    (!adminBypass.checked || adminBypass.uid !== user.uid);

  if (checkingPolicyBypass) {
    return (
      <main className={statusStyles.wrap}>
        <section className={statusStyles.card}>
          <div className={statusStyles.kicker}>
            <span className={statusStyles.dot} aria-hidden="true" />
            <span>Verifying Platform Access</span>
          </div>
          <h1 className={statusStyles.title}>Checking workspace availability…</h1>
          <p className={statusStyles.desc}>Please wait a moment while active platform policies are verified.</p>
        </section>
      </main>
    );
  }

  // Enforce Scheduled Maintenance Mode (Admin Console and verified owner bypass cleanly)
  if (sysConfig.maintenanceMode && !isPublicRoute && !isAdminRoute && !hasAdminBypass) {
    return (
      <main className={statusStyles.wrap}>
        <section className={statusStyles.card}>
          <div className={statusStyles.kicker}>
            <span className={statusStyles.dot} aria-hidden="true" />
            <span>Scheduled Maintenance</span>
          </div>
          <h1 className={statusStyles.title}>Workspace is temporarily paused</h1>
          <p className={statusStyles.desc}>{sysConfig.maintenanceMessage}</p>
          <div className={statusStyles.actions}>
            <button
              type="button"
              className={statusStyles.primaryBtn}
              onClick={() => window.location.reload()}
            >
              Check Availability
            </button>
            <button
              type="button"
              className={statusStyles.secondaryBtn}
              onClick={() => void logout()}
            >
              Sign Out
            </button>
          </div>
        </section>
      </main>
    );
  }

  // Enforce verified email policy when enabled by Admin
  const isUnverifiedEmail =
    sysConfig.requireVerifiedEmail &&
    !isGuest &&
    !isPublicRoute &&
    !isAdminRoute &&
    !hasAdminBypass &&
    'emailVerified' in user &&
    !user.emailVerified;

  if (isUnverifiedEmail) {
    return (
      <main className={statusStyles.wrap}>
        <section className={statusStyles.card}>
          <div className={statusStyles.kicker}>
            <span className={statusStyles.dot} aria-hidden="true" />
            <span>Security Policy · Email Verification</span>
          </div>
          <h1 className={statusStyles.title}>Verify your email to continue</h1>
          <p className={statusStyles.desc}>
            Verified email addresses are currently required for cloud workspace access. Check the inbox for{' '}
            <strong>{user.email}</strong> or request a new link below.
          </p>
          {verifyNotice && <div className={statusStyles.digest}>{verifyNotice}</div>}
          <div className={statusStyles.actions}>
            <button
              type="button"
              className={statusStyles.primaryBtn}
              disabled={verifyBusy}
              onClick={async () => {
                setVerifyBusy(true);
                setVerifyNotice(null);
                try {
                  const fbUser = getFirebaseAuth().currentUser;
                  if (fbUser) {
                    await sendEmailVerification(fbUser);
                    setVerifyNotice('Verification email sent. Confirm the link, then click Refresh Status.');
                  }
                } catch (err: unknown) {
                  setVerifyNotice(
                    err instanceof Error ? err.message : 'Unable to resend verification email right now.'
                  );
                } finally {
                  setVerifyBusy(false);
                }
              }}
            >
              {verifyBusy ? 'Sending…' : 'Resend Verification Email'}
            </button>
            <button
              type="button"
              className={statusStyles.secondaryBtn}
              onClick={async () => {
                const fbUser = getFirebaseAuth().currentUser;
                if (fbUser) await fbUser.reload().catch(() => undefined);
                window.location.reload();
              }}
            >
              Refresh Status
            </button>
            <button
              type="button"
              className={statusStyles.secondaryBtn}
              onClick={() => void logout()}
            >
              Sign Out
            </button>
          </div>
        </section>
      </main>
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
