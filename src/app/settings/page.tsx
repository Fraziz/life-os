'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '@/context/SettingsContext';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useKnowledge } from '@/context/KnowledgeContext';
import {
  clearLocalWorkspaceSilently,
  flushCloudNow,
  startFreshKeepBooks,
  stopCloudSync,
  wipeCloudKv,
} from '@/lib/cloudStore';
import { restoreMissingStarterWorkspace } from '@/lib/workspaceRecovery';
import { flushPendingBookSaves, wipeCloudBooks } from '@/lib/bookCloudSync';
import { idbClear, idbGet, idbSet } from '@/lib/idbStore';
import type { PlanningStyle, AppTheme, ColorThemeId } from '@/types';
import { COLOR_THEMES } from '@/config/themes';
import {
  User,
  Clock,
  Sliders,
  Bell,
  Sun,
  ShieldCheck,
  CheckCircle,
  RotateCcw,
  Headphones,
  Bot,
  Moon,
  Leaf,
  Download,
  Upload,
  Trash2,
  AlertOctagon,
  LogOut,
  Lock,
  ShieldAlert,
  Eye,
  EyeOff,
  Compass,
  ChevronDown,
  Monitor,
} from 'lucide-react';

import ActiveDevices from '@/components/settings/ActiveDevices';
import { useTour } from '@/context/TourContext';
import { usePwaInstall } from '@/utils/usePwaInstall';
import styles from './page.module.css';
import PageSkeleton from '@/components/ui/PageSkeleton';
import Logo from '@/components/ui/Logo';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Dubai',
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

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, isLoaded } = useSettings();
  const { user, isGuest, logout, logoutAllDevices, changePassword, deleteAccount } = useAuth();
  const { confirm: confirmDialog, alert: alertDialog, prompt: promptDialog } = useConfirm();
  const { startTour, restartTour, resetAllTours, isOpen: isTourOpen, currentStep: currentTourStep } = useTour();
  const { docs, restoreStarterBooks } = useKnowledge();
  const { canPromptInstall, isStandalone, isInstalled, promptInstall } = usePwaInstall();
  const [showDesktopGuide, setShowDesktopGuide] = useState(false);
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

  useEffect(() => {
    const desktopApi = (window as Window & {
      sarilingDesktop?: {
        getBubbleConfig?: () => Promise<{ visible: boolean; mode: 'circle' | 'line' | 'pill'; edge: 'left' | 'right'; popoverVisible?: boolean }>;
        getCompanionConfig?: () => Promise<{ openAtLogin: boolean; soundEnabled: boolean; edgeBlinkEnabled?: boolean; isBlinking?: boolean; blinkPaused?: boolean }>;
      };
    }).sarilingDesktop;
    if (desktopApi?.getBubbleConfig) {
      setHasDesktopBridge(true);
      void desktopApi.getBubbleConfig().then((cfg) => {
        if (cfg) setDesktopBubble(cfg);
      }).catch(() => {});
      void desktopApi.getCompanionConfig?.().then((cfg) => {
        if (cfg) setDesktopCompanion(cfg);
      }).catch(() => {});
    }
  }, []);

  const [formData, setFormData] = useState(settings);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [toastText, setToastText] = useState('Preferences saved successfully');

  // Password Change state
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordChangeBusy, setPasswordChangeBusy] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  // Backup & Portability state
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  // Permanent account deletion state
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountPhrase, setDeleteAccountPhrase] = useState('');
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Custom Logo & Tab Icon state
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      void alertDialog({
        title: 'File Too Large',
        message: 'Logo file too large. Please select an image under 5MB.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      if (file.type === 'image/svg+xml') {
        const updated = { ...formData, customLogoUrl: result };
        setFormData(updated);
        updateSettings(updated);
      } else {
        const img = new Image();
        img.onload = () => {
          const maxDim = 256;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimized = canvas.toDataURL('image/png');
            const updated = { ...formData, customLogoUrl: optimized };
            setFormData(updated);
            updateSettings(updated);
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleResetLogo = () => {
    const updated = { ...formData, customLogoUrl: undefined };
    setFormData(updated);
    updateSettings(updated);
  };

  const handleExportBackup = async () => {
    if (typeof window === 'undefined') return;
    const backup: Record<string, unknown> = {};
    const sensitiveKeys = new Set([
      'life_os_guest_vault_pin',
      'life_os_active_uid',
      'life_os_guest_mode',
    ]);

    // 1. Collect all local storage keys while scrubbing secrets and API credentials
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

    // 2. Also ensure complete knowledge books from IndexedDB are included if available
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
    a.download = `life-os-backup-${new Date().toISOString().split('T')[0]}.json`;
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
          message: 'Invalid backup file: Not a JSON object.',
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
          message: 'No recognized Life OS data found in this file.',
        });
        setRestoreStatus(null);
        return;
      }

      const confirmRestore = await confirmDialog({
        title: 'Restore Backup',
        message: `Found ${keys.length} data categories to restore from "${file.name}". This will merge/update your workspace data. Continue?`,
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
        } catch (err) {
          console.warn(`localStorage setItem failed for ${key}:`, err);
        }

        // If it is knowledge docs, also persist into IndexedDB for safety
        if (key === 'life_os_knowledge_docs_v1' && Array.isArray(val)) {
          void idbSet('life_os_knowledge_docs_v1', val);
          void idbSet('life_os_knowledge_docs_backup', val);
        }
      }

      // Notify all active contexts that data was updated and flush immediately to Firestore
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('life_os_cloud_synced'));
      }
      await flushCloudNow();

      setRestoreStatus(`Successfully restored ${keys.length} categories!`);
      await alertDialog({
        title: 'Backup Restored',
        message: `Success! Restored ${keys.length} data categories. The page will now reload.`,
      });
      window.location.reload();
    } catch (err) {
      console.error('Failed to import backup:', err);
      await alertDialog({
        title: 'Import Failed',
        message: 'Could not read or parse this backup file. Please ensure it is a valid JSON file.',
      });
      setRestoreStatus(null);
    } finally {
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccess(false);

    if (newPasswordInput.length < 6) {
      setPasswordChangeError('New password must be at least 6 characters long.');
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
      setToastText('Password updated and synced');
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password. Try again.';
      setPasswordChangeError(msg);
    } finally {
      setPasswordChangeBusy(false);
    }
  };

  const [loggingOut, setLoggingOut] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

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
      message: 'This will invalidate your sessions on all phones, tablets, and computers. You will need to sign back in on each device.',
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

  // Platform-wide AI availability (non-secret status from server vault)
  const [platformAiStatus, setPlatformAiStatus] = useState<{
    enabled: boolean;
    configured: boolean;
    provider: string;
    model: string;
  } | null>(null);

  useEffect(() => {
    if (isLoaded) {
      setFormData(settings);
    }
  }, [settings, isLoaded]);

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

  type SectionKey =
    | 'account'
    | 'experience'
    | 'shortcuts'
    | 'appearance'
    | 'tour'
    | 'profile'
    | 'workingHours'
    | 'planning'
    | 'focus'
    | 'notifications'
    | 'ai'
    | 'data';

  type SettingsCategory = 'all' | 'account' | 'appearance' | 'ai' | 'focus' | 'workflow' | 'data';

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('all');

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    account: true,
    experience: false,
    shortcuts: false,
    appearance: true,
    tour: false,
    profile: false,
    workingHours: false,
    planning: false,
    focus: false,
    notifications: false,
    ai: true,
    data: false,
  });

  // Ensure the Desktop & Edge card is visible whenever targeted by the Interactive Tour or #desktop-app anchor
  useEffect(() => {
    if (isTourOpen && currentTourStep?.target === '[data-tour="desktop-edge-card"]') {
      setActiveCategory((prev) => (prev === 'all' || prev === 'appearance' ? prev : 'all'));
      setOpenSections((prev) => (prev.appearance ? prev : { ...prev, appearance: true }));
    }
  }, [isTourOpen, currentTourStep]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#desktop-app') {
      setActiveCategory('all');
      setOpenSections((prev) => ({ ...prev, appearance: true }));
    }
  }, []);

  if (!isLoaded) {
    return <PageSkeleton variant="default" cardsCount={4} showMetrics={false} showControls={false} />;
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setToastText('Preferences saved successfully');
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const toggleWorkDay = (dayId: number) => {
    const current = formData.workingHours.workDays;
    const updatedDays = current.includes(dayId)
      ? current.filter((d) => d !== dayId)
      : [...current, dayId].sort();
    setFormData({
      ...formData,
      workingHours: {
        ...formData.workingHours,
        workDays: updatedDays,
      },
    });
  };

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    setOpenSections({
      account: true,
      experience: true,
      shortcuts: true,
      appearance: true,
      tour: true,
      profile: true,
      workingHours: true,
      planning: true,
      focus: true,
      notifications: true,
      ai: true,
      data: true,
    });
  };

  const collapseAll = () => {
    setOpenSections({
      account: false,
      experience: false,
      shortcuts: false,
      appearance: false,
      tour: false,
      profile: false,
      workingHours: false,
      planning: false,
      focus: false,
      notifications: false,
      ai: false,
      data: false,
    });
  };

  const handleCategorySelect = (cat: SettingsCategory) => {
    setActiveCategory(cat);
    if (cat === 'all') return;
    setOpenSections((prev) => {
      const next = { ...prev };
      if (cat === 'account') {
        next.account = true;
        next.profile = true;
      } else if (cat === 'appearance') {
        next.appearance = true;
        next.experience = true;
        next.tour = true;
      } else if (cat === 'ai') {
        next.ai = true;
      } else if (cat === 'focus') {
        next.focus = true;
        next.notifications = true;
      } else if (cat === 'workflow') {
        next.workingHours = true;
        next.planning = true;
        next.shortcuts = true;
      } else if (cat === 'data') {
        next.data = true;
      }
      return next;
    });
  };

  return (
    <div className={styles.page}>
      {/* ── Formal Header ── */}
      <header className={styles.header}>
        <h1 className={styles.title}>System Settings &amp; Preferences</h1>
      </header>

      {/* ── Minimalist Navigation Toolbar & Category Pills ── */}
      <div className={styles.toolbar}>
        <div className={styles.categoryPills} role="tablist" aria-label="Settings categories">
          {[
            { id: 'all', label: 'All Settings' },
            { id: 'account', label: 'Account & Security' },
            { id: 'appearance', label: 'Visual & Themes' },
            { id: 'ai', label: 'AI Intelligence' },
            { id: 'focus', label: 'Focus & Sound' },
            { id: 'workflow', label: 'Schedule & Tasks' },
            { id: 'data', label: 'Data & Backup' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.pillBtn} ${activeCategory === cat.id ? styles.pillBtnActive : ''}`}
              onClick={() => handleCategorySelect(cat.id as SettingsCategory)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className={styles.toggleAllBtns}>
          <button type="button" className={styles.textActionBtn} onClick={expandAll} title="Expand all sections">
            Expand All
          </button>
          <span style={{ color: 'var(--color-border)', fontSize: '11px' }}>•</span>
          <button type="button" className={styles.textActionBtn} onClick={collapseAll} title="Collapse all sections">
            Collapse All
          </button>
        </div>
      </div>

      {showSavedToast && (
        <div className="chatgptToast" role="status" aria-live="polite">
          <span>{toastText}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* ── 0. Account & Session ── */}
        {(activeCategory === 'all' || activeCategory === 'account') && (
          <section className={styles.sectionCard}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('account')}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.account}
            >
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <Lock size={16} />
                </div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionTitle}>Account &amp; Session</h2>
                  <p className={styles.sectionDesc}>Authenticated access, security, and multi-device session management.</p>
                </div>
              </div>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.collapseIndicator}>
                  {openSections.account ? 'Collapse' : 'Expand'}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${openSections.account ? styles.chevronOpen : ''}`}
                />
              </div>
            </div>

            {openSections.account && (
              <div className={styles.sectionBody}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Account Details Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', background: 'var(--color-surface-2)', padding: '14px 16px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-accent-dim)', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', border: '1px solid rgba(99, 102, 241, 0.25)', overflow: 'hidden', flexShrink: 0 }}>
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (user?.displayName || user?.email || 'U').slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.94rem', color: 'var(--color-text)' }}>
                      {user?.displayName || user?.email?.split('@')[0] || 'Personal User'}
                    </strong>
                    <span style={{ fontSize: '0.68rem', padding: '1px 7px', borderRadius: '99px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                      {(user as { isGuest?: boolean })?.isGuest
                        ? 'Local Workspace'
                        : user?.providerData?.[0]?.providerId === 'google.com'
                        ? 'Google Account'
                        : 'Email Account'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '2px' }}>
                    {user?.email || 'Signed in locally'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)', fontFamily: 'monospace' }}>
                  UID: {user?.uid ? `${user.uid.slice(0, 8)}...` : 'local'}
                </span>
              </div>
            </div>

            {/* Active Devices & Session Management */}
            {user?.uid && <ActiveDevices uid={user.uid} />}

            {/* ── Security & Change Password ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--color-surface)', padding: '16px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--color-border)' }}>
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>
                  Security &amp; Password
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '2px' }}>
                  Changing your password syncs directly with your account login and your Important Notes Vault.
                </span>
              </div>

              {passwordChangeError && (
                <div style={{ background: 'var(--color-danger-dim, rgba(239, 68, 68, 0.1))', color: 'var(--color-danger, #ef4444)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.82rem' }}>
                  {passwordChangeError}
                </div>
              )}

              {passwordChangeSuccess && (
                <div style={{ background: 'var(--color-success-dim, rgba(16, 185, 129, 0.1))', color: 'var(--color-success, #10b981)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.82rem' }}>
                  Password updated and synced with Important Notes Vault successfully.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                      Current Password {isGuest && '(or Passcode)'}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCurrentPass ? 'text' : 'password'}
                        value={currentPasswordInput}
                        onChange={(e) => setCurrentPasswordInput(e.target.value)}
                        placeholder="Enter current password"
                        disabled={passwordChangeBusy}
                        style={{ width: '100%', padding: '8px 34px 8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '0.84rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        tabIndex={-1}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', padding: '2px' }}
                      >
                        {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                      New Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="At least 6 characters"
                        minLength={6}
                        disabled={passwordChangeBusy}
                        style={{ width: '100%', padding: '8px 34px 8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '0.84rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        tabIndex={-1}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', padding: '2px' }}
                      >
                        {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      placeholder="Re-enter new password"
                      minLength={6}
                      disabled={passwordChangeBusy}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '0.84rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={passwordChangeBusy || !newPasswordInput || !confirmPasswordInput}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--color-accent)',
                      color: 'var(--color-text-inverse)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: passwordChangeBusy || !newPasswordInput || !confirmPasswordInput ? 0.6 : 1,
                    }}
                  >
                    {passwordChangeBusy ? 'Updating Password…' : 'Update & Sync Password'}
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleLogout}
                disabled={loggingOut || loggingOutAll}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <LogOut size={13} />
                {loggingOut ? 'Signing out…' : 'Sign Out This Device'}
              </button>

              <button
                type="button"
                className={styles.btnDanger}
                onClick={handleLogoutAllDevices}
                disabled={loggingOut || loggingOutAll}
                title="Revoke and log out of all active sessions on all phones, tablets, and PCs"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ShieldAlert size={14} />
                {loggingOutAll ? 'Logging out all devices…' : 'Log Out of All Devices'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )}

        {/* ── 1. Interface & Presets ── */}
        {(activeCategory === 'all' || activeCategory === 'appearance') && (
          <section className={styles.sectionCard}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('experience')}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.experience}
            >
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <Sliders size={16} />
                </div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionTitle}>Interface Mode</h2>
                  <p className={styles.sectionDesc}>Select your preferred workspace density and complexity level.</p>
                </div>
              </div>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.collapseIndicator}>
                  {openSections.experience ? 'Collapse' : 'Expand'}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${openSections.experience ? styles.chevronOpen : ''}`}
                />
              </div>
            </div>

            {openSections.experience && (
              <div className={styles.sectionBody}>
                <div className={styles.modeGrid}>
                  <div
                    className={`${styles.modeCard} ${formData.simpleMode ? styles.modeCardActive : ''}`}
                    onClick={() => {
                      const updated = { ...formData, simpleMode: true };
                      setFormData(updated);
                      updateSettings(updated);
                    }}
                  >
                    <div className={styles.modeCardHeader}>
                      <span className={styles.modeCardTitle}>Simple Mode</span>
                      {formData.simpleMode && <span className={styles.modeBadge}>Active</span>}
                    </div>
                    <p className={styles.modeCardDesc}>
                      Focused 4-view setup: Today Dashboard, Focus Timer, Tasks, and Calendar.
                    </p>
                  </div>

                  <div
                    className={`${styles.modeCard} ${!formData.simpleMode ? styles.modeCardActive : ''}`}
                    onClick={() => {
                      const updated = { ...formData, simpleMode: false };
                      setFormData(updated);
                      updateSettings(updated);
                    }}
                  >
                    <div className={styles.modeCardHeader}>
                      <span className={styles.modeCardTitle}>Full Sariling Mundo</span>
                      {!formData.simpleMode && <span className={styles.modeBadge}>Active</span>}
                    </div>
                    <p className={styles.modeCardDesc}>
                      Complete architecture: Dreams, Goals, Milestones, Projects, Roadmap, and Study &amp; Books.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Keyboard Shortcuts & Quick Navigation ── */}
        {(activeCategory === 'all' || activeCategory === 'workflow') && (
          <section className={styles.sectionCard}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('shortcuts')}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.shortcuts}
            >
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <Sliders size={16} />
                </div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionTitle}>Keyboard Shortcuts &amp; Quick Navigation</h2>
                  <p className={styles.sectionDesc}>
                    Jump across Today, Idea Parking, Tasks, Focus Space, and system tools instantly from your keyboard.
                  </p>
                </div>
              </div>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.collapseIndicator}>
                  {openSections.shortcuts ? 'Collapse' : 'Expand'}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${openSections.shortcuts ? styles.chevronOpen : ''}`}
                />
              </div>
            </div>

            {openSections.shortcuts && (
              <div className={styles.sectionBody}>
          {/* Complete System & Navigation Keyboard Shortcuts Reference */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Global Keyboard Shortcuts &amp; Navigation Reference</label>
            <div className={styles.shortcutsTable}>
              {/* Category 1: Website Quick Navigation */}
              <div className={styles.shortcutsCategoryHeader}>
                Website Navigation (Quick Jump)
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Idea Parking (Inbox)</span>
                  <span className={styles.shortcutSub}>Capture new thoughts, brain dump, and park ideas</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Alt + I</kbd>
                </div>
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Goals &amp; Ambitions</span>
                  <span className={styles.shortcutSub}>View long-term targets, active goals, and progress</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Alt + G</kbd>
                </div>
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Projects</span>
                  <span className={styles.shortcutSub}>Multi-step project tracking and auto-progress cascade</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Alt + P</kbd>
                </div>
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Task Board &amp; Execution</span>
                  <span className={styles.shortcutSub}>View daily tasks, priority queues, and execution board</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Alt + T</kbd>
                </div>
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Today Dashboard</span>
                  <span className={styles.shortcutSub}>Executive briefing, top priorities, and day overview</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Alt + Y</kbd>
                </div>
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Focus Space</span>
                  <span className={styles.shortcutSub}>Pomodoro deep work timer, binaural soundscape, and reader</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Alt + F</kbd>
                </div>
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Habits &amp; Routines</span>
                  <span className={styles.shortcutSub}>Daily consistency tracker and streak maintenance</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Alt + B</kbd>
                </div>
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Weekly Review</span>
                  <span className={styles.shortcutSub}>3-step low-friction guided ADHD review and dopamine summary</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Alt + R</kbd>
                </div>
              </div>

              {/* Category 2: System & Executive Controls */}
              <div className={styles.shortcutsCategoryHeader}>
                System &amp; Executive Controls
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Universal Search &amp; Command Palette</span>
                  <span className={styles.shortcutSub}>Full-text search across all notes, tasks, and system actions</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Ctrl + K</kbd>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>or</span>
                  <kbd className={styles.domainKbd}>⌘K</kbd>
                </div>
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Next Action Decision Engine</span>
                  <span className={styles.shortcutSub}>Instant decision helper (&quot;What should I do right now?&quot;)</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Ctrl + J</kbd>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>or</span>
                  <kbd className={styles.domainKbd}>⌘J</kbd>
                </div>
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>AI Assistant Companion</span>
                  <span className={styles.shortcutSub}>Open floating intelligence panel and conversational assistant</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Ctrl + L</kbd>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>or</span>
                  <kbd className={styles.domainKbd}>⌘L</kbd>
                </div>
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Toggle / Pin Navigation Sidebar</span>
                  <span className={styles.shortcutSub}>Lock open or auto-collapse the Instagram-style hover rail</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Ctrl + B</kbd>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>or</span>
                  <kbd className={styles.domainKbd}>⌘B</kbd>
                </div>
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Shortcuts Quick Reference</span>
                  <span className={styles.shortcutSub}>Open the keyboard shortcuts modal from any page</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>?</kbd>
                </div>
              </div>

              <div className={styles.shortcutRow}>
                <div className={styles.shortcutDesc}>
                  <span className={styles.shortcutName}>Close Active Modal / Dropdown</span>
                  <span className={styles.shortcutSub}>Dismiss any open dialog, drawer, or selector popover</span>
                </div>
                <div className={styles.shortcutKeys}>
                  <kbd className={styles.domainKbd}>Esc</kbd>
                </div>
              </div>
            </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── 2. Appearance & Color Theme ── */}
        {(activeCategory === 'all' || activeCategory === 'appearance') && (
          <section className={styles.sectionCard}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('appearance')}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.appearance}
            >
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <Sun size={16} />
                </div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionTitle}>Visual Theme</h2>
                  <p className={styles.sectionDesc}>Customize the interface appearance across all devices.</p>
                </div>
              </div>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.collapseIndicator}>
                  {openSections.appearance ? 'Collapse' : 'Expand'}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${openSections.appearance ? styles.chevronOpen : ''}`}
                />
              </div>
            </div>

            {openSections.appearance && (
              <div className={styles.sectionBody}>
                <div className={styles.themeGrid}>
                  {([
                    { id: 'system', label: 'System Auto-Adjust', desc: 'Automatically adapts Light / Dark with OS', icon: <Sliders size={14} /> },
                    { id: 'light', label: 'Daylight (Light)', desc: 'Soft low-glare daylight surfaces', icon: <Sun size={14} /> },
                    { id: 'dark', label: 'Night (Dark)', desc: 'Deep executive evening surfaces', icon: <Moon size={14} /> },
                  ] as const).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.themeBtn} ${formData.theme === item.id ? styles.themeBtnActive : ''}`}
                      onClick={() => {
                        const newTheme = item.id as AppTheme;
                        const updated = { ...formData, theme: newTheme };
                        setFormData(updated);
                        updateSettings(updated);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.icon}
                        <span style={{ fontWeight: 600 }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 2 }}>{item.desc}</span>
                    </button>
                  ))}
                </div>

                {/* ── Curated Formal Color Palettes ── */}
                <div className={styles.formGroup} style={{ marginTop: 16 }}>
                  <label className={styles.label}>
                    Color Theme Palette (Tip: Left-click the top-right theme circle to cycle, or right-click it for quick choices)
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
                      gap: '8px',
                      marginTop: '6px',
                    }}
                  >
                    {COLOR_THEMES.map((pal) => {
                      const isActive = (formData.colorTheme || 'slate') === pal.id;
                      return (
                        <button
                          key={pal.id}
                          type="button"
                          className={`${styles.themeBtn} ${isActive ? styles.themeBtnActive : ''}`}
                          onClick={() => {
                            const updated = { ...formData, colorTheme: pal.id as ColorThemeId };
                            setFormData(updated);
                            updateSettings(updated);
                          }}
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
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 3 }}>
                            {pal.mood}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Custom Logo & Tab Icon ── */}
                <div className={styles.logoCustomizerCard}>
                  <div className={styles.logoCustomizerHeader}>
                    <div>
                      <h3 className={styles.subCardTitle}>Workspace Logo &amp; Tab Icon</h3>
                      <p className={styles.subCardDesc}>
                        Change the brand logo and keep your browser tab icon in sync with your personal workspace.
                      </p>
                    </div>
                  </div>

                  <div className={styles.logoPreviewRow}>
                    <div className={styles.logoPreviewBox}>
                      <span className={styles.logoPreviewLabel}>App Logo Preview</span>
                      <div className={styles.logoBadgeContainer}>
                        <Logo size={32} iconOnly={true} withBadge={true} />
                      </div>
                    </div>

                    <div className={styles.logoPreviewBox}>
                      <span className={styles.logoPreviewLabel}>Browser Tab Preview</span>
                      <div className={styles.browserTabMock}>
                        <div className={styles.tabFaviconMock}>
                          <Logo size={14} iconOnly={true} withBadge={false} />
                        </div>
                        <span className={styles.tabTitleMock}>Sariling Mundo</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.logoActionsRow}>
                    <input
                      type="file"
                      ref={logoInputRef}
                      style={{ display: 'none' }}
                      accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
                      onChange={handleLogoUpload}
                    />

                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload size={13} style={{ marginRight: 6 }} />
                      Upload Custom Logo
                    </button>

                    {formData.customLogoUrl && (
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={handleResetLogo}
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <RotateCcw size={13} style={{ marginRight: 6 }} />
                        Reset to Official Logo
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Windows Desktop App & Cloud Sync ── */}
                <div id="desktop-app" data-tour="desktop-edge-card" className={styles.logoCustomizerCard}>
                  <div className={styles.logoCustomizerHeader}>
                    <div>
                      <h3 className={styles.subCardTitle}>Windows Desktop App</h3>
                      <p className={styles.subCardDesc}>
                        Run Sariling Mundo in its own Windows window with a Desktop/Taskbar shortcut, auto-synced in real time with your cloud account.
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '3px 9px',
                        borderRadius: '999px',
                        border: '1px solid var(--color-border-subtle)',
                        background: 'var(--color-surface-2)',
                        color: isStandalone ? '#22d3a5' : 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isStandalone ? 'Desktop Window Active' : isInstalled ? 'Installed on Device' : 'Browser Mode'}
                    </span>
                  </div>

                  <div className={styles.logoActionsRow}>
                    {canPromptInstall ? (
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={async () => {
                          const outcome = await promptInstall();
                          if (outcome === 'accepted') {
                            setToastText('Installing Sariling Mundo onto your Desktop…');
                            setShowSavedToast(true);
                            setTimeout(() => setShowSavedToast(false), 3000);
                          }
                        }}
                      >
                        <Monitor size={13} style={{ marginRight: 6 }} />
                        Install on Windows Desktop
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => setShowDesktopGuide((v) => !v)}
                      >
                        <Monitor size={13} style={{ marginRight: 6 }} />
                        {isStandalone ? 'Desktop Options & .exe Guide' : 'Pin / Install to Windows Desktop'}
                      </button>
                    )}
                  </div>

                  {(showDesktopGuide || !canPromptInstall) && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md, 8px)',
                        border: '1px solid var(--color-border-subtle)',
                        background: 'var(--color-surface-2)',
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)',
                        lineHeight: 1.55,
                        display: showDesktopGuide ? 'flex' : 'none',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--color-text)' }}>Option 1 — Instant Windows App (Edge / Chrome):</strong>{' '}
                        Click the <strong>Install icon</strong> in the browser address bar (or open browser menu <strong>Apps → Install this site as an app</strong>) to add a Desktop shortcut &amp; Taskbar pin that stays synced live.
                      </div>
                      <div>
                        <strong style={{ color: 'var(--color-text)' }}>Option 2 — Standalone Windows Installer (.exe):</strong>{' '}
                        Inside the repo&apos;s <code>desktop/</code> folder, run <code>npm install &amp;&amp; npm run build:win</code> to generate a native Windows <code>.exe</code> with System Tray and Launch-on-Startup support.
                      </div>
                    </div>
                  )}

                  {/* Desktop Floating Bubble Trigger & Style Controls */}
                  <div
                    style={{
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text)' }}>
                          Floating Bubble
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                          {hasDesktopBridge
                            ? 'Show, hide, or trigger the quick action bubble on your screen.'
                            : 'Open in the Windows Desktop App to control the desktop screen-edge bubble.'}
                        </div>
                      </div>
                      {hasDesktopBridge && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            border: '1px solid var(--color-border-subtle)',
                            background: 'var(--color-surface-2)',
                            color: desktopBubble?.visible ? 'var(--color-text)' : 'var(--color-text-muted)',
                          }}
                        >
                          {desktopBubble?.visible ? 'Visible' : 'Hidden'}
                        </span>
                      )}
                    </div>

                    <div className={styles.logoActionsRow}>
                      {hasDesktopBridge ? (
                        <>
                          <button
                            type="button"
                            className={styles.btnPrimary}
                            onClick={async () => {
                              const api = (window as Window & {
                                sarilingDesktop?: {
                                  setBubbleVisible?: (v: boolean) => Promise<typeof desktopBubble>;
                                };
                              }).sarilingDesktop;
                              if (!api?.setBubbleVisible) return;
                              const next = await api.setBubbleVisible(!desktopBubble?.visible);
                              if (next) setDesktopBubble(next);
                            }}
                          >
                            {desktopBubble?.visible ? 'Hide Floating Bubble' : 'Show Floating Bubble'}
                          </button>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={async () => {
                              const api = (window as Window & {
                                sarilingDesktop?: {
                                  toggleBubblePopover?: () => Promise<typeof desktopBubble>;
                                };
                              }).sarilingDesktop;
                              if (!api?.toggleBubblePopover) return;
                              const next = await api.toggleBubblePopover();
                              if (next) setDesktopBubble(next);
                            }}
                          >
                            Trigger Quick Action
                          </button>
                          {(['circle', 'line', 'pill'] as const).map((modeKey) => (
                            <button
                              key={modeKey}
                              type="button"
                              className={desktopBubble?.mode === modeKey ? styles.btnPrimary : styles.btnSecondary}
                              onClick={async () => {
                                const api = (window as Window & {
                                  sarilingDesktop?: {
                                    setBubbleMode?: (m: 'circle' | 'line' | 'pill') => Promise<typeof desktopBubble>;
                                  };
                                }).sarilingDesktop;
                                if (!api?.setBubbleMode) return;
                                const next = await api.setBubbleMode(modeKey);
                                if (next) setDesktopBubble(next);
                              }}
                            >
                              {modeKey === 'circle' ? 'Circle' : modeKey === 'line' ? 'Edge Line' : 'Pill'}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={desktopCompanion?.openAtLogin ? styles.btnPrimary : styles.btnSecondary}
                            onClick={async () => {
                              const api = (window as Window & {
                                sarilingDesktop?: {
                                  setStartupEnabled?: (e: boolean) => Promise<{ openAtLogin: boolean; soundEnabled: boolean }>;
                                };
                              }).sarilingDesktop;
                              if (!api?.setStartupEnabled) return;
                              const next = await api.setStartupEnabled(!desktopCompanion?.openAtLogin);
                              if (next) setDesktopCompanion(next);
                            }}
                          >
                            {desktopCompanion?.openAtLogin ? 'Windows Startup: On' : 'Windows Startup: Off'}
                          </button>
                          <button
                            type="button"
                            className={desktopCompanion?.soundEnabled !== false ? styles.btnPrimary : styles.btnSecondary}
                            onClick={async () => {
                              const api = (window as Window & {
                                sarilingDesktop?: {
                                  setAlertSoundEnabled?: (e: boolean) => Promise<{ openAtLogin: boolean; soundEnabled: boolean }>;
                                };
                              }).sarilingDesktop;
                              if (!api?.setAlertSoundEnabled) return;
                              const next = await api.setAlertSoundEnabled(!(desktopCompanion?.soundEnabled !== false));
                              if (next) setDesktopCompanion(next);
                            }}
                          >
                            {desktopCompanion?.soundEnabled !== false ? 'Alert Ring Sound: On' : 'Alert Ring Sound: Off'}
                          </button>
                          <button
                            type="button"
                            className={desktopCompanion?.edgeBlinkEnabled !== false ? styles.btnPrimary : styles.btnSecondary}
                            onClick={async () => {
                              const api = (window as Window & {
                                sarilingDesktop?: {
                                  setEdgeBlinkEnabled?: (e: boolean) => Promise<{ openAtLogin: boolean; soundEnabled: boolean; edgeBlinkEnabled?: boolean; isBlinking?: boolean; blinkPaused?: boolean }>;
                                };
                              }).sarilingDesktop;
                              if (!api?.setEdgeBlinkEnabled) return;
                              const next = await api.setEdgeBlinkEnabled(!(desktopCompanion?.edgeBlinkEnabled !== false));
                              if (next) setDesktopCompanion(next);
                            }}
                          >
                            {desktopCompanion?.edgeBlinkEnabled !== false ? 'Edge Line Blink: On' : 'Edge Line Blink: Muted'}
                          </button>
                          {desktopCompanion?.isBlinking && (
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              onClick={async () => {
                                const api = (window as Window & {
                                  sarilingDesktop?: {
                                    stopEdgeBlink?: () => Promise<{ openAtLogin: boolean; soundEnabled: boolean; edgeBlinkEnabled?: boolean; isBlinking?: boolean; blinkPaused?: boolean }>;
                                  };
                                }).sarilingDesktop;
                                if (!api?.stopEdgeBlink) return;
                                const next = await api.stopEdgeBlink();
                                if (next) setDesktopCompanion(next);
                              }}
                            >
                              Stop Edge Blinking
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={async () => {
                              const api = (window as Window & {
                                sarilingDesktop?: {
                                  testAlertRing?: () => Promise<{ ok: boolean }>;
                                };
                              }).sarilingDesktop;
                              await api?.testAlertRing?.();
                            }}
                          >
                            Test Alert Ring
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chat'))}
                        >
                          Trigger Floating Assistant
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Guided Tours & Onboarding ── */}
        {(activeCategory === 'all' || activeCategory === 'appearance') && (
          <section className={styles.sectionCard}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('tour')}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.tour}
            >
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <Compass size={16} />
                </div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionTitle}>Guided Tours &amp; Onboarding</h2>
                  <p className={styles.sectionDesc}>Interactive walkthroughs and step-by-step guidance across system features.</p>
                </div>
              </div>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.collapseIndicator}>
                  {openSections.tour ? 'Collapse' : 'Expand'}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${openSections.tour ? styles.chevronOpen : ''}`}
                />
              </div>
            </div>

            {openSections.tour && (
              <div className={styles.sectionBody}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  <div style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-lg, 10px)',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--color-text)' }}>Main System Tour</strong>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.45, margin: 0 }}>
                        Take a guided walkthrough of the core cockpit, Idea Parking, Tasks Kanban, Planning hierarchy, AI Assistant, and Screen-Edge Companion.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                      onClick={() => {
                        restartTour();
                        setToastText('Starting System Tour…');
                        setShowSavedToast(true);
                        setTimeout(() => setShowSavedToast(false), 2000);
                      }}
                    >
                      <Compass size={14} />
                      Restart System Tour
                    </button>
                  </div>

                  <div style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-lg, 10px)',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <Monitor size={16} style={{ color: 'var(--color-text-muted)' }} />
                        <strong style={{ fontSize: '0.92rem', color: 'var(--color-text)' }}>Edge &amp; Floating Bubble Guide</strong>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.45, margin: 0 }}>
                        Learn how to snap the Floating Bubble to your screen edge, pop up or pop out AI chat, and use the Desktop Edge Line sidebar &amp; blink alerts.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                      onClick={() => {
                        startTour('edge-companion', 0);
                        setToastText('Starting Edge & Floating Bubble Guide…');
                        setShowSavedToast(true);
                        setTimeout(() => setShowSavedToast(false), 2000);
                      }}
                    >
                      <Monitor size={14} />
                      Start Edge Guide
                    </button>
                  </div>

                  <div style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-lg, 10px)',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <RotateCcw size={16} style={{ color: 'var(--color-text-muted)' }} />
                        <strong style={{ fontSize: '0.92rem', color: 'var(--color-text)' }}>Feature Tips &amp; Guides</strong>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.45, margin: 0 }}>
                        Reset contextual tutorial banners (such as Focus Space and Idea Parking guides) so they appear again when visiting those pages.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                      onClick={() => {
                        resetAllTours();
                        setToastText('All tour progress and contextual tips reset');
                        setShowSavedToast(true);
                        setTimeout(() => setShowSavedToast(false), 2500);
                      }}
                    >
                      <RotateCcw size={14} />
                      Reset All Guides
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── 3. Identity & Profile ── */}
        {(activeCategory === 'all' || activeCategory === 'account') && (
          <section className={styles.sectionCard}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('profile')}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.profile}
            >
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <User size={16} />
                </div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionTitle}>Identity &amp; Profile</h2>
                  <p className={styles.sectionDesc}>Personalization details used in daily briefings and headings.</p>
                </div>
              </div>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.collapseIndicator}>
                  {openSections.profile ? 'Collapse' : 'Expand'}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${openSections.profile ? styles.chevronOpen : ''}`}
                />
              </div>
            </div>

            {openSections.profile && (
              <div className={styles.sectionBody}>
                <div className={styles.gridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="name-input">Full Name</label>
                    <input
                      id="name-input"
                      type="text"
                      className={styles.input}
                      value={formData.profile.name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          profile: { ...formData.profile, name: e.target.value },
                        })
                      }
                      placeholder="e.g. Alex Rivera"
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="display-name-input">Display Name</label>
                    <input
                      id="display-name-input"
                      type="text"
                      className={styles.input}
                      value={formData.profile.displayName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          profile: { ...formData.profile, displayName: e.target.value },
                        })
                      }
                      placeholder="e.g. Alex"
                      required
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── 4. Time & Schedule Capacity ── */}
        {(activeCategory === 'all' || activeCategory === 'workflow') && (
          <section className={styles.sectionCard}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('workingHours')}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.workingHours}
            >
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <Clock size={16} />
                </div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionTitle}>Schedule &amp; Capacity</h2>
                  <p className={styles.sectionDesc}>Define your timezone, daily working hours, and standard schedule.</p>
                </div>
              </div>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.collapseIndicator}>
                  {openSections.workingHours ? 'Collapse' : 'Expand'}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${openSections.workingHours ? styles.chevronOpen : ''}`}
                />
              </div>
            </div>

            {openSections.workingHours && (
              <div className={styles.sectionBody}>
                <div className={styles.gridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="timezone-select">Time Zone</label>
                    <select
                      id="timezone-select"
                      className={styles.select}
                      value={formData.timeZone}
                      onChange={(e) => setFormData({ ...formData, timeZone: e.target.value })}
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="capacity-input">Available Hours / Day</label>
                    <input
                      id="capacity-input"
                      type="number"
                      min="1"
                      max="24"
                      className={styles.input}
                      value={formData.availableHoursPerDay}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          availableHoursPerDay: Math.max(1, Math.min(24, parseInt(e.target.value) || 1)),
                        })
                      }
                    />
                  </div>
                </div>

                <div className={styles.gridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="work-start">Work Start Time</label>
                    <input
                      id="work-start"
                      type="time"
                      className={styles.input}
                      value={formData.workingHours.start}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          workingHours: { ...formData.workingHours, start: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="work-end">Work End Time</label>
                    <input
                      id="work-end"
                      type="time"
                      className={styles.input}
                      value={formData.workingHours.end}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          workingHours: { ...formData.workingHours, end: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Working Days</label>
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
              </div>
            )}
          </section>
        )}

        {/* ── 5. Planning & Task Execution ── */}
        {(activeCategory === 'all' || activeCategory === 'workflow') && (
          <section className={styles.sectionCard}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('planning')}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.planning}
            >
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <Sliders size={16} />
                </div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionTitle}>Planning &amp; Task Defaults</h2>
                  <p className={styles.sectionDesc}>Configure time estimates and task organization frameworks.</p>
                </div>
              </div>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.collapseIndicator}>
                  {openSections.planning ? 'Collapse' : 'Expand'}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${openSections.planning ? styles.chevronOpen : ''}`}
                />
              </div>
            </div>

            {openSections.planning && (
              <div className={styles.sectionBody}>
                <div className={styles.gridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="planning-style-select">Planning Methodology</label>
                    <select
                      id="planning-style-select"
                      className={styles.select}
                      value={formData.planningStyle}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          planningStyle: e.target.value as PlanningStyle,
                        })
                      }
                    >
                      <option value="time-blocking">Time Blocking (Structured Calendar)</option>
                      <option value="eisenhower">Eisenhower Matrix (Urgent / Important)</option>
                      <option value="gtd">Getting Things Done (GTD Contexts)</option>
                      <option value="kanban">Board View (Visual Workflow)</option>
                      <option value="weekly-focus">Weekly Focus Objectives</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="task-duration-select">Default Task Duration</label>
                    <select
                      id="task-duration-select"
                      className={styles.select}
                      value={formData.defaultTaskDuration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          defaultTaskDuration: parseInt(e.target.value),
                        })
                      }
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes</option>
                      <option value={60}>60 Minutes (1 Hour)</option>
                      <option value={90}>90 Minutes (Deep Block)</option>
                      <option value={120}>120 Minutes (2 Hours)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── 6. Focus & Deep Work Timer ── */}
        {(activeCategory === 'all' || activeCategory === 'focus') && (
          <section className={styles.sectionCard}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('focus')}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.focus}
            >
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <Headphones size={16} />
                </div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionTitle}>Focus &amp; Pomodoro Protocols</h2>
                  <p className={styles.sectionDesc}>Configure interval timers for undistracted deep work sessions.</p>
                </div>
              </div>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.collapseIndicator}>
                  {openSections.focus ? 'Collapse' : 'Expand'}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${openSections.focus ? styles.chevronOpen : ''}`}
                />
              </div>
            </div>

            {openSections.focus && (
              <div className={styles.sectionBody}>
                <div className={styles.gridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="pomodoro-duration">Focus Duration (Minutes)</label>
                    <input
                      id="pomodoro-duration"
                      type="number"
                      min="5"
                      max="120"
                      className={styles.input}
                      value={formData.focusPreferences.pomodoroDuration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          focusPreferences: {
                            ...formData.focusPreferences,
                            pomodoroDuration: parseInt(e.target.value) || 25,
                          },
                        })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="short-break-duration">Short Break (Minutes)</label>
                    <input
                      id="short-break-duration"
                      type="number"
                      min="1"
                      max="30"
                      className={styles.input}
                      value={formData.focusPreferences.shortBreakDuration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          focusPreferences: {
                            ...formData.focusPreferences,
                            shortBreakDuration: parseInt(e.target.value) || 5,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className={styles.gridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="long-break-duration">Long Break (Minutes)</label>
                    <input
                      id="long-break-duration"
                      type="number"
                      min="5"
                      max="60"
                      className={styles.input}
                      value={formData.focusPreferences.longBreakDuration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          focusPreferences: {
                            ...formData.focusPreferences,
                            longBreakDuration: parseInt(e.target.value) || 15,
                          },
                        })
                      }
                    />
                  </div>

                  <div className={styles.toggleRow} style={{ borderBottom: 'none' }}>
                    <div className={styles.toggleLabel}>
                      <span className={styles.toggleTitle}>Auto-Start Breaks</span>
                      <span className={styles.toggleDesc}>Automatically begin rest timer upon focus completion</span>
                    </div>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={formData.focusPreferences.autoStartBreaks}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          focusPreferences: {
                            ...formData.focusPreferences,
                            autoStartBreaks: e.target.checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── 7. Notifications & Quiet Hours ── */}
        {(activeCategory === 'all' || activeCategory === 'focus') && (
          <section className={styles.sectionCard}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('notifications')}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.notifications}
            >
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <Bell size={16} />
                </div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionTitle}>Notifications &amp; Quiet Hours</h2>
                  <p className={styles.sectionDesc}>Granular notification controls for deadlines, blocks, and quiet time.</p>
                </div>
              </div>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.collapseIndicator}>
                  {openSections.notifications ? 'Collapse' : 'Expand'}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${openSections.notifications ? styles.chevronOpen : ''}`}
                />
              </div>
            </div>

            {openSections.notifications && (
              <div className={styles.sectionBody}>
                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>System Notifications</span>
                    <span className={styles.toggleDesc}>Master switch for all task and milestone alerts</span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={formData.notifications.enabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                </div>

                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Quiet Hours Filter</span>
                    <span className={styles.toggleDesc}>Silence non-essential alerts during focus or rest periods</span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={formData.notifications.quietHours?.enabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          quietHours: {
                            ...formData.notifications.quietHours,
                            enabled: e.target.checked,
                            start: formData.notifications.quietHours?.start || '22:00',
                            end: formData.notifications.quietHours?.end || '08:00',
                          },
                        },
                      })
                    }
                  />
                </div>

                {formData.notifications.quietHours?.enabled && (
                  <div className={styles.gridTwo}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Quiet Hours Start</label>
                      <input
                        type="time"
                        className={styles.input}
                        value={formData.notifications.quietHours?.start || '22:00'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            notifications: {
                              ...formData.notifications,
                              quietHours: {
                                ...formData.notifications.quietHours,
                                start: e.target.value,
                                enabled: true,
                                end: formData.notifications.quietHours?.end || '08:00',
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Quiet Hours End</label>
                      <input
                        type="time"
                        className={styles.input}
                        value={formData.notifications.quietHours?.end || '08:00'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            notifications: {
                              ...formData.notifications,
                              quietHours: {
                                ...formData.notifications.quietHours,
                                end: e.target.value,
                                enabled: true,
                                start: formData.notifications.quietHours?.start || '22:00',
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Task Due Date Notifications</span>
                    <span className={styles.toggleDesc}>Notify when scheduled tasks reach their deadline</span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={formData.notifications.taskReminders}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          taskReminders: e.target.checked,
                        },
                      })
                    }
                  />
                </div>

                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Milestone &amp; Goal Target Notifications</span>
                    <span className={styles.toggleDesc}>Notify on upcoming project and milestone target dates</span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={formData.notifications.deadlineAlerts}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          deadlineAlerts: e.target.checked,
                        },
                      })
                    }
                  />
                </div>

                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Focus Block &amp; Calendar Notifications</span>
                    <span className={styles.toggleDesc}>Notify when scheduled calendar focus sessions are approaching</span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={formData.notifications.scheduledWorkAlerts}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          scheduledWorkAlerts: e.target.checked,
                        },
                      })
                    }
                  />
                </div>

                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Daily Habit Practice Cues</span>
                    <span className={styles.toggleDesc}>Remind on uncompleted habits at their configured reminder times</span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={formData.notifications.habitReminders}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          habitReminders: e.target.checked,
                        },
                      })
                    }
                  />
                </div>

                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Weekly Reflection Cues</span>
                    <span className={styles.toggleDesc}>Reminder to complete weekly progress and review reflections</span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={formData.notifications.weeklyReviewReminders}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          weeklyReviewReminders: e.target.checked,
                        },
                      })
                    }
                  />
                </div>

                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Desktop Operating System Notifications</span>
                    <span className={styles.toggleDesc}>Send system-level browser push notifications for critical alarms</span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={formData.notifications.browserNotifications}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked && typeof window !== 'undefined' && 'Notification' in window) {
                        void Notification.requestPermission();
                      }
                      setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          browserNotifications: checked,
                        },
                      });
                    }}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── 8. AI Assistant ── */}
        {(activeCategory === 'all' || activeCategory === 'ai') && (
          <section className={styles.sectionCard}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('ai')}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.ai}
            >
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <Bot size={16} />
                </div>
                <div className={styles.sectionHeaderContent}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <h2 className={styles.sectionTitle}>AI Assistant</h2>
                    <div
                      className={`${styles.aiStatusBadge} ${
                        formData.aiSettings?.enabled !== false && platformAiStatus?.enabled && platformAiStatus?.configured
                          ? styles.active
                          : styles.inactive
                      }`}
                    >
                      <span className={styles.statusDot} />
                      {formData.aiSettings?.enabled === false
                        ? 'Disabled in Preferences'
                        : platformAiStatus === null
                        ? 'Checking Service...'
                        : platformAiStatus.enabled && platformAiStatus.configured
                        ? `Active · ${platformAiStatus.model || platformAiStatus.provider.toUpperCase()}`
                        : 'Local Deterministic Mode'}
                    </div>
                  </div>
                  <p className={styles.sectionDesc}>
                    Workspace AI intelligence powered centrally without personal API key setup.
                  </p>
                </div>
              </div>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.collapseIndicator}>
                  {openSections.ai ? 'Collapse' : 'Expand'}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${openSections.ai ? styles.chevronOpen : ''}`}
                />
              </div>
            </div>

            {openSections.ai && (
              <div className={styles.sectionBody}>
                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Enable AI Assistant Features</span>
                    <span className={styles.toggleDesc}>
                      Allow AI task breakdown, daily briefings, Inbox capture, and floating chat across your workspace.
                    </span>
                  </div>
                  <label className={styles.switch} aria-label="Enable AI Assistant Features">
                    <input
                      type="checkbox"
                      checked={formData.aiSettings?.enabled !== false}
                      onChange={(e) => {
                        const isEnabled = e.target.checked;
                        const updatedAI = {
                          enabled: isEnabled,
                          provider: formData.aiSettings?.provider || 'gemini',
                          model: formData.aiSettings?.model || 'gemini-2.0-flash',
                          apiKey: '',
                          monthlyBudgetUSD: formData.aiSettings?.monthlyBudgetUSD || 5,
                          spentBudgetUSD: formData.aiSettings?.spentBudgetUSD || 0,
                          totalTokensUsed: formData.aiSettings?.totalTokensUsed || 0,
                          temperature: formData.aiSettings?.temperature || 0.7,
                        };
                        const updated = { ...formData, aiSettings: updatedAI };
                        setFormData(updated);
                        updateSettings(updated);
                      }}
                    />
                    <span className={styles.slider} />
                  </label>
                </div>

                <div
                  style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    background: 'var(--color-surface-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)' }}>
                    {platformAiStatus?.enabled && platformAiStatus?.configured
                      ? `Platform Gateway Ready (${(platformAiStatus.provider || 'AI').toUpperCase()} · ${platformAiStatus.model || 'Default Model'})`
                      : 'Local Rules Active'}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                    {platformAiStatus?.enabled && platformAiStatus?.configured
                      ? 'AI provider credentials and routing are centrally managed by your workspace administrator. Every signed-in account has automatic access.'
                      : 'The administrator has not configured a central AI provider yet. Built-in local planning rules remain active.'}
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── 9. Data Backup & Storage Management ── */}
        {(activeCategory === 'all' || activeCategory === 'data') && (
          <section className={styles.sectionCard}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('data')}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.data}
            >
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <Download size={16} />
                </div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionTitle}>Data Backup &amp; Portability</h2>
                  <p className={styles.sectionDesc}>Export a full JSON snapshot of your data or perform maintenance.</p>
                </div>
              </div>
              <div className={styles.sectionHeaderRight}>
                <span className={styles.collapseIndicator}>
                  {openSections.data ? 'Collapse' : 'Expand'}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${openSections.data ? styles.chevronOpen : ''}`}
                />
              </div>
            </div>

            {openSections.data && (
              <div className={styles.sectionBody}>
                <div className={styles.backupCard}>
                  <div>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>
                      Complete Snapshot Export (.json)
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                      Download all Dreams, Goals, Projects, Tasks, Workouts, Notes, Books, and Settings in a portable standard format (API keys &amp; credentials excluded).
                    </span>
                  </div>

                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => void handleExportBackup()}
                  >
                    <Download size={13} style={{ marginRight: 6 }} />
                    Export Data
                  </button>
                </div>

                <div className={styles.backupCard}>
                  <div>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>
                      Restore / Import Snapshot (.json)
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                      Upload and restore a previously exported JSON backup file into your workspace.
                    </span>
                    {restoreStatus && (
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-success)', marginTop: 4 }}>
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
                    <Upload size={13} style={{ marginRight: 6 }} />
                    Import Backup
                  </button>
                </div>

                <div className={styles.backupCard}>
                  <div>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>
                      Restore Starter Workspace Data
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                      Restores missing starter Dreams, Goals, Milestones, Projects, Tasks, Idea Parking, Daily Routine, and Guides without overwriting your custom entries.
                    </span>
                  </div>

                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={async () => {
                      const ok = await confirmDialog({
                        title: 'Restore Starter Workspace',
                        message:
                          'This will merge missing starter Dreams, Goals, Projects, Tasks, Idea Parking items, Habits, and Routine into your workspace without deleting any of your existing custom items. Continue?',
                        confirmLabel: 'Restore Data',
                      });
                      if (!ok) return;
                      const added = await restoreMissingStarterWorkspace();
                      if (docs.length === 0) {
                        restoreStarterBooks();
                      }
                      await alertDialog({
                        title: 'Starter Data Restored',
                        message:
                          added > 0
                            ? `Restored ${added} starter workspace items and synced them to your account.`
                            : 'Your workspace already has all starter items.',
                      });
                    }}
                  >
                    <RotateCcw size={13} style={{ marginRight: 6 }} />
                    Restore Starter Data
                  </button>
                </div>

                <div className={styles.dangerCard} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RotateCcw size={16} style={{ color: 'var(--color-text)' }} />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      Start Fresh (Keep Books)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                    Erases your Tasks, Goals, Milestones, Projects, Dreams, Idea Parking, Calendar, Habits, and Routine so you can start fresh while keeping all of your Books &amp; study documents safe.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={async () => {
                        const phrase = await promptDialog({
                          title: 'Start Fresh (Keep Books)',
                          message: 'Type "RESET" to delete Tasks, Goals, Projects, Dreams, Idea Parking, Calendar, Habits, and Routine while keeping all Books:',
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
                          await alertDialog({
                            title: 'Workspace Reset',
                            message: 'Your workspace is now fresh and empty, and your Books have been preserved.',
                          });
                          window.location.href = '/';
                        } else if (phrase !== null) {
                          await alertDialog({
                            title: 'Action Cancelled',
                            message: 'Confirmation phrase did not match. Nothing was deleted.',
                          });
                        }
                      }}
                    >
                      <RotateCcw size={13} />
                      Start Fresh (Keep Books)
                    </button>
                  </div>
                </div>

                <div className={styles.dangerCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertOctagon size={16} style={{ color: 'var(--color-danger, #ef4444)' }} />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-danger, #ef4444)' }}>
                      Factory Reset / Erase Everything (Including Books)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                    Permanently wipes ALL local and cloud data including Books, tasks, projects, notes, and local credentials.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
                    <button
                      type="button"
                      className={styles.btnDangerSolid}
                      onClick={async () => {
                        const phrase = await promptDialog({
                          title: 'Erase All Data',
                          message: 'To confirm permanent erasure of ALL data (including Books), type "DELETE ALL MY DATA" below:',
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
                            } catch { /* keep going */ }
                          }
                          clearLocalWorkspaceSilently();
                          await idbClear();
                          await alertDialog({
                            title: 'Data Erased',
                            message: 'Sariling Mundo data has been erased.',
                          });
                          window.location.href = '/';
                        } else if (phrase !== null) {
                          await alertDialog({
                            title: 'Action Cancelled',
                            message: 'Confirmation phrase did not match. Action cancelled.',
                          });
                        }
                      }}
                    >
                      <Trash2 size={13} />
                      Erase Data &amp; Reset
                    </button>
                  </div>
                </div>

                {!isGuest && (
                  <div className={styles.dangerCard} style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldAlert size={16} style={{ color: 'var(--color-danger, #ef4444)' }} />
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-danger, #ef4444)' }}>
                        Delete Account Permanently
                      </span>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                      Permanently deletes your Firebase account and erases all cloud records, uploaded attachments, books, and active device sessions. This cannot be undone.
                    </p>

                    {!showDeleteAccountConfirm ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
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
                          <Trash2 size={13} />
                          Delete My Account
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)' }}>
                        {deleteAccountError && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-danger, #ef4444)' }} role="alert">
                            {deleteAccountError}
                          </div>
                        )}

                        {user?.providerData?.some((p) => p.providerId === 'password') && (
                          <div>
                            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                              Current Password
                            </label>
                            <input
                              type="password"
                              value={deleteAccountPassword}
                              onChange={(e) => setDeleteAccountPassword(e.target.value)}
                              placeholder="Enter your password to verify"
                              disabled={deleteAccountBusy}
                              style={{ width: '100%', maxWidth: '340px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.82rem' }}
                            />
                          </div>
                        )}

                        <div>
                          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                            Type DELETE ACCOUNT to confirm
                          </label>
                          <input
                            type="text"
                            value={deleteAccountPhrase}
                            onChange={(e) => setDeleteAccountPhrase(e.target.value)}
                            placeholder="DELETE ACCOUNT"
                            disabled={deleteAccountBusy}
                            style={{ width: '100%', maxWidth: '340px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.82rem' }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          <button
                            type="button"
                            className={styles.btnDangerSolid}
                            disabled={deleteAccountBusy || deleteAccountPhrase !== 'DELETE ACCOUNT'}
                            onClick={async () => {
                              setDeleteAccountError(null);
                              setDeleteAccountBusy(true);
                              try {
                                await deleteAccount(deleteAccountPassword);
                                window.location.href = '/register';
                              } catch (err: unknown) {
                                setDeleteAccountError(err instanceof Error ? err.message : 'Failed to delete account.');
                              } finally {
                                setDeleteAccountBusy(false);
                              }
                            }}
                          >
                            <Trash2 size={13} />
                            {deleteAccountBusy ? 'Deleting Account…' : 'Confirm Permanent Deletion'}
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
            )}
          </section>
        )}

        {/* ── Privacy & Security Statement ── */}
        <div className={styles.privacyNotice}>
          <ShieldCheck className={styles.privacyIcon} size={18} />
          <div>
            <h3 className={styles.privacyTitle}>Private &amp; Local-First Architecture</h3>
            <p className={styles.privacyText}>
              Your workspace is stored locally and synced per user ID via Firebase rules. Review our{' '}
              <Link href="/privacy" style={{ color: 'var(--color-text)', textDecoration: 'underline' }}>
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="/terms" style={{ color: 'var(--color-text)', textDecoration: 'underline' }}>
                Terms of Service
              </Link>
              .
            </p>
          </div>
        </div>

        {/* ── Form Actions ── */}
        <div className={styles.actions}>
          <button type="submit" className={styles.btnPrimary}>
            Save Changes
          </button>

          <button
            type="button"
            className={styles.btnDanger}
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Reset Settings',
                message: 'Reset all settings to default values?',
                confirmLabel: 'Reset Defaults',
                isDestructive: true,
              });
              if (ok) {
                resetSettings();
              }
            }}
          >
            <RotateCcw size={13} />
            Reset Defaults
          </button>
        </div>
      </form>


    </div>
  );
}
