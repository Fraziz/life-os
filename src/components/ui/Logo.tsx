'use client';

import React, { useContext } from 'react';
import { SettingsContext } from '@/context/SettingsContext';
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
 * Minimalist orbital sphere representing focus, sovereignty, and personal universe.
 */
export default function Logo({
  iconOnly = false,
  size = 28,
  showTagline = false,
  taglineText = 'Better habits. A freer you.',
  className,
  withBadge = true,
}: LogoProps) {
  const settingsCtx = useContext(SettingsContext);
  const customLogoUrl = settingsCtx?.settings?.customLogoUrl;

  const iconContent = customLogoUrl ? (
    <img
      src={customLogoUrl}
      alt="Workspace Logo"
      width={size}
      height={size}
      className={styles.customLogoImg}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        borderRadius: withBadge ? '4px' : '6px',
        display: 'block',
      }}
    />
  ) : (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.svgIcon}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sm-logo-ring" x1="2" y1="16" x2="30" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--color-accent, #6366f1)" />
          <stop offset="60%" stopColor="var(--color-accent, #6366f1)" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* Precision World Sphere */}
      <circle
        cx="16"
        cy="16"
        r="10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.8"
      />
      {/* Dynamic Orbital Ring (Back Arc) */}
      <path
        d="M 5 20.5 C 7 13.5, 23 8.5, 27 12"
        stroke="url(#sm-logo-ring)"
        strokeWidth="1.4"
        strokeOpacity="0.4"
        strokeDasharray="2 1.5"
      />
      {/* Dynamic Orbital Ring (Front Arc) */}
      <path
        d="M 4.5 21 C 7.5 27, 24.5 24, 27.5 12.5"
        stroke="url(#sm-logo-ring)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Focal Core Nexus Dot */}
      <circle cx="16" cy="16" r="2.8" fill="var(--color-accent, #6366f1)" />
      {/* Orbital Satellite Beacon */}
      <circle cx="24.8" cy="14.8" r="1.4" fill="#38bdf8" />
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
