'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useReminders } from '@/context/ReminderContext';
import {
  Bell,
  BellOff,
  Moon,
  Clock,
  CheckCircle2,
  Calendar,
  Repeat,
  Target,
  CheckSquare,
  RefreshCw,
  X,
  Eye,
  Trash2,
} from 'lucide-react';
import styles from './ReminderDrawer.module.css';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  task: <CheckSquare size={16} />,
  deadline: <Target size={16} />,
  scheduled_work: <Calendar size={16} />,
  habit: <Repeat size={16} />,
  weekly_review: <RefreshCw size={16} />,
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
    snoozeReminder,
  } = useReminders();
  const router = useRouter();

  if (!isOpen) return null;

  const handleNavigate = (href?: string, id?: string) => {
    if (id) markAsRead(id);
    if (href) router.push(href);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={20} className={styles.bellIcon} />
              <h2 className={styles.title}>Reminders &amp; Alerts</h2>
            </div>
            {unreadCount > 0 && <span className={styles.badge}>{unreadCount} new</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {unreadCount > 0 && (
              <button className={styles.btnText} onClick={markAllAsRead}>
                Mark all read
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quiet Hours Banner */}
        {isQuietHourNow && (
          <div className={styles.quietBanner}>
            <Moon size={16} style={{ color: '#a594ff' }} />
            <div>
              <strong>Quiet Hours Active:</strong> Sounds and popup interruptions are silenced so you can rest.
            </div>
          </div>
        )}

        {/* List */}
        <div className={styles.list}>
          {activeReminders.length === 0 ? (
            <div className={styles.emptyState}>
              <CheckCircle2 size={40} style={{ color: 'var(--color-success)', marginBottom: '12px' }} />
              <p style={{ fontWeight: 600, color: 'var(--color-text)' }}>All caught up!</p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                No pending deadlines or missed reminders.
              </p>
            </div>
          ) : (
            activeReminders.map((r) => {
              const icon = TYPE_ICONS[r.type] || <Clock size={16} />;
              return (
                <div
                  key={r.id}
                  className={`${styles.item} ${!r.isRead ? styles.unread : ''} ${
                    r.priority === 'urgent' ? styles.urgent : ''
                  }`}
                  onClick={() => markAsRead(r.id)}
                >
                  <div className={styles.itemTop}>
                    <div className={styles.itemIcon}>{icon}</div>
                    <div className={styles.itemMain}>
                      <span className={styles.itemTitle}>{r.title}</span>
                      <p className={styles.itemMsg}>{r.message}</p>
                    </div>
                    {r.timeStr && <span className={styles.timeTag}>{r.timeStr}</span>}
                  </div>

                  <div className={styles.itemActions}>
                    {r.href && (
                      <button
                        className={styles.actionBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigate(r.href, r.id);
                        }}
                      >
                        View &rarr;
                      </button>
                    )}
                    <button
                      className={styles.actionBtnSecondary}
                      onClick={(e) => {
                        e.stopPropagation();
                        snoozeReminder(r.id, 60);
                      }}
                      title="Snooze 1 hour"
                    >
                      <Clock size={12} /> Snooze 1h
                    </button>
                    <button
                      className={styles.dismissBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissReminder(r.id);
                      }}
                      title="Dismiss"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
