'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { ReadingLogItem } from '@/types';
import { useKnowledge } from '@/context/KnowledgeContext';
import { playTimerAlarmSound, stopTimerAlarm } from '@/utils/soundAndDopamine';

export type StudyTimerMode = 'pomodoro' | 'stopwatch';
export type PomodoroState = 'focus' | 'shortBreak' | 'longBreak';

export interface StudySettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

export interface StudySessionContextType {
  // Mode & State
  mode: StudyTimerMode;
  pomoState: PomodoroState;
  isRunning: boolean;
  
  // Timer values
  pomoSecondsLeft: number;
  pomoDuration: number;
  stopwatchSeconds: number;
  sessionCount: number; // 1 to 4
  totalFocusSessionsCompleted: number;
  
  // Local time
  localTimeStr: string;
  
  // Associated entity
  currentBookId: string | null;
  currentBookTitle: string | null;
  currentLessonTitle: string | null;
  currentVideoId: string | null;
  
  // Settings
  settings: StudySettings;
  updateSettings: (newSettings: Partial<StudySettings>) => void;
  
  // Notification / message
  completionMessage: string | null;
  clearCompletionMessage: () => void;
  
  // Actions
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setMode: (mode: StudyTimerMode) => void;
  setPomoState: (state: PomodoroState) => void;
  skipToNextPomo: () => void;
  setAssociatedBook: (bookId: string | null, bookTitle: string | null) => void;
  setAssociatedLesson: (lessonTitle: string | null, videoId: string | null) => void;
  saveActiveStopwatchSession: () => void;
}

const STORAGE_KEY = 'life_os_study_session_v2';

const DEFAULT_SETTINGS: StudySettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

const StudySessionContext = createContext<StudySessionContextType | null>(null);

export function StudySessionProvider({ children }: { children: React.ReactNode }) {
  const { docs, updateDoc } = useKnowledge();

  const [mode, setModeState] = useState<StudyTimerMode>('pomodoro');
  const [pomoState, setPomoStateInternal] = useState<PomodoroState>('focus');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  
  const [settings, setSettings] = useState<StudySettings>(DEFAULT_SETTINGS);
  
  // Timer durations in seconds
  const [pomoDuration, setPomoDuration] = useState<number>(DEFAULT_SETTINGS.focusMinutes * 60);
  const [pomoSecondsLeft, setPomoSecondsLeft] = useState<number>(DEFAULT_SETTINGS.focusMinutes * 60);
  const [stopwatchSeconds, setStopwatchSeconds] = useState<number>(0);
  
  const [sessionCount, setSessionCount] = useState<number>(1);
  const [totalFocusSessionsCompleted, setTotalFocusSessionsCompleted] = useState<number>(0);
  
  // Association
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [currentBookTitle, setCurrentBookTitle] = useState<string | null>(null);
  const [currentLessonTitle, setCurrentLessonTitle] = useState<string | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  
  // Completion banner
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  
  // Local time clock string
  const [localTimeStr, setLocalTimeStr] = useState<string>('');

  // Drift-free timestamp references
  const targetEndTimestampRef = useRef<number | null>(null);
  const startedAtTimestampRef = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<Date>(new Date());
  const isHydratedRef = useRef<boolean>(false);

  // Update local clock every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setLocalTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Restore state from localStorage on initial mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.settings) setSettings(data.settings);
        if (data.mode) setModeState(data.mode);
        if (data.pomoState) setPomoStateInternal(data.pomoState);
        if (data.sessionCount) setSessionCount(data.sessionCount);
        if (data.totalFocusSessionsCompleted) setTotalFocusSessionsCompleted(data.totalFocusSessionsCompleted);
        if (data.currentBookId) setCurrentBookId(data.currentBookId);
        if (data.currentBookTitle) setCurrentBookTitle(data.currentBookTitle);
        if (data.currentLessonTitle) setCurrentLessonTitle(data.currentLessonTitle);
        if (data.currentVideoId) setCurrentVideoId(data.currentVideoId);

        const currentSettings = data.settings || DEFAULT_SETTINGS;
        const stateDuration = data.pomoState === 'shortBreak'
          ? currentSettings.shortBreakMinutes * 60
          : data.pomoState === 'longBreak'
          ? currentSettings.longBreakMinutes * 60
          : currentSettings.focusMinutes * 60;
        
        setPomoDuration(stateDuration);

        // Check if was running when page unloaded
        if (data.isRunning) {
          const now = Date.now();
          if (data.mode === 'pomodoro' && data.targetEndTimestamp) {
            if (data.targetEndTimestamp > now) {
              // Still running in future
              const remaining = Math.max(0, Math.ceil((data.targetEndTimestamp - now) / 1000));
              setPomoSecondsLeft(remaining);
              targetEndTimestampRef.current = data.targetEndTimestamp;
              setIsRunning(true);
            } else {
              // Expired while closed: mark session complete ONCE and wait
              setPomoSecondsLeft(0);
              setIsRunning(false);
              setCompletionMessage(
                data.pomoState === 'focus'
                  ? 'Focus session finished while you were away! Take a break.'
                  : 'Break completed while you were away. Ready for your next focus session?'
              );
            }
          } else if (data.mode === 'stopwatch' && data.startedAtTimestamp) {
            const elapsed = Math.floor((now - data.startedAtTimestamp) / 1000);
            setStopwatchSeconds(Math.max(0, elapsed));
            startedAtTimestampRef.current = data.startedAtTimestamp;
            setIsRunning(true);
          } else {
            setPomoSecondsLeft(typeof data.pomoSecondsLeft === 'number' ? data.pomoSecondsLeft : stateDuration);
            setStopwatchSeconds(data.stopwatchSeconds || 0);
            setIsRunning(false);
          }
        } else {
          setPomoSecondsLeft(typeof data.pomoSecondsLeft === 'number' ? data.pomoSecondsLeft : stateDuration);
          setStopwatchSeconds(data.stopwatchSeconds || 0);
          setIsRunning(false);
        }
      }
    } catch (e) {
      console.warn('Could not restore study session from localStorage:', e);
    } finally {
      isHydratedRef.current = true;
    }
  }, []);

  // Save snapshot to localStorage on state changes
  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      const payload = {
        mode,
        pomoState,
        isRunning,
        settings,
        pomoDuration,
        pomoSecondsLeft,
        stopwatchSeconds,
        sessionCount,
        totalFocusSessionsCompleted,
        currentBookId,
        currentBookTitle,
        currentLessonTitle,
        currentVideoId,
        targetEndTimestamp: targetEndTimestampRef.current,
        startedAtTimestamp: startedAtTimestampRef.current,
        lastSaved: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [
    mode,
    pomoState,
    isRunning,
    settings,
    pomoDuration,
    pomoSecondsLeft,
    stopwatchSeconds,
    sessionCount,
    totalFocusSessionsCompleted,
    currentBookId,
    currentBookTitle,
    currentLessonTitle,
    currentVideoId,
  ]);

  // Log completed focus or reading session to current book
  const logSessionToBook = useCallback(
    (durationMin: number, isVideo: boolean, customNotes?: string) => {
      if (!currentBookId || durationMin < 1) return;
      const targetDoc = docs.find((d) => d.id === currentBookId);
      if (!targetDoc) return;

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const notes =
        customNotes ||
        (isVideo && currentLessonTitle
          ? `Video lesson: ${currentLessonTitle}`
          : `Study session: ${targetDoc.title}`);

      const logItem: ReadingLogItem = {
        id: `study_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        startedAt: sessionStartTimeRef.current.toISOString(),
        endedAt: new Date().toISOString(),
        durationMinutes: durationMin,
        timeOfDay: timeStr,
        notes,
      };

      const existingLogs = targetDoc.readingLogs || [];
      const nextLogs = [logItem, ...existingLogs].slice(0, 50);
      const nextTotal = (targetDoc.totalReadMinutes || 0) + durationMin;

      updateDoc(currentBookId, {
        readingLogs: nextLogs,
        totalReadMinutes: nextTotal,
        lastReadAt: new Date().toISOString(),
        preferredReadingTime: timeStr,
      });
    },
    [currentBookId, currentLessonTitle, docs, updateDoc]
  );

  // Active Timer Tick Loop (drift-free timestamp math)
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const now = Date.now();

      if (mode === 'pomodoro') {
        if (!targetEndTimestampRef.current) return;
        const diffMs = targetEndTimestampRef.current - now;
        const remaining = Math.max(0, Math.ceil(diffMs / 1000));
        setPomoSecondsLeft(remaining);

        if (remaining <= 0) {
          // Pomodoro session completed!
          setIsRunning(false);
          targetEndTimestampRef.current = null;
          playTimerAlarmSound();

          if (pomoState === 'focus') {
            const focusMinutes = Math.max(1, Math.round(pomoDuration / 60));
            logSessionToBook(focusMinutes, !!currentVideoId);
            setTotalFocusSessionsCompleted((prev) => prev + 1);

            const nextSessionCount = (sessionCount % settings.sessionsBeforeLongBreak) + 1;
            setSessionCount(nextSessionCount);

            // If 4 sessions done, suggest long break
            if (sessionCount >= settings.sessionsBeforeLongBreak) {
              setPomoStateInternal('longBreak');
              const nextDur = settings.longBreakMinutes * 60;
              setPomoDuration(nextDur);
              setPomoSecondsLeft(nextDur);
              setCompletionMessage(`Session 4 complete! Great work. Time for a ${settings.longBreakMinutes}-minute Long Break.`);
            } else {
              setPomoStateInternal('shortBreak');
              const nextDur = settings.shortBreakMinutes * 60;
              setPomoDuration(nextDur);
              setPomoSecondsLeft(nextDur);
              setCompletionMessage(`Focus Session ${sessionCount} complete! Take a ${settings.shortBreakMinutes}-minute Short Break.`);
            }
          } else {
            // Break completed
            setPomoStateInternal('focus');
            const nextDur = settings.focusMinutes * 60;
            setPomoDuration(nextDur);
            setPomoSecondsLeft(nextDur);
            setCompletionMessage(`Break over! Ready to start Focus Session ${sessionCount} of ${settings.sessionsBeforeLongBreak}?`);
          }
        }
      } else {
        // Stopwatch mode
        if (!startedAtTimestampRef.current) return;
        const elapsed = Math.floor((now - startedAtTimestampRef.current) / 1000);
        setStopwatchSeconds(Math.max(0, elapsed));
      }
    }, 250);

    return () => clearInterval(interval);
  }, [
    isRunning,
    mode,
    pomoState,
    pomoDuration,
    sessionCount,
    settings,
    currentVideoId,
    logSessionToBook,
  ]);

  // Main Controls
  const start = useCallback(() => {
    stopTimerAlarm();
    sessionStartTimeRef.current = new Date();
    setCompletionMessage(null);

    if (mode === 'pomodoro') {
      const target = Date.now() + pomoSecondsLeft * 1000;
      targetEndTimestampRef.current = target;
    } else {
      startedAtTimestampRef.current = Date.now() - stopwatchSeconds * 1000;
    }
    setIsRunning(true);
  }, [mode, pomoSecondsLeft, stopwatchSeconds]);

  const pause = useCallback(() => {
    stopTimerAlarm();
    setIsRunning(false);
    targetEndTimestampRef.current = null;
    startedAtTimestampRef.current = null;
  }, []);

  const resume = useCallback(() => {
    start();
  }, [start]);

  const reset = useCallback(() => {
    stopTimerAlarm();
    setIsRunning(false);
    targetEndTimestampRef.current = null;
    startedAtTimestampRef.current = null;
    setCompletionMessage(null);

    if (mode === 'pomodoro') {
      const dur =
        pomoState === 'shortBreak'
          ? settings.shortBreakMinutes * 60
          : pomoState === 'longBreak'
          ? settings.longBreakMinutes * 60
          : settings.focusMinutes * 60;
      setPomoDuration(dur);
      setPomoSecondsLeft(dur);
    } else {
      setStopwatchSeconds(0);
    }
  }, [mode, pomoState, settings]);

  const setMode = useCallback(
    (newMode: StudyTimerMode) => {
      stopTimerAlarm();
      if (newMode === mode) return;
      setIsRunning(false);
      targetEndTimestampRef.current = null;
      startedAtTimestampRef.current = null;
      setModeState(newMode);
      setCompletionMessage(null);

      if (newMode === 'pomodoro') {
        const dur =
          pomoState === 'shortBreak'
            ? settings.shortBreakMinutes * 60
            : pomoState === 'longBreak'
            ? settings.longBreakMinutes * 60
            : settings.focusMinutes * 60;
        setPomoDuration(dur);
        setPomoSecondsLeft(dur);
      }
    },
    [mode, pomoState, settings]
  );

  const setPomoState = useCallback(
    (newState: PomodoroState) => {
      stopTimerAlarm();
      setIsRunning(false);
      targetEndTimestampRef.current = null;
      setPomoStateInternal(newState);
      setCompletionMessage(null);

      const dur =
        newState === 'shortBreak'
          ? settings.shortBreakMinutes * 60
          : newState === 'longBreak'
          ? settings.longBreakMinutes * 60
          : settings.focusMinutes * 60;
      setPomoDuration(dur);
      setPomoSecondsLeft(dur);
    },
    [settings]
  );

  const skipToNextPomo = useCallback(() => {
    stopTimerAlarm();
    setIsRunning(false);
    targetEndTimestampRef.current = null;

    if (pomoState === 'focus') {
      const nextSessionCount = (sessionCount % settings.sessionsBeforeLongBreak) + 1;
      setSessionCount(nextSessionCount);
      if (sessionCount >= settings.sessionsBeforeLongBreak) {
        setPomoState('longBreak');
      } else {
        setPomoState('shortBreak');
      }
    } else {
      setPomoState('focus');
    }
  }, [pomoState, sessionCount, settings, setPomoState]);

  const updateSettings = useCallback(
    (newSettings: Partial<StudySettings>) => {
      setSettings((prev) => {
        const merged = { ...prev, ...newSettings };
        if (!isRunning && mode === 'pomodoro') {
          const dur =
            pomoState === 'shortBreak'
              ? merged.shortBreakMinutes * 60
              : pomoState === 'longBreak'
              ? merged.longBreakMinutes * 60
              : merged.focusMinutes * 60;
          setPomoDuration(dur);
          setPomoSecondsLeft(dur);
        }
        return merged;
      });
    },
    [isRunning, mode, pomoState]
  );

  const setAssociatedBook = useCallback((bookId: string | null, bookTitle: string | null) => {
    setCurrentBookId(bookId);
    setCurrentBookTitle(bookTitle);
  }, []);

  const setAssociatedLesson = useCallback((lessonTitle: string | null, videoId: string | null) => {
    setCurrentLessonTitle(lessonTitle);
    setCurrentVideoId(videoId);
  }, []);

  const saveActiveStopwatchSession = useCallback(() => {
    if (stopwatchSeconds < 30) return;
    const mins = Math.max(1, Math.round(stopwatchSeconds / 60));
    logSessionToBook(mins, !!currentVideoId);
    reset();
  }, [stopwatchSeconds, currentVideoId, logSessionToBook, reset]);

  return (
    <StudySessionContext.Provider
      value={{
        mode,
        pomoState,
        isRunning,
        pomoSecondsLeft,
        pomoDuration,
        stopwatchSeconds,
        sessionCount,
        totalFocusSessionsCompleted,
        localTimeStr,
        currentBookId,
        currentBookTitle,
        currentLessonTitle,
        currentVideoId,
        settings,
        updateSettings,
        completionMessage,
        clearCompletionMessage: () => {
          stopTimerAlarm();
          setCompletionMessage(null);
        },
        start,
        pause,
        resume,
        reset,
        setMode,
        setPomoState,
        skipToNextPomo,
        setAssociatedBook,
        setAssociatedLesson,
        saveActiveStopwatchSession,
      }}
    >
      {children}
    </StudySessionContext.Provider>
  );
}

export function useStudySession(): StudySessionContextType {
  const context = useContext(StudySessionContext);
  if (!context) {
    throw new Error('useStudySession must be used within a StudySessionProvider');
  }
  return context;
}
