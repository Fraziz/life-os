'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Sun,
  Moon,
  X,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Zap,
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useHabits } from '@/context/HabitContext';
import { generateDailyBriefing } from '@/utils/aiEngine';
import styles from './DailyBriefingModal.module.css';

interface DailyBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'morning' | 'evening';
}

export default function DailyBriefingModal({
  isOpen,
  onClose,
  initialMode = 'morning',
}: DailyBriefingModalProps) {
  const { settings } = useSettings();
  const { tasks } = useTasks();
  const { activeGoals } = useGoals();
  const { activeProjects } = useProjects();
  const { habits, isHabitCompletedOnDate } = useHabits();

  const [mode, setMode] = useState<'morning' | 'evening'>(initialMode);
  const [briefingCache, setBriefingCache] = useState<{ morning?: string; evening?: string }>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const todayCompletedTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status !== 'done') return false;
      if (!t.completedAt) return true;
      return t.completedAt.startsWith(todayStr);
    });
  }, [tasks, todayStr]);

  const todayHabitCount = useMemo(() => {
    return habits.filter((h) => isHabitCompletedOnDate(h.id, todayStr)).length;
  }, [habits, isHabitCompletedOnDate, todayStr]);

  const userName = settings?.profile?.displayName || 'Aaron';

  const briefingText = briefingCache[mode] || '';

  const loadBriefing = useCallback(
    async (briefingMode: 'morning' | 'evening', force = false) => {
      if (!force && briefingCache[briefingMode]) {
        return;
      }

      setIsLoading(true);
      try {
        const text = await generateDailyBriefing(
          briefingMode,
          {
            userName,
            tasks,
            goals: activeGoals,
            projects: activeProjects,
            habits,
            todayCompletedTasks,
            todayHabitCount,
          },
          settings?.aiSettings
        );
        setBriefingCache((prev) => ({
          ...prev,
          [briefingMode]: text,
        }));
      } catch (err) {
        console.warn('Briefing generator degraded to offline mode:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [briefingCache, userName, tasks, activeGoals, activeProjects, habits, todayCompletedTasks, todayHabitCount, settings?.aiSettings]
  );

  // Initialize on open
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setMode(initialMode);
      loadBriefing(initialMode);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, initialMode, loadBriefing]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!briefingText) return;
    navigator.clipboard.writeText(briefingText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleModeChange = (newMode: 'morning' | 'evening') => {
    setMode(newMode);
    loadBriefing(newMode);
  };

  // Basic markdown-friendly renderer
  const renderFormattedContent = (content: string) => {
    if (!content) return null;
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('## ')) {
        return <h2 key={idx}>{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx}>{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('> ')) {
        return <blockquote key={idx}>{line.replace('> ', '')}</blockquote>;
      }
      if (line.startsWith('---')) {
        return <hr key={idx} />;
      }
      if (line.trim() === '') {
        return <div key={idx} style={{ height: '0.5rem' }} />;
      }

      // Format bold text **text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <div key={idx} style={{ marginBottom: line.startsWith('•') || line.startsWith('-') ? '0.35rem' : '0.2rem' }}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
            }
            return <span key={pIdx}>{part}</span>;
          })}
        </div>
      );
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleGroup}>
            <div className={`${styles.headerIcon} ${mode === 'evening' ? styles.evening : ''}`}>
              {mode === 'morning' ? <Sun size={20} /> : <Moon size={20} />}
            </div>
            <div>
              <h3 className={styles.title}>
                {mode === 'morning' ? 'Executive Morning Briefing' : 'Evening Debrief & Reflection'}
              </h3>
              <p className={styles.subtitle}>
                {settings?.aiSettings?.enabled ? 'Powered by AI Assistant' : 'Deterministic Rule Engine (Offline Ready)'}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className={styles.modeTabs}>
          <button
            className={`${styles.tab} ${mode === 'morning' ? styles.activeMorning : ''}`}
            onClick={() => handleModeChange('morning')}
          >
            <Sun size={15} />
            Morning Briefing
          </button>
          <button
            className={`${styles.tab} ${mode === 'evening' ? styles.activeEvening : ''}`}
            onClick={() => handleModeChange('evening')}
          >
            <Moon size={15} />
            Evening Reflection
          </button>
        </div>

        {/* Body Content */}
        <div className={styles.body}>
          {isLoading && !briefingText ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner} />
              <p>Analyzing live roadmap, habits & priorities...</p>
            </div>
          ) : (
            <div className={styles.contentCard}>
              {renderFormattedContent(briefingText)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            className={styles.btnSecondary}
            onClick={() => loadBriefing(mode, true)}
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? styles.spin : ''} />
            {isLoading ? 'Generating...' : 'Regenerate'}
          </button>

          <div className={styles.actions}>
            <button className={styles.btnSecondary} onClick={handleCopy} disabled={!briefingText}>
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy Briefing'}
            </button>
            <button className={styles.btnPrimary} onClick={onClose}>
              <Check size={14} />
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
