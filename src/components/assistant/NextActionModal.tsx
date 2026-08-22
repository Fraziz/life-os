'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useMilestones } from '@/context/MilestoneContext';
import { useHabits } from '@/context/HabitContext';
import type { NextActionRecommendation } from '@/types';
import { getNextActionRecommendation } from '@/utils/nextActionEngine';
import {
  Compass,
  Play,
  RotateCcw,
  Clock,
  Ban,
  Sparkles,
  X,
  Target,
  FolderKanban,
  Zap,
} from 'lucide-react';
import styles from './NextActionModal.module.css';

interface NextActionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NextActionModal({ isOpen, onClose }: NextActionModalProps) {
  const router = useRouter();
  const { settings } = useSettings();
  const { tasks } = useTasks();
  const { goals } = useGoals();
  const { projects } = useProjects();
  const { milestones } = useMilestones();
  const { habits } = useHabits();

  const [recommendation, setRecommendation] = useState<NextActionRecommendation | null>(null);
  const [cycleIndex, setCycleIndex] = useState(0);
  const [snoozedIds, setSnoozedIds] = useState<string[]>([]);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecommendation = useCallback(async (currCycle: number, snoozed: string[], rejected: string[]) => {
    setLoading(true);
    const rec = await getNextActionRecommendation({
      tasks,
      goals,
      projects,
      milestones,
      habits,
      settings,
      snoozedTaskIds: snoozed,
      rejectedTaskIds: rejected,
      cycleIndex: currCycle,
    });
    setRecommendation(rec);
    setLoading(false);
  }, [tasks, goals, projects, milestones, habits, settings]);

  useEffect(() => {
    if (isOpen) {
      fetchRecommendation(cycleIndex, snoozedIds, rejectedIds);
    }
  }, [isOpen, cycleIndex, snoozedIds, rejectedIds, fetchRecommendation]);

  if (!isOpen) return null;

  const handleStart = () => {
    if (!recommendation) return;
    // Store in localStorage for Focus page to pre-select
    try {
      localStorage.setItem('life_os_active_focus_task_id', recommendation.task.id);
    } catch { /* noop */ }
    onClose();
    router.push('/focus');
  };

  const handleChooseAnother = () => {
    const nextIdx = cycleIndex + 1;
    setCycleIndex(nextIdx);
  };

  const handleSnooze = () => {
    if (!recommendation) return;
    const nextSnoozed = [...snoozedIds, recommendation.task.id];
    setSnoozedIds(nextSnoozed);
  };

  const handleReject = () => {
    if (!recommendation) return;
    const nextRejected = [...rejectedIds, recommendation.task.id];
    setRejectedIds(nextRejected);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={22} className={styles.compassIcon} />
            <h2 className={styles.title}>What Should I Do Right Now?</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingArea}>
              <RotateCcw size={28} className={styles.spin} />
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                Analyzing deadlines, momentum, and priorities...
              </p>
            </div>
          ) : !recommendation ? (
            <div className={styles.emptyArea}>
              <Zap size={36} style={{ color: 'var(--color-success)', marginBottom: '12px' }} />
              <h3>All caught up!</h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                You have no active pending tasks or you have reviewed all candidates. Take a well-earned break or do a Brain Dump.
              </p>
            </div>
          ) : (
            <div className={styles.recommendationCard}>
              {/* WHY Section */}
              <div className={styles.sectionWhy}>
                <span className={styles.whyLabel}>WHY THIS MATTERS NOW</span>
                <p className={styles.whyText}>&ldquo;{recommendation.why}&rdquo;</p>
              </div>

              {/* TASK Section */}
              <div className={styles.sectionTask}>
                <div className={styles.tagsRow}>
                  {recommendation.projectTitle && (
                    <span className={styles.projectTag}>
                      <FolderKanban size={11} /> {recommendation.projectTitle}
                    </span>
                  )}
                  {recommendation.goalTitle && (
                    <span className={styles.goalTag}>
                      <Target size={11} /> {recommendation.goalTitle}
                    </span>
                  )}
                  <span className={`${styles.priorityTag} ${styles[recommendation.priority]}`}>
                    {recommendation.priority}
                  </span>
                </div>

                <h3 className={styles.taskTitle}>{recommendation.task.title}</h3>

                {recommendation.task.description && (
                  <p className={styles.taskDesc}>{recommendation.task.description}</p>
                )}
              </div>

              {/* TIME Section */}
              <div className={styles.sectionTime}>
                <Clock size={16} className={styles.clockIcon} />
                <span className={styles.timeLabel}>Estimated Time:</span>
                <span className={styles.timeVal}>{recommendation.estimatedMinutes} minutes</span>
              </div>

              {/* Action Buttons */}
              <div className={styles.actions}>
                <button className={styles.btnStart} onClick={handleStart}>
                  <Play size={16} fill="currentColor" /> START TASK NOW
                </button>

                <div className={styles.secondaryActions}>
                  <button className={styles.btnSecondary} onClick={handleChooseAnother} title="Evaluate next candidate">
                    <RotateCcw size={13} /> Choose another
                  </button>
                  <button className={styles.btnSecondary} onClick={handleSnooze} title="Snooze for 2 hours">
                    <Clock size={13} /> Snooze
                  </button>
                  <button className={styles.btnSecondary} onClick={handleReject} title="Skip this task">
                    <Ban size={13} /> Reject
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
