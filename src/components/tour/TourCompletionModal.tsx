'use client';

import React from 'react';
import { useTour } from '@/context/TourContext';
import styles from './TourModals.module.css';

export default function TourCompletionModal() {
  const { isCompletionOpen, restartTour, skipTour } = useTour();

  if (!isCompletionOpen) return null;

  return (
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-modal-title"
    >
      <div className={styles.modalCard}>
        <div className={styles.titleArea}>
          <div className={styles.modalBadge}>Tour Complete</div>
          <h2 id="completion-modal-title" className={styles.modalTitle}>
            You&apos;re All Set
          </h2>
          <p className={styles.modalDescription}>
            You now know the essentials. Start exploring your workspace, or restart the tour anytime from your profile settings.
          </p>
        </div>

        <div className={styles.actionsColumn}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={skipTour}
            autoFocus
          >
            Start Exploring
          </button>

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={restartTour}
          >
            Restart Tour
          </button>
        </div>
      </div>
    </div>
  );
}
