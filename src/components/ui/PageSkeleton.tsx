'use client';

import React from 'react';
import styles from './PageSkeleton.module.css';

interface PageSkeletonProps {
  variant?: 'default' | 'tasks' | 'dashboard' | 'calendar' | 'cards' | 'knowledge';
  cardsCount?: number;
  showMetrics?: boolean;
  showControls?: boolean;
}

export default function PageSkeleton({
  variant = 'default',
  cardsCount = 4,
  showMetrics = true,
  showControls = true,
}: PageSkeletonProps) {
  return (
    <div className={styles.skeletonContainer} aria-busy="true" aria-label="Loading page content">
      {/* ── Header Skeleton ── */}
      <div className={styles.headerSkeleton}>
        <div className={styles.titleGroup}>
          <div className={`${styles.shimmer} ${styles.titleBar}`} />
          <div className={`${styles.shimmer} ${styles.subtitleBar}`} />
        </div>
        <div className={styles.actionsGroup}>
          <div className={`${styles.shimmer} ${styles.btnSkeleton}`} />
          <div className={`${styles.shimmer} ${styles.btnSkeleton}`} />
        </div>
      </div>

      {/* ── Summary Stats / Metrics ── */}
      {showMetrics && (
        <div className={styles.metricsRow}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.metricCard}>
              <div className={`${styles.shimmer} ${styles.metricIcon}`} />
              <div className={styles.metricTextGroup}>
                <div className={`${styles.shimmer} ${styles.metricValue}`} />
                <div className={`${styles.shimmer} ${styles.metricLabel}`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Controls & Filter Tabs ── */}
      {showControls && (
        <div className={styles.controlsSkeleton}>
          <div className={`${styles.shimmer} ${styles.searchBarSkeleton}`} />
          <div className={styles.tabsSkeleton}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`${styles.shimmer} ${styles.tabPill}`} />
            ))}
          </div>
        </div>
      )}

      {/* ── Content Grid / Feed ── */}
      {variant === 'tasks' || variant === 'default' ? (
        <div className={styles.feedList}>
          {Array.from({ length: cardsCount }).map((_, i) => (
            <div key={i} className={styles.cardItem}>
              <div className={styles.cardTopRow}>
                <div className={`${styles.shimmer} ${styles.cardTag}`} />
                <div className={`${styles.shimmer} ${styles.cardDate}`} />
              </div>
              <div className={`${styles.shimmer} ${styles.cardTitle}`} />
              <div className={`${styles.shimmer} ${styles.cardDesc}`} />
              <div className={styles.cardFooter}>
                <div className={`${styles.shimmer} ${styles.cardBadge}`} />
                <div className={`${styles.shimmer} ${styles.cardAvatar}`} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.gridList}>
          {Array.from({ length: cardsCount }).map((_, i) => (
            <div key={i} className={styles.cardItem}>
              <div className={styles.cardTopRow}>
                <div className={`${styles.shimmer} ${styles.cardTag}`} />
                <div className={`${styles.shimmer} ${styles.cardDate}`} />
              </div>
              <div className={`${styles.shimmer} ${styles.cardTitle}`} />
              <div className={`${styles.shimmer} ${styles.cardDesc}`} />
              <div className={styles.cardFooter}>
                <div className={`${styles.shimmer} ${styles.cardBadge}`} />
                <div className={`${styles.shimmer} ${styles.cardAvatar}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
