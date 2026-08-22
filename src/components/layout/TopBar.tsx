'use client';

import React from 'react';
import Logo from '@/components/ui/Logo';
import { useReminders } from '@/context/ReminderContext';
import { Bell, Compass, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './TopBar.module.css';

interface TopBarProps {
  pageTitle: string;
  onMenuToggle: () => void;
  onOpenReminders?: () => void;
  onOpenNextAction?: () => void;
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

export default function TopBar({
  pageTitle,
  onMenuToggle,
  onOpenReminders,
  onOpenNextAction,
}: TopBarProps) {
  const { unreadCount } = useReminders();
  const { logout } = useAuth();

  return (
    <header className={styles.topBar} role="banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className={styles.menuButton}
          onClick={onMenuToggle}
          aria-label="Open navigation menu"
          aria-haspopup="true"
        >
          <HamburgerIcon />
        </button>

        <span className={styles.pageTitle}>{pageTitle}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {onOpenNextAction && (
          <button
            className={styles.iconBtn}
            onClick={onOpenNextAction}
            title="What should I do right now?"
            aria-label="What to do"
          >
            <Compass size={18} />
          </button>
        )}

        {onOpenReminders && (
          <button
            className={styles.iconBtn}
            onClick={onOpenReminders}
            title="Reminders & Alerts"
            aria-label="Reminders"
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
          </button>
        )}

        <button
          className={styles.iconBtn}
          onClick={() => void logout()}
          title="Log out"
          aria-label="Log out"
        >
          <LogOut size={18} />
        </button>

        <Logo iconOnly size={26} />
      </div>
    </header>
  );
}
