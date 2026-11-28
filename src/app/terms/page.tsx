import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Terms of Service — Sariling Mundo',
  description: 'Terms governing the use of Sariling Mundo personal operating system.',
};

export default function TermsOfServicePage() {
  return (
    <main className={styles.wrap}>
      <article className={styles.container}>
        <header className={styles.header}>
          <Link href="/login" className={styles.backLink}>
            Back to Sign In
          </Link>
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.updated}>Last updated: November 2026</p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Acceptance of Terms</h2>
          <p className={styles.paragraph}>
            By creating an account or using Sariling Mundo, you agree to use the service lawfully and remain responsible
            for safeguarding your login credentials, passcodes, and any third-party AI API keys you configure.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Your Content &amp; Backups</h2>
          <p className={styles.paragraph}>
            You retain full ownership of every note, book, file, task, and plan you enter into Sariling Mundo.
            While cloud sync and local IndexedDB backups are designed for reliability, we recommend periodically saving
            a JSON snapshot from Settings before clearing browser storage or switching devices.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Acceptable Use</h2>
          <ul className={styles.list}>
            <li>Do not attempt to access other users&apos; accounts, bypass rate limits, or probe internal endpoints.</li>
            <li>Do not upload illegal content or abuse server AI/link-preview resources.</li>
            <li>Accounts or automated traffic violating service stability may be rate-limited or suspended.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Service Availability</h2>
          <p className={styles.paragraph}>
            Sariling Mundo is provided &quot;as is&quot; without warranties of uninterrupted availability. Features may evolve over
            time, and you may export your data or delete your account at any moment in Settings.
          </p>
        </section>

        <footer className={styles.footer}>
          <Link href="/privacy" className={styles.footerLink}>Privacy Policy</Link>
          <Link href="/register" className={styles.footerLink}>Create Account</Link>
          <Link href="/" className={styles.footerLink}>Workspace</Link>
        </footer>
      </article>
    </main>
  );
}
