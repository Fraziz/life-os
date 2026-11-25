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
  const logoSrc = customLogoUrl || '/logo.png?v=3';

  const iconContent = (
    <img
      src={logoSrc}
      alt="Sariling Mundo Logo"
      width={size}
      height={size}
      className={styles.customLogoImg}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
      }}
    />
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
