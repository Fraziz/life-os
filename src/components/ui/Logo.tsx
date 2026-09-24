'use client';

import React from 'react';
import styles from './Logo.module.css';

interface LogoProps {
  /** Show only the icon mark, not the wordmark */
  iconOnly?: boolean;
  /** Size in pixels for the icon mark SVG */
  size?: number;
  /** Whether to display the brand tagline underneath */
  showTagline?: boolean;
  /** Custom tagline text */
  taglineText?: string;
  /** Optional extra CSS class */
  className?: string;
  /** Wrap the SVG in the modern glass badge */
  withBadge?: boolean;
}

/**
 * Sariling Mundo ("Own World") Logo Mark.
 * Minimalist orbital sphere representing focus and sovereignty.
 */
export default function Logo({
  iconOnly = false,
  size = 28,
  showTagline = false,
  taglineText = 'Better habits. A freer you.',
  className,
  withBadge = true,
}: LogoProps) {
  const iconContent = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.svgIcon}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
      <ellipse
        cx="16"
        cy="16"
        rx="14"
        ry="5"
        transform="rotate(-25 16 16)"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
      />
      <circle cx="16" cy="16" r="3" fill="var(--color-accent)" />
    </svg>
  );

  return (
    <div
      className={`${styles.logoContainer} ${className || ''}`}
      aria-label="Sariling Mundo"
    >
      {withBadge ? (
        <div className={styles.iconBadge}>{iconContent}</div>
      ) : (
        iconContent
      )}

      {!iconOnly && (
        <div className={styles.textGroup}>
          <div className={styles.brandTitle}>
            <span className={styles.wordSariling}>Sariling</span>
            <span className={styles.wordMundo}>Mundo</span>
          </div>
          {showTagline && (
            <span className={styles.tagline}>{taglineText}</span>
          )}
        </div>
      )}
    </div>
  );
}
