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
import { useDailyRoutineReminder } from '@/utils/dailyRoutineReminder';
import {
  Bell,
  Moon,
  Clock,
  Calendar,
  Repeat,
  Target,
  CheckSquare,
  RefreshCw,
  X,
  ShieldCheck,
  CheckCheck,
  Settings,
  BookOpen,
  Video,
  Lightbulb,
  Folder,
  Check,
  Pin,
} from 'lucide-react';
import styles from './ReminderDrawer.module.css';
import AutoLinkText from '@/components/ui/AutoLinkText';

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  task: {
    label: 'Task Due',
    icon: <CheckSquare size={17} strokeWidth={1.8} />,
  },
  deadline: {
    label: 'Deadline',
    icon: <Target size={17} strokeWidth={1.8} />,
  },
  scheduled_work: {
    label: 'Focus Block',
    icon: <Calendar size={17} strokeWidth={1.8} />,
  },
  habit: {
    label: 'Habit',
    icon: <Repeat size={17} strokeWidth={1.8} />,
  },
  weekly_review: {
    label: 'Weekly Review',
    icon: <RefreshCw size={17} strokeWidth={1.8} />,
  },
  reminder: {
    label: 'Alert',
    icon: <Bell size={17} strokeWidth={1.8} />,
  },
};

interface UnifiedUserReminder {
  id: string;
  type: 'routine' | 'book' | 'video' | 'task' | 'idea' | 'project';
  typeLabel: string;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
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
  const dailyRoutine = useDailyRoutineReminder();

  const [activeTab, setActiveTab] = useState<'all' | 'reminders' | 'urgent' | 'unread'>('all');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const userReminders = useMemo<UnifiedUserReminder[]>(() => {
    const list: UnifiedUserReminder[] = [];

    if (dailyRoutine.isActiveToday) {
      list.push({
        id: 'daily-routine-today',
        type: 'routine',
        typeLabel: 'Daily Routine',
        title: 'Daily Routine',
        subtitle: dailyRoutine.subtitle,
        href: '/routine',
        icon: <Clock size={17} strokeWidth={1.8} />,
        onFinish: dailyRoutine.markDoneToday,
        onClearReminder: dailyRoutine.markDoneToday,
      });
    }

    tasks
      .filter((t) => t.isReminder && t.status !== 'done')
      .forEach((t) => {
        list.push({
          id: t.id,
          type: 'task',
          typeLabel: 'Task',
          title: t.title,
          subtitle: t.dueDate ? `Due ${t.dueDate}` : t.priority ? `${t.priority} priority` : 'Pinned reminder',
          href: '/tasks',
          icon: <CheckSquare size={17} strokeWidth={1.8} />,
          onFinish: () => toggleTaskDone(t.id),
          onClearReminder: () => toggleTaskReminder(t.id),
        });
      });

    docs
      .filter((d) => d.isReminder && d.status !== 'archived')
      .forEach((d) => {
        const isVideo = isDocVideoLesson(d);
        list.push({
          id: d.id,
          type: isVideo ? 'video' : 'book',
          typeLabel: isVideo ? 'Video Lesson' : 'Book',
          title: d.title,
          subtitle: isVideo ? 'Video lesson' : d.category || 'Reading',
          href: isVideo ? '/focus' : '/knowledge',
          icon: isVideo ? <Video size={17} strokeWidth={1.8} /> : <BookOpen size={17} strokeWidth={1.8} />,
          onClearReminder: () => toggleDocReminder(d.id),
        });
      });

    (inboxReminders || [])
      .filter((r) => !r.isApplied && r.status === 'inbox')
      .forEach((r) => {
        list.push({
          id: r.id,
          type: 'idea',
          typeLabel: 'Idea Parking',
          title: r.content,
          subtitle: r.reminderTime ? r.reminderTime : 'Parked thought',
          href: '/inbox',
          icon: <Lightbulb size={17} strokeWidth={1.8} />,
          onFinish: () => toggleItemApplied(r.id),
          onClearReminder: () => toggleItemReminder(r.id),
        });
      });

    (activeProjects || [])
      .filter((p) => p.isReminder && p.status !== 'completed')
      .forEach((p) => {
        list.push({
          id: p.id,
          type: 'project',
          typeLabel: 'Project',
          title: p.title,
          subtitle: `${p.progress}% progress`,
          href: '/projects',
          icon: <Folder size={17} strokeWidth={1.8} />,
          onClearReminder: () => toggleProjectReminder(p.id),
        });
      });

    return list;
  }, [
    dailyRoutine.isActiveToday,
    dailyRoutine.subtitle,
    dailyRoutine.markDoneToday,
    tasks,
    docs,
    inboxReminders,
    activeProjects,
    toggleTaskDone,
    toggleTaskReminder,
    toggleDocReminder,
    toggleItemApplied,
    toggleItemReminder,
    toggleProjectReminder,
  ]);

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
      <div className={styles.avatarWrap}>
        <div className={styles.itemAvatar}>{rem.icon}</div>
        <span className={styles.avatarCornerBadge} aria-hidden="true">
          <Pin size={9} />
        </span>
      </div>

      <div className={styles.itemBody}>
        <h4 className={styles.itemTitle}>
          <AutoLinkText text={rem.title} />
        </h4>
        <p className={styles.itemMsg}>
          <AutoLinkText text={rem.subtitle} />
        </p>
        <div className={styles.itemMetaRow}>
          <span>{rem.typeLabel}</span>
          <span>·</span>
          <span>Reminder</span>
        </div>
      </div>

      <div className={styles.itemRight}>
        <div className={styles.rowActions}>
          {rem.onFinish && (
            <button
              type="button"
              className={`${styles.iconActionBtn} ${styles.iconActionBtnDone}`}
              onClick={(e) => {
                e.stopPropagation();
                rem.onFinish?.();
                playSuccessChime();
                triggerDopamineBurst();
              }}
              title="Mark done"
              aria-label="Mark done"
            >
              <Check size={14} strokeWidth={2.4} />
            </button>
          )}
          <button
            type="button"
            className={`${styles.iconActionBtn} ${styles.iconActionBtnDismiss}`}
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
    </article>
  );

  const renderSystemNotificationItem = (r: (typeof activeReminders)[number]) => {
    const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.reminder;
    return (
      <article
        key={r.id}
        className={`${styles.item} ${!r.isRead ? styles.unreadItem : ''}`}
        onClick={() => (r.href ? handleNavigate(r.href, r.id) : markAsRead(r.id))}
      >
        <div className={styles.avatarWrap}>
          <div className={styles.itemAvatar}>{cfg.icon}</div>
        </div>

        <div className={styles.itemBody}>
          <h4 className={styles.itemTitle}>
            <AutoLinkText text={r.title} />
          </h4>
          <p className={styles.itemMsg}>
            <AutoLinkText text={r.message} />
          </p>
          <div className={styles.itemMetaRow}>
            <span>{cfg.label}</span>
            {r.timeStr && (
              <>
                <span>·</span>
                <span>{r.timeStr}</span>
              </>
            )}
            {r.priority === 'urgent' && <span className={styles.urgentTag}>Urgent</span>}
          </div>
        </div>

        <div className={styles.itemRight}>
          <div className={styles.rowActions}>
            <button
              type="button"
              className={styles.iconActionBtn}
              onClick={(e) => {
                e.stopPropagation();
                snoozeReminder(r.id, 60);
              }}
              title="Snooze 1 hour"
              aria-label="Snooze 1 hour"
            >
              <Clock size={13} />
            </button>
            <button
              type="button"
              className={`${styles.iconActionBtn} ${styles.iconActionBtnDismiss}`}
              onClick={(e) => {
                e.stopPropagation();
                dismissReminder(r.id);
              }}
              title="Dismiss"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
          {!r.isRead && <span className={styles.unreadDot} title="Unread" />}
        </div>
      </article>
    );
  };

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
    >
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTopRow}>
            <h2 className={styles.title}>Notifications</h2>

            <div className={styles.headerActions}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className={styles.headerTextBtn}
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  <span>Mark all read</span>
                </button>
              )}
              {readCount > 0 && (
                <button
                  type="button"
                  className={styles.headerTextBtn}
                  onClick={dismissAllRead}
                  title="Clear read notifications"
                >
                  <span>Clear</span>
                </button>
              )}
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close notifications"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className={styles.filterTabsRow}>
            <button
              type="button"
              className={`${styles.filterTab} ${activeTab === 'all' ? styles.filterTabActive : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All <span className={styles.filterTabCount}>{activeReminders.length + userReminders.length}</span>
            </button>
            <button
              type="button"
              className={`${styles.filterTab} ${activeTab === 'reminders' ? styles.filterTabActive : ''}`}
              onClick={() => setActiveTab('reminders')}
            >
              Reminders <span className={styles.filterTabCount}>{userReminders.length}</span>
            </button>
            <button
              type="button"
              className={`${styles.filterTab} ${activeTab === 'unread' ? styles.filterTabActive : ''}`}
              onClick={() => setActiveTab('unread')}
            >
              Unread <span className={styles.filterTabCount}>{unreadCount}</span>
            </button>
            {urgentCount > 0 && (
              <button
                type="button"
                className={`${styles.filterTab} ${activeTab === 'urgent' ? styles.filterTabActive : ''}`}
                onClick={() => setActiveTab('urgent')}
              >
                Urgent <span className={styles.filterTabCount}>{urgentCount}</span>
              </button>
            )}
          </div>
        </div>

        {isQuietHourNow && (
          <div className={styles.quietBanner}>
            <Moon size={14} />
            <span>
              <strong>Quiet Hours</strong> · Sound notifications paused
            </span>
          </div>
        )}

        <div className={styles.list}>
          {activeTab === 'reminders' ? (
            userReminders.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIconCircle}>
                  <Bell size={22} />
                </div>
                <h3 className={styles.emptyTitle}>No pinned reminders</h3>
                <p className={styles.emptyDesc}>
                  Items marked as a reminder appear here.
                </p>
              </div>
            ) : (
              userReminders.map(renderUserReminderItem)
            )
          ) : activeTab === 'all' ? (
            userReminders.length === 0 && filteredNotifications.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIconCircle}>
                  <ShieldCheck size={22} />
                </div>
                <h3 className={styles.emptyTitle}>You&apos;re all caught up</h3>
                <p className={styles.emptyDesc}>No active notifications right now.</p>
                <Link href="/settings" className={styles.settingsLink} onClick={onClose}>
                  <Settings size={13} />
                  <span>Notification Settings</span>
                </Link>
              </div>
            ) : (
              <>
                {userReminders.length > 0 && (
                  <>
                    <div className={styles.sectionHeader}>
                      <span>Pinned Reminders</span>
                      <span className={styles.sectionCount}>{userReminders.length}</span>
                    </div>
                    {userReminders.map(renderUserReminderItem)}
                  </>
                )}

                {filteredNotifications.length > 0 && (
                  <>
                    <div className={styles.sectionHeader}>
                      <span>Recent</span>
                      <span className={styles.sectionCount}>{filteredNotifications.length}</span>
                    </div>
                    {filteredNotifications.map(renderSystemNotificationItem)}
                  </>
                )}
              </>
            )
          ) : filteredNotifications.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconCircle}>
                <ShieldCheck size={22} />
              </div>
              <h3 className={styles.emptyTitle}>No matching notifications</h3>
              <p className={styles.emptyDesc}>You&apos;re caught up in this view.</p>
            </div>
          ) : (
            filteredNotifications.map(renderSystemNotificationItem)
          )}
        </div>
      </div>
    </div>
  );
}
