'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LogIn, Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function LoginPage() {
  const { login, signup, error, clearError } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    clearError();
    try {
      if (mode === 'signup') {
        await signup(email, password);
      } else {
        await login(email, password);
      }
      router.replace('/');
    } catch {
      // Error text is provided by AuthContext
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.badgeRow}>
          <div className={styles.lock}>
            <Lock size={22} />
          </div>
          <span className={styles.privateTag}>
            <Sparkles size={13} />
            Private Life OS
          </span>
        </div>

        <h1 className={styles.title}>{mode === 'signup' ? 'Create your OS' : 'Welcome back'}</h1>
        <p className={styles.lead}>
          {mode === 'signup'
            ? 'Set up your private account to start organizing your life, tasks, and habits.'
            : 'Log in with your private Firebase account to access your tasks, habits, and dashboard.'}
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'var(--color-surface-2)', padding: '4px', borderRadius: '12px' }}>
          <button
            type="button"
            onClick={() => { setMode('login'); clearError(); }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              background: mode === 'login' ? 'var(--color-surface)' : 'transparent',
              color: mode === 'login' ? 'var(--color-text)' : 'var(--color-text-muted)',
              boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); clearError(); }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              background: mode === 'signup' ? 'var(--color-surface)' : 'transparent',
              color: mode === 'signup' ? 'var(--color-text)' : 'var(--color-text-muted)',
              boxShadow: mode === 'signup' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <label className={styles.label} htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            className={styles.input}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@email.com"
            disabled={busy}
            autoFocus
          />

          <div className={styles.passwordHeader}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <button
              type="button"
              className={styles.showPassBtn}
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              <span>{showPassword ? 'Hide' : 'Show'}</span>
            </button>
          </div>

          <input
            id="password"
            className={styles.input}
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder={mode === 'signup' ? 'Choose a password (min 6 chars)' : 'Enter your password'}
            disabled={busy}
          />

          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <button className={styles.primary} type="submit" disabled={busy || !email || !password}>
            <LogIn size={18} />
            {busy
              ? (mode === 'signup' ? 'Creating your OS…' : 'Opening your OS…')
              : (mode === 'signup' ? 'Create Account & Open OS' : 'Log in to Life OS')}
          </button>
        </form>

        <div className={styles.features}>
          <div className={styles.featureItem}>
            <CheckCircle2 size={15} className={styles.checkIcon} />
            <span>Encrypted cloud sync across all your devices</span>
          </div>
          <div className={styles.featureItem}>
            <CheckCircle2 size={15} className={styles.checkIcon} />
            <span>Single-owner access locked to your account</span>
          </div>
        </div>
      </div>
    </div>
  );
}
