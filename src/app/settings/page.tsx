'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import {
  clearLocalWorkspaceSilently,
  flushCloudNow,
  startFreshKeepBooks,
  stopCloudSync,
  wipeCloudKv,
} from '@/lib/cloudStore';
import { flushPendingBookSaves, wipeCloudBooks } from '@/lib/bookCloudSync';
import { idbClear, idbGet, idbSet } from '@/lib/idbStore';
import type { AppTheme, ColorThemeId, UserSettings } from '@/types';
import { COLOR_THEMES } from '@/config/themes';
import {
  User,
  Sliders,
  Bell,
  Sun,
  Moon,
  Download,
  Upload,
  Trash2,
  LogOut,
  Eye,
  EyeOff,
  Monitor,
  Clock,
  HelpCircle,
} from 'lucide-react';

import ActiveDevices from '@/components/settings/ActiveDevices';
import { useTour } from '@/context/TourContext';
import { usePwaInstall } from '@/utils/usePwaInstall';
import PageSkeleton from '@/components/ui/PageSkeleton';
import styles from './page.module.css';

const TIMEZONES = [
  'UTC',
  'Asia/Manila',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Dubai',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Australia/Sydney',
];

const WEEKDAYS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 7, label: 'Sun' },
];

type SettingsTab = 'account' | 'appearance' | 'focus' | 'notifications' | 'data';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
  { id: 'account', label: 'Account', icon: <User size={15} /> },
  { id: 'appearance', label: 'Appearance & App', icon: <Sun size={15} /> },
  { id: 'focus', label: 'Focus & Schedule', icon: <Clock size={15} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
  { id: 'data', label: 'Data & Help', icon: <HelpCircle size={15} /> },
];

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, isLoaded } = useSettings();
  const { user, isGuest, logout, logoutAllDevices, changePassword, deleteAccount } = useAuth();
  const { confirm: confirmDialog, alert: alertDialog, prompt: promptDialog } = useConfirm();
  const {
    startTour,
    restartTour,
    resetAllTours,
    isOpen: isTourOpen,
    currentStep: currentTourStep,
  } = useTour();
  const { canPromptInstall, isStandalone, isInstalled, promptInstall } = usePwaInstall();

  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [formData, setFormData] = useState<UserSettings>(settings);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [toastText, setToastText] = useState('Saved');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Desktop companion bridge state
  const [showInstallTip, setShowInstallTip] = useState(false);
  const [hasDesktopBridge, setHasDesktopBridge] = useState(false);
  const [desktopBubble, setDesktopBubble] = useState<{
    visible: boolean;
    mode: 'circle' | 'line' | 'pill';
    edge: 'left' | 'right';
    popoverVisible?: boolean;
  } | null>(null);
  const [desktopCompanion, setDesktopCompanion] = useState<{
    openAtLogin: boolean;
    soundEnabled: boolean;
    edgeBlinkEnabled?: boolean;
    isBlinking?: boolean;
    blinkPaused?: boolean;
  } | null>(null);

  // Password Change state
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordChangeBusy, setPasswordChangeBusy] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  // Session & Account deletion state
  const [loggingOut, setLoggingOut] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountPhrase, setDeleteAccountPhrase] = useState('');
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Backup state
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  // Platform AI status
  const [platformAiStatus, setPlatformAiStatus] = useState<{
    enabled: boolean;
    configured: boolean;
    provider: string;
    model: string;
  } | null>(null);

  const flashSaved = (msg = 'Preferences saved') => {
    setToastText(msg);
    setShowSavedToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowSavedToast(false), 2000);
  };

  // Instant auto-save helper
  const commitSettings = (patch: Partial<UserSettings>, feedbackMsg?: string) => {
    const next = { ...formData, ...patch };
    setFormData(next);
    updateSettings(patch);
    if (feedbackMsg) flashSaved(feedbackMsg);
  };

  useEffect(() => {
    if (isLoaded) {
      setFormData(settings);
      setDisplayNameDraft(
        settings.profile.displayName ||
          user?.displayName ||
          (user?.email ? user.email.split('@')[0] : '')
      );
    }
  }, [settings, isLoaded, user]);

  useEffect(() => {
    const desktopApi = (
      window as Window & {
        sarilingDesktop?: {
          getBubbleConfig?: () => Promise<typeof desktopBubble>;
          getCompanionConfig?: () => Promise<typeof desktopCompanion>;
        };
      }
    ).sarilingDesktop;
    if (desktopApi?.getBubbleConfig) {
      setHasDesktopBridge(true);
      void desktopApi
        .getBubbleConfig()
        .then((cfg) => {
          if (cfg) setDesktopBubble(cfg);
        })
        .catch(() => {});
      void desktopApi
        .getCompanionConfig?.()
        .then((cfg) => {
          if (cfg) setDesktopCompanion(cfg);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/ai/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setPlatformAiStatus({
            enabled: Boolean(data.enabled),
            configured: Boolean(data.configured),
            provider: String(data.provider || ''),
            model: String(data.model || ''),
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Switch automatically to Appearance tab when Interactive Tour or #desktop-app anchor targets it
  useEffect(() => {
    if (isTourOpen && currentTourStep?.target === '[data-tour="desktop-edge-card"]') {
      setActiveTab('appearance');
    }
  }, [isTourOpen, currentTourStep]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#desktop-app') {
      setActiveTab('appearance');
    }
  }, []);

  if (!isLoaded) {
    return <PageSkeleton variant="default" cardsCount={3} showMetrics={false} showControls={false} />;
  }

  const handleSaveProfileName = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = displayNameDraft.trim();
    commitSettings(
      {
        profile: {
          ...formData.profile,
          displayName: clean,
          name: clean || formData.profile.name,
        },
      },
      'Display name saved'
    );
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccess(false);

    if (newPasswordInput.length < 6) {
      setPasswordChangeError('New password must be at least 6 characters.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordChangeError('New passwords do not match.');
      return;
    }

    setPasswordChangeBusy(true);
    try {
      await changePassword(currentPasswordInput, newPasswordInput);
      setPasswordChangeSuccess(true);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      flashSaved('Password updated');
    } catch (err: unknown) {
      setPasswordChangeError(
        err instanceof Error ? err.message : 'Failed to update password. Try again.'
      );
    } finally {
      setPasswordChangeBusy(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    const confirmed = await confirmDialog({
      title: 'Log Out All Devices',
      message:
        'This will sign you out on all phones, tablets, and computers. You will need to sign back in on each device.',
      confirmLabel: 'Log Out All',
      isDestructive: true,
    });
    if (!confirmed) return;
    setLoggingOutAll(true);
    try {
      await logoutAllDevices();
    } finally {
      setLoggingOutAll(false);
    }
  };

  const handleExportBackup = async () => {
    if (typeof window === 'undefined') return;
    const backup: Record<string, unknown> = {};
    const sensitiveKeys = new Set([
      'life_os_guest_vault_pin',
      'life_os_active_uid',
      'life_os_guest_mode',
    ]);

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        !sensitiveKeys.has(key) &&
        (key.startsWith('life_os_') || key.startsWith('life-os-') || key.startsWith('lifeos_'))
      ) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || 'null');
          if (key === 'life_os_user_settings_v1' && parsed && typeof parsed === 'object') {
            const copy = { ...(parsed as Record<string, unknown>) };
            if (copy.aiSettings && typeof copy.aiSettings === 'object') {
              copy.aiSettings = {
                ...(copy.aiSettings as Record<string, unknown>),
                apiKey: '',
                savedKeys: [],
                activeKeyId: undefined,
              };
            }
            backup[key] = copy;
          } else {
            backup[key] = parsed;
          }
        } catch {
          backup[key] = localStorage.getItem(key);
        }
      }
    }

    try {
      const idbDocs = await idbGet('life_os_knowledge_docs_v1');
      if (Array.isArray(idbDocs) && idbDocs.length > 0) {
        backup['life_os_knowledge_docs_v1'] = idbDocs;
      }
    } catch {}

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sariling-mundo-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setRestoreStatus('Reading backup file...');
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== 'object') {
        await alertDialog({
          title: 'Invalid Backup File',
          message: 'Please select a valid JSON backup file.',
        });
        setRestoreStatus(null);
        return;
      }

      const ignoredImportKeys = new Set([
        'life_os_guest_vault_pin',
        'life_os_active_uid',
        'life_os_guest_mode',
      ]);
      const keys = Object.keys(data).filter(
        (k) =>
          !ignoredImportKeys.has(k) &&
          (k.startsWith('life_os_') || k.startsWith('life-os-') || k.startsWith('lifeos_'))
      );

      if (keys.length === 0) {
        await alertDialog({
          title: 'No Data Found',
          message: 'No recognized workspace data was found in this file.',
        });
        setRestoreStatus(null);
        return;
      }

      const confirmRestore = await confirmDialog({
        title: 'Restore Backup',
        message: `Restore ${keys.length} data categories from "${file.name}"?`,
        confirmLabel: 'Restore',
      });
      if (!confirmRestore) {
        setRestoreStatus(null);
        if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
        return;
      }

      setRestoreStatus('Restoring data...');
      for (const key of keys) {
        const val = data[key];
        const valStr = typeof val === 'string' ? val : JSON.stringify(val);
        try {
          localStorage.setItem(key, valStr);
        } catch {}

        if (key === 'life_os_knowledge_docs_v1' && Array.isArray(val)) {
          void idbSet('life_os_knowledge_docs_v1', val);
          void idbSet('life_os_knowledge_docs_backup', val);
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('life_os_cloud_synced'));
      }
      await flushCloudNow();

      setRestoreStatus('Backup restored!');
      await alertDialog({
        title: 'Backup Restored',
        message: 'Your workspace backup was restored. The page will now reload.',
      });
      window.location.reload();
    } catch {
      await alertDialog({
        title: 'Import Failed',
        message: 'Could not read this backup file. Please verify it is a valid JSON export.',
      });
      setRestoreStatus(null);
    } finally {
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
    }
  };

  const toggleWorkDay = (dayId: number) => {
    const current = formData.workingHours.workDays;
    const updatedDays = current.includes(dayId)
      ? current.filter((d) => d !== dayId)
      : [...current, dayId].sort();
    commitSettings({
      workingHours: {
        ...formData.workingHours,
        workDays: updatedDays,
      },
    });
  };

  const resolvedUserLabel =
    formData.profile.displayName ||
    user?.displayName ||
    (user?.email ? user.email.split('@')[0] : 'Personal User');

  const isGoogleOnly =
    Boolean(user?.providerData?.some((p) => p.providerId === 'google.com')) &&
    !user?.providerData?.some((p) => p.providerId === 'password');

  return (
    <div className={styles.realSettingsShell}>
      <header className={styles.realSettingsHeader}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Manage your account, appearance, focus timers, and data.</p>
        </div>
        {showSavedToast && (
          <span className={styles.savedInlinePill} role="status" aria-live="polite">
            {toastText}
          </span>
        )}
      </header>

      <div className={styles.realSettingsLayout}>
        {/* Left Navigation Rail (Horizontal Pills on Mobile) */}
        <nav className={styles.realSettingsNav} aria-label="Settings sections">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.realNavItem} ${
                activeTab === tab.id ? styles.realNavItemActive : ''
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Active Settings Content Pane */}
        <div className={styles.realSettingsContent}>
          {/* ═══════════════════════════════════════════════════════
              TAB 1: ACCOUNT
              ═══════════════════════════════════════════════════════ */}
          {activeTab === 'account' && (
            <>
              <section className={styles.cleanGroupCard}>
                <h2 className={styles.cleanGroupTitle}>Profile</h2>
                <div className={styles.profileSummaryRow}>
                  <div className={styles.profileAvatarCircle}>
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      resolvedUserLabel.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--color-text)' }}>
                        {resolvedUserLabel}
                      </strong>
                      <span className={styles.accountTypeTag}>
                        {isGuest
                          ? 'Guest Mode'
                          : isGoogleOnly
                          ? 'Google Account'
                          : 'Email Account'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {user?.email || 'Local workspace on this browser'}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSaveProfileName} className={styles.inlineFieldRow}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label className={styles.label} htmlFor="display-name-input">
                      Display Name (shown in greetings)
                    </label>
                    <input
                      id="display-name-input"
                      type="text"
                      className={styles.input}
                      value={displayNameDraft}
                      onChange={(e) => setDisplayNameDraft(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <button type="submit" className={styles.btnSecondary} style={{ height: 38 }}>
                    Save Name
                  </button>
                </form>
              </section>

              {/* Password Card */}
              {!isGoogleOnly && (
                <section className={styles.cleanGroupCard}>
                  <div>
                    <h2 className={styles.cleanGroupTitle}>Password</h2>
                    <p className={styles.cleanGroupDesc}>
                      Update your login password and Private Notes Vault lock.
                    </p>
                  </div>

                  {passwordChangeError && (
                    <div className={styles.testErrorBox} role="alert">
                      {passwordChangeError}
                    </div>
                  )}
                  {passwordChangeSuccess && (
                    <div className={styles.testSuccessBox} role="status">
                      Password updated successfully.
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className={styles.passwordFormGrid}>
                    <div>
                      <label className={styles.label}>
                        Current Password {isGuest ? '(or Passcode)' : ''}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showCurrentPass ? 'text' : 'password'}
                          value={currentPasswordInput}
                          onChange={(e) => setCurrentPasswordInput(e.target.value)}
                          placeholder="Current password"
                          disabled={passwordChangeBusy}
                          className={styles.input}
                          style={{ paddingRight: 34 }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPass((v) => !v)}
                          tabIndex={-1}
                          className={styles.eyeIconBtn}
                          aria-label="Toggle password visibility"
                        >
                          {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={styles.label}>New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showNewPass ? 'text' : 'password'}
                          value={newPasswordInput}
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                          placeholder="At least 6 characters"
                          minLength={6}
                          disabled={passwordChangeBusy}
                          className={styles.input}
                          style={{ paddingRight: 34 }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass((v) => !v)}
                          tabIndex={-1}
                          className={styles.eyeIconBtn}
                          aria-label="Toggle new password visibility"
                        >
                          {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={styles.label}>Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder="Repeat new password"
                        minLength={6}
                        disabled={passwordChangeBusy}
                        className={styles.input}
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        className={styles.btnPrimary}
                        disabled={
                          passwordChangeBusy || !newPasswordInput || !confirmPasswordInput
                        }
                      >
                        {passwordChangeBusy ? 'Updating…' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {/* Sessions & Sign Out */}
              <section className={styles.cleanGroupCard}>
                <div>
                  <h2 className={styles.cleanGroupTitle}>Sessions &amp; Sign Out</h2>
                  <p className={styles.cleanGroupDesc}>
                    Manage devices signed in to your workspace.
                  </p>
                </div>

                {user?.uid && !isGuest && <ActiveDevices uid={user.uid} />}

                <div className={styles.rowActionsFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={handleLogout}
                    disabled={loggingOut || loggingOutAll}
                  >
                    <LogOut size={13} />
                    <span>{loggingOut ? 'Signing out…' : 'Sign Out'}</span>
                  </button>

                  {!isGuest && (
                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={handleLogoutAllDevices}
                      disabled={loggingOut || loggingOutAll}
                    >
                      <span>
                        {loggingOutAll ? 'Signing out everywhere…' : 'Log Out All Devices'}
                      </span>
                    </button>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════
              TAB 2: APPEARANCE & DESKTOP APP
              ═══════════════════════════════════════════════════════ */}
          {activeTab === 'appearance' && (
            <>
              <section className={styles.cleanGroupCard}>
                <div>
                  <h2 className={styles.cleanGroupTitle}>Theme &amp; Color Palette</h2>
                  <p className={styles.cleanGroupDesc}>
                    Auto-adjusts with your system Day/Night cycle. You can also left-click the
                    top-right theme circle to cycle colors or right-click it for quick choices.
                  </p>
                </div>

                <div className={styles.themeGrid}>
                  {(
                    [
                      {
                        id: 'system',
                        label: 'Auto System',
                        desc: 'Matches OS Light / Dark automatically',
                        icon: <Sliders size={14} />,
                      },
                      {
                        id: 'light',
                        label: 'Light',
                        desc: 'Soft low-glare daylight surfaces',
                        icon: <Sun size={14} />,
                      },
                      {
                        id: 'dark',
                        label: 'Dark',
                        desc: 'Deep calm evening surfaces',
                        icon: <Moon size={14} />,
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.themeBtn} ${
                        formData.theme === item.id ? styles.themeBtnActive : ''
                      }`}
                      onClick={() =>
                        commitSettings({ theme: item.id as AppTheme }, `${item.label} active`)
                      }
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.icon}
                        <span style={{ fontWeight: 600 }}>{item.label}</span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--color-text-muted)',
                          marginTop: 2,
                        }}
                      >
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>

                <div className={styles.paletteGridSettings}>
                  {COLOR_THEMES.map((pal) => {
                    const isActive = (formData.colorTheme || 'slate') === pal.id;
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        className={`${styles.themeBtn} ${isActive ? styles.themeBtnActive : ''}`}
                        onClick={() =>
                          commitSettings(
                            { colorTheme: pal.id as ColorThemeId },
                            `${pal.label} applied`
                          )
                        }
                        style={{ alignItems: 'flex-start', textAlign: 'left' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              border: '1px solid var(--color-border)',
                              background: `linear-gradient(135deg, ${pal.lightSurface} 50%, ${pal.lightAccent} 50%)`,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{pal.label}</span>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-text-muted)',
                            marginTop: 2,
                          }}
                        >
                          {pal.mood}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className={styles.toggleRow} style={{ paddingTop: 12, borderBottom: 'none' }}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Simple Sidebar Mode</span>
                    <span className={styles.toggleDesc}>
                      Show only core daily pages in the sidebar to reduce visual clutter.
                    </span>
                  </div>
                  <label className={styles.switch} aria-label="Simple Sidebar Mode">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.simpleMode)}
                      onChange={(e) =>
                        commitSettings(
                          { simpleMode: e.target.checked },
                          e.target.checked ? 'Simple Mode enabled' : 'Full navigation enabled'
                        )
                      }
                    />
                    <span className={styles.slider} />
                  </label>
                </div>
              </section>

              {/* Desktop App & Screen-Edge Bubble */}
              <section
                id="desktop-app"
                data-tour="desktop-edge-card"
                className={styles.cleanGroupCard}
              >
                <div className={styles.rowBetweenWrap}>
                  <div>
                    <h2 className={styles.cleanGroupTitle}>Desktop App &amp; Screen-Edge Bubble</h2>
                    <p className={styles.cleanGroupDesc}>
                      Use Sariling Mundo in its own desktop window and control the screen-edge
                      companion bubble.
                    </p>
                  </div>
                  <span className={styles.accountTypeTag}>
                    {isStandalone
                      ? 'Desktop Window'
                      : isInstalled
                      ? 'Installed'
                      : 'Web Browser'}
                  </span>
                </div>

                {!isStandalone && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {canPromptInstall ? (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={async () => {
                            const outcome = await promptInstall();
                            if (outcome === 'accepted') {
                              flashSaved('Installing Desktop App…');
                            }
                          }}
                        >
                          <Monitor size={14} />
                          <span>Install Desktop App</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => setShowInstallTip((v) => !v)}
                        >
                          <Monitor size={14} />
                          <span>How to Install on Desktop</span>
                        </button>
                      )}
                    </div>

                    {showInstallTip && !canPromptInstall && (
                      <div className={styles.subtleHintBox}>
                        Click the <strong>Install</strong> icon in your browser&apos;s address bar
                        (or open your browser menu → <strong>Apps → Install this site as an app</strong>)
                        to pin Sariling Mundo to your Taskbar and Desktop.
                      </div>
                    )}
                  </div>
                )}

                <div
                  style={{
                    paddingTop: 12,
                    borderTop: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      Floating Bubble &amp; Edge Line
                    </span>
                    <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                      {hasDesktopBridge
                        ? 'Switch between Circle, Edge Line, or Pill mode and manage edge alerts.'
                        : 'Open the floating AI assistant bubble anytime, or drag it to snap to either screen edge.'}
                    </p>
                  </div>

                  <div className={styles.logoActionsRow}>
                    {hasDesktopBridge ? (
                      <>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={async () => {
                            const api = (
                              window as Window & {
                                sarilingDesktop?: {
                                  setBubbleVisible?: (v: boolean) => Promise<typeof desktopBubble>;
                                };
                              }
                            ).sarilingDesktop;
                            if (!api?.setBubbleVisible) return;
                            const next = await api.setBubbleVisible(!desktopBubble?.visible);
                            if (next) setDesktopBubble(next);
                          }}
                        >
                          {desktopBubble?.visible ? 'Hide Bubble' : 'Show Bubble'}
                        </button>
                        {(['circle', 'line', 'pill'] as const).map((modeKey) => (
                          <button
                            key={modeKey}
                            type="button"
                            className={
                              desktopBubble?.mode === modeKey
                                ? styles.btnPrimary
                                : styles.btnSecondary
                            }
                            onClick={async () => {
                              const api = (
                                window as Window & {
                                  sarilingDesktop?: {
                                    setBubbleMode?: (
                                      m: 'circle' | 'line' | 'pill'
                                    ) => Promise<typeof desktopBubble>;
                                  };
                                }
                              ).sarilingDesktop;
                              if (!api?.setBubbleMode) return;
                              const next = await api.setBubbleMode(modeKey);
                              if (next) setDesktopBubble(next);
                            }}
                          >
                            {modeKey === 'circle'
                              ? 'Circle'
                              : modeKey === 'line'
                              ? 'Edge Line'
                              : 'Pill'}
                          </button>
                        ))}
                        <button
                          type="button"
                          className={
                            desktopCompanion?.openAtLogin ? styles.btnPrimary : styles.btnSecondary
                          }
                          onClick={async () => {
                            const api = (
                              window as Window & {
                                sarilingDesktop?: {
                                  setStartupEnabled?: (
                                    e: boolean
                                  ) => Promise<typeof desktopCompanion>;
                                };
                              }
                            ).sarilingDesktop;
                            if (!api?.setStartupEnabled) return;
                            const next = await api.setStartupEnabled(
                              !desktopCompanion?.openAtLogin
                            );
                            if (next) setDesktopCompanion(next);
                          }}
                        >
                          {desktopCompanion?.openAtLogin
                            ? 'Launch at Startup: On'
                            : 'Launch at Startup: Off'}
                        </button>
                        <button
                          type="button"
                          className={
                            desktopCompanion?.edgeBlinkEnabled !== false
                              ? styles.btnPrimary
                              : styles.btnSecondary
                          }
                          onClick={async () => {
                            const api = (
                              window as Window & {
                                sarilingDesktop?: {
                                  setEdgeBlinkEnabled?: (
                                    e: boolean
                                  ) => Promise<typeof desktopCompanion>;
                                };
                              }
                            ).sarilingDesktop;
                            if (!api?.setEdgeBlinkEnabled) return;
                            const next = await api.setEdgeBlinkEnabled(
                              !(desktopCompanion?.edgeBlinkEnabled !== false)
                            );
                            if (next) setDesktopCompanion(next);
                          }}
                        >
                          {desktopCompanion?.edgeBlinkEnabled !== false
                            ? 'Edge Blink: On'
                            : 'Edge Blink: Muted'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chat'))}
                      >
                        Open Floating Assistant
                      </button>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════
              TAB 3: FOCUS, SCHEDULE & AI
              ═══════════════════════════════════════════════════════ */}
          {activeTab === 'focus' && (
            <>
              <section className={styles.cleanGroupCard}>
                <div>
                  <h2 className={styles.cleanGroupTitle}>Focus Timer</h2>
                  <p className={styles.cleanGroupDesc}>
                    Default session lengths used in Focus Space.
                  </p>
                </div>

                <div className={styles.threeColFields}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="pomodoro-duration">
                      Focus (minutes)
                    </label>
                    <input
                      id="pomodoro-duration"
                      type="number"
                      min="5"
                      max="120"
                      className={styles.input}
                      value={formData.focusPreferences.pomodoroDuration}
                      onChange={(e) =>
                        commitSettings({
                          focusPreferences: {
                            ...formData.focusPreferences,
                            pomodoroDuration: Math.max(5, Math.min(120, parseInt(e.target.value) || 25)),
                          },
                        })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="short-break-duration">
                      Short Break (minutes)
                    </label>
                    <input
                      id="short-break-duration"
                      type="number"
                      min="1"
                      max="30"
                      className={styles.input}
                      value={formData.focusPreferences.shortBreakDuration}
                      onChange={(e) =>
                        commitSettings({
                          focusPreferences: {
                            ...formData.focusPreferences,
                            shortBreakDuration: Math.max(1, Math.min(30, parseInt(e.target.value) || 5)),
                          },
                        })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="long-break-duration">
                      Long Break (minutes)
                    </label>
                    <input
                      id="long-break-duration"
                      type="number"
                      min="5"
                      max="60"
                      className={styles.input}
                      value={formData.focusPreferences.longBreakDuration}
                      onChange={(e) =>
                        commitSettings({
                          focusPreferences: {
                            ...formData.focusPreferences,
                            longBreakDuration: Math.max(5, Math.min(60, parseInt(e.target.value) || 15)),
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className={styles.toggleRow} style={{ borderBottom: 'none' }}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Auto-Start Breaks</span>
                    <span className={styles.toggleDesc}>
                      Automatically start your break timer as soon as a focus session finishes.
                    </span>
                  </div>
                  <label className={styles.switch} aria-label="Auto-Start Breaks">
                    <input
                      type="checkbox"
                      checked={formData.focusPreferences.autoStartBreaks}
                      onChange={(e) =>
                        commitSettings({
                          focusPreferences: {
                            ...formData.focusPreferences,
                            autoStartBreaks: e.target.checked,
                          },
                        })
                      }
                    />
                    <span className={styles.slider} />
                  </label>
                </div>
              </section>

              <section className={styles.cleanGroupCard}>
                <div>
                  <h2 className={styles.cleanGroupTitle}>Working Hours &amp; Task Defaults</h2>
                  <p className={styles.cleanGroupDesc}>
                    Used when scheduling your day and estimating new tasks.
                  </p>
                </div>

                <div className={styles.gridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="timezone-select">
                      Time Zone
                    </label>
                    <select
                      id="timezone-select"
                      className={styles.select}
                      value={formData.timeZone}
                      onChange={(e) => commitSettings({ timeZone: e.target.value }, 'Time zone saved')}
                    >
                      {!TIMEZONES.includes(formData.timeZone) && (
                        <option value={formData.timeZone}>{formData.timeZone}</option>
                      )}
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="task-duration-select">
                      Default Task Length
                    </label>
                    <select
                      id="task-duration-select"
                      className={styles.select}
                      value={formData.defaultTaskDuration}
                      onChange={(e) =>
                        commitSettings({ defaultTaskDuration: parseInt(e.target.value, 10) })
                      }
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={90}>90 minutes</option>
                    </select>
                  </div>
                </div>

                <div className={styles.gridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="work-start">
                      Day Starts At
                    </label>
                    <input
                      id="work-start"
                      type="time"
                      className={styles.input}
                      value={formData.workingHours.start}
                      onChange={(e) =>
                        commitSettings({
                          workingHours: { ...formData.workingHours, start: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="work-end">
                      Day Ends At
                    </label>
                    <input
                      id="work-end"
                      type="time"
                      className={styles.input}
                      value={formData.workingHours.end}
                      onChange={(e) =>
                        commitSettings({
                          workingHours: { ...formData.workingHours, end: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Active Days</label>
                  <div className={styles.daysGrid}>
                    {WEEKDAYS.map((day) => {
                      const isActive = formData.workingHours.workDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          className={`${styles.dayChip} ${isActive ? styles.activeDay : ''}`}
                          onClick={() => toggleWorkDay(day.id)}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className={styles.cleanGroupCard}>
                <div className={styles.rowBetweenWrap}>
                  <div>
                    <h2 className={styles.cleanGroupTitle}>AI Assistant</h2>
                    <p className={styles.cleanGroupDesc}>
                      Powered centrally by your workspace—no personal API key required.
                    </p>
                  </div>
                  <span
                    className={`${styles.aiStatusBadge} ${
                      formData.aiSettings?.enabled !== false &&
                      platformAiStatus?.enabled &&
                      platformAiStatus?.configured
                        ? styles.active
                        : styles.inactive
                    }`}
                  >
                    <span className={styles.statusDot} />
                    {formData.aiSettings?.enabled === false
                      ? 'Paused'
                      : platformAiStatus?.enabled && platformAiStatus?.configured
                      ? 'Connected'
                      : 'Local Mode'}
                  </span>
                </div>

                <div className={styles.toggleRow} style={{ borderBottom: 'none' }}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Enable AI Features</span>
                    <span className={styles.toggleDesc}>
                      Use AI chat, task breakdown, schedule optimization, and daily briefings.
                    </span>
                  </div>
                  <label className={styles.switch} aria-label="Enable AI Features">
                    <input
                      type="checkbox"
                      checked={formData.aiSettings?.enabled !== false}
                      onChange={(e) =>
                        commitSettings(
                          {
                            aiSettings: {
                              enabled: e.target.checked,
                              provider: formData.aiSettings?.provider || 'groq',
                              model: formData.aiSettings?.model || 'openai/gpt-oss-120b',
                              apiKey: '',
                              monthlyBudgetUSD: formData.aiSettings?.monthlyBudgetUSD || 10,
                              spentBudgetUSD: formData.aiSettings?.spentBudgetUSD || 0,
                              totalTokensUsed: formData.aiSettings?.totalTokensUsed || 0,
                              temperature: formData.aiSettings?.temperature || 0.7,
                            },
                          },
                          e.target.checked ? 'AI features enabled' : 'AI features paused'
                        )
                      }
                    />
                    <span className={styles.slider} />
                  </label>
                </div>
              </section>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════
              TAB 4: NOTIFICATIONS
              ═══════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <section className={styles.cleanGroupCard}>
              <div>
                <h2 className={styles.cleanGroupTitle}>Reminders &amp; Quiet Hours</h2>
                <p className={styles.cleanGroupDesc}>
                  Choose which reminders nudge you and when your workspace stays silent.
                </p>
              </div>

              <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                  <span className={styles.toggleTitle}>In-App Reminders</span>
                  <span className={styles.toggleDesc}>
                    Master switch for task, deadline, and routine notifications.
                  </span>
                </div>
                <label className={styles.switch} aria-label="In-App Reminders">
                  <input
                    type="checkbox"
                    checked={formData.notifications.enabled}
                    onChange={(e) =>
                      commitSettings({
                        notifications: { ...formData.notifications, enabled: e.target.checked },
                      })
                    }
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                  <span className={styles.toggleTitle}>Browser / Desktop Push Notifications</span>
                  <span className={styles.toggleDesc}>
                    Receive system notifications even when Sariling Mundo is in the background.
                  </span>
                </div>
                <label className={styles.switch} aria-label="Desktop Push Notifications">
                  <input
                    type="checkbox"
                    checked={formData.notifications.browserNotifications}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked && typeof window !== 'undefined' && 'Notification' in window) {
                        void Notification.requestPermission();
                      }
                      commitSettings({
                        notifications: {
                          ...formData.notifications,
                          browserNotifications: checked,
                        },
                      });
                    }}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                  <span className={styles.toggleTitle}>Task &amp; Project Deadlines</span>
                  <span className={styles.toggleDesc}>
                    Alert when due dates and pinned reminders arrive.
                  </span>
                </div>
                <label className={styles.switch} aria-label="Task & Project Deadlines">
                  <input
                    type="checkbox"
                    checked={formData.notifications.taskReminders}
                    onChange={(e) =>
                      commitSettings({
                        notifications: {
                          ...formData.notifications,
                          taskReminders: e.target.checked,
                          deadlineAlerts: e.target.checked,
                        },
                      })
                    }
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                  <span className={styles.toggleTitle}>Daily Routine &amp; Focus Blocks</span>
                  <span className={styles.toggleDesc}>
                    Gentle reminders for scheduled focus sessions and daily routines.
                  </span>
                </div>
                <label className={styles.switch} aria-label="Daily Routine & Focus Blocks">
                  <input
                    type="checkbox"
                    checked={formData.notifications.habitReminders}
                    onChange={(e) =>
                      commitSettings({
                        notifications: {
                          ...formData.notifications,
                          habitReminders: e.target.checked,
                          scheduledWorkAlerts: e.target.checked,
                        },
                      })
                    }
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.toggleRow} style={{ borderBottom: 'none' }}>
                <div className={styles.toggleLabel}>
                  <span className={styles.toggleTitle}>Quiet Hours</span>
                  <span className={styles.toggleDesc}>
                    Silence non-urgent alerts overnight so you can rest.
                  </span>
                </div>
                <label className={styles.switch} aria-label="Quiet Hours">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.notifications.quietHours?.enabled)}
                    onChange={(e) =>
                      commitSettings({
                        notifications: {
                          ...formData.notifications,
                          quietHours: {
                            enabled: e.target.checked,
                            start: formData.notifications.quietHours?.start || '22:00',
                            end: formData.notifications.quietHours?.end || '08:00',
                          },
                        },
                      })
                    }
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              {formData.notifications.quietHours?.enabled && (
                <div className={styles.gridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Quiet From</label>
                    <input
                      type="time"
                      className={styles.input}
                      value={formData.notifications.quietHours?.start || '22:00'}
                      onChange={(e) =>
                        commitSettings({
                          notifications: {
                            ...formData.notifications,
                            quietHours: {
                              enabled: true,
                              start: e.target.value,
                              end: formData.notifications.quietHours?.end || '08:00',
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Until</label>
                    <input
                      type="time"
                      className={styles.input}
                      value={formData.notifications.quietHours?.end || '08:00'}
                      onChange={(e) =>
                        commitSettings({
                          notifications: {
                            ...formData.notifications,
                            quietHours: {
                              enabled: true,
                              start: formData.notifications.quietHours?.start || '22:00',
                              end: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ═══════════════════════════════════════════════════════
              TAB 5: DATA, BACKUP & HELP
              ═══════════════════════════════════════════════════════ */}
          {activeTab === 'data' && (
            <>
              <section className={styles.cleanGroupCard}>
                <div>
                  <h2 className={styles.cleanGroupTitle}>Guides &amp; Shortcuts</h2>
                  <p className={styles.cleanGroupDesc}>
                    Quick refreshers on how Sariling Mundo works.
                  </p>
                </div>

                <div className={styles.cleanActionList}>
                  <div className={styles.cleanActionRow}>
                    <div>
                      <span className={styles.cleanActionTitle}>Interactive System Tour</span>
                      <span className={styles.cleanActionSub}>
                        Walk through Today, Routine, Idea Parking, Tasks, AI Bubble, and Edge.
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => restartTour()}
                    >
                      Replay Tour
                    </button>
                  </div>

                  <div className={styles.cleanActionRow}>
                    <div>
                      <span className={styles.cleanActionTitle}>Edge &amp; Floating Bubble Guide</span>
                      <span className={styles.cleanActionSub}>
                        2-step walkthrough of screen-edge docking, pop-out AI, and Edge Line mode.
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => startTour('edge-companion', 0)}
                    >
                      Start Guide
                    </button>
                  </div>

                  <div className={styles.cleanActionRow}>
                    <div>
                      <span className={styles.cleanActionTitle}>Keyboard Shortcuts</span>
                      <span className={styles.cleanActionSub}>
                        Press <code>?</code> anywhere or <code>Ctrl+K</code> for quick search.
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => {
                        resetAllTours();
                        flashSaved('Page tips reset');
                      }}
                    >
                      Reset Page Tips
                    </button>
                  </div>
                </div>
              </section>

              <section className={styles.cleanGroupCard}>
                <div>
                  <h2 className={styles.cleanGroupTitle}>Backup &amp; Restore</h2>
                  <p className={styles.cleanGroupDesc}>
                    Download a portable copy of your workspace or restore from a JSON backup.
                  </p>
                </div>

                <div className={styles.cleanActionList}>
                  <div className={styles.cleanActionRow}>
                    <div>
                      <span className={styles.cleanActionTitle}>Export Backup (.json)</span>
                      <span className={styles.cleanActionSub}>
                        Saves your tasks, projects, goals, notes, books, and preferences.
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => void handleExportBackup()}
                    >
                      <Download size={13} />
                      <span>Export</span>
                    </button>
                  </div>

                  <div className={styles.cleanActionRow}>
                    <div>
                      <span className={styles.cleanActionTitle}>Import Backup (.json)</span>
                      <span className={styles.cleanActionSub}>
                        Restore data from a previously exported backup file.
                      </span>
                      {restoreStatus && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: '0.74rem',
                            color: 'var(--color-success)',
                            marginTop: 3,
                          }}
                        >
                          {restoreStatus}
                        </span>
                      )}
                    </div>
                    <input
                      ref={restoreFileInputRef}
                      type="file"
                      accept=".json,application/json"
                      style={{ display: 'none' }}
                      onChange={handleImportBackup}
                    />
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => restoreFileInputRef.current?.click()}
                    >
                      <Upload size={13} />
                      <span>Import</span>
                    </button>
                  </div>
                </div>
              </section>

              <section className={styles.cleanGroupCard}>
                <div>
                  <h2 className={styles.cleanGroupTitle}>Reset &amp; Account Deletion</h2>
                  <p className={styles.cleanGroupDesc}>
                    Destructive actions require confirmation before taking effect.
                  </p>
                </div>

                <div className={styles.cleanActionList}>
                  <div className={styles.cleanActionRow}>
                    <div>
                      <span className={styles.cleanActionTitle}>Reset Settings to Defaults</span>
                      <span className={styles.cleanActionSub}>
                        Restores default timers, hours, and theme preferences without deleting data.
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={async () => {
                        const ok = await confirmDialog({
                          title: 'Reset Settings',
                          message: 'Reset your preferences to default values?',
                          confirmLabel: 'Reset Preferences',
                        });
                        if (ok) {
                          resetSettings();
                          flashSaved('Preferences reset');
                        }
                      }}
                    >
                      Reset Preferences
                    </button>
                  </div>

                  <div className={styles.cleanActionRow}>
                    <div>
                      <span className={styles.cleanActionTitle}>Start Fresh (Keep Books)</span>
                      <span className={styles.cleanActionSub}>
                        Clears tasks, projects, goals, routine, and inbox while keeping all Books.
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={async () => {
                        const phrase = await promptDialog({
                          title: 'Start Fresh (Keep Books)',
                          message:
                            'Type "RESET" to clear tasks, goals, projects, and inbox while keeping your Books:',
                          placeholder: 'RESET',
                          confirmLabel: 'Reset & Keep Books',
                          isDestructive: true,
                        });
                        if (phrase === 'RESET') {
                          const targetUid = user && !isGuest ? user.uid : undefined;
                          if (targetUid) {
                            await flushPendingBookSaves(targetUid);
                          }
                          await startFreshKeepBooks(targetUid);
                          window.location.href = '/';
                        }
                      }}
                    >
                      Start Fresh
                    </button>
                  </div>

                  <div className={styles.cleanActionRow}>
                    <div>
                      <span
                        className={styles.cleanActionTitle}
                        style={{ color: 'var(--color-danger, #ef4444)' }}
                      >
                        Erase All Workspace Data
                      </span>
                      <span className={styles.cleanActionSub}>
                        Permanently deletes all tasks, notes, and Books on this account.
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={async () => {
                        const phrase = await promptDialog({
                          title: 'Erase All Data',
                          message:
                            'Type "DELETE ALL MY DATA" to permanently erase everything including Books:',
                          placeholder: 'DELETE ALL MY DATA',
                          confirmLabel: 'Erase Everything',
                          isDestructive: true,
                        });
                        if (phrase === 'DELETE ALL MY DATA') {
                          await stopCloudSync({ flushWrites: false });
                          if (user && !isGuest) {
                            try {
                              await Promise.all([
                                wipeCloudKv(user.uid),
                                wipeCloudBooks(user.uid),
                              ]);
                            } catch {}
                          }
                          clearLocalWorkspaceSilently();
                          await idbClear();
                          window.location.href = '/';
                        }
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Erase All</span>
                    </button>
                  </div>

                  {!isGuest && (
                    <div className={styles.cleanActionRow} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <div className={styles.rowBetweenWrap}>
                        <div>
                          <span
                            className={styles.cleanActionTitle}
                            style={{ color: 'var(--color-danger, #ef4444)' }}
                          >
                            Delete Account Permanently
                          </span>
                          <span className={styles.cleanActionSub}>
                            Deletes your login and permanently removes all cloud data.
                          </span>
                        </div>
                        {!showDeleteAccountConfirm && (
                          <button
                            type="button"
                            className={styles.btnDanger}
                            onClick={() => {
                              setDeleteAccountError(null);
                              setDeleteAccountPhrase('');
                              setDeleteAccountPassword('');
                              setShowDeleteAccountConfirm(true);
                            }}
                          >
                            Delete Account
                          </button>
                        )}
                      </div>

                      {showDeleteAccountConfirm && (
                        <div className={styles.deleteConfirmBox}>
                          {deleteAccountError && (
                            <div className={styles.testErrorBox} role="alert">
                              {deleteAccountError}
                            </div>
                          )}

                          {user?.providerData?.some((p) => p.providerId === 'password') && (
                            <div>
                              <label className={styles.label}>Current Password</label>
                              <input
                                type="password"
                                value={deleteAccountPassword}
                                onChange={(e) => setDeleteAccountPassword(e.target.value)}
                                placeholder="Enter password to confirm"
                                disabled={deleteAccountBusy}
                                className={styles.input}
                                style={{ maxWidth: 320 }}
                              />
                            </div>
                          )}

                          <div>
                            <label className={styles.label}>Type DELETE ACCOUNT to confirm</label>
                            <input
                              type="text"
                              value={deleteAccountPhrase}
                              onChange={(e) => setDeleteAccountPhrase(e.target.value)}
                              placeholder="DELETE ACCOUNT"
                              disabled={deleteAccountBusy}
                              className={styles.input}
                              style={{ maxWidth: 320 }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className={styles.btnDangerSolid}
                              disabled={
                                deleteAccountBusy || deleteAccountPhrase !== 'DELETE ACCOUNT'
                              }
                              onClick={async () => {
                                setDeleteAccountError(null);
                                setDeleteAccountBusy(true);
                                try {
                                  await deleteAccount(deleteAccountPassword);
                                  window.location.href = '/register';
                                } catch (err: unknown) {
                                  setDeleteAccountError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Failed to delete account.'
                                  );
                                } finally {
                                  setDeleteAccountBusy(false);
                                }
                              }}
                            >
                              {deleteAccountBusy ? 'Deleting…' : 'Confirm Delete Account'}
                            </button>
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              disabled={deleteAccountBusy}
                              onClick={() => {
                                setShowDeleteAccountConfirm(false);
                                setDeleteAccountError(null);
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.legalLinksFooter}>
                  <Link href="/privacy">Privacy Policy</Link>
                  <span>·</span>
                  <Link href="/terms">Terms of Service</Link>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
