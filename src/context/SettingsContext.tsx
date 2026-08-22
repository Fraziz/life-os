'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { UserSettings } from '@/types';

const SETTINGS_STORAGE_KEY = 'life_os_user_settings_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  profile: {
    id: 'personal-owner',
    name: 'Life OS User',
    displayName: 'Alex',
    avatarInitials: 'A',
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
    enabled: false,
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    monthlyBudgetUSD: 5,
    spentBudgetUSD: 0,
    totalTokensUsed: 0,
    temperature: 0.7,
  },
  theme: 'dark',
  updatedAt: new Date().toISOString(),
};

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  updateProfile: (profile: Partial<UserSettings['profile']>) => void;
  resetSettings: () => void;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const reloadFromStorage = () => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
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

  // Apply theme to document
  useEffect(() => {
    if (!isLoaded) return;
    const theme = settings.theme;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [settings.theme, isLoaded]);

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
    const updated: UserSettings = {
      ...settings,
      ...partial,
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
