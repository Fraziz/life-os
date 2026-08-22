'use client';

import React, { useState } from 'react';
import {
  Repeat,
  Plus,
  Check,
  CheckCircle2,
  RotateCcw,
  Target,
  Clock,
  Sparkles,
  Layers,
  Trash2,
  X,
  Flame,
  Zap,
  Bookmark,
  Calendar,
} from 'lucide-react';
import { useHabits } from '@/context/HabitContext';
import { useGoals } from '@/context/GoalContext';
import { useLifeAreas } from '@/context/LifeAreaContext';
import type { Habit, HabitFrequency } from '@/types';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';

export default function HabitsPage() {
  const {
    habits,
    checkIns,
    addHabit,
    deleteHabit,
    toggleHabitCheckIn,
    isHabitCompletedOnDate,
    getWeeklyCompletionsCount,
    getTotalCompletionsCount,
    getPast7DaysStatus,
    resetToDefaultHabits,
    isLoaded,
  } = useHabits();

  const { goals } = useGoals();
  const { activeAreas } = useLifeAreas();

  const [addModalOpen, setAddModalOpen] = useState(false);

  // Form states for creating a new habit
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('weekly');
  const [targetCount, setTargetCount] = useState('3');
  const [parentGoalId, setParentGoalId] = useState('');
  const [lifeAreaId, setLifeAreaId] = useState('');
  const [reminderTime, setReminderTime] = useState('18:00');
  const [reminderNote, setReminderNote] = useState('');
  const [habitColor, setHabitColor] = useState('#7c6fff');

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading your Habits...
        </p>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addHabit({
      title: title.trim(),
      description: description.trim() || undefined,
      frequency,
      targetCount: parseInt(targetCount) || 1,
      parentGoalId: parentGoalId || undefined,
      lifeAreaId: lifeAreaId || undefined,
      reminderTime: reminderTime || undefined,
      reminderNote: reminderNote.trim() || undefined,
      color: habitColor || undefined,
      isOptional: true,
    });

    setAddModalOpen(false);
    setTitle('');
    setDescription('');
    setParentGoalId('');
    setReminderNote('');
    setHabitColor('#7c6fff');
  };

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Optional Habits & Practice</h1>
          <p className={styles.subtitle}>
            Supportive, identity-driven daily and weekly practice. Consistency and total volume are celebrated — without punishing streaks.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.btnAdd} onClick={() => setAddModalOpen(true)}>
            <Plus size={14} /> New Habit
          </button>
        </div>
      </header>

      {/* ── Philosophy Banner ── */}
      <section className={styles.philosophyBanner}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Sparkles size={22} style={{ color: 'var(--color-accent)' }} />
          <p className={styles.bannerText}>
            <strong>Guilt-Free Rhythm:</strong> Habits are votes for who you want to become. Showing up <span className={styles.bannerHighlight}>3 or 4 days a week</span> consistently produces massive mastery over time.
          </p>
        </div>
      </section>

      {/* ── Habits Grid ── */}
      <div className={styles.habitsGrid}>
        {habits.map((habit) => {
          const completedToday = isHabitCompletedOnDate(habit.id, todayStr);
          const weeklyCount = getWeeklyCompletionsCount(habit.id);
          const totalCount = getTotalCompletionsCount(habit.id);
          const past7Days = getPast7DaysStatus(habit.id);
          const linkedGoal = habit.parentGoalId ? goals.find((g) => g.id === habit.parentGoalId) : null;
          const weeklyProgressPercent = Math.min(100, Math.round((weeklyCount / habit.targetCount) * 100));

          const accentColor = habit.color || 'var(--color-accent)';

          return (
            <article
              key={habit.id}
              className={styles.habitCard}
              style={{
                borderLeft: completedToday
                  ? `4px solid var(--color-success)`
                  : `4px solid ${accentColor}`,
                background: completedToday
                  ? `linear-gradient(135deg, var(--color-surface) 0%, rgba(34,211,165,0.06) 100%)`
                  : habit.color
                  ? `linear-gradient(135deg, var(--color-surface) 0%, ${habit.color}10 100%)`
                  : undefined,
              }}
            >
              <div className={styles.cardTop}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <div className={styles.habitTitleRow}>
                    <h2 className={styles.habitTitle}>{habit.title}</h2>
                  </div>
                  {habit.description && <p className={styles.habitDesc}>{habit.description}</p>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <EntityFiles variant="icon" entityType="habit" entityId={habit.id} title={habit.title} />
                  <button
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', padding: '2px' }}
                    onClick={() => {
                      if (confirm(`Delete habit "${habit.title}"?`)) {
                        deleteHabit(habit.id);
                      }
                    }}
                    title="Delete habit"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* 1-Click Check-in & 7-Day Matrix */}
              <div className={styles.checkInArea}>
                <button
                  className={`${styles.btnCheckIn} ${completedToday ? styles.checked : ''}`}
                  onClick={() => toggleHabitCheckIn(habit.id, todayStr)}
                  title={completedToday ? 'Checked in today! Click to toggle off' : 'Click to check in for Today'}
                >
                  {completedToday ? <Check size={14} /> : <CheckCircle2 size={14} />}
                  <span>{completedToday ? 'Done Today' : 'Check In'}</span>
                </button>

                {/* 7-Day Rolling Dots */}
                <div className={styles.dotsRow}>
                  {past7Days.map((d, i) => (
                    <div key={i} className={styles.dayDotCol} title={`${d.date}: ${d.completed ? 'Completed' : 'Not completed'}`}>
                      <div className={`${styles.dotCircle} ${d.completed ? styles.filled : ''}`} />
                      <span className={styles.dotLabel}>{d.dayName}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metrics & Linked Goal */}
              <div className={styles.cardFooter}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    Target: {habit.targetCount}x {habit.frequency === 'daily' ? 'daily' : 'per week'}
                  </span>
                  <span style={{ fontWeight: 600, color: weeklyCount >= habit.targetCount ? 'var(--color-success)' : 'var(--color-accent-light)' }}>
                    {weeklyCount} / {habit.targetCount} this week ({weeklyProgressPercent}%)
                  </span>
                </div>

                <div className={styles.progressBarTrack}>
                  <div
                    className={styles.progressBarFill}
                    style={{
                      width: `${weeklyProgressPercent}%`,
                      background: weeklyCount >= habit.targetCount ? 'var(--color-success)' : undefined,
                    }}
                  />
                </div>

                <div className={styles.footerMeta}>
                  <span>Total Reps: <strong>{totalCount} sessions</strong></span>

                  {linkedGoal && (
                    <span className={styles.goalBadge} title={`Connected Goal: ${linkedGoal.title}`}>
                      <Target size={11} /> {linkedGoal.title}
                    </span>
                  )}
                </div>

                {habit.reminderTime && (
                  <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={10} /> Reminder: {habit.reminderTime} {habit.reminderNote ? `• "${habit.reminderNote}"` : ''}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* ── Modal: Add Habit ── */}
      {addModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Create Optional Habit
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setAddModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                  Habit Title (e.g. Practice Blender, Read 20 mins, Work on game)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Practice Blender"
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-xs)',
                    outline: 'none',
                  }}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 3D modeling, hard surface, and shader nodes"
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-xs)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
                    style={{
                      width: '100%',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-xs)',
                      outline: 'none',
                    }}
                  >
                    <option value="daily">Daily (1x / day)</option>
                    <option value="weekly">Weekly (Nx / week)</option>
                    <option value="custom">Custom (Mon/Wed/Fri)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                    Target Reps per Week/Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={targetCount}
                    onChange={(e) => setTargetCount(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-xs)',
                      outline: 'none',
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                  Connect to Goal (Optional)
                </label>
                <select
                  value={parentGoalId}
                  onChange={(e) => setParentGoalId(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-xs)',
                    outline: 'none',
                  }}
                >
                  <option value="">-- No connected goal --</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                    Reminder Time
                  </label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-xs)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                    Reminder Cue / Prompt
                  </label>
                  <input
                    type="text"
                    value={reminderNote}
                    onChange={(e) => setReminderNote(e.target.value)}
                    placeholder="e.g. Fire up Blender for 30 mins"
                    style={{
                      width: '100%',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-xs)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Color Accent Swatch Picker */}
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Accent Color
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    '#7c6fff', '#38bdf8', '#22d3a5', '#f59e0b',
                    '#ef4444', '#ec4899', '#a855f7', '#84cc16', '#fb923c',
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => setHabitColor(c)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: c,
                        border: habitColor === c ? '3px solid white' : '2px solid transparent',
                        outline: habitColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: 'var(--space-2)' }}>
                <button type="button" className={styles.btnSecondary} onClick={() => setAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnAdd}>
                  Create Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
