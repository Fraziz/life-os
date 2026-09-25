'use client';

import React, { useMemo } from 'react';
import { useTasks } from '@/context/TaskContext';
import { useHabits } from '@/context/HabitContext';
import { Sparkles, Calendar } from 'lucide-react';
import styles from './ActivityHeatmap.module.css';

interface ActivityHeatmapProps {
  weeksToShow?: number;
  title?: string;
}

export default function ActivityHeatmap({ weeksToShow = 20, title = 'Consistency & Execution Heatmap' }: ActivityHeatmapProps) {
  const { tasks } = useTasks();
  const { checkIns } = useHabits();

  // Generate date grid for the last `weeksToShow` weeks up to today
  const { days, totalActivityCount, maxStreak } = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sun, 6 = Sat
    const daysInGrid = weeksToShow * 7;

    // Create a map of dateStr -> count
    const activityMap: Record<string, { tasks: number; habits: number; total: number }> = {};

    tasks.forEach((t) => {
      if (t.status === 'done') {
        const dateStr = (t.completedAt || t.updatedAt || t.createdAt).split('T')[0];
        if (!activityMap[dateStr]) activityMap[dateStr] = { tasks: 0, habits: 0, total: 0 };
        activityMap[dateStr].tasks += 1;
        activityMap[dateStr].total += 1;
      }
    });

    (checkIns || []).forEach((c) => {
      if (c.completed) {
        const dateStr = c.date;
        if (!activityMap[dateStr]) activityMap[dateStr] = { tasks: 0, habits: 0, total: 0 };
        activityMap[dateStr].habits += 1;
        activityMap[dateStr].total += 1;
      }
    });

    const gridDays: Array<{
      date: Date;
      dateStr: string;
      tasks: number;
      habits: number;
      total: number;
      level: number;
    }> = [];

    let totalActivities = 0;

    // Build grid from (daysInGrid - 1) days ago to today
    for (let i = daysInGrid - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const data = activityMap[dateStr] || { tasks: 0, habits: 0, total: 0 };

      totalActivities += data.total;

      let level = 0;
      if (data.total >= 7) level = 4;
      else if (data.total >= 4) level = 3;
      else if (data.total >= 2) level = 2;
      else if (data.total >= 1) level = 1;

      gridDays.push({
        date: d,
        dateStr,
        tasks: data.tasks,
        habits: data.habits,
        total: data.total,
        level,
      });
    }

    // Calculate current streak
    let streak = 0;
    for (let i = gridDays.length - 1; i >= 0; i--) {
      if (gridDays[i].total > 0) {
        streak += 1;
      } else if (i === gridDays.length - 1) {
        // Today has no activity yet, check yesterday
        continue;
      } else {
        break;
      }
    }

    return {
      days: gridDays,
      totalActivityCount: totalActivities,
      maxStreak: streak,
    };
  }, [tasks, checkIns, weeksToShow]);

  return (
    <div className={styles.heatmapCard}>
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <Calendar size={15} style={{ color: 'var(--color-accent)' }} />
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.statsText}>
          <strong>{totalActivityCount}</strong> actions logged &middot;{' '}
          <span style={{ color: 'var(--color-success, #22c55e)' }}>
            🔥 {maxStreak} day streak
          </span>
        </div>
      </div>

      <div className={styles.gridContainer}>
        <div className={styles.heatmapGrid}>
          {days.map((day) => (
            <div
              key={day.dateStr}
              className={`${styles.cell} ${styles[`level${day.level}`]}`}
              title={`${day.dateStr}: ${day.total} activities (${day.tasks} tasks, ${day.habits} habits)`}
            />
          ))}
        </div>
      </div>

      <div className={styles.legendRow}>
        <span>Less</span>
        <div className={`${styles.legendBox} ${styles.level0}`} />
        <div className={`${styles.legendBox} ${styles.level1}`} />
        <div className={`${styles.legendBox} ${styles.level2}`} />
        <div className={`${styles.legendBox} ${styles.level3}`} />
        <div className={`${styles.legendBox} ${styles.level4}`} />
        <span>More</span>
      </div>
    </div>
  );
}
