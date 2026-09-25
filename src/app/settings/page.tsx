'use client';

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { wipeCloudKv } from '@/lib/cloudStore';
import type { PlanningStyle, AppTheme, SavedApiKey, AISettings } from '@/types';
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
  Trash2,
  AlertOctagon,
  LogOut,
  Lock,
  Eye,
  EyeOff,
  X,
  Sparkles,
  Copy,
  Plus,
  Key,
  Layers,
  Zap,
  Check,
} from 'lucide-react';
import StarterPresetsModal from '@/components/onboarding/StarterPresetsModal';
import { testAIConnection } from '@/utils/aiEngine';
import styles from './page.module.css';

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
  const { user, logout } = useAuth();

  const [formData, setFormData] = useState(settings);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [presetsModalOpen, setPresetsModalOpen] = useState(false);

  // AI Connection Test state
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    modelUsed?: string;
  } | null>(null);

  useEffect(() => {
    if (isLoaded) {
      setFormData(settings);
    }
  }, [settings, isLoaded]);

  // AI Vault & Auto-Save state
  const [autoSavedAi, setAutoSavedAi] = useState(false);
  const [newKeyNameInput, setNewKeyNameInput] = useState('');
  const [isAddingNewKey, setIsAddingNewKey] = useState(false);

  const triggerAutoSaveAI = (updatedAI: AISettings) => {
    const updated = {
      ...formData,
      aiSettings: updatedAI,
    };
    setFormData(updated);
    updateSettings(updated);
    setAutoSavedAi(true);
    setTimeout(() => setAutoSavedAi(false), 2500);
  };

  const handleApiKeyChange = (val: string) => {
    if (!formData.aiSettings) return;
    const curActiveId = formData.aiSettings.activeKeyId;
    let updatedSavedKeys = [...(formData.aiSettings.savedKeys || [])];

    if (curActiveId) {
      updatedSavedKeys = updatedSavedKeys.map((k) => (k.id === curActiveId ? { ...k, apiKey: val } : k));
    }

    const updatedAI: AISettings = {
      ...formData.aiSettings,
      apiKey: val,
      savedKeys: updatedSavedKeys,
    };
    triggerAutoSaveAI(updatedAI);
  };

  const handleSaveCurrentKeyToVault = () => {
    if (!formData.aiSettings?.apiKey?.trim()) return;
    const existing = formData.aiSettings.savedKeys || [];
    const count = existing.length + 1;
    const keyName = newKeyNameInput.trim() || `Key Profile ${count} (${formData.aiSettings.model || 'Flash'})`;
    const newSavedKey: SavedApiKey = {
      id: `key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: keyName,
      apiKey: formData.aiSettings.apiKey.trim(),
      provider: formData.aiSettings.provider,
      model: formData.aiSettings.model,
      createdAt: new Date().toISOString(),
    };
    const updatedAI: AISettings = {
      ...formData.aiSettings,
      savedKeys: [...existing, newSavedKey],
      activeKeyId: newSavedKey.id,
    };
    setNewKeyNameInput('');
    setIsAddingNewKey(false);
    triggerAutoSaveAI(updatedAI);
  };

  const handleDuplicateKey = (k: SavedApiKey) => {
    if (!formData.aiSettings) return;
    const existing = formData.aiSettings.savedKeys || [];
    const duplicated: SavedApiKey = {
      id: `key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${k.name} (Copy)`,
      apiKey: k.apiKey,
      provider: k.provider,
      model: k.model,
      createdAt: new Date().toISOString(),
    };
    const updatedAI: AISettings = {
      ...formData.aiSettings,
      savedKeys: [...existing, duplicated],
    };
    triggerAutoSaveAI(updatedAI);
  };

  const handleSwitchActiveKey = (k: SavedApiKey) => {
    if (!formData.aiSettings) return;
    const updatedAI: AISettings = {
      ...formData.aiSettings,
      apiKey: k.apiKey,
      model: k.model || formData.aiSettings.model,
      provider: k.provider || formData.aiSettings.provider,
      activeKeyId: k.id,
      enabled: true,
    };
    setAiTestResult(null);
    triggerAutoSaveAI(updatedAI);
  };

  const handleDeleteSavedKey = (keyId: string) => {
    if (!formData.aiSettings) return;
    const existing = formData.aiSettings.savedKeys || [];
    const remaining = existing.filter((k) => k.id !== keyId);
    const updatedAI: AISettings = {
      ...formData.aiSettings,
      savedKeys: remaining,
      activeKeyId: formData.aiSettings.activeKeyId === keyId ? remaining[0]?.id || undefined : formData.aiSettings.activeKeyId,
      apiKey: formData.aiSettings.activeKeyId === keyId ? remaining[0]?.apiKey || '' : formData.aiSettings.apiKey,
    };
    triggerAutoSaveAI(updatedAI);
  };

  const handleToggleFailover = () => {
    if (!formData.aiSettings) return;
    const cur = formData.aiSettings.autoFailover !== false;
    const updatedAI: AISettings = {
      ...formData.aiSettings,
      autoFailover: !cur,
    };
    triggerAutoSaveAI(updatedAI);
  };

  const handleTestAndSaveAI = async () => {
    if (!formData.aiSettings) return;
    setIsTestingAI(true);
    setAiTestResult(null);

    const testSettings = {
      ...formData.aiSettings,
      enabled: true,
    };

    const res = await testAIConnection(testSettings);
    setIsTestingAI(false);
    setAiTestResult(res);

    if (res.success) {
      const updated = {
        ...formData,
        aiSettings: {
          ...testSettings,
          model: res.modelUsed || testSettings.model,
        },
      };
      setFormData(updated);
      updateSettings(updated);
    }
  };

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading your personal settings...
        </p>
      </div>
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
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

  return (
    <div className={styles.page}>
      {/* ── Formal Header ── */}
      <header className={styles.header}>
        <h1 className={styles.title}>System Settings &amp; Preferences</h1>
        <p className={styles.subtitle}>
          Manage your profile, display preferences, operational capacity, and integrations.
        </p>
      </header>

      {showSavedToast && (
        <div className={styles.saveBanner} role="status">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} /> Preferences saved successfully.
          </span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* ── 0. Account & Session ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Lock size={16} />
            </div>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Account &amp; Session</h2>
              <p className={styles.sectionDesc}>Authenticated access and multi-device synchronization status.</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', display: 'block' }}>Signed in account</span>
              <strong style={{ fontSize: '0.92rem', color: 'var(--color-text)' }}>{user?.email || 'Local User'}</strong>
            </div>
            <button
              type="button"
              className={styles.btnDanger}
              onClick={() => void logout()}
            >
              <LogOut size={13} />
              Sign Out
            </button>
          </div>
        </section>

        {/* ── 1. Interface & Presets ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Sliders size={16} />
            </div>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Interface Mode</h2>
              <p className={styles.sectionDesc}>Select your preferred workspace density and complexity level.</p>
            </div>
          </div>

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
                <span className={styles.modeCardTitle}>Full Life OS</span>
                {!formData.simpleMode && <span className={styles.modeBadge}>Active</span>}
              </div>
              <p className={styles.modeCardDesc}>
                Complete architecture: Dreams, Goals, Milestones, Projects, Roadmap, and Knowledge Base.
              </p>
            </div>
          </div>

          <div className={styles.starterPresetRow}>
            <div>
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text)' }}>Workspace Templates</span>
              <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', margin: 0 }}>
                Populate initial blueprints for Fitness, Deep Work Student, or Creative Projects.
              </p>
            </div>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setPresetsModalOpen(true)}
            >
              <Sparkles size={12} style={{ marginRight: 6 }} />
              Browse Presets
            </button>
          </div>
        </section>

        {/* ── 2. Appearance & Color Theme ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Sun size={16} />
            </div>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Visual Theme</h2>
              <p className={styles.sectionDesc}>Customize the interface appearance across all devices.</p>
            </div>
          </div>

          <div className={styles.themeGrid}>
            {([
              { id: 'cyber', label: 'Cyber Glow', desc: 'Neon Violet & Electric Cyan', icon: <Sparkles size={14} /> },
              { id: 'nature', label: 'Nature Forest', desc: 'Organic Sage Glass & Timber', icon: <Leaf size={14} /> },
              { id: 'dark', label: 'Sleek Dark', desc: 'Refined Charcoal & Slate', icon: <Moon size={14} /> },
              { id: 'light', label: 'Clean Light', desc: 'Luminous Paper & Indigo', icon: <Sun size={14} /> },
              { id: 'system', label: 'System Sync', desc: 'Match Operating System', icon: <Sliders size={14} /> },
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
        </section>

        {/* ── 3. Identity & Profile ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <User size={16} />
            </div>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Identity &amp; Profile</h2>
              <p className={styles.sectionDesc}>Personalization details used in daily briefings and headings.</p>
            </div>
          </div>

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
        </section>

        {/* ── 4. Time & Schedule Capacity ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Clock size={16} />
            </div>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Schedule &amp; Capacity</h2>
              <p className={styles.sectionDesc}>Define your timezone, daily working hours, and standard schedule.</p>
            </div>
          </div>

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
        </section>

        {/* ── 5. Planning & Task Execution ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Sliders size={16} />
            </div>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Planning &amp; Task Defaults</h2>
              <p className={styles.sectionDesc}>Configure time estimates and task organization frameworks.</p>
            </div>
          </div>

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
                <option value="kanban">Kanban Boards (Visual Workflow)</option>
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
        </section>

        {/* ── 6. Focus & Deep Work Timer ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Headphones size={16} />
            </div>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Focus &amp; Pomodoro Protocols</h2>
              <p className={styles.sectionDesc}>Configure interval timers for undistracted deep work sessions.</p>
            </div>
          </div>

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
        </section>

        {/* ── 7. Notifications & Quiet Hours ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Bell size={16} />
            </div>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Notifications &amp; Quiet Hours</h2>
              <p className={styles.sectionDesc}>Granular notification controls for deadlines, blocks, and quiet time.</p>
            </div>
          </div>

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
              <span className={styles.toggleTitle}>Task Due Date Alerts</span>
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
              <span className={styles.toggleTitle}>Milestone &amp; Goal Target Alerts</span>
              <span className={styles.toggleDesc}>Alert on upcoming project and milestone target dates</span>
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
        </section>

        {/* ── 8. AI Engine & API Key Setup ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Bot size={16} />
            </div>
            <div className={styles.sectionHeaderContent}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <h2 className={styles.sectionTitle}>AI Integration &amp; API Key</h2>
                <div className={`${styles.aiStatusBadge} ${formData.aiSettings?.enabled && formData.aiSettings?.apiKey ? styles.active : styles.inactive}`}>
                  <span className={styles.statusDot} />
                  {formData.aiSettings?.enabled && formData.aiSettings?.apiKey
                    ? `Active: ${formData.aiSettings?.model || 'Gemini'}`
                    : 'Offline Deterministic Mode'}
                </div>
              </div>
              <p className={styles.sectionDesc}>Optional bring-your-own-key intelligence layer for task breakdown and planning.</p>
            </div>
          </div>

          <div className={styles.toggleRow}>
            <div className={styles.toggleLabel}>
              <span className={styles.toggleTitle}>Enable AI Features</span>
              <span className={styles.toggleDesc}>Connect Gemini, OpenAI, Claude, or local Ollama models</span>
            </div>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={formData.aiSettings?.enabled || false}
              onChange={(e) => {
                const isEnabled = e.target.checked;
                const updatedAI = {
                  enabled: isEnabled,
                  provider: formData.aiSettings?.provider || 'gemini',
                  model: formData.aiSettings?.model || 'gemini-2.0-flash',
                  apiKey: formData.aiSettings?.apiKey || '',
                  monthlyBudgetUSD: formData.aiSettings?.monthlyBudgetUSD || 5,
                  spentBudgetUSD: formData.aiSettings?.spentBudgetUSD || 0,
                  totalTokensUsed: formData.aiSettings?.totalTokensUsed || 0,
                  temperature: formData.aiSettings?.temperature || 0.7,
                };
                const updated = {
                  ...formData,
                  aiSettings: updatedAI,
                };
                setFormData(updated);
                updateSettings(updated);
              }}
            />
          </div>

          {formData.aiSettings?.enabled && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>AI Provider</label>
                <div className={styles.providerGrid}>
                  <div
                    className={`${styles.providerCard} ${formData.aiSettings?.provider === 'openrouter' ? styles.activeProvider : ''}`}
                    onClick={() => {
                      const updatedAI = {
                        ...formData.aiSettings!,
                        provider: 'openrouter' as const,
                        model: 'google/gemini-2.0-flash-exp:free',
                      };
                      const updated = { ...formData, aiSettings: updatedAI };
                      setFormData(updated);
                      updateSettings(updated);
                    }}
                  >
                    <span className={styles.providerTitle}>OpenRouter</span>
                    <span className={styles.providerSub}>Free &amp; All Models</span>
                  </div>

                  <div
                    className={`${styles.providerCard} ${formData.aiSettings?.provider === 'groq' ? styles.activeProvider : ''}`}
                    onClick={() => {
                      const updatedAI = {
                        ...formData.aiSettings!,
                        provider: 'groq' as const,
                        model: 'llama-3.3-70b-versatile',
                      };
                      const updated = { ...formData, aiSettings: updatedAI };
                      setFormData(updated);
                      updateSettings(updated);
                    }}
                  >
                    <span className={styles.providerTitle}>Groq</span>
                    <span className={styles.providerSub}>100% Free &amp; Fast</span>
                  </div>

                  <div
                    className={`${styles.providerCard} ${formData.aiSettings?.provider === 'gemini' ? styles.activeProvider : ''}`}
                    onClick={() => {
                      const updatedAI = {
                        ...formData.aiSettings!,
                        provider: 'gemini' as const,
                        model: 'gemini-2.0-flash',
                      };
                      const updated = { ...formData, aiSettings: updatedAI };
                      setFormData(updated);
                      updateSettings(updated);
                    }}
                  >
                    <span className={styles.providerTitle}>Google Gemini</span>
                    <span className={styles.providerSub}>Free Tier Direct</span>
                  </div>

                  <div
                    className={`${styles.providerCard} ${formData.aiSettings?.provider === 'deepseek' ? styles.activeProvider : ''}`}
                    onClick={() => {
                      const updatedAI = {
                        ...formData.aiSettings!,
                        provider: 'deepseek' as const,
                        model: 'deepseek-chat',
                      };
                      const updated = { ...formData, aiSettings: updatedAI };
                      setFormData(updated);
                      updateSettings(updated);
                    }}
                  >
                    <span className={styles.providerTitle}>DeepSeek</span>
                    <span className={styles.providerSub}>V3 / R1 Reasoning</span>
                  </div>

                  <div
                    className={`${styles.providerCard} ${formData.aiSettings?.provider === 'mistral' ? styles.activeProvider : ''}`}
                    onClick={() => {
                      const updatedAI = {
                        ...formData.aiSettings!,
                        provider: 'mistral' as const,
                        model: 'mistral-small-latest',
                      };
                      const updated = { ...formData, aiSettings: updatedAI };
                      setFormData(updated);
                      updateSettings(updated);
                    }}
                  >
                    <span className={styles.providerTitle}>Mistral AI</span>
                    <span className={styles.providerSub}>Free Tier Available</span>
                  </div>

                  <div
                    className={`${styles.providerCard} ${formData.aiSettings?.provider === 'huggingface' ? styles.activeProvider : ''}`}
                    onClick={() => {
                      const updatedAI = {
                        ...formData.aiSettings!,
                        provider: 'huggingface' as const,
                        model: 'meta-llama/Llama-3.2-3B-Instruct',
                      };
                      const updated = { ...formData, aiSettings: updatedAI };
                      setFormData(updated);
                      updateSettings(updated);
                    }}
                  >
                    <span className={styles.providerTitle}>Hugging Face</span>
                    <span className={styles.providerSub}>Serverless Inference</span>
                  </div>

                  <div
                    className={`${styles.providerCard} ${formData.aiSettings?.provider === 'cohere' ? styles.activeProvider : ''}`}
                    onClick={() => {
                      const updatedAI = {
                        ...formData.aiSettings!,
                        provider: 'cohere' as const,
                        model: 'command-r',
                      };
                      const updated = { ...formData, aiSettings: updatedAI };
                      setFormData(updated);
                      updateSettings(updated);
                    }}
                  >
                    <span className={styles.providerTitle}>Cohere</span>
                    <span className={styles.providerSub}>Command R / Trial</span>
                  </div>

                  <div
                    className={`${styles.providerCard} ${formData.aiSettings?.provider === 'openai' ? styles.activeProvider : ''}`}
                    onClick={() => {
                      const updatedAI = {
                        ...formData.aiSettings!,
                        provider: 'openai' as const,
                        model: 'gpt-4o-mini',
                      };
                      const updated = { ...formData, aiSettings: updatedAI };
                      setFormData(updated);
                      updateSettings(updated);
                    }}
                  >
                    <span className={styles.providerTitle}>OpenAI</span>
                    <span className={styles.providerSub}>GPT-4o Mini / 4o</span>
                  </div>

                  <div
                    className={`${styles.providerCard} ${formData.aiSettings?.provider === 'anthropic' ? styles.activeProvider : ''}`}
                    onClick={() => {
                      const updatedAI = {
                        ...formData.aiSettings!,
                        provider: 'anthropic' as const,
                        model: 'claude-3-5-sonnet-20241022',
                      };
                      const updated = { ...formData, aiSettings: updatedAI };
                      setFormData(updated);
                      updateSettings(updated);
                    }}
                  >
                    <span className={styles.providerTitle}>Anthropic</span>
                    <span className={styles.providerSub}>Claude 3.5</span>
                  </div>

                  <div
                    className={`${styles.providerCard} ${formData.aiSettings?.provider === 'custom' ? styles.activeProvider : ''}`}
                    onClick={() => {
                      const updatedAI = {
                        ...formData.aiSettings!,
                        provider: 'custom' as const,
                        model: 'llama3',
                        apiEndpoint: formData.aiSettings?.apiEndpoint || 'http://localhost:11434/v1/chat/completions',
                      };
                      const updated = { ...formData, aiSettings: updatedAI };
                      setFormData(updated);
                      updateSettings(updated);
                    }}
                  >
                    <span className={styles.providerTitle}>Local / Ollama</span>
                    <span className={styles.providerSub}>Offline &amp; Private</span>
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Model Identifier</label>
                <input
                  type="text"
                  className={styles.input}
                  value={formData.aiSettings?.model || ''}
                  onChange={(e) => {
                    const updatedAI = {
                      ...formData.aiSettings!,
                      model: e.target.value,
                    };
                    setFormData({ ...formData, aiSettings: updatedAI });
                  }}
                  placeholder={
                    formData.aiSettings?.provider === 'gemini'
                      ? 'e.g. gemini-3.1-pro-preview or gemini-2.5-flash'
                      : 'e.g. google/gemini-2.0-flash-exp:free'
                  }
                />

                <div className={styles.modelChipsRow}>
                  {formData.aiSettings?.provider === 'openrouter' && (
                    <>
                      {[
                        'google/gemini-2.0-flash-exp:free',
                        'deepseek/deepseek-r1:free',
                        'meta-llama/llama-3.3-70b-instruct:free',
                        'qwen/qwen-2.5-coder-32b-instruct:free',
                        'mistralai/mistral-small-24b-instruct-2501:free',
                        'anthropic/claude-3.5-sonnet',
                        'openai/gpt-4o-mini',
                      ].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`${styles.modelPresetChip} ${formData.aiSettings?.model === m ? styles.activeModelChip : ''}`}
                          onClick={() => {
                            const updatedAI = { ...formData.aiSettings!, model: m };
                            setFormData({ ...formData, aiSettings: updatedAI });
                            updateSettings({ aiSettings: updatedAI });
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </>
                  )}

                  {formData.aiSettings?.provider === 'groq' && (
                    <>
                      {[
                        'llama-3.3-70b-versatile',
                        'llama-3.1-8b-instant',
                        'deepseek-r1-distill-llama-70b',
                        'gemma2-9b-it',
                        'mixtral-8x7b-32768',
                      ].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`${styles.modelPresetChip} ${formData.aiSettings?.model === m ? styles.activeModelChip : ''}`}
                          onClick={() => {
                            const updatedAI = { ...formData.aiSettings!, model: m };
                            setFormData({ ...formData, aiSettings: updatedAI });
                            updateSettings({ aiSettings: updatedAI });
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </>
                  )}

                  {formData.aiSettings?.provider === 'gemini' && (
                    <>
                      {['gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`${styles.modelPresetChip} ${formData.aiSettings?.model === m ? styles.activeModelChip : ''}`}
                          onClick={() => {
                            const updatedAI = { ...formData.aiSettings!, model: m };
                            setFormData({ ...formData, aiSettings: updatedAI });
                            updateSettings({ aiSettings: updatedAI });
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </>
                  )}

                  {formData.aiSettings?.provider === 'deepseek' && (
                    <>
                      {['deepseek-chat', 'deepseek-reasoner'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`${styles.modelPresetChip} ${formData.aiSettings?.model === m ? styles.activeModelChip : ''}`}
                          onClick={() => {
                            const updatedAI = { ...formData.aiSettings!, model: m };
                            setFormData({ ...formData, aiSettings: updatedAI });
                            updateSettings({ aiSettings: updatedAI });
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </>
                  )}

                  {formData.aiSettings?.provider === 'mistral' && (
                    <>
                      {['mistral-small-latest', 'codestral-latest', 'open-mistral-7b', 'mistral-large-latest'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`${styles.modelPresetChip} ${formData.aiSettings?.model === m ? styles.activeModelChip : ''}`}
                          onClick={() => {
                            const updatedAI = { ...formData.aiSettings!, model: m };
                            setFormData({ ...formData, aiSettings: updatedAI });
                            updateSettings({ aiSettings: updatedAI });
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </>
                  )}

                  {formData.aiSettings?.provider === 'huggingface' && (
                    <>
                      {[
                        'meta-llama/Llama-3.2-3B-Instruct',
                        'mistralai/Mistral-7B-Instruct-v0.3',
                        'Qwen/Qwen2.5-72B-Instruct',
                      ].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`${styles.modelPresetChip} ${formData.aiSettings?.model === m ? styles.activeModelChip : ''}`}
                          onClick={() => {
                            const updatedAI = { ...formData.aiSettings!, model: m };
                            setFormData({ ...formData, aiSettings: updatedAI });
                            updateSettings({ aiSettings: updatedAI });
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </>
                  )}

                  {formData.aiSettings?.provider === 'cohere' && (
                    <>
                      {['command-r', 'command-r-plus', 'command-light'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`${styles.modelPresetChip} ${formData.aiSettings?.model === m ? styles.activeModelChip : ''}`}
                          onClick={() => {
                            const updatedAI = { ...formData.aiSettings!, model: m };
                            setFormData({ ...formData, aiSettings: updatedAI });
                            updateSettings({ aiSettings: updatedAI });
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </>
                  )}

                  {formData.aiSettings?.provider === 'openai' && (
                    <>
                      {['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`${styles.modelPresetChip} ${formData.aiSettings?.model === m ? styles.activeModelChip : ''}`}
                          onClick={() => {
                            const updatedAI = { ...formData.aiSettings!, model: m };
                            setFormData({ ...formData, aiSettings: updatedAI });
                            updateSettings({ aiSettings: updatedAI });
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </>
                  )}

                  {formData.aiSettings?.provider === 'anthropic' && (
                    <>
                      {['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`${styles.modelPresetChip} ${formData.aiSettings?.model === m ? styles.activeModelChip : ''}`}
                          onClick={() => {
                            const updatedAI = { ...formData.aiSettings!, model: m };
                            setFormData({ ...formData, aiSettings: updatedAI });
                            updateSettings({ aiSettings: updatedAI });
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </>
                  )}

                  {formData.aiSettings?.provider === 'custom' && (
                    <>
                      {['llama3', 'mistral', 'deepseek-r1', 'qwen2.5', 'phi3'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`${styles.modelPresetChip} ${formData.aiSettings?.model === m ? styles.activeModelChip : ''}`}
                          onClick={() => {
                            const updatedAI = { ...formData.aiSettings!, model: m };
                            setFormData({ ...formData, aiSettings: updatedAI });
                            updateSettings({ aiSettings: updatedAI });
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {formData.aiSettings?.provider === 'custom' && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Custom Endpoint URL</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={formData.aiSettings?.apiEndpoint || ''}
                    onChange={(e) => {
                      const updatedAI = {
                        ...formData.aiSettings!,
                        apiEndpoint: e.target.value,
                      };
                      setFormData({ ...formData, aiSettings: updatedAI });
                    }}
                    placeholder="http://localhost:11434/v1/chat/completions"
                  />
                </div>
              )}

              <div className={styles.formGroup}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <label className={styles.label}>API Key (Stored Locally)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {autoSavedAi && (
                      <span className={styles.autoSaveBadge}>
                        <Check size={12} /> Auto-saved
                      </span>
                    )}
                    {formData.aiSettings?.provider === 'gemini' && (
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.externalGuideLink}
                      >
                        Get Free Gemini Key (Google AI Studio)
                      </a>
                    )}
                    {formData.aiSettings?.provider === 'groq' && (
                      <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.externalGuideLink}
                      >
                        Get Free Groq API Key
                      </a>
                    )}
                    {formData.aiSettings?.provider === 'openrouter' && (
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.externalGuideLink}
                      >
                        Get OpenRouter Key
                      </a>
                    )}
                    {formData.aiSettings?.provider === 'deepseek' && (
                      <a
                        href="https://platform.deepseek.com/api_keys"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.externalGuideLink}
                      >
                        Get DeepSeek Key
                      </a>
                    )}
                    {formData.aiSettings?.provider === 'mistral' && (
                      <a
                        href="https://console.mistral.ai/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.externalGuideLink}
                      >
                        Get Mistral API Key
                      </a>
                    )}
                    {formData.aiSettings?.provider === 'huggingface' && (
                      <a
                        href="https://huggingface.co/settings/tokens"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.externalGuideLink}
                      >
                        Get Free Hugging Face Token
                      </a>
                    )}
                    {formData.aiSettings?.provider === 'cohere' && (
                      <a
                        href="https://dashboard.cohere.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.externalGuideLink}
                      >
                        Get Cohere Trial Key
                      </a>
                    )}
                    {formData.aiSettings?.provider === 'openai' && (
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.externalGuideLink}
                      >
                        Get OpenAI API Key
                      </a>
                    )}
                    {formData.aiSettings?.provider === 'anthropic' && (
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.externalGuideLink}
                      >
                        Get Anthropic API Key
                      </a>
                    )}
                    {formData.aiSettings?.provider === 'custom' && (
                      <a
                        href="https://ollama.com"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.externalGuideLink}
                      >
                        Learn about local Ollama setup
                      </a>
                    )}
                  </div>
                </div>

                <div className={styles.apiKeyInputWrapper}>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className={styles.input}
                    value={formData.aiSettings?.apiKey || ''}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder={
                      formData.aiSettings?.provider === 'gemini'
                        ? 'Paste your Gemini API key (auto-saves instantly)'
                        : 'Paste your API key (auto-saves instantly)'
                    }
                    id="ai-api-key-input"
                  />
                  <div className={styles.inputActions}>
                    <button
                      type="button"
                      className={styles.iconBtnSmall}
                      onClick={() => setShowApiKey(!showApiKey)}
                      title={showApiKey ? 'Hide key' : 'Show key'}
                      aria-label="Toggle key visibility"
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    {formData.aiSettings?.apiKey && (
                      <button
                        type="button"
                        className={styles.iconBtnSmall}
                        onClick={() => {
                          const updatedAI = { ...formData.aiSettings!, apiKey: '', activeKeyId: undefined };
                          triggerAutoSaveAI(updatedAI);
                          setAiTestResult(null);
                        }}
                        title="Clear key"
                        aria-label="Clear key"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span className={styles.hint}>
                    Keys auto-save instantly and remain strictly on your local device.
                  </span>
                  {formData.aiSettings?.apiKey?.trim() && (
                    <button
                      type="button"
                      className={styles.btnVaultAction}
                      onClick={() => setIsAddingNewKey(!isAddingNewKey)}
                      title="Save this key to your multi-key vault"
                    >
                      <Key size={13} /> Save to Key Vault
                    </button>
                  )}
                </div>

                {/* Save Key to Vault Dialog */}
                {isAddingNewKey && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--color-surface-2)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                    <input
                      type="text"
                      className={styles.input}
                      style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                      value={newKeyNameInput}
                      onChange={(e) => setNewKeyNameInput(e.target.value)}
                      placeholder="Identifier name (e.g. Primary Studio Key, Backup Flash 2)..."
                      autoFocus
                    />
                    <button
                      type="button"
                      className={`${styles.btnVaultAction} ${styles.btnVaultActionPrimary}`}
                      onClick={handleSaveCurrentKeyToVault}
                    >
                      <Plus size={13} /> Save Key
                    </button>
                    <button
                      type="button"
                      className={styles.btnVaultAction}
                      onClick={() => setIsAddingNewKey(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* ── Key Vault & Multi-Key Switcher / Pool ── */}
                <div className={styles.vaultContainer}>
                  <div className={styles.vaultHeader}>
                    <div className={styles.vaultTitle}>
                      <Key size={15} style={{ color: 'var(--color-accent)' }} />
                      Saved API Keys Vault ({formData.aiSettings?.savedKeys?.length || 0})
                    </div>
                    <div className={styles.vaultActions}>
                      <button
                        type="button"
                        className={styles.btnVaultAction}
                        onClick={() => {
                          if (formData.aiSettings?.apiKey) {
                            handleSaveCurrentKeyToVault();
                          } else {
                            setIsAddingNewKey(true);
                          }
                        }}
                      >
                        <Plus size={12} /> Add Key Profile
                      </button>
                    </div>
                  </div>

                  {(!formData.aiSettings?.savedKeys || formData.aiSettings.savedKeys.length === 0) ? (
                    <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: 0 }}>
                      No key profiles saved yet. Click &quot;Save to Key Vault&quot; above to store multiple Gemini keys for instant 1-click switching and automatic failover when limits are reached.
                    </p>
                  ) : (
                    <div className={styles.vaultList}>
                      {formData.aiSettings.savedKeys.map((k) => {
                        const isActive = formData.aiSettings?.apiKey === k.apiKey || formData.aiSettings?.activeKeyId === k.id;
                        const maskedKey = k.apiKey.length > 10
                          ? `${k.apiKey.slice(0, 7)}...${k.apiKey.slice(-5)}`
                          : '••••••••';

                        return (
                          <div
                            key={k.id}
                            className={`${styles.vaultCard} ${isActive ? styles.vaultCardActive : ''}`}
                          >
                            <div className={styles.vaultCardInfo}>
                              <div className={styles.vaultCardNameRow}>
                                <span className={styles.vaultCardName}>{k.name}</span>
                                {isActive && <span className={styles.activeTag}>Active</span>}
                                {k.model && (
                                  <span style={{ fontSize: '0.68rem', color: 'var(--color-accent)', background: 'var(--color-surface)', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                                    {k.model}
                                  </span>
                                )}
                              </div>
                              <span className={styles.vaultCardKey}>{maskedKey}</span>
                            </div>

                            <div className={styles.vaultCardActions}>
                              {!isActive && (
                                <button
                                  type="button"
                                  className={`${styles.btnVaultAction} ${styles.btnVaultActionPrimary}`}
                                  onClick={() => handleSwitchActiveKey(k)}
                                  title="Switch to this API key instantly"
                                >
                                  <Zap size={12} /> Use
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.btnVaultAction}
                                onClick={() => handleDuplicateKey(k)}
                                title="Duplicate profile (switch model or label without retyping key)"
                              >
                                <Copy size={12} /> Duplicate
                              </button>
                              <button
                                type="button"
                                className={styles.iconBtnSmall}
                                onClick={() => handleDeleteSavedKey(k.id)}
                                title="Delete key profile"
                                aria-label="Delete key profile"
                              >
                                <Trash2 size={13} style={{ color: 'var(--color-danger, #ef4444)' }} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Auto-Failover setting */}
                  <div className={styles.failoverRow}>
                    <div className={styles.failoverLabel}>
                      <span style={{ fontWeight: 600 }}>Auto-Switch on Rate Limit / Quota Exhaustion</span>
                      <span style={{ fontSize: '0.70rem', color: 'var(--color-text-muted)' }}>
                        Automatically failover to the next saved key in your pool if Gemini returns 429 or quota limit.
                      </span>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={formData.aiSettings?.autoFailover !== false}
                        onChange={handleToggleFailover}
                      />
                      <span className={styles.slider} />
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.testConnectionArea}>
                <div className={styles.testButtonsRow}>
                  <button
                    type="button"
                    className={styles.btnTestConnection}
                    onClick={handleTestAndSaveAI}
                    disabled={isTestingAI || (!formData.aiSettings?.apiKey && formData.aiSettings?.provider !== 'custom')}
                  >
                    {isTestingAI ? 'Testing...' : 'Test Connection'}
                  </button>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                    Verifies connection against the {formData.aiSettings?.provider} endpoint.
                  </span>
                </div>

                {aiTestResult && (
                  <>
                    {aiTestResult.success ? (
                      <div className={styles.testSuccessBox} role="status">
                        Connected successfully. Latency: {aiTestResult.latencyMs}ms.
                      </div>
                    ) : (
                      <div className={styles.testErrorBox} role="alert">
                        Connection failed: {aiTestResult.message}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </section>

        {/* ── 9. Data Backup & Storage Management ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Download size={16} />
            </div>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Data Backup &amp; Portability</h2>
              <p className={styles.sectionDesc}>Export a full JSON snapshot of your data or perform maintenance.</p>
            </div>
          </div>

          <div className={styles.backupCard}>
            <div>
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>
                Complete Snapshot Export (.json)
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                Download all Dreams, Goals, Projects, Tasks, Notes, and Settings in a portable standard format.
              </span>
            </div>

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                if (typeof window === 'undefined') return;
                const backup: Record<string, any> = {};
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && (key.startsWith('life_os_') || key.startsWith('lifeos_'))) {
                    try {
                      backup[key] = JSON.parse(localStorage.getItem(key) || 'null');
                    } catch {
                      backup[key] = localStorage.getItem(key);
                    }
                  }
                }
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `life-os-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={13} style={{ marginRight: 6 }} />
              Export Data
            </button>
          </div>

          <div className={styles.dangerCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertOctagon size={16} style={{ color: 'var(--color-danger, #ef4444)' }} />
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-danger, #ef4444)' }}>
                Factory Reset / Erase Local Data
              </span>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
              Permanently wipes all local browser storage, tasks, projects, notes, and local credentials.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
              <button
                type="button"
                className={styles.btnDangerSolid}
                onClick={async () => {
                  const phrase = prompt('To confirm erasure of all data, type "DELETE ALL MY DATA" below:');
                  if (phrase === 'DELETE ALL MY DATA') {
                    if (user) {
                      try { await wipeCloudKv(user.uid); } catch { /* keep going */ }
                    }
                    localStorage.clear();
                    alert('Life OS data has been erased.');
                    window.location.href = '/';
                  } else if (phrase !== null) {
                    alert('Confirmation phrase did not match. Action cancelled.');
                  }
                }}
              >
                <Trash2 size={13} />
                Erase Data &amp; Reset
              </button>
            </div>
          </div>
        </section>

        {/* ── Privacy & Security Statement ── */}
        <div className={styles.privacyNotice}>
          <ShieldCheck className={styles.privacyIcon} size={18} />
          <div>
            <h3 className={styles.privacyTitle}>Private &amp; Local-First Architecture</h3>
            <p className={styles.privacyText}>
              All data is stored directly in your local environment and synced securely via your private Firebase cloud project.
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
            onClick={() => {
              if (confirm('Reset all settings to default values?')) {
                resetSettings();
              }
            }}
          >
            <RotateCcw size={13} />
            Reset Defaults
          </button>
        </div>
      </form>

      {/* Starter Presets Modal */}
      <StarterPresetsModal isOpen={presetsModalOpen} onClose={() => setPresetsModalOpen(false)} />
    </div>
  );
}
