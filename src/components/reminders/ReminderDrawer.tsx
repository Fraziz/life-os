'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useReminders } from '@/context/ReminderContext';
import type { ReminderItem } from '@/types';
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
import AutoLinkText from '@/components/ui/AutoLinkText';

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bg: string; border: string }
> = {
  task: {
    label: 'Task Due',
    icon: <CheckSquare size={16} strokeWidth={2} />,
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.1)',
    border: 'rgba(59, 130, 246, 0.22)',
  },
  deadline: {
    label: 'Deadline',
    icon: <Target size={16} strokeWidth={2} />,
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.1)',
    border: 'rgba(239, 68, 68, 0.22)',
  },
  scheduled_work: {
    label: 'Focus Block',
    icon: <Calendar size={16} strokeWidth={2} />,
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.1)',
    border: 'rgba(139, 92, 246, 0.22)',
  },
  habit: {
    label: 'Daily Habit',
    icon: <Repeat size={16} strokeWidth={2} />,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.22)',
  },
  weekly_review: {
    label: 'Weekly Review',
    icon: <RefreshCw size={16} strokeWidth={2} />,
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.22)',
  },
  reminder: {
    label: 'System Alert',
    icon: <Bell size={16} strokeWidth={2} />,
    color: '#6366f1',
    bg: 'rgba(99, 102, 241, 0.1)',
    border: 'rgba(99, 102, 241, 0.22)',
  },
};

const PRIORITY_BADGES: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  urgent: {
    label: 'Critical',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.25)',
  },
  high: {
    label: 'High Priority',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.25)',
  },
  normal: {
    label: 'Scheduled',
    color: 'var(--color-text-muted)',
    bg: 'var(--color-surface-2)',
    border: 'var(--color-border-subtle)',
  },
  low: {
    label: 'Info',
    color: 'var(--color-text-faint)',
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
  } = useReminders();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'all' | 'urgent' | 'unread'>('all');

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

  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case 'urgent':
        return activeReminders.filter((r) => r.priority === 'urgent');
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
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Notifications Center"
    >
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* ── Meta-Style Formal Header ── */}
        <div className={styles.header}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerTitleGroup}>
              <div className={styles.bellIconBox}>
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className={styles.bellBadgeCount}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div>
                <div className={styles.titleRow}>
                  <h2 className={styles.title}>Notifications</h2>
                  {unreadCount > 0 ? (
                    <span className={styles.unreadPill}>{unreadCount} new</span>
                  ) : (
                    <span className={styles.caughtUpPill}>All caught up</span>
                  )}
                </div>
                <p className={styles.subtitle}>
                  System updates, schedule alerts, and upcoming project deadlines.
                </p>
              </div>
            </div>

            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close notifications panel"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Meta-Style Segment Filter Tabs ── */}
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
              className={`${styles.filterTab} ${activeTab === 'unread' ? styles.filterTabActive : ''}`}
              onClick={() => setActiveTab('unread')}
            >
              Unread <span>({unreadCount})</span>
            </button>
            {urgentCount > 0 && (
              <button
                type="button"
                className={`${styles.filterTab} ${activeTab === 'urgent' ? styles.filterTabActive : ''}`}
                onClick={() => setActiveTab('urgent')}
              >
                Critical <span>({urgentCount})</span>
              </button>
            )}
          </div>

          {/* ── Utility Toolbar ── */}
          <div className={styles.utilityToolbar}>
            <span className={styles.statusIndicator}>
              <span className={styles.statusDot} />
              {isQuietHourNow ? 'Quiet Hours' : 'Live Feed'}
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
                  <span>Mark all read</span>
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
                  <span>Clear read</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Quiet Hours Protocol Banner ── */}
        {isQuietHourNow && (
          <div className={styles.quietBanner}>
            <div className={styles.quietIconBox}>
              <Moon size={15} />
            </div>
            <div className={styles.quietText}>
              <strong>Quiet Hours Enforced</strong>
              <p>Auditory notifications are silenced. Notifications are logged silently here.</p>
            </div>
          </div>
        )}

        {/* ── Notifications Feed ── */}
        <div className={styles.list}>
          {filteredNotifications.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconCircle}>
                <ShieldCheck size={28} />
              </div>
              <h3 className={styles.emptyTitle}>You&apos;re all caught up</h3>
              <p className={styles.emptyDesc}>
                {activeTab === 'all'
                  ? 'No active notifications right now. Upcoming deadlines, overdue tasks, or schedule updates will appear here.'
                  : `No notifications match the "${activeTab}" filter.`}
              </p>
              <Link href="/settings" className={styles.settingsLink} onClick={onClose}>
                <Settings size={13} />
                <span>Notification Settings</span>
              </Link>
            </div>
          ) : (
            filteredNotifications.map((r) => {
              const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.reminder;
              const pBadge = PRIORITY_BADGES[r.priority] || PRIORITY_BADGES.normal;

              return (
                <article
                  key={r.id}
                  className={`${styles.item} ${!r.isRead ? styles.unreadItem : ''}`}
                  onClick={() => markAsRead(r.id)}
                >
                  {/* Left Category Avatar */}
                  <div
                    className={styles.itemAvatar}
                    style={{
                      color: cfg.color,
                      backgroundColor: cfg.bg,
                      borderColor: cfg.border,
                    }}
                  >
                    {cfg.icon}
                  </div>

                  {/* Main Content Body */}
                  <div className={styles.itemBody}>
                    <div className={styles.itemHeaderRow}>
                      <div className={styles.itemMetaLeft}>
                        <span className={styles.categoryLabel} style={{ color: cfg.color }}>
                          {cfg.label}
                        </span>
                        {r.timeStr && (
                          <span className={styles.timeTag}>
                            {r.timeStr}
                          </span>
                        )}
                        {r.priority === 'urgent' && (
                          <span
                            className={styles.priorityPill}
                            style={{
                              color: pBadge.color,
                              background: pBadge.bg,
                              borderColor: pBadge.border,
                            }}
                          >
                            {pBadge.label}
                          </span>
                        )}
                      </div>

                      {/* Meta Blue Unread Indicator Dot */}
                      {!r.isRead && (
                        <span className={styles.unreadDot} title="Unread notification" />
                      )}
                    </div>

                    <h4 className={styles.itemTitle}>
                      <AutoLinkText text={r.title} />
                    </h4>
                    <p className={styles.itemMsg}>
                      <AutoLinkText text={r.message} />
                    </p>

                    {/* Inline Actions */}
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
                          title="Snooze for 1 hour"
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
