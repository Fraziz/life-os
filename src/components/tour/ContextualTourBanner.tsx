'use client';

import React from 'react';
import { useTour } from '@/context/TourContext';
import { Sparkles } from 'lucide-react';
import styles from './ContextualTourBanner.module.css';

interface ContextualTourBannerProps {
  tourId: string;
  featureName?: string;
}

export default function ContextualTourBanner({ tourId, featureName }: ContextualTourBannerProps) {
  const { isContextualDismissed, dismissContextualTour, startTour, isOpen } = useTour();

  // If already dismissed, or if a tour is currently running, hide
  if (isContextualDismissed(tourId) || isOpen) {
    return null;
  }

  const handleStart = () => {
    startTour(tourId, 0);
  };

  const handleDismiss = () => {
    dismissContextualTour(tourId);
  };

  return (
    <div className={styles.banner} role="region" aria-label="Feature Guide Prompt">
      <div className={styles.leftGroup}>
        <Sparkles size={14} className={styles.icon} />
        <span>
          New here? Take a quick tour of {featureName || 'this feature'}.
        </span>
      </div>

      <div className={styles.rightGroup}>
        <button type="button" className={styles.btnShowMe} onClick={handleStart}>
          Show Me
        </button>
        <button type="button" className={styles.btnNotNow} onClick={handleDismiss}>
          Not Now
        </button>
      </div>
    </div>
  );
}
