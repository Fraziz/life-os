'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Brain,
  Target,
  Calendar,
  Plus,
  Check,
  Layers,
  Leaf,
  Mountain,
  X,
  Play,
  Pause,
  Zap,
  Flame,
  Moon,
  Battery,
  BatteryMedium,
  BatteryCharging,
  Flag,
  Clock,
  CheckSquare,
  Square,
  BookOpen,
  Sparkles,
  Bell,
  Dumbbell,
  Video,
  Lightbulb,
  Folder,
} from 'lucide-react';

import { isDocVideoLesson } from '@/utils/videoLesson';
import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useInbox } from '@/context/InboxContext';
import { useHabits } from '@/context/HabitContext';
import { useKnowledge } from '@/context/KnowledgeContext';
import { useLifeAreas } from '@/context/LifeAreaContext';
import { playSuccessChime, playSubtaskTick, triggerDopamineBurst, playTimerAlarmSound, stopTimerAlarm } from '@/utils/soundAndDopamine';
import { formatTagLabel, getTagCategory } from '@/utils/tagUtils';
import RightSidebar from '@/components/layout/RightSidebar';
import LifeDomainPill from '@/components/layout/LifeDomainPill';

import ActivityHeatmap from '@/components/analytics/ActivityHeatmap';
import DailyBriefingModal from '@/components/assistant/DailyBriefingModal';
import OptimizeDayModal from '@/components/assistant/OptimizeDayModal';
import DailyAccomplishReminder from '@/components/reminders/DailyAccomplishReminder';
import styles from './page.module.css';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_WORKOUT_SCHEDULE = [
  { dayOfWeek: 0, label: 'Sunday', sessionName: 'Active Recovery', isRestDay: true },
  { dayOfWeek: 1, label: 'Monday', sessionName: 'Upper Body', isRestDay: false },
  { dayOfWeek: 2, label: 'Tuesday', sessionName: 'Lower Body', isRestDay: false },
  { dayOfWeek: 3, label: 'Wednesday', sessionName: 'Rest & Stretch', isRestDay: true },
  { dayOfWeek: 4, label: 'Thursday', sessionName: 'Push', isRestDay: false },
  { dayOfWeek: 5, label: 'Friday', sessionName: 'Pull & Core', isRestDay: false },
  { dayOfWeek: 6, label: 'Saturday', sessionName: 'Cardio & Mobility', isRestDay: true },
];

export default function TodayDashboardContent() {
  const { settings } = useSettings();
  const { tasks, toggleTaskDone, toggleTaskReminder, quickAddTask, toggleSubtask } = useTasks();
  const { activeProjects, toggleProjectReminder } = useProjects();
  const { activeGoals } = useGoals();
  const { focusedAreaId, areas } = useLifeAreas();
  const { quickDump, activeItems: brainDumpItems, activeReminders, deleteInboxItem, toggleItemApplied, toggleItemReminder } = useInbox();
  const { habits, isHabitCompletedOnDate, toggleHabitCheckIn } = useHabits();
  const { docs, addDoc, toggleDocReminder } = useKnowledge();

  const [featuredBookId, setFeaturedBookId] = useState<string | null>(null);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [newBookTitleInput, setNewBookTitleInput] = useState('');
  const [isReminderBannerDismissed, setIsReminderBannerDismissed] = useState(false);

  // Load user's selected book from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('life_os_featured_book_id');
      if (saved) setFeaturedBookId(saved);
    } catch {
      // ignore
    }

    const onBookChanged = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) setFeaturedBookId(custom.detail);
    };
    window.addEventListener('life_os_featured_book_changed', onBookChanged);
    return () => window.removeEventListener('life_os_featured_book_changed', onBookChanged);
  }, []);

  const currentReadingDoc = (featuredBookId ? docs.find((d) => d.id === featuredBookId) : null)
    || docs.find((d) => d.readStatus === 'reading')
    || docs.find((d) => (d.readProgress || 0) > 0 && (d.readProgress || 0) < 100)
    || docs.find((d) => d.isPinned)
    || docs[0];

  const handleSelectFeaturedBook = (id: string) => {
    setFeaturedBookId(id);
    try {
      localStorage.setItem('life_os_featured_book_id', id);
    } catch {
      // ignore
    }
    setBookPickerOpen(false);
  };

  const handleCreateAndSelectBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookTitleInput.trim()) return;
    const title = newBookTitleInput.trim();
    const created = addDoc({
      title,
      content: `# ${title}\n\nStart reading notes or key insights here...`,
      status: 'active',
      category: 'learning',
      readStatus: 'reading',
      readProgress: 0,
      tags: ['book', 'reading'],
    });
    setNewBookTitleInput('');
    handleSelectFeaturedBook(created.id);
  };

  const filteredPickerDocs = docs.filter((d) =>
    !bookSearchQuery.trim() || d.title.toLowerCase().includes(bookSearchQuery.toLowerCase())
  );

  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [optimizeModalOpen, setOptimizeModalOpen] = useState(false);
  const [briefingInitialMode, setBriefingInitialMode] = useState<'morning' | 'evening'>('morning');
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});

  const toggleSubtasks = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedSubtasks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenBriefing = (mode?: 'morning' | 'evening') => {
    const currentHour = new Date().getHours();
    const targetMode = mode || (currentHour < 17 ? 'morning' : 'evening');
    setBriefingInitialMode(targetMode);
    setBriefingModalOpen(true);
  };

  // ── Greeting & Date ──────────────────────────────────────────
  const [greeting, setGreeting] = useState('Good morning');
  const [dateDisplay, setDateDisplay] = useState('');
  const [todayHeaderDate, setTodayHeaderDate] = useState('');

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
    setDateDisplay(
      now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    );
    setTodayHeaderDate(
      now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
    );
  }, []);

  const userName = settings?.profile?.displayName || 'Aaron';
  const todayStr = new Date().toISOString().split('T')[0];


  // ── Energy Mode (reactive from Sidebar or localStorage) ──────
  const [energyLevel, setEnergyLevel] = useState<'low' | 'normal' | 'high'>('normal');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('life_os_energy_level');
      if (saved === 'low' || saved === 'normal' || saved === 'high') {
        setEnergyLevel(saved);
      }
    } catch {
      // ignore
    }

    const onEnergyChange = (e: Event) => {
      const custom = e as CustomEvent<'low' | 'normal' | 'high'>;
      if (custom.detail) setEnergyLevel(custom.detail);
    };
    window.addEventListener('life_os_energy_changed', onEnergyChange);
    return () => window.removeEventListener('life_os_energy_changed', onEnergyChange);
  }, []);

  const selectEnergy = (lvl: 'low' | 'normal' | 'high') => {
    setEnergyLevel(lvl);
    try {
      localStorage.setItem('life_os_energy_level', lvl);
      window.dispatchEvent(new CustomEvent('life_os_energy_changed', { detail: lvl }));
    } catch {
      // ignore
    }
  };

  const energyTips: Record<'low' | 'normal' | 'high', string> = {
    low: 'Low Energy Mode: Pick just 1 tiny task. Momentum beats perfection today.',
    normal: 'Steady Focus: Work in 25-minute Pomodoro sprints with real rest breaks.',
    high: 'High Energy: Tackle your #1 hardest priority right now while focus is sharp.',
  };

  // ── Domain Filter ───────────────────────────────────────────
  const domainTasks = useMemo(() => {
    if (!focusedAreaId) return tasks;
    const activeArea = areas.find((a) => a.id === focusedAreaId);
    const areaNameLower = activeArea ? activeArea.name.toLowerCase() : '';
    return tasks.filter((t) => {
      const parentProject = activeProjects.find((p) => p.id === t.projectId);
      const parentGoal = activeGoals.find((g) => g.id === (t.goalId || parentProject?.goalId));
      const matchesDirect = t.lifeAreaId === focusedAreaId;
      const matchesProject = parentProject?.lifeAreaId === focusedAreaId;
      const matchesGoal = parentGoal?.lifeAreaId === focusedAreaId;
      const matchesTag = Boolean(
        areaNameLower &&
          t.tags &&
          t.tags.some((tag) => {
            const tl = tag.toLowerCase();
            return tl.includes(areaNameLower) || areaNameLower.includes(tl);
          })
      );
      return matchesDirect || matchesProject || matchesGoal || matchesTag;
    });
  }, [tasks, focusedAreaId, areas, activeProjects, activeGoals]);

  const domainHabits = useMemo(() => {
    if (!focusedAreaId) return habits;
    return habits.filter((h) => h.lifeAreaId === focusedAreaId);
  }, [habits, focusedAreaId]);

  // ── Tasks ────────────────────────────────────────────────────
  const doItNowActive = domainTasks.filter((t) => t.status !== 'done' && t.tags?.includes('do-it-now'));
  const otherHighPriority = domainTasks.filter(
    (t) => t.status !== 'done' && !t.tags?.includes('do-it-now') && (t.priority === 'urgent' || t.priority === 'high')
  );

  // Guarantee that Do It Now priorities are strictly unique by id and title
  const dedupeTasks = (items: typeof domainTasks) => {
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    return items.filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      const norm = item.title.trim().toLowerCase();
      if (norm && seenTitles.has(norm)) return false;
      seenTitles.add(norm);
      return true;
    });
  };

  const uniqueDoItNow = dedupeTasks(doItNowActive);
  const uniqueOtherHigh = dedupeTasks(otherHighPriority);

  // Show all unique Do It Now tasks, plus top high-priority tasks up to at least 3
  const topPriorities = uniqueDoItNow.length > 0
    ? [...uniqueDoItNow, ...uniqueOtherHigh.slice(0, Math.max(0, 3 - uniqueDoItNow.length))]
    : uniqueOtherHigh.slice(0, 3);

  const otherTasks = domainTasks
    .filter((t) => t.status !== 'done' && !topPriorities.some((p) => p.id === t.id))
    .slice(0, 8);

  // Filter completed tasks to show ONLY tasks completed TODAY
  const completedTasks = domainTasks
    .filter((t) => {
      if (t.status !== 'done') return false;
      if (t.completedAt) return t.completedAt.split('T')[0] === todayStr;
      if (t.updatedAt) return t.updatedAt.split('T')[0] === todayStr;
      return true;
    })
    .slice(0, 8);

  const [showCompleted, setShowCompleted] = useState(true);

  // ── Unified Today's Reminders (Books, Videos, Tasks, Ideas, Projects) ──
  const todayReminders = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'task' | 'book' | 'video' | 'idea' | 'project';
      typeLabel: string;
      title: string;
      subtitle?: string;
      href: string;
      onFinish?: () => void;
      onClearReminder: () => void;
    }> = [];

    // 1. Tasks marked as reminder
    tasks
      .filter((t) => t.isReminder && t.status !== 'done')
      .forEach((t) => {
        list.push({
          id: t.id,
          type: 'task',
          typeLabel: 'TASK',
          title: t.title,
          subtitle: t.dueDate ? `Due ${t.dueDate}` : (t.priority ? `${t.priority} priority` : undefined),
          href: '/tasks',
          onFinish: () => toggleTaskDone(t.id),
          onClearReminder: () => toggleTaskReminder(t.id),
        });
      });

    // 2. Books & Videos marked as reminder
    docs
      .filter((d) => d.isReminder && d.status !== 'archived')
      .forEach((d) => {
        const isVideo = isDocVideoLesson(d);
        list.push({
          id: d.id,
          type: isVideo ? 'video' : 'book',
          typeLabel: isVideo ? 'VIDEO' : 'BOOK',
          title: d.title,
          subtitle: isVideo ? 'Video Lesson' : (d.category || 'Reading Material'),
          href: isVideo ? '/focus' : '/knowledge',
          onClearReminder: () => toggleDocReminder(d.id),
        });
      });

    // 3. Idea Parking thoughts marked as reminder
    (activeReminders || [])
      .filter((r) => !r.isApplied && r.status === 'inbox')
      .forEach((r) => {
        list.push({
          id: r.id,
          type: 'idea',
          typeLabel: 'IDEA',
          title: r.content,
          subtitle: r.reminderTime ? `Time: ${r.reminderTime}` : 'Idea Parking',
          href: '/inbox',
          onFinish: () => toggleItemApplied(r.id),
          onClearReminder: () => toggleItemReminder(r.id),
        });
      });

    // 4. Projects marked as reminder
    (activeProjects || [])
      .filter((p) => p.isReminder && p.status !== 'completed')
      .forEach((p) => {
        list.push({
          id: p.id,
          type: 'project',
          typeLabel: 'PROJECT',
          title: p.title,
          subtitle: `${p.progress}% progress • ${p.priority} priority`,
          href: '/projects',
          onClearReminder: () => toggleProjectReminder(p.id),
        });
      });

    return list;
  }, [tasks, docs, activeReminders, activeProjects, toggleTaskDone, toggleTaskReminder, toggleDocReminder, toggleItemApplied, toggleItemReminder, toggleProjectReminder]);

  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      quickAddTask(newTaskTitle.trim(), {
        priority: 'medium',
        dueDate: todayStr,
        lifeAreaId: focusedAreaId || undefined,
      });
      setNewTaskTitle('');
      setAddingTask(false);
      playSuccessChime();
    }
  };

  const handleToggleTask = (id: string, e: React.MouseEvent) => {
    toggleTaskDone(id);
    playSuccessChime();
    triggerDopamineBurst(e.clientX, e.clientY);
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSubtask(taskId, subtaskId);
    playSubtaskTick();
    triggerDopamineBurst(e.clientX, e.clientY);
  };

  // ── Habits ───────────────────────────────────────────────────
  const todayHabits = domainHabits.slice(0, 6);
  const habitsCompletedToday = todayHabits.filter((h) =>
    isHabitCompletedOnDate(h.id, todayStr)
  ).length;

  const handleToggleHabit = (habitId: string, e: React.MouseEvent) => {
    toggleHabitCheckIn(habitId, todayStr);
    playSuccessChime();
    triggerDopamineBurst(e.clientX, e.clientY);
  };

  // ── Workout State & Logic ─────────────────────────────────────
  const [workoutSessions, setWorkoutSessions] = useState<{
    id: string;
    date: string;
    name: string;
    completed: boolean;
    completedAt?: string;
  }[]>([]);
  const [workoutSchedule, setWorkoutSchedule] = useState(DEFAULT_WORKOUT_SCHEDULE);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('life-os-workouts-v1');
      if (raw) setWorkoutSessions(JSON.parse(raw));
      const rawSched = localStorage.getItem('life-os-workout-schedule-v1');
      if (rawSched) setWorkoutSchedule(JSON.parse(rawSched));
    } catch {
      // ignore
    }
  }, []);

  const todayDow = new Date().getDay();
  const todaySched = workoutSchedule[todayDow] || DEFAULT_WORKOUT_SCHEDULE[todayDow];
  const todayWorkoutSession = workoutSessions.find((s) => s.date === todayStr);
  const isWorkoutDone = Boolean(todayWorkoutSession?.completed);
  const todayWorkoutName = todayWorkoutSession?.name || todaySched?.sessionName || (todaySched?.isRestDay ? 'Rest & Recovery' : 'Daily Workout');

  const handleToggleTodayWorkout = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let updated: typeof workoutSessions;
      if (todayWorkoutSession) {
        const nextCompleted = !todayWorkoutSession.completed;
        updated = workoutSessions.map((s) =>
          s.id === todayWorkoutSession.id
            ? { ...s, completed: nextCompleted, completedAt: nextCompleted ? new Date().toISOString() : undefined }
            : s
        );
        if (nextCompleted) {
          playSuccessChime();
          triggerDopamineBurst(e.clientX, e.clientY);
        }
      } else {
        const newSession = {
          id: Math.random().toString(36).slice(2) + Date.now().toString(36),
          name: todayWorkoutName,
          date: todayStr,
          dayOfWeek: todayDow,
          completed: true,
          completedAt: new Date().toISOString(),
        };
        updated = [newSession, ...workoutSessions];
        playSuccessChime();
        triggerDopamineBurst(e.clientX, e.clientY);
      }
      setWorkoutSessions(updated);
      localStorage.setItem('life-os-workouts-v1', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // ── Brain Dump (Single Unified Source of Truth) ───────────────
  const [dumpText, setDumpText] = useState('');
  const [dumpIsReminder, setDumpIsReminder] = useState(false);
  const [addingDump, setAddingDump] = useState(false);
  const dumpInputRef = useRef<HTMLInputElement>(null);

  const handleDump = (e: React.FormEvent) => {
    e.preventDefault();
    if (dumpText.trim()) {
      quickDump(dumpText.trim(), { isReminder: dumpIsReminder });
      setDumpText('');
      setAddingDump(false);
      setDumpIsReminder(false);
      playSuccessChime();
    }
  };

  const focusDump = () => {
    setAddingDump(true);
    setTimeout(() => {
      dumpInputRef.current?.focus();
      dumpInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  // ── Pomodoro Timer ───────────────────────────────────────────
  const [timerSecs, setTimerSecs] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    let iv: NodeJS.Timeout | null = null;
    if (timerRunning) {
      iv = setInterval(() => {
        setTimerSecs((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            playTimerAlarmSound();
            return 25 * 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (iv) clearInterval(iv);
    };
  }, [timerRunning]);

  const fmtTimer = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Wrap Up Day Celebration Modal ─────────────────────────────
  const [wrapUpOpen, setWrapUpOpen] = useState(false);

  const handleOpenWrapUp = (e: React.MouseEvent) => {
    setWrapUpOpen(true);
    playSuccessChime();
    triggerDopamineBurst(e.clientX, e.clientY);
  };

  // ── Helpers ──────────────────────────────────────────────────
  const getTagStyle = (tags: string[] = []) => {
    const category = getTagCategory(tags[0] || '');
    switch (category) {
      case 'project':
        return styles.tagProject;
      case 'goal':
        return styles.tagGoal;
      case 'dream':
        return styles.tagDream;
      case 'school':
        return styles.tagSchool;
      case 'health':
        return styles.tagHealth;
      case 'ai':
        return styles.tagAi;
      case 'doitnow':
        return styles.tagDoitnow;
      default:
        return styles.tagDefault;
    }
  };

  const getProjectIcon = (title: string) => {
    if (/gain/i.test(title)) return <Leaf size={15} />;
    if (/link|dare/i.test(title)) return <Layers size={15} />;
    return <Target size={15} />;
  };

  const tasksDone = tasks.filter((t) => t.status === 'done').length;
  const habitColor = (color?: string) => color || '#6366f1';
  const getActionTitleFontSize = (text: string) => {
    if (text.length > 28) return '0.70rem';
    if (text.length > 18) return '0.76rem';
    if (text.length > 12) return '0.82rem';
    return '0.88rem';
  };

  const readingTitle = currentReadingDoc?.title || 'Knowledge Book';

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.mainColumn}>

        {/* Hero Banner */}
        <div className={styles.heroBanner}>
          <div className={styles.heroOverlay}>
            <div className={styles.heroLeft}>
              <h1 className={styles.heroGreeting}>{greeting}, {userName}!</h1>
              <p className={styles.heroSubtitle}>Same you. But a little closer to your goals.</p>
              {dateDisplay && (
                <div className={styles.heroDateBadge}>
                  <Calendar size={13} />
                  <span>{dateDisplay}</span>
                </div>
              )}
            </div>
            <div className={styles.heroQuoteCard}>
              <div className={styles.heroQuoteText}>&ldquo;Discipline today, freedom tomorrow.&rdquo;</div>
              <div className={styles.heroQuoteAuthor}>— Action Principle —</div>
            </div>
          </div>
        </div>

        {/* ── Daily Accomplishment Action Reminder ── */}
        <DailyAccomplishReminder />

        {/* Daily Snapshot */}
        <div className={styles.dailySummaryRow}>
          <div className={styles.summaryPill}>
            <Check size={13} className={styles.pillIconGreen} />
            <span><strong>{tasksDone}</strong> / {tasks.length} tasks done</span>
          </div>
          <div className={styles.summaryPill}>
            <Flame size={13} className={styles.pillIconOrange} />
            <span><strong>{habitsCompletedToday}</strong> / {todayHabits.length} habits</span>
          </div>
          <button
            type="button"
            className={`${styles.summaryPill} ${styles.summaryPillOptimize}`}
            onClick={() => setOptimizeModalOpen(true)}
            title="1-Click AI Auto Time-Blocker: Optimize hourly day schedule"
          >
            <span>Optimize Day</span>
          </button>
          <button
            type="button"
            className={`${styles.summaryPill} ${styles.summaryPillBriefing}`}
            onClick={() => handleOpenBriefing()}
            title="Open Executive Morning Briefing / Evening Reflection"
          >
            <span>AI Briefing</span>
          </button>
          <Link href="/focus" className={`${styles.summaryPill} ${styles.summaryPillFocus}`}>
            <span>Focus Space</span>
          </Link>
          <LifeDomainPill />
        </div>



        {/* Quick Actions */}
        <div className={styles.quickActionsGrid}>
          <button type="button" className={styles.actionCard} onClick={() => setAddingTask(true)}>
            <div className={`${styles.actionIconWrap} ${styles.iconWrapCheck}`}>
              <Plus size={19} strokeWidth={2.2} />
            </div>
            <div className={styles.actionCardTitle}>Add Task</div>
            <div className={styles.actionCardSub}>Quick add</div>
          </button>

          <button type="button" className={styles.actionCard} onClick={focusDump}>
            <div className={`${styles.actionIconWrap} ${styles.iconWrapBrain}`}>
              <Brain size={19} strokeWidth={2.2} />
            </div>
            <div className={styles.actionCardTitle}>Idea Parking</div>
            <div className={styles.actionCardSub}>Quick capture</div>
          </button>

          <button
            type="button"
            className={styles.actionCard}
            onClick={() => window.dispatchEvent(new CustomEvent('open-next-action'))}
          >
            <div className={`${styles.actionIconWrap} ${styles.iconWrapSun}`}>
              <Zap size={19} strokeWidth={2.2} />
            </div>
            <div className={styles.actionCardTitle}>What to do?</div>
            <div className={styles.actionCardSub}>AI picks next</div>
          </button>

          <div className={styles.actionCard} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
              <Link
                href={currentReadingDoc ? `/knowledge?docId=${currentReadingDoc.id}` : '/knowledge'}
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                title={currentReadingDoc ? `Open book: ${currentReadingDoc.title}` : 'Open Study & Books'}
              >
                <div className={`${styles.actionIconWrap} ${styles.iconWrapTarget}`} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', marginBottom: 0 }}>
                  <BookOpen size={19} strokeWidth={2.2} />
                </div>
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setBookPickerOpen(true);
                }}
                className={styles.changeBookBtn}
                title="Choose which book to put here"
              >
                Change
              </button>
            </div>

            <Link
              href={currentReadingDoc ? `/knowledge?docId=${currentReadingDoc.id}` : '/knowledge'}
              style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, justifyContent: 'center' }}
              title={currentReadingDoc ? `Open book: ${currentReadingDoc.title}` : 'Open Study & Books'}
            >
              <div
                className={styles.actionCardTitle}
                style={{
                  fontSize: getActionTitleFontSize(readingTitle),
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  lineHeight: 1.25,
                }}
              >
                {readingTitle}
              </div>
              <div className={styles.actionCardSub}>
                {currentReadingDoc?.readProgress != null && currentReadingDoc.readProgress > 0
                  ? `${currentReadingDoc.readProgress}% completed`
                  : 'Study & Books'}
              </div>
            </Link>
          </div>
        </div>

        {/* Today's Tasks */}
        <section className={styles.contentSectionCard}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHeaderLeft}>
              <h2 className={styles.sectionHeading}>Today</h2>
              {todayHeaderDate && (
                <span className={styles.sectionHeaderDate}>{todayHeaderDate}</span>
              )}

              {/* Combined Today's Energy Switcher */}
              <div className={styles.headerEnergyCluster}>
                <div className={styles.headerEnergyPills}>
                  <button
                    type="button"
                    className={`${styles.headerEnergyBtn} ${energyLevel === 'low' ? styles.headerEnergyBtnActive : ''}`}
                    onClick={() => selectEnergy('low')}
                    title="Low Energy: Pick just 1 tiny task. Momentum beats perfection today."
                  >
                    <Battery size={13} />
                    <span>Low</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.headerEnergyBtn} ${energyLevel === 'normal' ? styles.headerEnergyBtnActive : ''}`}
                    onClick={() => selectEnergy('normal')}
                    title="Steady Focus: Work in 25-minute Pomodoro sprints with real rest breaks."
                  >
                    <BatteryMedium size={13} />
                    <span>Steady</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.headerEnergyBtn} ${energyLevel === 'high' ? styles.headerEnergyBtnActive : ''}`}
                    onClick={() => selectEnergy('high')}
                    title="High Energy: Tackle your #1 hardest priority right now while focus is sharp."
                  >
                    <BatteryCharging size={13} />
                    <span>High</span>
                  </button>
                </div>
              </div>
            </div>

            <Link href="/tasks" className={styles.viewAllNotesLink}>All tasks →</Link>
          </div>

          {/* Contextual Energy Tip */}
          <div className={styles.todayEnergyTipBanner}>
            <Zap size={14} className={styles.todayEnergyZapIcon} />
            <span>{energyTips[energyLevel]}</span>
          </div>

          {/* Today's Active Reminders (Important to Finish) */}
          {todayReminders.length > 0 && (
            <div className={styles.todayRemindersCard}>
              <div className={styles.todayRemindersHeader}>
                <div className={styles.todayRemindersHeaderLeft}>
                  <span className={styles.todayRemindersDot} />
                  <Bell size={13} className={styles.todayRemindersBell} />
                  <h3 className={styles.todayRemindersTitle}>Today&apos;s Reminders</h3>
                  <span className={styles.todayRemindersCountBadge}>{todayReminders.length}</span>
                </div>
                <span className={styles.todayRemindersSub}>Important to finish</span>
              </div>

              <div className={styles.todayRemindersList}>
                {todayReminders.map((rem) => (
                  <div key={`${rem.type}-${rem.id}`} className={styles.todayReminderRow}>
                    {rem.onFinish ? (
                      <button
                        type="button"
                        className={styles.reminderCheckBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          rem.onFinish?.();
                          playSuccessChime();
                          triggerDopamineBurst();
                        }}
                        title="Mark as done / finish"
                        aria-label="Complete reminder"
                      >
                        <Check size={12} />
                      </button>
                    ) : (
                      <span className={styles.reminderDotMarker} />
                    )}

                    <span className={`${styles.reminderTypeBadge} ${styles[`typeBadge_${rem.type}`] || ''}`}>
                      {rem.type === 'book' && <BookOpen size={10} />}
                      {rem.type === 'video' && <Video size={10} />}
                      {rem.type === 'task' && <CheckSquare size={10} />}
                      {rem.type === 'idea' && <Lightbulb size={10} />}
                      {rem.type === 'project' && <Folder size={10} />}
                      <span>{rem.typeLabel}</span>
                    </span>

                    <Link href={rem.href} className={styles.reminderItemLink} title="Open item">
                      <span className={styles.reminderItemTitle}>{rem.title}</span>
                      {rem.subtitle && <span className={styles.reminderItemSub}>• {rem.subtitle}</span>}
                    </Link>

                    <button
                      type="button"
                      className={styles.reminderDismissBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        rem.onClearReminder();
                      }}
                      title="Remove reminder (unpin from Today)"
                      aria-label="Remove reminder"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Priorities */}
          <div className={styles.subSectionWrap}>
            <h3 className={styles.subSectionTitle}>
              {topPriorities.length > 3 ? `Top ${topPriorities.length} Priorities` : 'Top 3 Priorities'}
            </h3>
            <div className={styles.prioritiesList}>
              {topPriorities.length === 0 && (
                <div className={styles.emptyState}>
                  No high-priority tasks.{' '}
                  <button type="button" className={styles.emptyStateLink}
                    onClick={() => setAddingTask(true)}>Add one</button>
                </div>
              )}
              {topPriorities.map((item, idx) => {
                const isDoItNow = item.tags?.includes('do-it-now');

                return (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div
                      className={`${styles.priorityRow} ${item.status === 'done' ? styles.taskDoneRow : ''}`}
                      style={isDoItNow ? {
                        background: 'rgba(212, 163, 115, 0.07)',
                        border: '1px solid rgba(212, 163, 115, 0.28)',
                      } : undefined}
                    >
                      <div className={styles.priorityLeft}>
                        <span
                          className={styles.priorityNumBadge}
                          style={isDoItNow ? {
                            backgroundColor: '#d4a373',
                            color: '#ffffff',
                            fontWeight: 700,
                          } : undefined}
                        >
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          className={styles.checkboxBtn}
                          onClick={(e) => handleToggleTask(item.id, e)}
                        >
                          {item.status === 'done' ? (
                            <div className={styles.checkedBox}><Check size={12} strokeWidth={3} /></div>
                          ) : (
                            <div className={styles.emptyBox} style={isDoItNow ? { borderColor: '#d4a373' } : undefined} />
                          )}
                        </button>
                        <span className={styles.taskTitleText}>{item.title}</span>
                        {item.subtasks && item.subtasks.length > 0 && (
                          <button
                            type="button"
                            className={styles.subtaskBadgeBtn}
                            onClick={(e) => toggleSubtasks(item.id, e)}
                            title="Toggle subtask checklist"
                          >
                            <span>{item.subtasks.filter((s) => s.completed).length}/{item.subtasks.length} steps</span>
                            <span style={{ fontSize: '9px' }}>{expandedSubtasks[item.id] ? '▲' : '▼'}</span>
                          </button>
                        )}
                      </div>

                      {/* Right-aligned Tag Badge — consistent with Project Action */}
                      {isDoItNow ? (
                        <span className={`${styles.tagBadge} ${styles.tagDoitnow}`}>
                          <span className={styles.tagDot} />
                          Do It Now
                        </span>
                      ) : item.tags && item.tags.length > 0 ? (
                        <span className={`${styles.tagBadge} ${getTagStyle(item.tags)}`}>
                          <span className={styles.tagDot} />
                          {formatTagLabel(item.tags[0])}
                        </span>
                      ) : null}
                    </div>

                    {/* Subtask Step Breakdown (Collapsible) */}
                    {item.subtasks && item.subtasks.length > 0 && expandedSubtasks[item.id] && (
                      <div style={{ marginLeft: '36px', display: 'flex', flexDirection: 'column', gap: '3px', borderLeft: '2px solid var(--color-border-subtle)', paddingLeft: '10px', marginBottom: '6px' }}>
                        {item.subtasks.map((sub) => (
                          <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: sub.completed ? 'var(--color-text-faint)' : 'var(--color-text-muted)' }}>
                            <button
                              type="button"
                              onClick={(e) => handleToggleSubtask(item.id, sub.id, e)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: sub.completed ? 'var(--color-success)' : 'var(--color-text-faint)', display: 'inline-flex', alignItems: 'center' }}
                              title={sub.completed ? 'Mark uncompleted' : 'Mark done'}
                            >
                              {sub.completed ? <CheckSquare size={13} /> : <Square size={13} />}
                            </button>
                            <span style={{ textDecoration: sub.completed ? 'line-through' : 'none' }}>{sub.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Other Tasks */}
          <div className={styles.otherTasksWrap}>
            <div className={styles.otherTasksHeader}>
              <h3 className={styles.subSectionTitle}>Other Tasks</h3>
              <span className={styles.sectionHeaderDate}>
                {tasks.filter((t) => t.status !== 'done').length} pending
              </span>
            </div>
            <div className={styles.otherTasksList}>
              {otherTasks.map((task) => {
                const isDoItNow = task.tags?.includes('do-it-now');
                return (
                  <div key={task.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div
                      className={`${styles.otherTaskRow} ${task.status === 'done' ? styles.taskDoneRow : ''}`}
                      style={isDoItNow ? {
                        background: 'rgba(212, 163, 115, 0.05)',
                        border: '1px solid rgba(212, 163, 115, 0.22)',
                      } : undefined}
                    >
                      <button
                        type="button"
                        className={styles.checkboxBtn}
                        onClick={(e) => handleToggleTask(task.id, e)}
                      >
                        {task.status === 'done' ? (
                          <div className={styles.checkedCircle}><Check size={11} strokeWidth={3} /></div>
                        ) : (
                          <div className={styles.emptyCircle} style={isDoItNow ? { borderColor: '#d4a373' } : undefined} />
                        )}
                      </button>
                      <span className={styles.otherTaskTitle}>{task.title}</span>
                      {task.subtasks && task.subtasks.length > 0 && (
                        <button
                          type="button"
                          className={styles.subtaskBadgeBtn}
                          onClick={(e) => toggleSubtasks(task.id, e)}
                          title="Toggle subtask checklist"
                        >
                          <span>{task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} steps</span>
                          <span style={{ fontSize: '9px' }}>{expandedSubtasks[task.id] ? '▲' : '▼'}</span>
                        </button>
                      )}
                      {isDoItNow ? (
                        <span className={`${styles.tagBadge} ${styles.tagDoitnow}`} style={{ marginLeft: 'auto' }}>
                          <span className={styles.tagDot} />
                          Do It Now
                        </span>
                      ) : task.tags && task.tags.length > 0 ? (
                        <span className={`${styles.tagBadge} ${getTagStyle(task.tags)}`} style={{ marginLeft: 'auto' }}>
                          <span className={styles.tagDot} />
                          {formatTagLabel(task.tags[0])}
                        </span>
                      ) : null}
                    </div>

                  {/* Subtask Step Breakdown for Other Tasks (Collapsible) */}
                  {task.subtasks && task.subtasks.length > 0 && expandedSubtasks[task.id] && (
                    <div style={{ marginLeft: '28px', display: 'flex', flexDirection: 'column', gap: '3px', borderLeft: '2px solid var(--color-border-subtle)', paddingLeft: '10px', marginBottom: '4px' }}>
                      {task.subtasks.map((sub) => (
                        <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: sub.completed ? 'var(--color-text-faint)' : 'var(--color-text-muted)' }}>
                          <button
                            type="button"
                            onClick={(e) => handleToggleSubtask(task.id, sub.id, e)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: sub.completed ? 'var(--color-success)' : 'var(--color-text-faint)', display: 'inline-flex', alignItems: 'center' }}
                            title={sub.completed ? 'Mark uncompleted' : 'Mark done'}
                          >
                            {sub.completed ? <CheckSquare size={13} /> : <Square size={13} />}
                          </button>
                          <span style={{ textDecoration: sub.completed ? 'line-through' : 'none' }}>{sub.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
              {addingTask ? (
                <form onSubmit={handleCreateTask} className={styles.addTaskForm}>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateTask(e);
                      }
                    }}
                    placeholder="Task name..."
                    className={styles.addTaskInput}
                    autoFocus
                  />
                  <div className={styles.addTaskBtnGroup}>
                    <button type="submit" className={styles.addTaskSubmitBtn}>Add</button>
                    <button
                      type="button"
                      className={styles.addTaskCancelBtn}
                      onClick={() => setAddingTask(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className={styles.addTaskTrigger}
                  onClick={() => setAddingTask(true)}
                >
                  <Plus size={14} /><span>Add task</span>
                </button>
              )}
            </div>
          </div>

          {/* Completed Today (Visual proof of accomplishments) */}
          {completedTasks.length > 0 && (
            <div className={styles.completedTasksWrap}>
              <div
                className={styles.completedTasksHeader}
                onClick={() => setShowCompleted(!showCompleted)}
                role="button"
                tabIndex={0}
              >
                <span className={styles.completedTasksTitle}>
                  Completed Today ({completedTasks.length})
                </span>
                <span className={styles.completedBadge}>
                  {showCompleted ? 'Hide' : 'Show'}
                </span>
              </div>

              {showCompleted && (
                <div className={styles.completedTasksList}>
                  {completedTasks.map((t) => (
                    <div key={t.id} className={styles.completedTaskRow}>
                      <button
                        type="button"
                        className={styles.checkboxBtn}
                        onClick={(e) => handleToggleTask(t.id, e)}
                        title="Mark pending"
                      >
                        <div className={styles.checkedCircle}><Check size={11} strokeWidth={3} /></div>
                      </button>
                      <span className={styles.completedTaskTitle}>{t.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Habits & Workout */}
        <section className={styles.contentSectionCard}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHeaderLeft}>
              <h2 className={styles.sectionHeading}>Habits &amp; Workout</h2>
              <span className={styles.sectionHeaderDate}>
                {habitsCompletedToday}/{todayHabits.length} habits done
              </span>
              {isWorkoutDone ? (
                <span className={styles.workoutStatusDoneBadge}>
                  <Check size={10} strokeWidth={3} /> Workout done
                </span>
              ) : todaySched?.isRestDay ? (
                <span className={styles.workoutStatusRestBadge}>Rest day</span>
              ) : (
                <span className={styles.workoutStatusSchedBadge}>{todayWorkoutName}</span>
              )}
            </div>
            <div className={styles.sectionHeaderLinks}>
              <Link href="/habits" className={styles.viewAllNotesLink}>All habits →</Link>
              <span className={styles.linkDivider}>•</span>
              <Link href="/workout" className={styles.viewAllNotesLink}>Workout tracker →</Link>
            </div>
          </div>

          {/* Today's Workout Banner Row */}
          <div className={`${styles.workoutBannerRow} ${isWorkoutDone ? styles.workoutBannerDone : ''}`}>
            <div className={styles.workoutBannerLeft}>
              <button
                type="button"
                className={styles.checkboxBtn}
                onClick={handleToggleTodayWorkout}
                title={isWorkoutDone ? 'Mark workout pending' : 'Mark workout completed'}
              >
                {isWorkoutDone ? (
                  <div className={styles.checkedCircle}><Check size={11} strokeWidth={3} /></div>
                ) : (
                  <div className={styles.emptyCircle} />
                )}
              </button>
              <Dumbbell size={16} className={styles.workoutIcon} />
              <div className={styles.workoutBannerText}>
                <span className={styles.workoutBannerTitle}>{todayWorkoutName}</span>
                <span className={styles.workoutBannerMeta}>
                  {isWorkoutDone
                    ? 'Completed for today ✓'
                    : todaySched?.isRestDay
                    ? `${DAYS_OF_WEEK[todayDow]} • Scheduled recovery day`
                    : `${DAYS_OF_WEEK[todayDow]} routine • 45 min`}
                </span>
              </div>
            </div>
            <Link href="/workout" className={styles.workoutActionBtn}>
              {isWorkoutDone ? 'View workout' : 'Start workout'} →
            </Link>
          </div>

          {/* Daily Habits Quick Check Grid */}
          <div className={styles.habitsGrid}>
            {todayHabits.length === 0 && (
              <div className={styles.emptyState}>
                No habits yet.{' '}
                <Link href="/habits" className={styles.viewAllNotesLink}>Add habits →</Link>
              </div>
            )}
            {todayHabits.map((habit) => {
              const done = isHabitCompletedOnDate(habit.id, todayStr);
              return (
                <button
                  key={habit.id}
                  type="button"
                  className={`${styles.habitChip} ${done ? styles.habitChipDone : ''}`}
                  onClick={(e) => handleToggleHabit(habit.id, e)}
                  style={{ '--habit-color': habitColor(habit.color) } as React.CSSProperties}
                >
                  <span className={`${styles.habitDot} ${done ? styles.habitDotDone : ''}`}>
                    {done && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className={styles.habitChipLabel}>{habit.title}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Consistency & Execution Heatmap */}
        <ActivityHeatmap weeksToShow={24} />

        {/* Projects & Goals */}
        <section className={styles.contentSectionCard}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHeaderLeft}>
              <Target size={17} className={styles.targetHeaderIcon} />
              <h2 className={styles.sectionHeading}>Projects &amp; Goals</h2>
            </div>
            <Link href="/projects" className={styles.viewAllNotesLink}>View all →</Link>
          </div>

          <div className={styles.projectGoalsGrid}>
            {activeProjects.slice(0, 2).map((project) => (
              <div key={project.id} className={styles.projectCard}>
                <div className={styles.projectCardHeader}>
                  <div className={styles.projectCardIconWrap}>{getProjectIcon(project.title)}</div>
                  <span className={styles.projectCardTitle}>{project.title}</span>
                </div>
                <div className={styles.progressBarBg}>
                  <div
                    className={project.progress >= 100 ? styles.progressBarFillDark : styles.progressBarFillGreen}
                    style={{ width: `${Math.min(100, project.progress ?? 0)}%` }}
                  />
                </div>
                {project.notes && (
                  <div className={styles.projectNextLabel}>{project.notes.split('\n')[0]}</div>
                )}
                <div className={styles.projectMetaRow}>
                  <span>{project.progress ?? 0}% complete</span>
                </div>
              </div>
            ))}

            {activeGoals.length > 0 && (
              <div className={styles.projectCard}>
                <div className={styles.projectCardHeader}>
                  <div className={styles.projectCardIconWrap}><Mountain size={15} /></div>
                  <span className={styles.projectCardTitle}>Goals</span>
                </div>
                <div className={styles.personalGoalsList}>
                  {activeGoals.slice(0, 4).map((g) => (
                    <div key={g.id} className={styles.personalGoalRow}>
                      <div className={styles.emptyCircleSmall} />
                      <span className={styles.personalGoalText}>{g.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Brain Dump — Unified Quick Capture */}
        <section className={styles.contentSectionCard}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHeaderLeft}>
              <Brain size={17} style={{ color: '#8b5cf6' }} />
              <h2 className={styles.sectionHeading}>Idea Parking</h2>
              <span className={styles.sectionHeaderDate}>
                {brainDumpItems.length} thoughts
              </span>
            </div>
            <Link href="/inbox" className={styles.viewAllNotesLink}>Open inbox →</Link>
          </div>

          <div className={styles.notesList}>
            {brainDumpItems.slice(0, 5).map((item) => (
              <div key={item.id} className={styles.noteItemRow}>
                <span className={styles.noteBullet}>•</span>
                <span className={styles.noteText} style={{ flex: 1 }}>
                  {item.content}
                  {item.reminderTime && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                      ({item.reminderTime})
                    </span>
                  )}
                </span>
                {item.isReminder && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      background: 'rgba(99, 102, 241, 0.12)',
                      color: 'var(--color-accent-light, #818cf8)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      marginRight: '6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Reminder
                  </span>
                )}
                <button
                  type="button"
                  className={styles.noteDeleteBtn}
                  onClick={() => deleteInboxItem(item.id)}
                  aria-label="Delete thought"
                >
                  <X size={13} />
                </button>
              </div>
            ))}

            {addingDump ? (
              <form onSubmit={handleDump} className={styles.addTaskForm} style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setDumpIsReminder(false)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: !dumpIsReminder ? 600 : 400,
                      background: !dumpIsReminder ? 'var(--color-surface-2)' : 'transparent',
                      color: !dumpIsReminder ? 'var(--color-text)' : 'var(--color-text-muted)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                    }}
                  >
                    Thought
                  </button>
                  <button
                    type="button"
                    onClick={() => setDumpIsReminder(true)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: dumpIsReminder ? 600 : 400,
                      background: dumpIsReminder ? 'var(--color-accent)' : 'transparent',
                      color: dumpIsReminder ? '#ffffff' : 'var(--color-text-muted)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                    }}
                  >
                    Reminder
                  </button>
                </div>
                <input
                  ref={dumpInputRef}
                  type="text"
                  value={dumpText}
                  onChange={(e) => setDumpText(e.target.value)}
                  placeholder={dumpIsReminder ? "Set a reminder (moves right to left on Today screen)..." : "Dump a thought, idea, or worry..."}
                  className={styles.addTaskInput}
                  autoFocus
                />
                <div className={styles.addTaskBtnGroup}>
                  <button type="submit" className={styles.addTaskSubmitBtn}>
                    {dumpIsReminder ? 'Add Reminder' : 'Capture'}
                  </button>
                  <button
                    type="button"
                    className={styles.addTaskCancelBtn}
                    onClick={() => {
                      setAddingDump(false);
                      setDumpIsReminder(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className={styles.addTaskTrigger}
                onClick={() => {
                  setAddingDump(true);
                  setTimeout(() => dumpInputRef.current?.focus(), 50);
                }}
                style={{ marginTop: 4 }}
              >
                <Plus size={13} /><span>Dump thought</span>
              </button>
            )}
          </div>
        </section>

        {/* Wrap Up Day Button */}
        <div className={styles.wrapUpContainer}>
          <button type="button" className={styles.wrapUpDayBtn} onClick={handleOpenWrapUp}>
            <Moon size={15} />
            <span>Wrap Up Day</span>
          </button>
        </div>

        <footer className={styles.bottomMottoFooter}>
          <span>Focus</span><span className={styles.mottoDot}>·</span>
          <span>Build</span><span className={styles.mottoDot}>·</span>
          <span>Grow</span><span className={styles.mottoDot}>·</span>
          <span>Freedom</span>
        </footer>
      </div>

      <RightSidebar />

      {/* Evening Shutdown & Wrap Up Day Modal */}
      {wrapUpOpen && (
        <div className={styles.modalBackdrop} onClick={() => setWrapUpOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Great Job Today, {userName}!</h2>
            <p className={styles.modalSubtitle}>
              You showed up and took action today. Take a deep breath and acknowledge your wins.
            </p>

            <div className={styles.modalStatsGrid}>
              <div className={styles.modalStatCard}>
                <span className={styles.modalStatNumber}>{tasksDone}</span>
                <span className={styles.modalStatLabel}>Tasks Completed</span>
              </div>
              <div className={styles.modalStatCard}>
                <span className={styles.modalStatNumber}>{habitsCompletedToday}</span>
                <span className={styles.modalStatLabel}>Habits Kept</span>
              </div>
            </div>

            <div className={styles.modalReflection}>
              <strong>Evening Anchor:</strong> You don&apos;t have to finish everything to deserve rest. Give your brain full permission to turn off now so you can recharge.
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                type="button"
                className={styles.modalPrimaryBtn}
                style={{ flex: 1, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                onClick={() => {
                  setWrapUpOpen(false);
                  handleOpenBriefing('evening');
                }}
              >
                <Sparkles size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                AI Evening Reflection
              </button>
              <button
                type="button"
                className={styles.modalPrimaryBtn}
                style={{ flex: 1 }}
                onClick={() => setWrapUpOpen(false)}
              >
                Complete Shutdown
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Daily Briefing & Reflection Modal */}
      <DailyBriefingModal
        isOpen={briefingModalOpen}
        onClose={() => setBriefingModalOpen(false)}
        initialMode={briefingInitialMode}
      />

      {/* 1-Click AI Auto Time-Blocker Modal */}
      <OptimizeDayModal
        isOpen={optimizeModalOpen}
        onClose={() => setOptimizeModalOpen(false)}
      />

      {/* Featured Dashboard Book Picker Modal */}
      {bookPickerOpen && (
        <div className={styles.modalBackdrop} onClick={() => setBookPickerOpen(false)}>
          <div className={styles.bookPickerModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.bookPickerHeader}>
              <div>
                <h3 className={styles.bookPickerTitle}>Choose Dashboard Book</h3>
                <p className={styles.bookPickerDesc}>
                  Select which book appears on your Today dashboard. Clicking it opens the book immediately.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setBookPickerOpen(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search your library..."
              value={bookSearchQuery}
              onChange={(e) => setBookSearchQuery(e.target.value)}
              className={styles.bookSearchInput}
              autoFocus
            />

            <div className={styles.bookListScroll}>
              {filteredPickerDocs.length > 0 ? (
                filteredPickerDocs.map((doc) => {
                  const isSelected = currentReadingDoc?.id === doc.id;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      className={`${styles.bookListItem} ${isSelected ? styles.bookListItemActive : ''}`}
                      onClick={() => handleSelectFeaturedBook(doc.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, textAlign: 'left' }}>
                        <BookOpen size={16} style={{ color: isSelected ? '#38bdf8' : 'var(--color-text-muted)', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div className={styles.bookItemTitle}>{doc.title}</div>
                          <div className={styles.bookItemMeta}>
                            {doc.readProgress != null && doc.readProgress > 0 ? `${doc.readProgress}% read · ` : ''}
                            {doc.category || 'document'}
                          </div>
                        </div>
                      </div>
                      <span className={styles.bookSelectBadge}>
                        {isSelected ? '✓ Active' : 'Select'}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                  No matching books found.
                </div>
              )}
            </div>

            <div className={styles.bookCreateDivider}>
              <span>Or add a new book to read</span>
            </div>

            <form onSubmit={handleCreateAndSelectBook} className={styles.bookCreateForm}>
              <input
                type="text"
                placeholder="Enter new book title (e.g. Atomic Habits)..."
                value={newBookTitleInput}
                onChange={(e) => setNewBookTitleInput(e.target.value)}
                className={styles.bookCreateInput}
              />
              <button type="submit" className={styles.bookCreateBtn}>
                + Set &amp; Open
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
