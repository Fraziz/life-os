import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './status.module.css';

export const metadata: Metadata = {
  title: 'Page Not Found — Sariling Mundo',
  description: 'The requested page could not be found.',
};

export default function NotFound() {
  return (
    <main className={styles.wrap}>
      <section className={styles.card}>
        <div className={styles.kicker}>
          <span className={styles.dot} aria-hidden="true" />
          <span>404 — Not Found</span>
        </div>
        <h1 className={styles.title}>This page does not exist</h1>
        <p className={styles.desc}>
          The link you followed may have moved or is no longer available in your workspace.
        </p>
        <div className={styles.actions}>
          <Link href="/" className={styles.primaryBtn}>
            Return to Workspace
          </Link>
          <Link href="/login" className={styles.secondaryBtn}>
            Sign In
          </Link>
        </div>
      </section>
    </main>
  );
}
