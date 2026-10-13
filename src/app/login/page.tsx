'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/ui/Logo';
import styles from './page.module.css';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { login, signInWithGoogle, continueAsGuest, error, clearError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    clearError();
    try {
      await login(email, password);
      router.replace('/');
    } catch {
      // Error is set in AuthContext
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    clearError();
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch {
      // Error is set in AuthContext
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.brandHeader}>
          <Logo size={32} showTagline={false} />
          <p className={styles.brandTagline}>Personal Operating System</p>
        </div>

        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Sign in to your private workspace</p>
        </div>

        {/* Google Sign In */}
        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogleSignIn}
          disabled={busy || googleBusy}
          aria-label="Continue with Google"
        >
          <GoogleIcon />
          <span>{googleBusy ? 'Connecting with Google…' : 'Continue with Google'}</span>
        </button>

        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerText}>or continue with email</span>
          <div className={styles.dividerLine} />
        </div>

        {error && (
          <div className={styles.errorAlert} role="alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              disabled={busy || googleBusy}
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="login-password">
              Password
            </label>
            <div className={styles.inputWrap}>
              <input
                id="login-password"
                className={`${styles.input} ${styles.inputWithIcon}`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                disabled={busy || googleBusy}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={busy || googleBusy || !email || !password}
          >
            <span>{busy ? 'Signing in…' : 'Sign In'}</span>
            {!busy && <ArrowRight size={15} />}
          </button>
        </form>

        <div className={styles.switchPrompt}>
          <span>Don&apos;t have an account?</span>
          <Link href="/register" className={styles.switchLink}>
            Create one
          </Link>
        </div>

        <button
          type="button"
          className={styles.guestBtn}
          onClick={() => {
            continueAsGuest();
            router.replace('/');
          }}
          aria-label="Continue to Local Workspace without an account"
        >
          <span>Continue in Local Mode (Offline)</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <div className={styles.footerTrust}>
        <span className={styles.trustItem}>
          <ShieldCheck size={13} />
          End-to-end user isolation
        </span>
        <span className={styles.trustItem}>
          <Lock size={12} />
          Encrypted private storage
        </span>
      </div>
    </main>
  );
}
