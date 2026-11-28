'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import styles from './status.module.css';

export default function RouteError({
  error,
  retry,
  reset,
}: {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error('[Sariling Mundo] Route error boundary caught:', error);
  }, [error]);

  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? String((error as { digest?: string }).digest || '')
      : '';

  const handleRetry = () => {
    if (typeof retry === 'function') {
      retry();
      return;
    }
    if (typeof reset === 'function') {
      reset();
      return;
    }
    window.location.reload();
  };

  return (
    <main className={styles.wrap}>
      <section className={styles.card} role="alert">
        <div className={styles.kicker}>
          <span className={styles.dot} aria-hidden="true" />
          <span>Recovery Mode</span>
        </div>
        <h1 className={styles.title}>Something interrupted this view</h1>
        <p className={styles.desc}>
          Your saved workspace data is safe. Retry loading this page or return to the Today view.
        </p>
        {digest && (
          <div className={styles.digest}>
            Reference ID: {digest}
          </div>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={handleRetry}>
            Try Again
          </button>
          <Link href="/" className={styles.secondaryBtn}>
            Return to Today
          </Link>
        </div>
      </section>
    </main>
  );
}
