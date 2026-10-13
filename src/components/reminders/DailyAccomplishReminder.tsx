'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useTasks } from '@/context/TaskContext';
import { useLifeAreas } from '@/context/LifeAreaContext';
import { playSuccessChime } from '@/utils/soundAndDopamine';
import styles from './DailyAccomplishReminder.module.css';

export default function DailyAccomplishReminder() {
  const { quickAddTask } = useTasks();
  const { focusedAreaId } = useLifeAreas();

  const [inputVal, setInputVal] = useState('');
  const [priority, setPriority] = useState<'urgent' | 'high'>('high');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Load minimized preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('life_os_daily_reminder_minimized');
      if (saved === 'true') setIsMinimized(true);
    } catch {
      // ignore
    }
  }, []);

  const toggleMinimized = () => {
    const next = !isMinimized;
    setIsMinimized(next);
    try {
      localStorage.setItem('life_os_daily_reminder_minimized', String(next));
    } catch {
      // ignore
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = inputVal.trim();
    if (!title) return;

    quickAddTask(title, {
      priority,
      dueDate: todayStr,
      lifeAreaId: focusedAreaId || undefined,
      tags: ['do-it-now'],
    });

    setInputVal('');
    setFeedbackMsg(`Priority logged for execution today.`);
    playSuccessChime();

    setTimeout(() => {
      setFeedbackMsg(null);
    }, 2800);
  };

  // Minimized state: formal, serene single row with quiet indicator
  if (isMinimized) {
    return (
      <div className={styles.reminderCardMinimized} aria-label="Do It Now (Minimized)">
        <div className={styles.minimizedContent} onClick={toggleMinimized} style={{ cursor: 'pointer' }}>
          <div className={styles.badgeGroup}>
            <span className={styles.statusDot} />
            <span className={styles.doItNowBadge}>DO IT NOW</span>
          </div>
          <span className={styles.minimizedText}>
            Write down what you need to accomplish today. Accomplish it now, not tomorrow.
          </span>
        </div>
        <button
          type="button"
          onClick={toggleMinimized}
          className={styles.iconBtn}
          aria-label="Expand Do It Now card"
          title="Expand Do It Now card"
        >
          <ChevronDown size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.reminderCard} aria-label="Do It Now Action Directive">
      {/* Top Header Row */}
      <div className={styles.topRow}>
        <div className={styles.badgeGroup}>
          <span className={styles.statusDot} />
          <span className={styles.doItNowBadge}>DO IT NOW</span>
          <span className={styles.directiveSub}>Daily Focus</span>
        </div>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={toggleMinimized}
          aria-label="Minimize Do It Now card"
          title="Minimize Do It Now card"
        >
          <ChevronUp size={14} />
        </button>
      </div>

      {/* Main Motto & Subtitle */}
      <div className={styles.messageContent}>
        <h2 className={styles.mainHeading}>
          Write down what you need to accomplish today. Accomplish it now, not tomorrow.
        </h2>
        <p className={styles.subText}>
          Define your priority for today, write it down, and execute immediately.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className={styles.formRow}>
        <div className={styles.inputGroup}>
          <input
            ref={inputRef}
            type="text"
            className={styles.textInput}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="What will you accomplish today?"
            autoComplete="off"
          />

          <button
            type="button"
            className={`${styles.priorityToggleBtn} ${
              priority === 'urgent' ? styles.priorityToggleBtnActive : ''
            }`}
            onClick={() => setPriority((p) => (p === 'high' ? 'urgent' : 'high'))}
            title="Toggle priority level"
          >
            {priority === 'urgent' ? 'Critical' : 'High Priority'}
          </button>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!inputVal.trim()}
          >
            Do It Now
          </button>
        </div>

        {feedbackMsg && (
          <div className={styles.feedbackToast} role="status">
            <Check size={12} strokeWidth={2.5} />
            <span>{feedbackMsg}</span>
          </div>
        )}
      </form>
    </div>
  );
}
