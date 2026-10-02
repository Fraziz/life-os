'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useReminders } from '@/context/ReminderContext';
import {
  Bell,
  Moon,
  Clock,
  CheckCircle2,
  Calendar,
  Repeat,
  Target,
  CheckSquare,
  RefreshCw,
  X,
  ArrowRight,
  ShieldCheck,
  CheckCheck,
  Settings,
  Trash2,
} from 'lucide-react';
import styles from './ReminderDrawer.module.css';

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  task: {
    label: 'TASK DUE',
    icon: <CheckSquare size={13} />,
    color: 'var(--color-text)',
    bg: 'var(--color-surface-2)',
  },
  deadline: {
    label: 'DEADLINE',
    icon: <Target size={13} />,
    color: 'var(--color-text)',
    bg: 'var(--color-surface-2)',
  },
  scheduled_work: {
    label: 'FOCUS BLOCK',
    icon: <Calendar size={13} />,
    color: 'var(--color-text)',
    bg: 'var(--color-surface-2)',
  },
  habit: {
    label: 'DAILY HABIT',
    icon: <Repeat size={13} />,
    color: 'var(--color-text)',
    bg: 'var(--color-surface-2)',
  },
  weekly_review: {
    label: 'WEEKLY REVIEW',
    icon: <RefreshCw size={13} />,
    color: 'var(--color-text)',
    bg: 'var(--color-surface-2)',
  },
};

const PRIORITY_BADGES: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  urgent: {
    label: 'CRITICAL',
    color: 'var(--color-text)',
    bg: 'var(--color-surface-3)',
    border: 'var(--color-border)',
  },
  high: {
    label: 'HIGH PRIORITY',
    color: 'var(--color-text)',
    bg: 'var(--color-surface-2)',
    border: 'var(--color-border)',
  },
  normal: {
    label: 'SCHEDULED',
    color: 'var(--color-text-muted)',
    bg: 'var(--color-surface-2)',
    border: 'var(--color-border-subtle)',
  },
  low: {
    label: 'INFO',
    color: 'var(--color-text-muted)',
    bg: 'transparent',
    border: 'var(--color-border-subtle)',
  },
};

interface ReminderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReminderDrawer({ isOpen, onClose }: ReminderDrawerProps) {
  const {
    activeReminders,
    unreadCount,
    isQuietHourNow,
    markAsRead,
    markAllAsRead,
    dismissReminder,
    dismissAllRead,
    snoozeReminder,
    requestBrowserPermission,
  } = useReminders();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'all' | 'urgent' | 'actionable' | 'unread'>('all');

  // Handle ESC key to dismiss drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredReminders = useMemo(() => {
    switch (activeTab) {
      case 'urgent':
        return activeReminders.filter((r) => r.priority === 'urgent');
      case 'actionable':
        return activeReminders.filter(
          (r) => r.type === 'deadline' || r.type === 'task' || r.type === 'scheduled_work'
        );
      case 'unread':
        return activeReminders.filter((r) => !r.isRead);
      case 'all':
      default:
        return activeReminders;
    }
  }, [activeReminders, activeTab]);

  const urgentCount = useMemo(
    () => activeReminders.filter((r) => r.priority === 'urgent').length,
    [activeReminders]
  );
  const actionableCount = useMemo(
    () =>
      activeReminders.filter(
        (r) => r.type === 'deadline' || r.type === 'task' || r.type === 'scheduled_work'
      ).length,
    [activeReminders]
  );
  const readCount = useMemo(
    () => activeReminders.filter((r) => r.isRead).length,
    [activeReminders]
  );

  if (!isOpen) return null;

  const handleNavigate = (href?: string, id?: string) => {
    if (id) markAsRead(id);
    if (href) router.push(href);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Notifications Center">
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* Formal Header */}
        <div className={styles.header}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerTitleGroup}>
              <div className={styles.bellIconBox}>
                <Bell size={18} />
                {unreadCount > 0 && <span className={styles.bellPulseDot} />}
              </div>
              <div>
                <div className={styles.titleRow}>
                  <h2 className={styles.title}>Notifications</h2>
                  {unreadCount > 0 && (
                    <span className={styles.unreadPill}>{unreadCount} New</span>
                  )}
                </div>
                <p className={styles.subtitle}>
                  System briefings, upcoming deadlines, and scheduled focus sessions.
                </p>
              </div>
            </div>

            <button className={styles.closeBtn} onClick={onClose} aria-label="Close notification center">
              <X size={18} />
            </button>
          </div>

          {/* Quick Filter Tabs */}
          <div className={styles.filterTabsRow}>
            <button
              type="button"
              className={`${styles.filterTab} ${activeTab === 'all' ? styles.filterTabActive : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All <span>({activeReminders.length})</span>
            </button>
            <button
              type="button"
              className={`${styles.filterTab} ${activeTab === 'urgent' ? styles.filterTabActive : ''}`}
              onClick={() => setActiveTab('urgent')}
            >
              Critical <span>({urgentCount})</span>
            </button>
            <button
              type="button"
              className={`${styles.filterTab} ${activeTab === 'actionable' ? styles.filterTabActive : ''}`}
              onClick={() => setActiveTab('actionable')}
            >
              Actionable <span>({actionableCount})</span>
            </button>
            <button
              type="button"
              className={`${styles.filterTab} ${activeTab === 'unread' ? styles.filterTabActive : ''}`}
              onClick={() => setActiveTab('unread')}
            >
              Unread <span>({unreadCount})</span>
            </button>
          </div>

          {/* Utility Toolbar */}
          <div className={styles.utilityToolbar}>
            <span className={styles.statusIndicator}>
              <span className={styles.statusDot} />
              {isQuietHourNow ? 'Quiet Hours Protocol' : 'Live Sync Active'}
            </span>

            <div className={styles.utilityActions}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className={styles.btnActionSecondary}
                  onClick={markAllAsRead}
                  title="Mark all notifications as read"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              {readCount > 0 && (
                <button
                  type="button"
                  className={styles.btnActionSecondary}
                  onClick={dismissAllRead}
                  title="Clear acknowledged and read notifications"
                >
                  <Trash2 size={12} />
                  Clear read
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quiet Hours Protocol Banner */}
        {isQuietHourNow && (
          <div className={styles.quietBanner}>
            <div className={styles.quietIconBox}>
              <Moon size={15} />
            </div>
            <div className={styles.quietText}>
              <strong>Quiet Hours Enforced</strong>
              <p>Auditory chimes and desktop interrupts are muted. Notifications are logged silently here.</p>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className={styles.list}>
          {filteredReminders.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconCircle}>
                <ShieldCheck size={32} />
              </div>
              <h3 className={styles.emptyTitle}>All Notifications Resolved</h3>
              <p className={styles.emptyDesc}>
                {activeTab === 'all'
                  ? 'Your schedule is clear. No pending deadlines, missed habits, or overdue tasks require attention.'
                  : `No notifications match the "${activeTab}" filter.`}
              </p>
              <Link href="/settings" className={styles.settingsLink} onClick={onClose}>
                <Settings size={13} />
                <span>Configure Notification Preferences</span>
              </Link>
            </div>
          ) : (
            filteredReminders.map((r) => {
              const cfg = TYPE_CONFIG[r.type] || {
                label: 'NOTIFICATION',
                icon: <Clock size={13} />,
                color: '#6366f1',
                bg: 'rgba(99, 102, 241, 0.1)',
              };
              const pBadge = PRIORITY_BADGES[r.priority] || PRIORITY_BADGES.normal;

              return (
                <article
                  key={r.id}
                  className={`${styles.item} ${!r.isRead ? styles.unreadItem : ''} ${
                    r.priority === 'urgent' ? styles.urgentItem : ''
                  }`}
                  onClick={() => markAsRead(r.id)}
                >
                  {/* Card Meta Header */}
                  <div className={styles.cardMetaRow}>
                    <div className={styles.categoryBadge} style={{ color: cfg.color, background: cfg.bg }}>
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </div>

                    <div className={styles.metaRight}>
                      {r.priority === 'urgent' && (
                        <span
                          className={styles.priorityPill}
                          style={{ color: pBadge.color, background: pBadge.bg, borderColor: pBadge.border }}
                        >
                          {pBadge.label}
                        </span>
                      )}
                      {r.timeStr && <span className={styles.timeTag}>{r.timeStr}</span>}
                      {!r.isRead && <span className={styles.unreadDot} title="Unread notification" />}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className={styles.cardContent}>
                    <h4 className={styles.itemTitle}>{r.title}</h4>
                    <p className={styles.itemMsg}>{r.message}</p>
                  </div>

                  {/* Formal Actions Footer */}
                  <div className={styles.itemActions}>
                    {r.href ? (
                      <button
                        type="button"
                        className={styles.actionBtnPrimary}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigate(r.href, r.id);
                        }}
                      >
                        <span>Open &amp; Review</span>
                        <ArrowRight size={13} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.actionBtnPrimary}
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(r.id);
                        }}
                      >
                        <CheckCircle2 size={13} />
                        <span>Acknowledge</span>
                      </button>
                    )}

                    <div className={styles.itemSecondaryActions}>
                      <button
                        type="button"
                        className={styles.actionBtnSecondary}
                        onClick={(e) => {
                          e.stopPropagation();
                          snoozeReminder(r.id, 60);
                        }}
                        title="Snooze alert for 1 hour"
                      >
                        <Clock size={12} />
                        <span>Snooze 1h</span>
                      </button>

                      <button
                        type="button"
                        className={styles.dismissBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissReminder(r.id);
                        }}
                        title="Dismiss notification"
                        aria-label="Dismiss notification"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
