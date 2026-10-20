'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useReminders } from '@/context/ReminderContext';
import { useTasks } from '@/context/TaskContext';
import { useKnowledge } from '@/context/KnowledgeContext';
import { useInbox } from '@/context/InboxContext';
import { useProjects } from '@/context/ProjectContext';
import { isDocVideoLesson } from '@/utils/videoLesson';
import { playSuccessChime, triggerDopamineBurst } from '@/utils/soundAndDopamine';
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
  BookOpen,
  Video,
  Lightbulb,
  Folder,
  Check,
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

interface UnifiedUserReminder {
  id: string;
  type: 'book' | 'video' | 'task' | 'idea' | 'project';
  typeLabel: string;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  onFinish?: () => void;
  onClearReminder: () => void;
}

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

  const { tasks, toggleTaskDone, toggleTaskReminder } = useTasks();
  const { docs, toggleDocReminder } = useKnowledge();
  const { activeReminders: inboxReminders, toggleItemApplied, toggleItemReminder } = useInbox();
  const { activeProjects, toggleProjectReminder } = useProjects();

  const [activeTab, setActiveTab] = useState<'all' | 'reminders' | 'urgent' | 'unread'>('all');

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

  // Aggregate user reminders across all 5 areas (Books, Videos, Tasks, Ideas, Projects)
  const userReminders = useMemo<UnifiedUserReminder[]>(() => {
    const list: UnifiedUserReminder[] = [];

    // 1. Tasks
    tasks
      .filter((t) => t.isReminder && t.status !== 'done')
      .forEach((t) => {
        list.push({
          id: t.id,
          type: 'task',
          typeLabel: 'Task',
          title: t.title,
          subtitle: t.dueDate ? `Due ${t.dueDate}` : t.priority ? `${t.priority.toUpperCase()} priority` : 'Marked important to finish',
          href: '/tasks',
          icon: <CheckSquare size={16} strokeWidth={2} />,
          color: '#10b981',
          bg: 'rgba(16, 185, 129, 0.1)',
          border: 'rgba(16, 185, 129, 0.22)',
          onFinish: () => toggleTaskDone(t.id),
          onClearReminder: () => toggleTaskReminder(t.id),
        });
      });

    // 2. Books & Videos
    docs
      .filter((d) => d.isReminder && d.status !== 'archived')
      .forEach((d) => {
        const isVideo = isDocVideoLesson(d);
        list.push({
          id: d.id,
          type: isVideo ? 'video' : 'book',
          typeLabel: isVideo ? 'Video Lesson' : 'Book',
          title: d.title,
          subtitle: isVideo ? 'Video Lesson study target' : (d.category ? `${d.category} reading` : 'Reading material'),
          href: isVideo ? '/focus' : '/knowledge',
          icon: isVideo ? <Video size={16} strokeWidth={2} /> : <BookOpen size={16} strokeWidth={2} />,
          color: isVideo ? '#38bdf8' : '#a594ff',
          bg: isVideo ? 'rgba(56, 189, 248, 0.1)' : 'rgba(165, 148, 255, 0.1)',
          border: isVideo ? 'rgba(56, 189, 248, 0.22)' : 'rgba(165, 148, 255, 0.22)',
          onClearReminder: () => toggleDocReminder(d.id),
        });
      });

    // 3. Idea Parking thoughts
    (inboxReminders || [])
      .filter((r) => !r.isApplied && r.status === 'inbox')
      .forEach((r) => {
        list.push({
          id: r.id,
          type: 'idea',
          typeLabel: 'Idea Parking',
          title: r.content,
          subtitle: r.reminderTime ? `Reminder time: ${r.reminderTime}` : 'Parked thought to finish',
          href: '/inbox',
          icon: <Lightbulb size={16} strokeWidth={2} />,
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.1)',
          border: 'rgba(245, 158, 11, 0.22)',
          onFinish: () => toggleItemApplied(r.id),
          onClearReminder: () => toggleItemReminder(r.id),
        });
      });

    // 4. Projects
    (activeProjects || [])
      .filter((p) => p.isReminder && p.status !== 'completed')
      .forEach((p) => {
        list.push({
          id: p.id,
          type: 'project',
          typeLabel: 'Project',
          title: p.title,
          subtitle: `${p.progress}% progress • ${p.priority} priority`,
          href: '/projects',
          icon: <Folder size={16} strokeWidth={2} />,
          color: '#c084fc',
          bg: 'rgba(168, 85, 247, 0.1)',
          border: 'rgba(168, 85, 247, 0.22)',
          onClearReminder: () => toggleProjectReminder(p.id),
        });
      });

    return list;
  }, [tasks, docs, inboxReminders, activeProjects, toggleTaskDone, toggleTaskReminder, toggleDocReminder, toggleItemApplied, toggleItemReminder, toggleProjectReminder]);

  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case 'urgent':
        return activeReminders.filter((r) => r.priority === 'urgent');
      case 'unread':
        return activeReminders.filter((r) => !r.isRead);
      case 'reminders':
        return [];
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

  const totalActiveBadge = unreadCount + userReminders.length;

  if (!isOpen) return null;

  const handleNavigate = (href?: string, id?: string) => {
    if (id) markAsRead(id);
    if (href) router.push(href);
    onClose();
  };

  const renderUserReminderItem = (rem: UnifiedUserReminder) => (
    <article
      key={`user-rem-${rem.type}-${rem.id}`}
      className={styles.item}
      onClick={() => handleNavigate(rem.href)}
    >
      {/* Category Avatar */}
      <div
        className={styles.itemAvatar}
        style={{
          color: rem.color,
          backgroundColor: rem.bg,
          borderColor: rem.border,
        }}
      >
        {rem.icon}
      </div>

      {/* Main Content Body */}
      <div className={styles.itemBody}>
        <div className={styles.itemHeaderRow}>
          <div className={styles.itemMetaLeft}>
            <span className={styles.categoryLabel} style={{ color: rem.color }}>
              {rem.typeLabel}
            </span>
            <span
              className={styles.priorityPill}
              style={{
                color: 'var(--color-warning, #f59e0b)',
                background: 'rgba(245, 158, 11, 0.12)',
                borderColor: 'rgba(245, 158, 11, 0.3)',
              }}
            >
              Important to finish
            </span>
          </div>
        </div>

        <h4 className={styles.itemTitle}>
          <AutoLinkText text={rem.title} />
        </h4>
        <p className={styles.itemMsg}>
          <AutoLinkText text={rem.subtitle} />
        </p>

        {/* Inline Actions */}
        <div className={styles.itemActions}>
          <button
            type="button"
            className={styles.actionBtnPrimary}
            onClick={(e) => {
              e.stopPropagation();
              handleNavigate(rem.href);
            }}
          >
            <span>Open {rem.typeLabel}</span>
            <ArrowRight size={13} />
          </button>

          <div className={styles.itemSecondaryActions}>
            {rem.onFinish && (
              <button
                type="button"
                className={styles.actionBtnDone}
                onClick={(e) => {
                  e.stopPropagation();
                  rem.onFinish?.();
                  playSuccessChime();
                  triggerDopamineBurst();
                }}
                title="Mark as completed / done"
              >
                <Check size={12} />
                <span>Finish</span>
              </button>
            )}

            <button
              type="button"
              className={styles.dismissBtn}
              onClick={(e) => {
                e.stopPropagation();
                rem.onClearReminder();
              }}
              title="Remove reminder"
              aria-label="Remove reminder"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Notifications and Reminders Center"
    >
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* ── Formal Header ── */}
        <div className={styles.header}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerTitleGroup}>
              <div className={styles.bellIconBox}>
                <Bell size={18} />
                {totalActiveBadge > 0 && (
                  <span className={styles.bellBadgeCount}>
                    {totalActiveBadge > 99 ? '99+' : totalActiveBadge}
                  </span>
                )}
              </div>
              <div>
                <div className={styles.titleRow}>
                  <h2 className={styles.title}>Notifications &amp; Reminders</h2>
                  {totalActiveBadge > 0 ? (
                    <span className={styles.unreadPill}>{totalActiveBadge} new</span>
                  ) : (
                    <span className={styles.caughtUpPill}>All caught up</span>
                  )}
                </div>
                <p className={styles.subtitle}>
                  System updates, schedule alerts, and items marked important to finish.
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

          {/* ── Segment Filter Tabs ── */}
          <div className={styles.filterTabsRow}>
            <button
              type="button"
              className={`${styles.filterTab} ${activeTab === 'all' ? styles.filterTabActive : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All <span>({activeReminders.length + userReminders.length})</span>
            </button>
            <button
              type="button"
              className={`${styles.filterTab} ${activeTab === 'reminders' ? styles.filterTabActive : ''}`}
              onClick={() => setActiveTab('reminders')}
            >
              Reminders <span>({userReminders.length})</span>
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

        {/* ── Feed List ── */}
        <div className={styles.list}>
          {activeTab === 'reminders' ? (
            userReminders.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIconCircle}>
                  <Bell size={28} style={{ color: 'var(--color-warning, #f59e0b)' }} />
                </div>
                <h3 className={styles.emptyTitle}>No active reminders</h3>
                <p className={styles.emptyDesc}>
                  Click the Reminder button on any Book, Video Lesson, Task, Idea Parking thought, or Project to pin it here.
                </p>
              </div>
            ) : (
              userReminders.map(renderUserReminderItem)
            )
          ) : activeTab === 'all' ? (
            userReminders.length === 0 && filteredNotifications.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIconCircle}>
                  <ShieldCheck size={28} />
                </div>
                <h3 className={styles.emptyTitle}>You&apos;re all caught up</h3>
                <p className={styles.emptyDesc}>
                  No active reminders or notifications right now.
                </p>
                <Link href="/settings" className={styles.settingsLink} onClick={onClose}>
                  <Settings size={13} />
                  <span>Notification Settings</span>
                </Link>
              </div>
            ) : (
              <>
                {userReminders.length > 0 && (
                  <>
                    <div className={styles.sectionDividerRow}>
                      <span className={styles.sectionDividerTitle}>
                        <Bell size={12} style={{ color: 'var(--color-warning, #f59e0b)' }} />
                        Important Reminders ({userReminders.length})
                      </span>
                    </div>
                    {userReminders.map(renderUserReminderItem)}
                  </>
                )}

                {filteredNotifications.length > 0 && (
                  <>
                    {userReminders.length > 0 && (
                      <div className={styles.sectionDividerRow} style={{ marginTop: '12px' }}>
                        <span className={styles.sectionDividerTitle}>
                          <Clock size={12} />
                          System Notifications ({filteredNotifications.length})
                        </span>
                      </div>
                    )}
                    {filteredNotifications.map((r) => {
                      const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.reminder;
                      const pBadge = PRIORITY_BADGES[r.priority] || PRIORITY_BADGES.normal;

                      return (
                        <article
                          key={r.id}
                          className={`${styles.item} ${!r.isRead ? styles.unreadItem : ''}`}
                          onClick={() => markAsRead(r.id)}
                        >
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
                    })}
                  </>
                )}
              </>
            )
          ) : filteredNotifications.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconCircle}>
                <ShieldCheck size={28} />
              </div>
              <h3 className={styles.emptyTitle}>You&apos;re all caught up</h3>
              <p className={styles.emptyDesc}>
                No notifications match the &ldquo;{activeTab}&rdquo; filter.
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
