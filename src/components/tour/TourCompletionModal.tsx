'use client';

import React from 'react';
import { useTour } from '@/context/TourContext';
import { Compass, RotateCcw } from 'lucide-react';
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
        <div className={styles.iconWrapper} aria-hidden="true">
          <span>🎉</span>
        </div>

        <div className={styles.titleArea}>
          <h2 id="completion-modal-title" className={styles.modalTitle}>
            You&apos;re all set!
          </h2>
          <p className={styles.modalDescription}>
            You now know the basics. You&apos;re ready to explore the system!
          </p>
        </div>

        <div className={styles.actionsColumn}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={skipTour}
            autoFocus
          >
            <Compass size={15} />
            <span>Start Exploring</span>
          </button>

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={restartTour}
          >
            <RotateCcw size={13} />
            <span>Restart Tour</span>
          </button>
        </div>
      </div>
    </div>
  );
}
