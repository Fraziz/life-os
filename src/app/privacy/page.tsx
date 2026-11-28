import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Privacy Policy — Sariling Mundo',
  description: 'How Sariling Mundo handles account data, local storage, cloud sync, and deletion.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.wrap}>
      <article className={styles.container}>
        <header className={styles.header}>
          <Link href="/login" className={styles.backLink}>
            Back to Sign In
          </Link>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.updated}>Last updated: November 2026</p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. What Data We Store</h2>
          <p className={styles.paragraph}>
            Sariling Mundo stores the workspace data you create — including tasks, goals, projects, dreams,
            Idea Parking notes, calendar schedules, habits, uploaded attachments, and Books &amp; Knowledge documents —
            strictly inside your browser (localStorage / IndexedDB) and, when signed in, your isolated user directory
            in Google Firebase.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Account Isolation &amp; Access Control</h2>
          <ul className={styles.list}>
            <li>Authentication is handled via Firebase Authentication (Email/Password or Google Sign-In).</li>
            <li>Cloud Firestore and Firebase Storage enforce per-user access rules keyed to your unique user ID (`uid`).</li>
            <li>No other signed-in user can query or modify your workspace collections, books, or files.</li>
            <li>Local-only Guest Mode keeps all workspace data strictly on your current device browser.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Optional AI Assistant Providers</h2>
          <p className={styles.paragraph}>
            If you configure an AI provider or enter your own API key in Settings, prompts are sent to that selected
            provider only when you trigger an AI action. Your API keys remain under your account settings and are
            automatically scrubbed from JSON snapshot exports.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Data Export &amp; Permanent Deletion</h2>
          <p className={styles.paragraph}>
            You own your workspace data. At any time inside Settings → Data Backup &amp; Portability, you can export a
            full JSON snapshot, reset your workspace while preserving books, wipe all workspace data, or permanently
            delete your Firebase account and associated cloud records.
          </p>
        </section>

        <footer className={styles.footer}>
          <Link href="/terms" className={styles.footerLink}>Terms of Service</Link>
          <Link href="/register" className={styles.footerLink}>Create Account</Link>
          <Link href="/" className={styles.footerLink}>Workspace</Link>
        </footer>
      </article>
    </main>
  );
}
