'use client';

import React, { useState } from 'react';
import type { Task } from '@/types';
import styles from './SoftUIWidgetBar.module.css';

interface SoftUIWidgetBarProps {
  mainFocusTask?: Task | null;
  onToggleFocusTask?: (taskId: string) => void;
  nextActionText?: string;
  onQuickDump?: (text: string) => void;
  todayTasksCount?: number;
  completedTasksCount?: number;
}

export default function SoftUIWidgetBar({
  mainFocusTask,
  onToggleFocusTask,
  nextActionText,
  onQuickDump,
  todayTasksCount = 0,
  completedTasksCount = 0,
}: SoftUIWidgetBarProps) {
  // Card 1: Cyan Focus Counter (reference 25)
  const [focusTarget, setFocusTarget] = useState<number>(25);

  // Card 2: Orange Energy / Target Index (reference 23°)
  const [energyLevel, setEnergyLevel] = useState<number>(23);
  const [meterStep, setMeterStep] = useState<number>(3); // 1 to 5

  // Knob states
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [audioAmbient, setAudioAmbient] = useState<boolean>(true);
  const [hapticFeed, setHapticFeed] = useState<boolean>(false);

  // Quick dump state inside tile
  const [localDump, setLocalDump] = useState<string>('');
  const [dumpSent, setDumpSent] = useState<boolean>(false);

  const incrementFocus = () => setFocusTarget((prev) => Math.min(60, prev + 5));
  const decrementFocus = () => setFocusTarget((prev) => Math.max(5, prev - 5));

  const incrementEnergy = () => {
    setEnergyLevel((prev) => Math.min(30, prev + 1));
    setMeterStep((prev) => Math.min(5, prev + 1));
  };

  const decrementEnergy = () => {
    setEnergyLevel((prev) => Math.max(16, prev - 1));
    setMeterStep((prev) => Math.max(1, prev - 1));
  };

  const handleDumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localDump.trim()) return;
    if (onQuickDump) {
      onQuickDump(localDump.trim());
    }
    setLocalDump('');
    setDumpSent(true);
    setTimeout(() => setDumpSent(false), 2000);
  };

  return (
    <div className={styles.consoleFrame}>{/* ── Soft UI Console (2x2 Grid) ── */}
        {/* Row 1, Col 1: Card 1 (25 with Cyan chevrons) */}
        <div className={styles.softCard}>
          <span className={styles.cardLabel}>Focus Min</span>
          <div className={styles.numberCyan}>{focusTarget}</div>
          <div className={styles.chevronRow}>
            <button
              type="button"
              className={styles.softCircleBtn}
              onClick={decrementFocus}
              aria-label="Decrease focus duration"
              title="Decrease duration"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.softCircleBtn}
              onClick={incrementFocus}
              aria-label="Increase focus duration"
              title="Increase duration"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Row 1, Col 2: Card 3 (Top-Right Square Focus & Capture Card) */}
        <div className={styles.focusTile}>
          <div className={styles.tileHeader}>
            <span className={styles.tileEyebrow}>Primary Objective</span>
            <button
              type="button"
              className={styles.tileActionBtn}
              onClick={() => window.dispatchEvent(new CustomEvent('open-next-action'))}
            >
              Next Action ↗
            </button>
          </div>

          <div className={styles.taskDisplay}>
            {mainFocusTask ? (
              <>
                <button
                  type="button"
                  className={styles.taskCheckBtn}
                  onClick={() => onToggleFocusTask && onToggleFocusTask(mainFocusTask.id)}
                  title="Mark done"
                  aria-label="Mark task done"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
                <div className={styles.taskTextWrap}>
                  <p className={styles.taskTitleText}>{mainFocusTask.title}</p>
                  <span className={styles.taskSubMeta}>
                    {mainFocusTask.estimatedDuration ? `${mainFocusTask.estimatedDuration}m` : 'Next priority'}
                  </span>
                </div>
              </>
            ) : (
              <div className={styles.taskTextWrap}>
                <p className={styles.taskTitleText}>
                  {nextActionText || 'Everything clear for now'}
                </p>
                <span className={styles.taskSubMeta}>
                  {todayTasksCount > 0 ? `${todayTasksCount} tasks queued` : 'Ready to capture'}
                </span>
              </div>
            )}
          </div>

          {/* Integrated Brain Dump Quick Capture */}
          <form onSubmit={handleDumpSubmit} className={styles.tileDumpInputWrap}>
            <input
              type="text"
              className={styles.tileDumpInput}
              value={localDump}
              onChange={(e) => setLocalDump(e.target.value)}
              placeholder={dumpSent ? '✓ Captured to Inbox!' : 'Dump a thought (2 sec)...'}
            />
            <button type="submit" className={styles.tileDumpSendBtn} title="Quick Dump">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>

        {/* Row 2, Col 1: Card 2 (23° with Orange segmented meter) */}
        <div className={styles.softCard}>
          <span className={styles.cardLabel}>Energy Index</span>
          <div className={styles.numberOrange}>{energyLevel}°</div>
          <div className={styles.thermostatRow}>
            <button
              type="button"
              className={styles.stepIconBtn}
              onClick={decrementEnergy}
              aria-label="Decrease energy target"
            >
              −
            </button>
            <div className={styles.meterSegments} aria-label={`Level ${meterStep} of 5`}>
              {[1, 2, 3, 4, 5].map((idx) => (
                <span
                  key={idx}
                  className={`${styles.segment} ${idx <= meterStep ? styles.active : ''}`}
                />
              ))}
            </div>
            <button
              type="button"
              className={styles.stepIconBtn}
              onClick={incrementEnergy}
              aria-label="Increase energy target"
            >
              +
            </button>
          </div>
        </div>

        {/* Row 2, Col 2: 3 Circular Knobs Stacked Vertically */}
        <div className={styles.knobsTile}>
          {/* Knob 1: Raised convex dial (Zen mode) */}
          <button
            type="button"
            className={`${styles.softDialRaised} ${zenMode ? styles.active : ''}`}
            onClick={() => setZenMode(!zenMode)}
            title="Zen / Deep Focus Mode"
            aria-label="Toggle Zen Mode"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v18" />
            </svg>
          </button>

          {/* Knob 2: Raised convex dial (Ambient sound) */}
          <button
            type="button"
            className={`${styles.softDialRaised} ${audioAmbient ? styles.active : ''}`}
            onClick={() => setAudioAmbient(!audioAmbient)}
            title="Ambient Soundscape"
            aria-label="Toggle Ambient Audio"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          </button>

          {/* Knob 3: Sunken concave socket with glowing indicator (AI Assistant) */}
          <button
            type="button"
            className={styles.softDialSunken}
            onClick={() => {
              setHapticFeed(!hapticFeed);
              window.dispatchEvent(new CustomEvent('open-assistant'));
            }}
            title="AI Assistant Socket"
            aria-label="Open AI Assistant"
          >
            <span
              className={styles.dialIndicator}
              style={{ color: hapticFeed ? '#00c2ff' : '#ff7a00' }}
            />
          </button>
        </div>
    </div>
  );
}
