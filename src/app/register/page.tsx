'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/ui/Logo';
import styles from '../login/page.module.css';

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

export default function RegisterPage() {
  const { signup, signInWithGoogle, error, clearError } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    if (!email.trim() || !password) return;

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match. Please verify your password.');
      return;
    }

    setBusy(true);
    try {
      await signup(email, password, name.trim());
      router.replace('/');
    } catch {
      // Error is set in AuthContext
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    setValidationError(null);
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
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.subtitle}>Begin your private, isolated workspace</p>
        </div>

        {/* Google Sign Up */}
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
          <span className={styles.dividerText}>or register with email</span>
          <div className={styles.dividerLine} />
        </div>

        {(validationError || error) && (
          <div className={styles.errorAlert} role="alert">
            <span>{validationError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="register-name">
              Your Name
            </label>
            <input
              id="register-name"
              className={styles.input}
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aaron Paul"
              disabled={busy || googleBusy}
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="register-email">
              Email Address
            </label>
            <input
              id="register-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              disabled={busy || googleBusy}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="register-password">
              Password
            </label>
            <div className={styles.inputWrap}>
              <input
                id="register-password"
                className={`${styles.input} ${styles.inputWithIcon}`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
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

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="register-confirm-password">
              Confirm Password
            </label>
            <input
              id="register-confirm-password"
              className={styles.input}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Repeat your password"
              disabled={busy || googleBusy}
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={busy || googleBusy || !email || !password || !confirmPassword}
          >
            <span>{busy ? 'Creating account…' : 'Create Account'}</span>
            {!busy && <ArrowRight size={15} />}
          </button>
        </form>

        <div className={styles.switchPrompt}>
          <span>Already have an account?</span>
          <Link href="/login" className={styles.switchLink}>
            Sign in
          </Link>
        </div>
      </div>

      <div className={styles.footerTrust}>
        <span className={styles.trustItem}>
          <ShieldCheck size={13} />
          Unique workspace per user
        </span>
        <span className={styles.trustItem}>
          <Lock size={12} />
          End-to-end encrypted storage
        </span>
      </div>
    </main>
  );
}
