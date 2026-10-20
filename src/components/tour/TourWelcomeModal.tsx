'use client';

import React from 'react';
import { useTour } from '@/context/TourContext';
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
        <div className={styles.titleArea}>
          <div className={styles.modalBadge}>Guided Tour</div>
          <h2 id="welcome-modal-title" className={styles.modalTitle}>
            Welcome to Sariling Mundo
          </h2>
          <p className={styles.modalDescription}>
            Would you like a quick interactive tour? We&apos;ll introduce you to the core structure and everyday tools of your system.
          </p>
        </div>

        <div className={styles.featuresPills} aria-hidden="true">
          <span className={styles.pill}>ADHD-Optimized</span>
          <span className={styles.pill}>2 Minutes</span>
          <span className={styles.pill}>8 Steps</span>
        </div>

        <div className={styles.actionsColumn}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => startTour()}
            autoFocus
          >
            Start Tour
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
