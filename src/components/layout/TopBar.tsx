'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Compass, Search } from 'lucide-react';
import styles from './TopBar.module.css';

interface TopBarProps {
  pageTitle: string;
  onMenuToggle: () => void;
  onOpenNextAction?: () => void;
  onOpenSearch?: () => void;
  onOpenReminders?: () => void;
  unreadCount?: number;
}

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Small pulsing indicator showing cloud sync status */
function CloudSyncDot() {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const syncTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Show "Saving…" when cloudStore queues a write
    const onWriting = () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      setTimeout(() => {
        setStatus('syncing');
      }, 0);
    };

    // Show "Saved ✓" when Firebase batch commits complete
    const onSynced = () => {
      setTimeout(() => {
        setStatus('synced');
        // Fade back to idle after 3 seconds
        syncTimer.current = setTimeout(() => setStatus('idle'), 3000);
      }, 0);
    };

    window.addEventListener('life_os_writing', onWriting);
    window.addEventListener('life_os_cloud_synced', onSynced);

    return () => {
      window.removeEventListener('life_os_writing', onWriting);
      window.removeEventListener('life_os_cloud_synced', onSynced);
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  if (status === 'idle') return null;

  return (
    <span
      title={status === 'syncing' ? 'Saving to cloud…' : 'Saved to cloud ✓'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '11px',
        fontWeight: 500,
        color: status === 'syncing' ? 'var(--color-accent, #7c6aff)' : '#22c55e',
        opacity: status === 'synced' ? 0.85 : 1,
        transition: 'color 0.3s, opacity 0.3s',
        userSelect: 'none',
        letterSpacing: '0.02em',
      }}
      aria-live="polite"
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: status === 'syncing' ? 'var(--color-accent, #7c6aff)' : '#22c55e',
          display: 'inline-block',
          animation: status === 'syncing' ? 'pulse-ring 1.2s ease-in-out infinite' : 'none',
          boxShadow: status === 'syncing' ? '0 0 0 3px rgba(124,106,255,0.25)' : '0 0 0 3px rgba(34,197,94,0.25)',
        }}
      />
      {status === 'syncing' ? 'Saving…' : 'Saved ✓'}
    </span>
  );
}

export default function TopBar({
  pageTitle,
  onMenuToggle,
  onOpenNextAction,
  onOpenSearch,
  onOpenReminders,
  unreadCount = 0,
}: TopBarProps) {
  return (
    <header className={styles.topBar} role="banner">
      <div className={styles.leftGroup}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={onMenuToggle}
          aria-label="Open navigation menu"
          aria-haspopup="true"
        >
          <HamburgerIcon />
        </button>

        <span className={styles.pageTitle}>{pageTitle}</span>
      </div>

      <div className={styles.rightGroup} data-tour="topbar-actions">
        <CloudSyncDot />

        {onOpenSearch && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onOpenSearch}
            title="Search"
            aria-label="Search workspace"
          >
            <Search size={18} strokeWidth={1.9} />
          </button>
        )}

        {onOpenNextAction && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onOpenNextAction}
            title="What should I do right now?"
            aria-label="What to do"
            data-tour="topbar-compass"
          >
            <Compass size={18} strokeWidth={1.9} />
          </button>
        )}

        {onOpenReminders && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onOpenReminders}
            title="Notifications & Reminders"
            aria-label={`Notifications (${unreadCount} unread)`}
          >
            <Bell size={18} strokeWidth={1.9} />
            {unreadCount > 0 && (
              <span className={styles.badge}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
