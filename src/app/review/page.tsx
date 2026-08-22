'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  CheckCircle2,
  Clock,
  Target,
  FolderKanban,
  CheckSquare,
  Repeat,
  Sparkles,
  Trophy,
  ArrowRight,
  Send,
  Trash2,
  History,
  RotateCcw,
} from 'lucide-react';
import { useReview } from '@/context/ReviewContext';
import styles from './page.module.css';

export default function WeeklyReviewPage() {
  const {
    reviews,
    currentWeekStats,
    saveWeeklyReview,
    deleteWeeklyReview,
    resetToDefaultReviews,
    isLoaded,
  } = useReview();

  // Form inputs for the 4 reflection questions
  const [wentWell, setWentWell] = useState('');
  const [didNotGoWell, setDidNotGoWell] = useState('');
  const [shouldChange, setShouldChange] = useState('');
  const [nextWeekFocus, setNextWeekFocus] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Preparing your Weekly Review data...
        </p>
      </div>
    );
  }

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wentWell.trim() && !nextWeekFocus.trim()) {
      alert('Please write at least a brief reflection on what went well and next week focus.');
      return;
    }

    saveWeeklyReview({
      weekStartDate: currentWeekStats.weekStartStr,
      weekEndDate: currentWeekStats.weekEndStr,
      completedTaskCount: currentWeekStats.completedTasks.length,
      openTaskCount: currentWeekStats.openTasks.length,
      focusMinutesLogged: currentWeekStats.focusMinutes,
      goalsProgressedCount: currentWeekStats.goalsProgressed.length,
      projectsProgressedCount: currentWeekStats.projectsProgressed.length,
      habitsConsistencyRate: currentWeekStats.habitsConsistency,
      importantWins: currentWeekStats.importantWins,
      wentWell: wentWell.trim() || 'Consistent progress maintained across daily focus sessions.',
      didNotGoWell: didNotGoWell.trim() || 'Some task estimations required recalibration.',
      shouldChange: shouldChange.trim() || 'Protect morning deep focus blocks from non-essential distractions.',
      nextWeekFocus: nextWeekFocus.trim() || 'Advance core milestone deliverables.',
    });

    setSavedNotice(true);
    setWentWell('');
    setDidNotGoWell('');
    setShouldChange('');
    setNextWeekFocus('');
    setTimeout(() => setSavedNotice(false), 3500);
  };

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Weekly Review & Alignment</h1>
          <p className={styles.subtitle}>
            Close the loop on the past 7 days. Celebrate real momentum, acknowledge friction, calibrate your direction, and lock in next week&apos;s focus.
          </p>
        </div>

        <Link href="/" className={styles.btnSave} style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', textDecoration: 'none' }}>
          Return to Command Center <ArrowRight size={14} />
        </Link>
      </header>

      {/* ── 1. Weekly Performance Summary Grid ── */}
      <section className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ color: 'var(--color-success)' }}>
            <CheckSquare size={18} />
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricVal}>{currentWeekStats.completedTasks.length} Done</span>
            <span className={styles.metricLabel}>{currentWeekStats.openTasks.length} Remaining</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ color: '#a855f7' }}>
            <Clock size={18} />
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricVal}>{formatHours(currentWeekStats.focusMinutes)}</span>
            <span className={styles.metricLabel}>Deep Focus Logged</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ color: 'var(--color-accent-light)' }}>
            <Target size={18} />
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricVal}>{currentWeekStats.goalsProgressed.length} Goals</span>
            <span className={styles.metricLabel}>{currentWeekStats.projectsProgressed.length} Projects Moved</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ color: '#38bdf8' }}>
            <Repeat size={18} />
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricVal}>{currentWeekStats.habitsConsistency}%</span>
            <span className={styles.metricLabel}>Habit Consistency</span>
          </div>
        </div>
      </section>

      {/* ── 2. Important Wins Banner ── */}
      <section className={styles.winsBanner}>
        <span className={styles.winsTitle}>
          <Trophy size={14} /> Important Wins This Week
        </span>
        <div className={styles.winsList}>
          {currentWeekStats.importantWins.map((win, idx) => (
            <div key={idx} className={styles.winItem}>
              <CheckCircle2 size={13} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
              <span>{win}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. The 4 Guided Reflection Prompts ── */}
      <form onSubmit={handleReviewSubmit} className={styles.reviewForm}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-3)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
              Weekly Reflection Prompts
            </h2>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Week of {currentWeekStats.weekStartStr} to {currentWeekStats.weekEndStr}
            </span>
          </div>

          {savedNotice && (
            <span style={{ color: 'var(--color-success)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
              ✓ Weekly Review Saved!
            </span>
          )}
        </div>

        {/* Prompt 1 */}
        <div className={styles.promptBlock}>
          <label className={styles.promptLabel}>
            <Sparkles size={16} style={{ color: 'var(--color-success)' }} /> 1. What went well?
          </label>
          <span className={styles.promptSubtext}>What gave you energy, worked smoothly, or was a meaningful breakthrough?</span>
          <textarea
            className={styles.promptTextarea}
            value={wentWell}
            onChange={(e) => setWentWell(e.target.value)}
            placeholder="e.g. Completed the physics vector math, morning focus was sharp..."
            required
          />
        </div>

        {/* Prompt 2 */}
        <div className={styles.promptBlock}>
          <label className={styles.promptLabel}>
            <Clock size={16} style={{ color: '#f59e0b' }} /> 2. What didn&apos;t?
          </label>
          <span className={styles.promptSubtext}>Where did you hit friction, procrastinate, or get derailed?</span>
          <textarea
            className={styles.promptTextarea}
            value={didNotGoWell}
            onChange={(e) => setDidNotGoWell(e.target.value)}
            placeholder="e.g. Underestimated Blender environment lighting setup, got distracted on social..."
          />
        </div>

        {/* Prompt 3 */}
        <div className={styles.promptBlock}>
          <label className={styles.promptLabel}>
            <RefreshCw size={16} style={{ color: 'var(--color-accent)' }} /> 3. What should I change?
          </label>
          <span className={styles.promptSubtext}>One concrete adjustment to routines, task breakdown, or environment.</span>
          <textarea
            className={styles.promptTextarea}
            value={shouldChange}
            onChange={(e) => setShouldChange(e.target.value)}
            placeholder="e.g. Break 3D modeling tasks into 25-minute steps before opening the project..."
          />
        </div>

        {/* Prompt 4 */}
        <div className={styles.promptBlock}>
          <label className={styles.promptLabel}>
            <Target size={16} style={{ color: '#ec4899' }} /> 4. What matters next week?
          </label>
          <span className={styles.promptSubtext}>The #1 or #2 essential outcomes for the upcoming 7 days.</span>
          <textarea
            className={styles.promptTextarea}
            value={nextWeekFocus}
            onChange={(e) => setNextWeekFocus(e.target.value)}
            placeholder="e.g. Lock in Blobbit playable level build and test movement controls..."
            required
          />
        </div>

        <button type="submit" className={styles.btnSave}>
          <Send size={14} /> Save Weekly Review
        </button>
      </form>

      {/* ── 4. Past Reviews Archive ── */}
      <section className={styles.archiveSection}>
        <div className={styles.archiveHeader}>
          <span className={styles.archiveTitle}>
            <History size={16} /> Past Reviews Archive ({reviews.length})
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {reviews.map((rev) => (
            <article key={rev.id} className={styles.reviewCard}>
              <div className={styles.reviewCardTop}>
                <span className={styles.reviewDateRange}>
                  Week: {rev.weekStartDate} → {rev.weekEndDate}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {rev.completedTaskCount} tasks • {formatHours(rev.focusMinutesLogged)} focus • {rev.habitsConsistencyRate}% habits
                  </span>
                  <button
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }}
                    onClick={() => deleteWeeklyReview(rev.id)}
                    title="Delete review"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className={styles.reviewAnswersGrid}>
                <div className={styles.answerBox}>
                  <span className={styles.answerLabel}>What Went Well</span>
                  <p className={styles.answerText}>{rev.wentWell}</p>
                </div>

                <div className={styles.answerBox}>
                  <span className={styles.answerLabel}>What Didn&apos;t</span>
                  <p className={styles.answerText}>{rev.didNotGoWell}</p>
                </div>

                <div className={styles.answerBox}>
                  <span className={styles.answerLabel}>What To Change</span>
                  <p className={styles.answerText}>{rev.shouldChange}</p>
                </div>

                <div className={styles.answerBox}>
                  <span className={styles.answerLabel}>Next Week Focus</span>
                  <p className={styles.answerText}>{rev.nextWeekFocus}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
