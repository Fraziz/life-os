'use client';

import React, { useEffect, useState } from 'react';
import { Monitor, Smartphone, Tablet, ChevronDown } from 'lucide-react';
import {
  ACTIVE_NOW_WINDOW_MS,
  formatLastActive,
  getDeviceId,
  revokeDeviceSession,
  subscribeDeviceSessions,
  type DeviceSession,
} from '@/lib/deviceSessions';
import styles from './ActiveDevices.module.css';
import { useConfirm } from '@/context/ConfirmContext';

interface ActiveDevicesProps {
  uid: string;
}

const DEVICE_ICONS = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
} as const;

function formatSignedIn(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ActiveDevices({ uid }: ActiveDevicesProps) {
  const { confirm: confirmDialog } = useConfirm();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [currentId] = useState(() => getDeviceId());
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('life_os_devices_expanded');
      return saved !== null ? saved === 'true' : false;
    }
    return false;
  });

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('life_os_devices_expanded', String(next));
      }
      return next;
    });
  };

  useEffect(() => {
    const unsub = subscribeDeviceSessions(
      uid,
      (list) => {
        setSessions(list);
        setError(null);
      },
      () => setError('Could not load your devices. Check your connection and try again.')
    );
    return () => unsub();
  }, [uid]);

  // Refresh relative times ("3 min ago") every 30s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const handleRevoke = async (s: DeviceSession) => {
    const label = `${s.browser} on ${s.model || s.os}`;
    if (!(await confirmDialog({ title: 'Sign Out Device', message: `Sign out ${label}? That device will be logged out immediately.`, confirmLabel: 'Sign Out' }))) return;
    setRevoking(s.deviceId);
    try {
      await revokeDeviceSession(uid, s.deviceId);
    } catch {
      setError('Could not sign out that device. Please try again.');
    } finally {
      setRevoking(null);
    }
  };

  // Current device first, then most recently active
  const ordered = sessions
    ? [...sessions].sort((a, b) => {
        if (a.deviceId === currentId) return -1;
        if (b.deviceId === currentId) return 1;
        return (b.lastActive || 0) - (a.lastActive || 0);
      })
    : null;

  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.headerBtn}
        onClick={toggleExpand}
        aria-expanded={isExpanded}
        title={isExpanded ? 'Collapse active devices' : 'Expand active devices'}
      >
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>Active Sessions &amp; Devices</span>
          <span className={styles.headerDesc}>
            Devices currently signed in to your account. Sign out any device you don&apos;t recognize.
          </span>
        </div>

        <div className={styles.headerRight}>
          {ordered !== null ? (
            <span className={styles.countBadge}>
              {ordered.length} {ordered.length === 1 ? 'device' : 'devices'}
            </span>
          ) : (
            <span className={styles.countBadge}>Loading...</span>
          )}
          <span className={styles.collapseLabel}>
            {isExpanded ? 'Collapse' : 'Expand'}
          </span>
          <ChevronDown
            size={16}
            className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className={styles.body}>
          {error && !ordered ? (
            <div className={styles.message}>{error}</div>
          ) : !ordered ? (
            <ul className={styles.list} aria-busy="true">
              {[0, 1].map((i) => (
                <li key={i} className={`${styles.row} ${styles.skeleton}`}>
                  <span className={styles.iconBox} />
                  <span className={styles.skelLines}>
                    <span className={styles.skelLine} />
                    <span className={`${styles.skelLine} ${styles.skelShort}`} />
                  </span>
                </li>
              ))}
            </ul>
          ) : ordered.length === 0 ? (
            <div className={styles.message}>No signed-in devices found yet.</div>
          ) : (
            <>
              <ul className={styles.list}>
                {ordered.map((s) => {
                  const isCurrent = s.deviceId === currentId;
                  const Icon = DEVICE_ICONS[s.deviceType] || Monitor;
                  const activeNow = isCurrent || now - (s.lastActive || 0) < ACTIVE_NOW_WINDOW_MS;
                  const title = s.model ? `${s.model} · ${s.os}` : s.os;

                  return (
                    <li key={s.deviceId} className={`${styles.row} ${isCurrent ? styles.current : ''}`}>
                      <span className={styles.iconBox} aria-hidden="true">
                        <Icon size={18} strokeWidth={1.7} />
                      </span>

                      <div className={styles.info}>
                        <div className={styles.titleRow}>
                          <span className={styles.title}>{title}</span>
                          {isCurrent && <span className={styles.badge}>This device</span>}
                        </div>
                        <div className={styles.meta}>
                          <span>{s.browser}</span>
                          {s.location && (
                            <>
                              <span className={styles.dot} aria-hidden="true">·</span>
                              <span>{s.location}</span>
                            </>
                          )}
                          <span className={styles.dot} aria-hidden="true">·</span>
                          <span className={activeNow ? styles.activeNow : undefined}>
                            {activeNow && <span className={styles.pulse} aria-hidden="true" />}
                            {isCurrent ? 'Active now' : formatLastActive(s.lastActive, now)}
                          </span>
                        </div>
                        {s.signedInAt > 0 && (
                          <div className={styles.signedIn}>Signed in {formatSignedIn(s.signedInAt)}</div>
                        )}
                      </div>

                      {!isCurrent && (
                        <button
                          type="button"
                          className={styles.revokeBtn}
                          onClick={() => handleRevoke(s)}
                          disabled={revoking === s.deviceId}
                          id={`revoke-device-${s.deviceId}`}
                        >
                          {revoking === s.deviceId ? 'Signing out…' : 'Sign out'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {error && <div className={styles.message}>{error}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
