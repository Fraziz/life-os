'use client';

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { wipeCloudKv } from '@/lib/cloudStore';
import type { PlanningStyle, AppTheme } from '@/types';
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
  Download,
  Trash2,
  AlertOctagon,
  LogOut,
  Lock,
} from 'lucide-react';
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
  const { settings, updateSettings, updateProfile, resetSettings, isLoaded } = useSettings();
  const { user, logout } = useAuth();

  // Local form state initialized from context
  const [formData, setFormData] = useState(settings);
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setFormData(settings);
    }
  }, [settings, isLoaded]);

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
      {/* ── Header ── */}
      <header className={styles.header}>
        <h1 className={styles.title}>Personal Profile & Settings</h1>
        <p className={styles.subtitle}>
          Configure your personal Life OS parameters. Your preferences guide daily planning, focus timing, and task breakdown.
        </p>
      </header>

      {showSavedToast && (
        <div className={styles.saveBanner} role="status">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} /> Settings saved to local browser storage!
          </span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Lock size={20} />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Your private login</h2>
              <p className={styles.sectionDesc}>Only this account can open Life OS. Phone and computer stay in sync.</p>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Signed in as <strong style={{ color: 'var(--color-text)' }}>{user?.email || 'you'}</strong>
          </p>
          <button
            type="button"
            className={styles.btnDanger}
            onClick={() => void logout()}
          >
            <LogOut size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Log out
          </button>
        </section>

        {/* ── 0. Appearance ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Sun size={20} />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Appearance</h2>
              <p className={styles.sectionDesc}>Choose between dark mode, light mode, or follow your system preference.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {(['dark', 'light', 'system'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  const newTheme = t as AppTheme;
                  const updated = { ...formData, theme: newTheme };
                  setFormData(updated);
                  updateSettings(updated);  // apply immediately — no Save needed
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-lg)',
                  border: formData.theme === t
                    ? '2px solid var(--color-accent)'
                    : '1px solid var(--color-border)',
                  background: formData.theme === t
                    ? 'var(--color-accent-dim)'
                    : 'var(--color-surface-2)',
                  color: formData.theme === t ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  fontWeight: formData.theme === t ? 700 : 500,
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {t === 'dark' && <Moon size={16} />}
                {t === 'light' && <Sun size={16} />}
                {t === 'system' && <Sliders size={16} />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {/* ── 1. Profile ── */}
        <section className={styles.sectionCard}>

          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <User size={20} />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Identity & Profile</h2>
              <p className={styles.sectionDesc}>Your name and preferred display name across the app.</p>
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
              <label className={styles.label} htmlFor="display-name-input">Preferred Display Name</label>
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
              <span className={styles.hint}>Used in greetings and navigation sidebar.</span>
            </div>
          </div>
        </section>

        {/* ── 2. Time & Capacity ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Clock size={20} />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Time Zone & Working Hours</h2>
              <p className={styles.sectionDesc}>Define when you work and how many hours you have available per day.</p>
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
              <span className={styles.hint}>Realistic daily capacity for deep & shallow work.</span>
            </div>
          </div>

          <div className={styles.gridTwo} style={{ marginTop: 'var(--space-2)' }}>
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

        {/* ── 3. Planning & Tasks ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Sliders size={20} />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Planning & Task Defaults</h2>
              <p className={styles.sectionDesc}>Customize how Life OS structures your schedule and estimates task time.</p>
            </div>
          </div>

          <div className={styles.gridTwo}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="planning-style-select">Preferred Planning Style</label>
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

        {/* ── 4. Focus Timer Preferences ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Headphones size={20} />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Focus & Pomodoro Preferences</h2>
              <p className={styles.sectionDesc}>Set default intervals for your deep work focus sessions.</p>
            </div>
          </div>

          <div className={styles.gridTwo}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="pomodoro-duration">Focus Session (Minutes)</label>
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
                <span className={styles.toggleDesc}>Automatically start break timer when focus session finishes</span>
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

        {/* ── 5. Reminders, Quiet Hours & Theme ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Bell size={20} />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Reminders &amp; Quiet Hours</h2>
              <p className={styles.sectionDesc}>Complete control over tasks, deadlines, habits, and quiet resting hours.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {/* Master Toggle */}
            <div className={styles.toggleRow} style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '12px' }}>
              <div className={styles.toggleLabel}>
                <span className={styles.toggleTitle} style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                  Enable Reminders &amp; Alerts
                </span>
                <span className={styles.toggleDesc}>Master switch to turn on/off all notification features</span>
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

            {/* Quiet Hours */}
            <div style={{ background: 'var(--color-surface-2)', padding: '12px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
              <div className={styles.toggleRow} style={{ marginBottom: '8px' }}>
                <div className={styles.toggleLabel}>
                  <span className={styles.toggleTitle}>🌙 Quiet Hours</span>
                  <span className={styles.toggleDesc}>Automatically silence non-urgent notifications during sleep or focus time</span>
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
                <div className={styles.gridTwo} style={{ marginTop: '8px' }}>
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
            </div>

            {/* Individual Notification Toggles */}
            <div className={styles.toggleRow}>
              <div className={styles.toggleLabel}>
                <span className={styles.toggleTitle}>Task Due Alerts</span>
                <span className={styles.toggleDesc}>Remind me when tasks are due or overdue</span>
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
                <span className={styles.toggleTitle}>Deadline &amp; Milestone Alerts</span>
                <span className={styles.toggleDesc}>Alert me for upcoming project or milestone target dates</span>
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
                <span className={styles.toggleTitle}>Scheduled Calendar Work Blocks</span>
                <span className={styles.toggleDesc}>Alert me when a scheduled focus block is about to start</span>
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
                <span className={styles.toggleTitle}>Habit Practice Cues</span>
                <span className={styles.toggleDesc}>Remind me for configured daily/weekly habit practice times</span>
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
                <span className={styles.toggleTitle}>Weekly Review Prompts</span>
                <span className={styles.toggleDesc}>Prompt for weekly reflection every Sunday / Friday</span>
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
          </div>
        </section>

        {/* ── 6. Optional AI Assistant & API Cost Control ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Bot size={20} />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Optional AI Assistant &amp; Privacy</h2>
              <p className={styles.sectionDesc}>100% optional. The app works fully offline using deterministic rules if AI is disabled.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className={styles.toggleRow} style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '12px' }}>
              <div className={styles.toggleLabel}>
                <span className={styles.toggleTitle} style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                  Enable Cloud AI Features
                </span>
                <span className={styles.toggleDesc}>
                  Connect your own API key to augment goal breakdown, planning, and task suggestions.
                </span>
              </div>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={formData.aiSettings?.enabled || false}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    aiSettings: {
                      enabled: e.target.checked,
                      provider: formData.aiSettings?.provider || 'gemini',
                      model: formData.aiSettings?.model || 'gemini-1.5-flash',
                      apiKey: formData.aiSettings?.apiKey || '',
                      monthlyBudgetUSD: formData.aiSettings?.monthlyBudgetUSD || 5,
                      spentBudgetUSD: formData.aiSettings?.spentBudgetUSD || 0,
                      totalTokensUsed: formData.aiSettings?.totalTokensUsed || 0,
                      temperature: formData.aiSettings?.temperature || 0.7,
                    },
                  })
                }
              />
            </div>

            {formData.aiSettings?.enabled && (
              <>
                <div className={styles.gridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>AI Provider</label>
                    <select
                      className={styles.select}
                      value={formData.aiSettings?.provider || 'gemini'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          aiSettings: {
                            ...formData.aiSettings!,
                            provider: e.target.value as any,
                            model: e.target.value === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini',
                          },
                        })
                      }
                    >
                      <option value="gemini">Google Gemini (Recommended &amp; Cost Effective)</option>
                      <option value="openai">OpenAI (GPT-4o Mini)</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="custom">Custom Endpoint (Ollama / Local LLM)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Model Identifier</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={formData.aiSettings?.model || 'gemini-1.5-flash'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          aiSettings: {
                            ...formData.aiSettings!,
                            model: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g. gemini-1.5-flash"
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Private API Key (Stored 100% Locally)</label>
                  <input
                    type="password"
                    className={styles.input}
                    value={formData.aiSettings?.apiKey || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        aiSettings: {
                          ...formData.aiSettings!,
                          apiKey: e.target.value,
                        },
                      })
                    }
                    placeholder="Enter your private API key..."
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginTop: '2px' }}>
                    Your API key is never shared or stored in any cloud backend. It remains exclusively in your browser.
                  </span>
                </div>

                <div className={styles.gridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Monthly Budget Safeguard (USD)</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className={styles.input}
                      value={formData.aiSettings?.monthlyBudgetUSD || 5}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          aiSettings: {
                            ...formData.aiSettings!,
                            monthlyBudgetUSD: parseFloat(e.target.value) || 5,
                          },
                        })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Estimated Usage &amp; Cost</label>
                    <div style={{ background: 'var(--color-surface-2)', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      <strong>${(formData.aiSettings?.spentBudgetUSD || 0).toFixed(4)}</strong> spent of ${formData.aiSettings?.monthlyBudgetUSD || 5} limit &middot; {formData.aiSettings?.totalTokensUsed || 0} tokens
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── 7. Data Portability & Account Reset (Phase 28) ── */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <Download size={20} />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Data Backup, Export &amp; Account Reset</h2>
              <p className={styles.sectionDesc}>Download a complete JSON snapshot of all your Life OS data or perform a factory reset.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Export */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)', display: 'block' }}>
                  Download Complete Data Backup (JSON)
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Exports Dreams, Goals, Projects, Tasks, Notes, Habits, Reviews, and Settings into a single portable file.
                </span>
              </div>

              <button
                type="button"
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} /> Export Backup (.json)
              </button>
            </div>

            {/* Account Reset / Factory Delete */}
            <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.06)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertOctagon size={18} style={{ color: 'var(--color-danger)' }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-danger)' }}>
                  Factory Reset / Erase All Local Data
                </span>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                Permanently wipes all local browser storage, tasks, projects, habits, documents, and API keys. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    const phrase = prompt('To confirm complete erasure of all local data, type "DELETE ALL MY DATA" below:');
                    if (phrase === 'DELETE ALL MY DATA') {
                      if (user) {
                        try { await wipeCloudKv(user.uid); } catch { /* keep going */ }
                      }
                      localStorage.clear();
                      alert('Life OS data has been erased. The app will reload.');
                      window.location.href = '/';
                    } else if (phrase !== null) {
                      alert('Confirmation phrase did not match. Deletion cancelled.');
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--color-danger)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={14} /> Erase All Data &amp; Reset Account
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Privacy & Security Guarantee ── */}
        <div className={styles.privacyNotice}>
          <ShieldCheck className={styles.privacyIcon} size={24} />
          <div>
            <h3 className={styles.privacyTitle}>Private Life OS — locked to you</h3>
            <p className={styles.privacyText}>
              Login is required. Your plans sync through your Firebase project so phone and computer stay in sync.
              Files live in your Storage bucket. Nobody else can open this account.
            </p>
          </div>
        </div>

        {/* ── Form Actions ── */}
        <div className={styles.actions}>
          <button type="submit" className={styles.btnPrimary}>
            Save Preferences
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
            <RotateCcw size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Reset Defaults
          </button>
        </div>
      </form>
    </div>
  );
}
