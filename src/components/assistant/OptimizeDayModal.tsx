'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Check,
  Clock,
  Zap,
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { useGoals } from '@/context/GoalContext';
import { useHabits } from '@/context/HabitContext';
import { useCalendar } from '@/context/CalendarContext';
import { useTodayPlan } from '@/context/TodayPlanContext';
import { optimizeMyDaySchedule, OptimizedDaySchedule } from '@/utils/aiEngine';
import { playSuccessChime } from '@/utils/soundAndDopamine';
import styles from './OptimizeDayModal.module.css';

interface OptimizeDayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OptimizeDayModal({ isOpen, onClose }: OptimizeDayModalProps) {
  const { settings } = useSettings();
  const { tasks } = useTasks();
  const { activeGoals } = useGoals();
  const { habits } = useHabits();
  const { events, batchScheduleTaskBlocks } = useCalendar();
  const { batchApplyDayPlan } = useTodayPlan();

  const [schedule, setSchedule] = useState<OptimizedDaySchedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [startHour, setStartHour] = useState<number>(() => {
    const currentH = new Date().getHours();
    return Math.max(7, Math.min(currentH >= 12 ? currentH : 9, 18));
  });

  const generateSchedule = useCallback(
    async (customStartHour?: number) => {
      setIsLoading(true);
      setIsApplied(false);
      try {
        const hour = customStartHour !== undefined ? customStartHour : startHour;
        const result = await optimizeMyDaySchedule(
          {
            tasks,
            habits,
            goals: activeGoals,
            calendarEvents: events,
            startHour: hour,
            availableHours: settings?.availableHoursPerDay || 8,
            userName: settings?.profile?.displayName || 'Aaron',
          },
          settings?.aiSettings
        );
        setSchedule(result);
      } catch (err) {
        console.warn('Failed to optimize schedule:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [startHour, tasks, habits, activeGoals, events, settings]
  );

  useEffect(() => {
    if (isOpen) {
      generateSchedule();
    }
  }, [isOpen, generateSchedule]);

  if (!isOpen) return null;

  const handleApplySchedule = () => {
    if (!schedule) return;

    const taskBlocks = schedule.blocks.filter((b) => b.taskId);
    const selectedTaskIds = taskBlocks.map((b) => b.taskId!).filter(Boolean);
    const scheduledSlots: Record<string, string> = {};

    taskBlocks.forEach((b) => {
      if (b.taskId) {
        scheduledSlots[b.taskId] = `${b.startTime} - ${b.endTime}`;
      }
    });

    // 1. Commit to TodayPlanContext (Sets Main Focus, Curated Tasks, Scheduled Slots)
    batchApplyDayPlan({
      mainFocusTaskId: schedule.mainFocusTaskId,
      selectedTaskIds,
      scheduledSlots,
    });

    // 2. Commit Focus Blocks to CalendarContext (Hourly timeline reflection)
    const blocksToCalendar = taskBlocks.map((b) => ({
      taskId: b.taskId!,
      date: schedule.date,
      startTime: b.startTime,
      durationMinutes: b.durationMinutes,
      notes: b.rationale,
    }));

    if (blocksToCalendar.length > 0) {
      batchScheduleTaskBlocks(blocksToCalendar);
    }

    playSuccessChime();
    setIsApplied(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const getBlockTypeLabel = (type: string) => {
    switch (type) {
      case 'deep_work':
        return 'Deep Work';
      case 'secondary_focus':
        return 'Focus';
      case 'habit':
        return 'Habit';
      case 'admin':
        return 'Admin';
      case 'break':
        return 'Buffer';
      default:
        return 'Task';
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerIcon}>
              <Clock size={18} />
            </div>
            <div>
              <h3 className={styles.title}>Optimize My Day</h3>
              <p className={styles.subtitle}>
                Auto Time-Blocker · Capacity-aware schedule allocation
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Start Hour Selector & Executive Summary */}
        <div className={styles.controlsBar}>
          <div className={styles.controlItem}>
            <label htmlFor="start-hour-select">Start Time:</label>
            <select
              id="start-hour-select"
              className={styles.hourSelect}
              value={startHour}
              onChange={(e) => {
                const val = Number(e.target.value);
                setStartHour(val);
                generateSchedule(val);
              }}
              disabled={isLoading}
            >
              <option value={7}>07:00 AM</option>
              <option value={8}>08:00 AM</option>
              <option value={9}>09:00 AM (Default)</option>
              <option value={10}>10:00 AM</option>
              <option value={11}>11:00 AM</option>
              <option value={13}>01:00 PM</option>
              <option value={14}>02:00 PM</option>
            </select>
          </div>

          <button
            className={styles.btnSecondarySmall}
            onClick={() => generateSchedule()}
            disabled={isLoading}
            title="Regenerate optimized schedule"
          >
            <RefreshCw size={12} className={isLoading ? styles.spin : ''} />
            Recalculate
          </button>
        </div>

        {/* Schedule Body */}
        <div className={styles.body}>
          {isLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner} />
              <p>Analyzing priorities, durations & calendar availability...</p>
            </div>
          ) : schedule ? (
            <>
              {/* Executive Summary Card */}
              <div className={styles.summaryCard}>
                <div className={styles.summaryBadge}>Executive Rationale</div>
                <p className={styles.summaryText}>{schedule.executiveSummary}</p>
              </div>

              {/* Main Focus Highlight */}
              {schedule.mainFocusTitle && (
                <div className={styles.mainFocusCard}>
                  <div className={styles.mainFocusLabel}>#1 Priority for Today</div>
                  <div className={styles.mainFocusTitle}>{schedule.mainFocusTitle}</div>
                </div>
              )}

              {/* Timeline Blocks */}
              <div className={styles.timelineList}>
                {schedule.blocks.map((b) => (
                  <div key={b.id} className={`${styles.blockCard} ${styles[`type_${b.type}`]}`}>
                    <div className={styles.blockTimeCol}>
                      <span className={styles.blockTimeStart}>{b.startTime}</span>
                      <span className={styles.blockTimeEnd}>{b.endTime}</span>
                    </div>

                    <div className={styles.blockBody}>
                      <div className={styles.blockTitleRow}>
                        <span className={styles.blockTitle}>{b.title}</span>
                        <div className={styles.blockBadges}>
                          <span className={styles.blockTypeBadge}>
                            {getBlockTypeLabel(b.type)}
                          </span>
                          <span className={styles.blockDurationBadge}>
                            {b.durationMinutes}m
                          </span>
                        </div>
                      </div>
                      <p className={styles.blockRationale}>{b.rationale}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>No schedule generated. Click Recalculate to generate.</div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={onClose}>
            Cancel
          </button>

          <button
            className={styles.btnPrimary}
            onClick={handleApplySchedule}
            disabled={isLoading || !schedule || isApplied}
          >
            {isApplied ? (
              <>
                <Check size={14} />
                Schedule Applied
              </>
            ) : (
              <>
                <Zap size={14} />
                Apply to My Day
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
