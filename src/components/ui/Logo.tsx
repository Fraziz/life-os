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
 * The mark depicts a futuristic personal sphere (Mundo) — with an angled
 * orbital ring, dimensional meridians, and a radiant focal center.
 * Represents self-mastery, focus, and personal sovereignty.
 * (No star icons).
 */
export default function Logo({
  iconOnly = false,
  size = 30,
  showTagline = false,
  taglineText = 'Better habits. A freer you.',
  className,
  withBadge = true,
}: LogoProps) {
  const iconContent = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.svgIcon}
      aria-hidden="true"
    >
      <defs>
        {/* Outer boundary gradient */}
        <linearGradient id="sm-border-grad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>

        {/* Sphere inner ambient glow */}
        <radialGradient id="sm-sphere-grad" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.32" />
          <stop offset="70%" stopColor="#6366f1" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.02" />
        </radialGradient>

        {/* Equatorial orbital ring */}
        <linearGradient id="sm-ring-grad" x1="2" y1="18" x2="34" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="45%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>

        {/* Meridian curved arc */}
        <linearGradient id="sm-meridian-grad" x1="18" y1="4" x2="18" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c084fc" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.5" />
        </linearGradient>

        {/* Luminous core */}
        <radialGradient id="sm-core-grad" cx="40%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#c7d2fe" />
          <stop offset="100%" stopColor="#6366f1" />
        </radialGradient>
      </defs>

      {/* 1. World Sphere Fill & Outer Perimeter ("Mundo") */}
      <circle cx="18" cy="18" r="13.5" fill="url(#sm-sphere-grad)" />
      <circle cx="18" cy="18" r="13.5" stroke="url(#sm-border-grad)" strokeWidth="1.6" />

      {/* 2. Longitudinal Meridian Arc (defines spherical dimension) */}
      <ellipse
        cx="18"
        cy="18"
        rx="7"
        ry="13.5"
        stroke="url(#sm-meridian-grad)"
        strokeWidth="1.2"
        fill="none"
      />

      {/* 3. Latitudinal Horizon / Equator curve */}
      <path
        d="M 5 16 C 10 20.5, 26 20.5, 31 16"
        stroke="url(#sm-meridian-grad)"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        strokeOpacity="0.75"
      />

      {/* 4. Planetary Equatorial Tilted Orbit Ring (-25 deg Earth tilt) */}
      <ellipse
        cx="18"
        cy="18"
        rx="16.2"
        ry="5.6"
        transform="rotate(-25 18 18)"
        stroke="url(#sm-ring-grad)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* 5. Center Core Singularity (self-mastery beacon) */}
      <circle cx="18" cy="18" r="4.8" stroke="url(#sm-ring-grad)" strokeWidth="0.8" strokeOpacity="0.5" strokeDasharray="1.5 2" fill="none" />
      <circle cx="18" cy="18" r="2.8" fill="url(#sm-core-grad)" />
    </svg>
  );

  return (
    <div
      className={`${styles.logoContainer} ${className || ''}`}
      aria-label="Sariling Mundo"
    >
      {/* Icon mark */}
      {withBadge ? (
        <div className={styles.iconBadge}>{iconContent}</div>
      ) : (
        iconContent
      )}

      {/* Brand Wordmark */}
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
