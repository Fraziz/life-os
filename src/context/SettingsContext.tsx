'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { UserSettings } from '@/types';

const SETTINGS_STORAGE_KEY = 'life_os_user_settings_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  profile: {
    id: 'personal-owner',
    name: 'Personal Space',
    displayName: '',
    avatarInitials: 'U',
  },
  timeZone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
  workingHours: {
    start: '09:00',
    end: '17:00',
    workDays: [1, 2, 3, 4, 5],
  },
  availableHoursPerDay: 8,
  planningStyle: 'time-blocking',
  defaultTaskDuration: 30,
  focusPreferences: {
    pomodoroDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    autoStartBreaks: false,
  },
  notifications: {
    enabled: true,
    taskReminders: true,
    deadlineAlerts: true,
    scheduledWorkAlerts: true,
    habitReminders: true,
    weeklyReviewReminders: true,
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '08:00',
    },
    browserNotifications: false,
    reminderAdvanceMinutes: 15,
  },
  aiSettings: {
    enabled: true,
    provider: 'groq',
    apiKey: '',
    model: 'openai/gpt-oss-120b',
    monthlyBudgetUSD: 10,
    spentBudgetUSD: 0,
    totalTokensUsed: 0,
    temperature: 0.7,
    autoFailover: true,
    savedKeys: [],
    activeKeyId: undefined,
  },
  simpleMode: false,
  starterPreset: 'default',
  theme: 'system',
  colorTheme: 'slate',
  updatedAt: new Date().toISOString(),
};

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  updateProfile: (profile: Partial<UserSettings['profile']>) => void;
  toggleSimpleMode: () => void;
  resetSettings: () => void;
  isLoaded: boolean;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const reloadFromStorage = () => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.aiSettings?.model === 'gemini-2.5-pro' || parsed.aiSettings?.model === 'models/gemini-2.5-pro') {
          parsed.aiSettings.model = 'gemini-3.1-pro-preview';
        }
        // Clean up any stale apiEndpoint if provider is not custom so it cannot hijack cloud endpoints
        if (parsed.aiSettings && parsed.aiSettings.provider !== 'custom' && parsed.aiSettings.apiEndpoint) {
          delete parsed.aiSettings.apiEndpoint;
        }
        // If provider is groq and model is unavailable llama-3.3-70b-versatile, auto-migrate to openai/gpt-oss-120b
        if (parsed.aiSettings?.provider === 'groq' && (parsed.aiSettings?.model === 'llama-3.3-70b-versatile' || !parsed.aiSettings?.model)) {
          parsed.aiSettings.model = 'openai/gpt-oss-120b';
        }
        // Ensure aiSettings defaults exist without baking server API keys into client bundles
        if (!parsed.aiSettings) {
          parsed.aiSettings = { ...DEFAULT_SETTINGS.aiSettings };
        } else {
          parsed.aiSettings = {
            ...DEFAULT_SETTINGS.aiSettings,
            ...parsed.aiSettings,
            autoFailover: parsed.aiSettings.autoFailover ?? true,
          };
        }
        // Normalize legacy themes and migrate once to System Auto-Adjust so themes adapt with OS Day/Night
        if (parsed.theme === 'nature') {
          parsed.theme = 'system';
          parsed.colorTheme = parsed.colorTheme || 'sage';
        } else if (parsed.theme === 'cyber') {
          parsed.theme = 'system';
          parsed.colorTheme = parsed.colorTheme || 'indigo';
        }
        try {
          if (!localStorage.getItem('life_os_auto_theme_migrated_v1')) {
            parsed.theme = 'system';
            parsed.colorTheme = parsed.colorTheme || 'ocean';
            localStorage.setItem('life_os_auto_theme_migrated_v1', 'true');
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...parsed }));
          }
        } catch {}
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } else {
        try { localStorage.setItem('life_os_auto_theme_migrated_v1', 'true'); } catch {}
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error('Failed to load Life OS user settings:', err);
    }
  };

  useEffect(() => {
    reloadFromStorage();
    setIsLoaded(true);

    const handleSync = () => reloadFromStorage();
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, []);

  // Apply luminance mode ('light' | 'dark' with live OS 'system' listener) + colorTheme palette
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;

    const colorPalette = settings.colorTheme || 'slate';
    document.documentElement.setAttribute('data-color-theme', colorPalette);

    const syncDesktopCompanionTheme = (isDark: boolean) => {
      try {
        const win = window as Window & {
          sarilingDesktop?: {
            syncTheme?: (payload: { theme: 'light' | 'dark'; colorTheme: string }) => void;
          };
        };
        win.sarilingDesktop?.syncTheme?.({
          theme: isDark ? 'dark' : 'light',
          colorTheme: colorPalette,
        });
      } catch {}
    };

    const applyResolvedMode = (isDark: boolean) => {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      syncDesktopCompanionTheme(isDark);
    };

    if (settings.theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      applyResolvedMode(mql.matches);
      const onSchemeChange = (e: MediaQueryListEvent) => applyResolvedMode(e.matches);
      mql.addEventListener('change', onSchemeChange);
      return () => mql.removeEventListener('change', onSchemeChange);
    }

    applyResolvedMode(settings.theme === 'dark');
  }, [settings.theme, settings.colorTheme, isLoaded]);

  // Persist settings
  const saveSettings = (updated: UserSettings) => {
    setSettings(updated);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save Life OS user settings:', err);
    }
  };

  const updateSettings = (partial: Partial<UserSettings>) => {
    if (partial.aiSettings?.model === 'gemini-2.5-pro' || partial.aiSettings?.model === 'models/gemini-2.5-pro') {
      partial.aiSettings.model = 'gemini-3.1-pro-preview';
    }
    const updated: UserSettings = {
      ...settings,
      ...partial,
      aiSettings: partial.aiSettings
        ? { ...(settings.aiSettings || DEFAULT_SETTINGS.aiSettings!), ...partial.aiSettings }
        : settings.aiSettings,
      notifications: partial.notifications
        ? { ...settings.notifications, ...partial.notifications }
        : settings.notifications,
      workingHours: partial.workingHours
        ? { ...settings.workingHours, ...partial.workingHours }
        : settings.workingHours,
      focusPreferences: partial.focusPreferences
        ? { ...settings.focusPreferences, ...partial.focusPreferences }
        : settings.focusPreferences,
      updatedAt: new Date().toISOString(),
    };
    saveSettings(updated);
  };

  const updateProfile = (profilePartial: Partial<UserSettings['profile']>) => {
    const updatedProfile = {
      ...settings.profile,
      ...profilePartial,
      avatarInitials: profilePartial.displayName
        ? profilePartial.displayName.slice(0, 2).toUpperCase()
        : profilePartial.name
          ? profilePartial.name.slice(0, 2).toUpperCase()
          : settings.profile.avatarInitials,
    };
    updateSettings({ profile: updatedProfile });
  };

  const toggleSimpleMode = () => {
    updateSettings({ simpleMode: !settings.simpleMode });
  };

  const resetSettings = () => {
    const reset = {
      ...DEFAULT_SETTINGS,
      updatedAt: new Date().toISOString(),
    };
    saveSettings(reset);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        updateProfile,
        toggleSimpleMode,
        resetSettings,
        isLoaded,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
