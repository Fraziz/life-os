'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Clock,
  Flame,
  Coffee,
  Zap,
  CheckSquare,
  Square,
  History,
  Target,
  Plus,
  X,
  ArrowRight,
  Sparkles,
  Volume2,
  VolumeX,
  Wand2,
  Send,
  CloudRain,
  Waves,
  Radio,
} from 'lucide-react';
import { useFocus } from '@/context/FocusContext';
import { useTasks } from '@/context/TaskContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useInbox } from '@/context/InboxContext';
import {
  playSuccessChime,
  playSubtaskTick,
  playTimerCompleteFanfare,
  triggerDopamineBurst,
  startAmbientSound,
  stopAmbientSound,
  setAmbientVolume,
  type AmbientSoundType,
} from '@/utils/soundAndDopamine';
import { generateMicroBreakdown } from '@/utils/adhdBreakdown';
import type { Task, FocusModeType } from '@/types';
import styles from './page.module.css';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function FocusPage() {
  const {
    activeTask,
    customTaskTitle,
    mode,
    timerDurationSeconds,
    secondsRemaining,
    secondsElapsed,
    isRunning,
    isZenMode,
    focusHistory,
    startTimer,
    pauseTimer,
    resetTimer,
    finishSession,
    selectFocusTask,
    setTimerMode,
    toggleZenMode,
    clearFocusHistory,
    isLoaded,
  } = useFocus();

  const { tasks, toggleSubtask, breakdownTask } = useTasks();
  const { goals } = useGoals();
  const { projects } = useProjects();
  const { quickDump } = useInbox();

  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [customMinInput, setCustomMinInput] = useState('30');
  const [finishNotes, setFinishNotes] = useState('');
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [markDoneOnFinish, setMarkDoneOnFinish] = useState(true);

  // ADHD Superpowers state
  const [ambientSound, setAmbientSound] = useState<AmbientSoundType>('off');
  const [ambientVol, setAmbientVol] = useState(0.35);
  const [parkingLotInput, setParkingLotInput] = useState('');
  const [parkedNotice, setParkedNotice] = useState(false);

  // Cleanup ambient sound on unmount
  useEffect(() => {
    return () => {
      stopAmbientSound();
    };
  }, []);

  const handleAmbientToggle = (type: AmbientSoundType) => {
    if (ambientSound === type) {
      setAmbientSound('off');
      stopAmbientSound();
    } else {
      setAmbientSound(type);
      startAmbientSound(type, ambientVol);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setAmbientVol(v);
    setAmbientVolume(v);
  };

  const handleMagicBreakdown = () => {
    if (!activeTask) return;
    const microSteps = generateMicroBreakdown(activeTask.title, activeTask.description);
    breakdownTask(activeTask.id, microSteps);
    triggerDopamineBurst();
    playSuccessChime();
  };

  const handleSubtaskCheck = (e: React.MouseEvent, subtaskId: string) => {
    if (!activeTask) return;
    toggleSubtask(activeTask.id, subtaskId);
    playSubtaskTick();
    triggerDopamineBurst(e.clientX, e.clientY);
  };

  const handleParkDistraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parkingLotInput.trim()) return;
    quickDump(`[Focus Distraction] ${parkingLotInput.trim()}`);
    setParkingLotInput('');
    setParkedNotice(true);
    setTimeout(() => setParkedNotice(false), 2500);
  };

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Preparing your Focus environment...
        </p>
      </div>
    );
  }

  const parentGoal = activeTask?.goalId ? goals.find((g) => g.id === activeTask.goalId) : null;
  const parentProject = activeTask?.projectId ? projects.find((p) => p.id === activeTask.projectId) : null;

  const handleCustomTimeApply = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(customMinInput);
    if (!isNaN(mins) && mins > 0) {
      setTimerMode('custom', mins);
    }
  };

  const handleFinishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playTimerCompleteFanfare();
    triggerDopamineBurst();
    finishSession(finishNotes, markDoneOnFinish);
    setFinishModalOpen(false);
    setFinishNotes('');
  };

  // ADHD Time Timer Ring calculations (Formal Swiss Precision Gauge)
  const totalDuration = timerDurationSeconds || 25 * 60;
  const timerProgress = Math.max(0, Math.min(1, secondsRemaining / totalDuration));
  const circleRadius = 125;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference * (1 - timerProgress);

  return (
    <div className={`${styles.page} ${isZenMode ? styles.zenMode : ''}`}>
      {/* ── Header (Hidden in Zen Mode) ── */}
      {!isZenMode && (
        <header className={styles.header}>
          <div className={styles.titleArea}>
            <h1 className={styles.title}>Focus Session</h1>
            <p className={styles.subtitle}>
              Lock in your attention on one priority outcome. Eliminate distractions and track deep work time.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.btnReset}
              onClick={toggleZenMode}
              title="Full screen Zen Mode"
            >
              <Maximize2 size={14} /> Fullscreen
            </button>
          </div>
        </header>
      )}

      {/* ── Zen Floating Close Button ── */}
      {isZenMode && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 10 }}>
          <button
            className={styles.btnReset}
            onClick={toggleZenMode}
            style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            <Minimize2 size={16} /> Exit Fullscreen
          </button>
        </div>
      )}

      {/* ── Main Focus Container ── */}
      <div className={styles.focusContainer}>
        {/* Left: Giant Centerpiece Card */}
        <section className={styles.focusCard} aria-labelledby="focus-task-title">
          {/* ── Formal Circular Precision Timer (Numbers 100% Centered Inside Circle) ── */}
          <div className={styles.timeTimerContainer}>
            <svg className={styles.timeTimerSvg} width="280" height="280" viewBox="0 0 280 280">
              {/* Outer Subtle Frame */}
              <circle
                cx="140"
                cy="140"
                r="136"
                fill="none"
                stroke="rgba(255, 255, 255, 0.03)"
                strokeWidth="1"
              />
              {/* Background Track Ring */}
              <circle
                cx="140"
                cy="140"
                r={circleRadius}
                fill="rgba(15, 15, 26, 0.4)"
                stroke="rgba(255, 255, 255, 0.06)"
                strokeWidth="8"
              />
              {/* Active Progress Ring */}
              <circle
                cx="140"
                cy="140"
                r={circleRadius}
                fill="none"
                stroke={timerProgress < 0.2 ? 'var(--color-danger)' : 'var(--color-accent)'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circleCircumference}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: isRunning ? 'stroke-dashoffset 1s linear, stroke 0.3s ease' : 'stroke-dashoffset 0.3s ease',
                  transform: 'rotate(-90deg)',
                  transformOrigin: '50% 50%',
                  filter: `drop-shadow(0 0 6px ${timerProgress < 0.2 ? 'rgba(255, 107, 107, 0.4)' : 'rgba(124, 111, 255, 0.35)'})`,
                }}
              />
            </svg>

            {/* Inner Formal Digits & Status */}
            <div className={styles.timeTimerCenter}>
              <div className={`${styles.timerDisplay} ${isRunning ? styles.activeTick : ''}`}>
                {formatTimer(secondsRemaining)}
              </div>
              <span className={styles.timerSubtitle}>
                {isRunning ? (
                  <span style={{ color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span className={styles.livePulse} /> Active
                  </span>
                ) : (
                  'Ready'
                )}
              </span>
            </div>
          </div>

          {/* Current Task Details */}
          <div className={styles.currentTaskArea}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className={styles.taskTagPill}>
                <Target size={12} /> Current Target
              </span>
              {parentProject && (
                <span style={{ fontSize: '11px', color: 'var(--color-accent-light)', background: 'var(--color-surface-2)', padding: '2px 8px', borderRadius: '4px' }}>
                  Project: {parentProject.title}
                </span>
              )}
              {activeTask?.estimatedDuration && (
                <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
                  Est: {activeTask.estimatedDuration}m • Act: {Math.round((activeTask.actualDuration || 0) + secondsElapsed / 60)}m
                </span>
              )}
            </div>

            <h2 className={styles.taskTitle} id="focus-task-title">
              {activeTask ? activeTask.title : customTaskTitle || 'Focus Session'}
            </h2>

            {/* Why It Matters */}
            {parentGoal?.why && (
              <p className={styles.taskWhy}>
                &ldquo;{parentGoal.why}&rdquo;
              </p>
            )}
            {activeTask?.description && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                {activeTask.description}
              </p>
            )}
          </div>

          {/* ── Subtasks checklist & 1-Click Magic Breakdown ── */}
          <div className={styles.subtasksBox}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Micro-Steps ({activeTask?.subtasks?.filter((s) => s.completed).length || 0}/{activeTask?.subtasks?.length || 0}):
              </span>

              {activeTask && (
                <button
                  className={styles.btnMagicBreakdown}
                  onClick={handleMagicBreakdown}
                  title="Break this task down into tiny 2-to-5 minute steps"
                >
                  Break into 5-Min Steps
                </button>
              )}
            </div>

            {activeTask?.subtasks && activeTask.subtasks.length > 0 ? (
              activeTask.subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className={`${styles.subtaskRow} ${sub.completed ? styles.done : ''}`}
                >
                  <button
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: sub.completed ? 'var(--color-success)' : 'var(--color-text-faint)',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                    onClick={(e) => handleSubtaskCheck(e, sub.id)}
                  >
                    {sub.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                  <span style={{ flex: 1, textAlign: 'left' }}>{sub.title}</span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', margin: 0, padding: '4px 0', textAlign: 'left' }}>
                Feeling stuck? Click <strong>Break into 5-Min Steps</strong> to break this into easy bite-sized actions.
              </p>
            )}
          </div>

          {/* Zen Mode Only Controls */}
          {isZenMode && (
            <div className={styles.controlsRow}>
              {isRunning ? (
                <button className={styles.btnPause} onClick={pauseTimer}>
                  <Pause size={18} /> Pause
                </button>
              ) : (
                <button className={styles.btnStart} onClick={startTimer}>
                  <Play size={18} /> {secondsElapsed > 0 ? 'Resume' : 'Start Focus'}
                </button>
              )}
              <button className={styles.btnReset} onClick={resetTimer} title="Reset timer">
                <RotateCcw size={16} /> Reset
              </button>
              <button
                className={styles.btnFinish}
                onClick={() => setFinishModalOpen(true)}
                title="Finish session and log actual time"
              >
                <CheckCircle2 size={16} /> Finish Session
              </button>
            </div>
          )}
        </section>

        {/* Right Sidebar: Controls, Presets, Parking Lot, Ambient Soundscapes & Focus History */}
        {!isZenMode && (
          <aside className={styles.sideSection}>
            {/* ── 1. Focus Controls (Right Side) ── */}
            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <span className={styles.sideCardTitle}>
                  <Play size={14} /> Session Controls
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {isRunning ? (
                  <button className={styles.sideBtnPause} onClick={pauseTimer}>
                    <Pause size={16} /> Pause Session
                  </button>
                ) : (
                  <button className={styles.sideBtnStart} onClick={startTimer}>
                    <Play size={16} /> {secondsElapsed > 0 ? 'Resume Focus' : 'Start Focus'}
                  </button>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button className={styles.sideActionBtn} onClick={resetTimer} title="Reset timer">
                    <RotateCcw size={13} /> Reset
                  </button>
                  <button
                    className={styles.sideActionBtn}
                    onClick={() => setTaskPickerOpen(true)}
                    title="Switch task"
                  >
                    Switch Target
                  </button>
                </div>

                <button
                  className={styles.sideBtnFinish}
                  onClick={() => setFinishModalOpen(true)}
                  title="Finish session and log actual time"
                >
                  <CheckCircle2 size={14} /> Finish & Log Session
                </button>
              </div>
            </div>

            {/* ── 2. Distraction Parking Lot (Right Side) ── */}
            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <span className={styles.sideCardTitle}>
                  Distraction Parking Lot
                </span>
              </div>

              <form onSubmit={handleParkDistraction} className={styles.sideParkingLotForm}>
                <input
                  type="text"
                  value={parkingLotInput}
                  onChange={(e) => setParkingLotInput(e.target.value)}
                  placeholder="Random thought? Park it here..."
                  className={styles.sideParkingLotInput}
                />
                <button type="submit" className={styles.sideBtnParkSubmit}>
                  <Send size={12} /> Park ↵
                </button>
              </form>
              {parkedNotice && (
                <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600, display: 'block', textAlign: 'center', marginTop: '4px' }}>
                  ✓ Safely parked in your Inbox! Back to flow.
                </span>
              )}
            </div>

            {/* ── 3. Focus Mode Presets ── */}
            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <span className={styles.sideCardTitle}>
                  <Clock size={14} /> Timer Presets
                </span>
              </div>

              <div className={styles.sideModeGrid}>
                <button
                  className={`${styles.sideModeBtn} ${mode === 'pomodoro' ? styles.activeSideMode : ''}`}
                  onClick={() => setTimerMode('pomodoro')}
                >
                  Pomodoro 25m
                </button>
                <button
                  className={`${styles.sideModeBtn} ${mode === 'custom' ? styles.activeSideMode : ''}`}
                  onClick={() => setTimerMode('custom', parseInt(customMinInput) || 30)}
                >
                  Custom {customMinInput}m
                </button>
                <button
                  className={`${styles.sideModeBtn} ${mode === 'short_break' ? styles.activeSideMode : ''}`}
                  onClick={() => setTimerMode('short_break')}
                >
                  Short Break 5m
                </button>
                <button
                  className={`${styles.sideModeBtn} ${mode === 'long_break' ? styles.activeSideMode : ''}`}
                  onClick={() => setTimerMode('long_break')}
                >
                  Long Break 15m
                </button>
                <button
                  className={`${styles.sideModeBtn} ${mode === 'flow' ? styles.activeSideMode : ''}`}
                  onClick={() => setTimerMode('flow')}
                >
                  Flow
                </button>
              </div>
            </div>

            {/* ── Procedural Ambient Sound Generator ── */}
            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <span className={styles.sideCardTitle}>
                  <Volume2 size={14} style={{ color: 'var(--color-accent-light)' }} /> ADHD Ambient Flow Sound
                </span>
                {ambientSound !== 'off' && (
                  <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 700 }}>
                    PLAYING
                  </span>
                )}
              </div>

              <div className={styles.ambientBtnGrid}>
                <button
                  className={`${styles.ambientPill} ${ambientSound === 'brown' ? styles.activeAmbient : ''}`}
                  onClick={() => handleAmbientToggle('brown')}
                  title="Deep Brown Noise (silences racing thoughts)"
                >
                  <Waves size={13} /> Brown Noise
                </button>
                <button
                  className={`${styles.ambientPill} ${ambientSound === 'rain' ? styles.activeAmbient : ''}`}
                  onClick={() => handleAmbientToggle('rain')}
                  title="Soft soothing rain"
                >
                  <CloudRain size={13} /> Soft Rain
                </button>
                <button
                  className={`${styles.ambientPill} ${ambientSound === 'drone' ? styles.activeAmbient : ''}`}
                  onClick={() => handleAmbientToggle('drone')}
                  title="14Hz Alpha wave focus drone"
                >
                  <Radio size={13} /> Alpha Drone
                </button>
                <button
                  className={`${styles.ambientPill} ${ambientSound === 'off' ? styles.activeAmbient : ''}`}
                  onClick={() => {
                    setAmbientSound('off');
                    stopAmbientSound();
                  }}
                  title="Mute ambient sound"
                >
                  <VolumeX size={13} /> Mute
                </button>
              </div>

              {ambientSound !== 'off' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <Volume2 size={12} style={{ color: 'var(--color-text-faint)' }} />
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={ambientVol}
                    onChange={handleVolumeChange}
                    style={{ flex: 1, accentColor: 'var(--color-accent)' }}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-faint)', minWidth: '24px' }}>
                    {Math.round(ambientVol * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Quick Time Customizer */}
            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <span className={styles.sideCardTitle}>
                  <Clock size={14} /> Custom Timer Length
                </span>
              </div>

              <form onSubmit={handleCustomTimeApply} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  min="1"
                  max="300"
                  step="5"
                  value={customMinInput}
                  onChange={(e) => setCustomMinInput(e.target.value)}
                  style={{
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 10px',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-xs)',
                    width: '80px',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>minutes</span>
                <button type="submit" className={styles.btnReset} style={{ padding: '6px 10px', fontSize: '11px' }}>
                  Set
                </button>
              </form>
            </div>

            {/* Focus History */}
            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <span className={styles.sideCardTitle}>
                  <History size={14} /> Focus History ({focusHistory.length})
                </span>
                {focusHistory.length > 0 && (
                  <button
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', fontSize: '10px', cursor: 'pointer' }}
                    onClick={clearFocusHistory}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className={styles.historyList}>
                {focusHistory.length === 0 ? (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
                    No sessions logged yet today.
                  </p>
                ) : (
                  focusHistory.map((sess) => (
                    <div key={sess.id} className={styles.historyItem}>
                      <span className={styles.historyItemTitle}>{sess.taskTitle}</span>
                      <div className={styles.historyItemMeta}>
                        <span>{sess.durationMinutes} mins • {sess.mode}</span>
                        <span>{new Date(sess.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {sess.notes && (
                        <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: 0, fontStyle: 'italic' }}>
                          &ldquo;{sess.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ── Modal: Task Picker ── */}
      {taskPickerOpen && (
        <div className={styles.modalOverlay} onClick={() => setTaskPickerOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Select Focus Target
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setTaskPickerOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
              {tasks
                .filter((t) => t.status !== 'done')
                .map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--color-surface-2)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      border: activeTask?.id === task.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                    }}
                    onClick={() => {
                      selectFocusTask(task);
                      setTaskPickerOpen(false);
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
                        {task.title}
                      </span>
                      {task.estimatedDuration && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginLeft: '6px' }}>
                          • {task.estimatedDuration}m
                        </span>
                      )}
                    </div>
                    <button className={styles.btnReset} style={{ padding: '2px 8px', fontSize: '11px' }}>
                      Select
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Finish Session ── */}
      {finishModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setFinishModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Finish Focus Session
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setFinishModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
              Log {Math.max(1, Math.round(secondsElapsed / 60))} minutes of deep focus to {activeTask ? `"${activeTask.title}"` : customTaskTitle}.
            </p>

            <form onSubmit={handleFinishSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                  Session Notes (Optional)
                </label>
                <textarea
                  value={finishNotes}
                  onChange={(e) => setFinishNotes(e.target.value)}
                  placeholder="What did you accomplish during this focus block?"
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3)',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-xs)',
                    minHeight: '80px',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>

              {activeTask && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--color-text)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={markDoneOnFinish}
                    onChange={(e) => setMarkDoneOnFinish(e.target.checked)}
                  />
                  <span>Mark task &ldquo;{activeTask.title}&rdquo; as completed (Done)</span>
                </label>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: 'var(--space-2)' }}>
                <button type="button" className={styles.btnReset} onClick={() => setFinishModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnFinish}>
                  Save & Log Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
