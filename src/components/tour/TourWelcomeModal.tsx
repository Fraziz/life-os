'use client';

import React from 'react';
import { useTour } from '@/context/TourContext';
import { Play, Clock, Sparkles } from 'lucide-react';
import styles from './TourModals.module.css';

export default function TourWelcomeModal() {
  const { isWelcomeOpen, startTour, postponeWelcome, dismissWelcome } = useTour();

  if (!isWelcomeOpen) return null;

  return (
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
    >
      <div className={styles.modalCard}>
        <div className={styles.iconWrapper} aria-hidden="true">
          <span>👋</span>
        </div>

        <div className={styles.titleArea}>
          <h2 id="welcome-modal-title" className={styles.modalTitle}>
            Welcome!
          </h2>
          <p className={styles.modalDescription}>
            Would you like a quick tour? We&apos;ll show you how to use the main features of this system.
          </p>
        </div>

        <div className={styles.featuresPills} aria-hidden="true">
          <span className={styles.pill}>
            <Sparkles size={11} /> ADHD-Friendly
          </span>
          <span className={styles.pill}>
            <Clock size={11} /> 2 Minutes
          </span>
          <span className={styles.pill}>8 Simple Steps</span>
        </div>

        <div className={styles.actionsColumn}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => startTour()}
            autoFocus
          >
            <Play size={14} fill="currentColor" />
            <span>Start Tour</span>
          </button>

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={postponeWelcome}
          >
            Maybe Later
          </button>

          <button
            type="button"
            className={styles.btnTertiary}
            onClick={dismissWelcome}
          >
            Skip Tour
          </button>
        </div>
      </div>
    </div>
  );
}
