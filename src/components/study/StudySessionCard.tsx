'use client';

import React, { useState } from 'react';
import {
  Clock,
  Lock,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  History,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  Volume2,
} from 'lucide-react';
import styles from './StudySessionCard.module.css';
import { useStudySession } from '@/context/StudySessionContext';
import { playTimerAlarmSound } from '@/utils/soundAndDopamine';

interface StudySessionCardProps {
  onOpenReadingLogs?: () => void;
  className?: string;
  compact?: boolean;
}

export default function StudySessionCard({
  onOpenReadingLogs,
  className,
  compact = false,
}: StudySessionCardProps) {
  const {
    mode,
    pomoState,
    isRunning,
    pomoSecondsLeft,
    pomoDuration,
    stopwatchSeconds,
    sessionCount,
    localTimeStr,
    currentBookTitle,
    currentLessonTitle,
    settings,
    updateSettings,
    completionMessage,
    clearCompletionMessage,
    start,
    pause,
    resume,
    reset,
    setMode,
    setPomoState,
    skipToNextPomo,
    saveActiveStopwatchSession,
  } = useStudySession();

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Formatting Digits
  const pomoMins = Math.floor(pomoSecondsLeft / 60);
  const pomoSecs = pomoSecondsLeft % 60;
  const pomoFormatted = `${String(pomoMins).padStart(2, '0')}:${String(pomoSecs).padStart(2, '0')}`;

  const swHrs = Math.floor(stopwatchSeconds / 3600);
  const swMins = Math.floor((stopwatchSeconds % 3600) / 60);
  const swSecs = stopwatchSeconds % 60;
  const swFormatted =
    swHrs > 0
      ? `${swHrs}:${String(swMins).padStart(2, '0')}:${String(swSecs).padStart(2, '0')}`
      : `${String(swMins).padStart(2, '0')}:${String(swSecs).padStart(2, '0')}`;

  // Circular progress calculation
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = pomoDuration > 0 ? Math.max(0, Math.min(1, pomoSecondsLeft / pomoDuration)) : 1;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div className={`${styles.studyCard} ${className || ''}`}>
      {/* 1. Local Time & Reader Status */}
      <div className={styles.localTimeRow}>
        <div className={styles.localTimeBox} title="Your current local time">
          <Clock size={12} style={{ color: 'var(--color-accent-light)' }} />
          <span>Local Time</span>
          <span className={styles.localTimeClock}>{localTimeStr || '--:--'}</span>
        </div>
        <span className={styles.bookLockedBadge}>
          <Lock size={9} />
          Book Reader
        </span>
      </div>

      {/* 2. Timer Type Switch (Pomodoro | Stopwatch) */}
      <div className={styles.timerTypeSwitch} role="tablist" aria-label="Timer Type">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'pomodoro'}
          className={`${styles.typeSwitchBtn} ${mode === 'pomodoro' ? styles.typeSwitchBtnActive : ''}`}
          onClick={() => setMode('pomodoro')}
        >
          Pomodoro
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'stopwatch'}
          className={`${styles.typeSwitchBtn} ${mode === 'stopwatch' ? styles.typeSwitchBtnActive : ''}`}
          onClick={() => setMode('stopwatch')}
        >
          Stopwatch
        </button>
      </div>

      {/* Pomodoro Sub-State Navigation (Focus | Short Break | Long Break) */}
      {mode === 'pomodoro' && (
        <div className={styles.pomoStateTabs} role="tablist" aria-label="Pomodoro Cycle Stage">
          <button
            type="button"
            className={`${styles.pomoStateBtn} ${pomoState === 'focus' ? styles.pomoStateBtnActive : ''}`}
            onClick={() => setPomoState('focus')}
          >
            Focus
          </button>
          <button
            type="button"
            className={`${styles.pomoStateBtn} ${pomoState === 'shortBreak' ? styles.pomoStateBtnActive : ''}`}
            onClick={() => setPomoState('shortBreak')}
          >
            Short Break
          </button>
          <button
            type="button"
            className={`${styles.pomoStateBtn} ${pomoState === 'longBreak' ? styles.pomoStateBtnActive : ''}`}
            onClick={() => setPomoState('longBreak')}
          >
            Long Break
          </button>
        </div>
      )}

      {/* Completion Banner Alert */}
      {completionMessage && (
        <div className={styles.completionBanner} role="alert">
          <span>{completionMessage}</span>
          <button
            type="button"
            className={styles.completionBannerClose}
            onClick={clearCompletionMessage}
            aria-label="Dismiss message"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* 3. Timer Display Centerpiece */}
      <div className={styles.displayContainer}>
        {mode === 'pomodoro' ? (
          <div className={styles.progressRingWrapper}>
            <svg className={styles.progressRingSvg} viewBox="0 0 160 160">
              <circle
                className={styles.progressRingTrack}
                cx="80"
                cy="80"
                r={radius}
              />
              <circle
                className={styles.progressRingIndicator}
                cx="80"
                cy="80"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className={styles.progressRingContent}>
              <span className={styles.pomoStateLabel}>
                {pomoState === 'focus'
                  ? 'Focus'
                  : pomoState === 'shortBreak'
                  ? 'Short Break'
                  : 'Long Break'}
              </span>
              <div className={`${styles.timerDigits} ${pomoFormatted.length > 5 ? styles.timerDigitsSm : ''}`}>
                {pomoFormatted}
              </div>
              <span className={styles.timerStatusSub}>
                {!isRunning && pomoSecondsLeft === pomoDuration
                  ? 'Ready to focus'
                  : isRunning
                  ? 'Timer active'
                  : 'Paused'}
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.stopwatchBox}>
            <div className={styles.stopwatchDigitsRow}>
              <span
                className={`${styles.statusIndicatorDot} ${
                  !isRunning ? styles.statusIndicatorDotPaused : ''
                }`}
              />
              <div className={`${styles.timerDigits} ${swFormatted.length > 5 ? styles.timerDigitsSm : ''}`}>
                {swFormatted}
              </div>
            </div>
            <span className={styles.timerStatusSub}>
              {stopwatchSeconds === 0 && !isRunning
                ? 'Ready • Tap Start to track elapsed time'
                : isRunning
                ? 'Study session in progress'
                : 'Session paused'}
            </span>
          </div>
        )}
      </div>

      {/* 4. Main Controls (Start, Pause, Resume, Reset) */}
      <div className={styles.controlsRow}>
        <button
          type="button"
          className={`${styles.primaryControlBtn} ${isRunning ? styles.primaryControlBtnRunning : ''}`}
          onClick={isRunning ? pause : (mode === 'pomodoro' ? (pomoSecondsLeft < pomoDuration ? resume : start) : (stopwatchSeconds > 0 ? resume : start))}
        >
          {isRunning ? (
            <>
              <Pause size={14} />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play size={14} />
              <span>
                {mode === 'pomodoro'
                  ? pomoSecondsLeft < pomoDuration
                    ? 'Resume'
                    : 'Start Focus'
                  : stopwatchSeconds > 0
                  ? 'Resume'
                  : 'Start'}
              </span>
            </>
          )}
        </button>

        {/* Reset Button */}
        {((mode === 'pomodoro' && pomoSecondsLeft < pomoDuration) ||
          (mode === 'stopwatch' && stopwatchSeconds > 0)) && (
          <button
            type="button"
            className={styles.secondaryControlBtn}
            onClick={reset}
            title="Reset timer"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        )}

        {/* Skip Button for Pomodoro */}
        {mode === 'pomodoro' && (
          <button
            type="button"
            className={styles.secondaryControlBtn}
            onClick={skipToNextPomo}
            title="Skip to next session / break"
          >
            <SkipForward size={13} />
          </button>
        )}

        {/* Save Stopwatch Session Button */}
        {mode === 'stopwatch' && stopwatchSeconds >= 30 && (
          <button
            type="button"
            className={styles.secondaryControlBtn}
            onClick={saveActiveStopwatchSession}
            title="Log elapsed time to book history"
          >
            <span>Log</span>
          </button>
        )}
      </div>

      {/* 5. Session Information */}
      <div className={styles.sessionInfoBox}>
        <div className={styles.sessionInfoRow}>
          <span className={styles.sessionInfoLabel}>Current Session</span>
          <span className={styles.sessionInfoValue}>
            {mode === 'pomodoro'
              ? `Session ${sessionCount} of ${settings.sessionsBeforeLongBreak}`
              : 'Reading Tracker'}
          </span>
        </div>
        <div className={styles.sessionInfoRow}>
          <span className={styles.sessionInfoLabel}>Associated Book</span>
          <span className={styles.sessionBookTitle} title={currentBookTitle || 'Current Book'}>
            {currentBookTitle || 'Active Book'}
          </span>
        </div>
        {currentLessonTitle && (
          <div className={styles.sessionInfoRow}>
            <span className={styles.sessionInfoLabel}>Video Lesson</span>
            <span className={styles.sessionBookTitle} title={currentLessonTitle}>
              {currentLessonTitle}
            </span>
          </div>
        )}
      </div>

      {/* 6. Reading Logs & Stats */}
      {onOpenReadingLogs && (
        <button
          type="button"
          className={styles.readingLogsBtn}
          onClick={onOpenReadingLogs}
          title="Open Reading History &amp; Study Stats"
        >
          <History size={13} />
          <span>Reading Logs &amp; Stats</span>
        </button>
      )}

      {/* 7. Collapsible Timer Settings */}
      <button
        type="button"
        className={styles.settingsToggleBtn}
        onClick={() => setSettingsOpen(!settingsOpen)}
        aria-expanded={settingsOpen}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <SlidersHorizontal size={11} />
          <span>Timer Settings</span>
        </span>
        {settingsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {settingsOpen && (
        <div className={styles.settingsAccordion}>
          <div className={styles.settingRow}>
            <span className={styles.settingLabel}>Focus (min)</span>
            <input
              type="number"
              min={1}
              max={120}
              className={styles.settingInput}
              value={settings.focusMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) updateSettings({ focusMinutes: val });
              }}
            />
          </div>
          <div className={styles.settingRow}>
            <span className={styles.settingLabel}>Short Break (min)</span>
            <input
              type="number"
              min={1}
              max={60}
              className={styles.settingInput}
              value={settings.shortBreakMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) updateSettings({ shortBreakMinutes: val });
              }}
            />
          </div>
          <div className={styles.settingRow}>
            <span className={styles.settingLabel}>Long Break (min)</span>
            <input
              type="number"
              min={1}
              max={90}
              className={styles.settingInput}
              value={settings.longBreakMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) updateSettings({ longBreakMinutes: val });
              }}
            />
          </div>
          <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className={styles.settingLabel}>Timer End Sound</span>
            <button
              type="button"
              className={styles.testAlarmBtn}
              onClick={() => playTimerAlarmSound()}
              title="Test clock timer alarm sound"
            >
              <Volume2 size={11} /> Test Alarm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
