'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Sun,
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
  Flag,
  Clock,
  CheckSquare,
  Square,
  BookOpen,
  Sparkles,
} from 'lucide-react';

import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useInbox } from '@/context/InboxContext';
import { useHabits } from '@/context/HabitContext';
import { useCalendar } from '@/context/CalendarContext';
import { useKnowledge } from '@/context/KnowledgeContext';
import { playSuccessChime, playSubtaskTick, triggerDopamineBurst } from '@/utils/soundAndDopamine';
import RightSidebar from '@/components/layout/RightSidebar';
import StarterPresetsModal from '@/components/onboarding/StarterPresetsModal';
import ActivityHeatmap from '@/components/analytics/ActivityHeatmap';
import DailyBriefingModal from '@/components/assistant/DailyBriefingModal';
import OptimizeDayModal from '@/components/assistant/OptimizeDayModal';
import styles from './page.module.css';

export default function TodayDashboardContent() {
  const { settings } = useSettings();
  const { tasks, toggleTaskDone, quickAddTask, toggleSubtask } = useTasks();
  const { activeProjects } = useProjects();
  const { activeGoals } = useGoals();
  const { quickDump, activeItems: brainDumpItems, activeReminders, deleteInboxItem, toggleItemApplied } = useInbox();
  const { habits, isHabitCompletedOnDate, toggleHabitCheckIn } = useHabits();
  const { getDeadlinesForDate, getEventsForDate, getScheduledBlocksForDate } = useCalendar();
  const { docs } = useKnowledge();

  const currentReadingDoc = docs.find((d) => d.readStatus === 'reading')
    || docs.find((d) => (d.readProgress || 0) > 0 && (d.readProgress || 0) < 100)
    || docs.find((d) => d.isPinned)
    || docs[0];

  const [presetsModalOpen, setPresetsModalOpen] = useState(false);
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

  const todayDeadlines = getDeadlinesForDate(todayStr);
  const todayEvents = getEventsForDate(todayStr);
  const todayBlocks = getScheduledBlocksForDate(todayStr);
  const totalTodayCalendarMarks = todayDeadlines.length + todayEvents.length + todayBlocks.length;

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

  // ── Tasks ────────────────────────────────────────────────────
  const top3 = tasks
    .filter((t) => t.status !== 'done' && (t.priority === 'urgent' || t.priority === 'high'))
    .slice(0, 3);

  const otherTasks = tasks
    .filter((t) => t.status !== 'done' && !top3.some((p) => p.id === t.id))
    .slice(0, 6);

  // Filter completed tasks to show ONLY tasks completed TODAY
  const completedTasks = tasks
    .filter((t) => {
      if (t.status !== 'done') return false;
      if (t.completedAt) return t.completedAt.split('T')[0] === todayStr;
      if (t.updatedAt) return t.updatedAt.split('T')[0] === todayStr;
      return true;
    })
    .slice(0, 8);

  const [showCompleted, setShowCompleted] = useState(true);

  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      quickAddTask(newTaskTitle.trim(), { priority: 'medium', dueDate: todayStr });
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
  const todayHabits = habits.slice(0, 6);
  const habitsCompletedToday = todayHabits.filter((h) =>
    isHabitCompletedOnDate(h.id, todayStr)
  ).length;

  const handleToggleHabit = (habitId: string, e: React.MouseEvent) => {
    toggleHabitCheckIn(habitId, todayStr);
    playSuccessChime();
    triggerDopamineBurst(e.clientX, e.clientY);
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
            playSuccessChime();
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
    const tag = tags[0] || '';
    if (/school|class|bsit/i.test(tag)) return styles.tagSchool;
    if (/health|workout|fitness/i.test(tag)) return styles.tagHealth;
    return styles.tagStudy;
  };

  const getProjectIcon = (title: string) => {
    if (/gain/i.test(title)) return <Leaf size={15} />;
    if (/link|dare/i.test(title)) return <Layers size={15} />;
    return <Target size={15} />;
  };

  const tasksDone = tasks.filter((t) => t.status === 'done').length;
  const habitColor = (color?: string) => color || '#6366f1';


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
              <div className={styles.heroQuoteAuthor}>— —</div>
            </div>
          </div>
        </div>

        {/* ── Today Moving Reminders Ticker (Right to Left Marquee) ── */}
        {activeReminders.length > 0 && (
          <div className={styles.reminderTickerContainer}>
            <div className={styles.reminderTickerHeader}>
              <span className={styles.tickerLabel}>Reminders</span>
              <span className={styles.tickerBadgeCount}>{activeReminders.length}</span>
            </div>

            <div className={styles.reminderTickerTrackMask}>
              <div
                className={styles.reminderTickerTrack}
                style={{
                  animationDuration: `${Math.max(28, activeReminders.length * 12)}s`,
                }}
              >
                {/* Repeat list to guarantee a seamless, smooth infinite right-to-left loop */}
                {[...activeReminders, ...activeReminders, ...activeReminders, ...activeReminders].map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className={styles.tickerPill}>
                    <span className={styles.tickerPillText} title={item.content}>
                      {item.content}
                    </span>
                    {item.reminderTime && (
                      <span className={styles.tickerPillTime}>{item.reminderTime}</span>
                    )}
                    <button
                      type="button"
                      className={styles.tickerDismissBtn}
                      onClick={() => {
                        toggleItemApplied(item.id);
                        playSuccessChime();
                      }}
                      title="Mark reminder as done"
                    >
                      Done
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Link href="/inbox?tab=reminders" className={styles.tickerManageLink} title="Manage all Brain Dump reminders">
              Inbox
            </Link>
          </div>
        )}

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
            className={styles.summaryPill}
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(56, 189, 248, 0.14))',
              borderColor: 'rgba(99, 102, 241, 0.35)',
              cursor: 'pointer',
              color: 'var(--color-text)',
            }}
            onClick={() => setOptimizeModalOpen(true)}
            title="1-Click AI Auto Time-Blocker: Optimize hourly day schedule"
          >
            <Clock size={13} style={{ color: 'var(--color-accent)' }} />
            <span><strong>Optimize Day</strong></span>
          </button>
          <button
            type="button"
            className={styles.summaryPill}
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(139, 92, 246, 0.16))',
              borderColor: 'rgba(245, 158, 11, 0.35)',
              cursor: 'pointer',
              color: 'var(--color-text)',
            }}
            onClick={() => handleOpenBriefing()}
            title="Open Executive Morning Briefing / Evening Reflection"
          >
            <Sparkles size={13} style={{ color: '#f59e0b' }} />
            <span><strong>AI Briefing</strong></span>
          </button>
          <Link href="/focus" className={`${styles.summaryPill} ${styles.summaryPillFocus}`}>
            <span>Focus Space</span>
          </Link>
        </div>



        {/* Today's Schedule & Deadlines */}
        {totalTodayCalendarMarks > 0 && (
          <div className={styles.scheduleSectionCard}>
            <div className={styles.sectionHeaderRow}>
              <div className={styles.sectionHeaderLeft}>
                <Calendar size={17} style={{ color: '#0ea5e9' }} />
                <h2 className={styles.sectionHeading}>Today&apos;s Schedule</h2>
                <span className={styles.calendarMarksCountBadge}>
                  {totalTodayCalendarMarks} mark{totalTodayCalendarMarks !== 1 ? 's' : ''}
                </span>
              </div>
              <Link href="/calendar" className={styles.viewAllNotesLink}>Full calendar →</Link>
            </div>

            <div className={styles.scheduleItemsGrid}>
              {todayDeadlines.map((dl) => (
                <div key={dl.id} className={`${styles.scheduleCardItem} ${styles.scheduleCardDeadline}`}>
                  <div className={styles.scheduleItemIconWrap}>
                    <Flag size={14} style={{ color: '#ef4444' }} />
                  </div>
                  <div className={styles.scheduleItemBody}>
                    <div className={styles.scheduleItemTitleRow}>
                      <span className={styles.scheduleItemTitle}>{dl.title}</span>
                      <span className={styles.scheduleTypeBadge} style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
                        deadline
                      </span>
                    </div>
                    <div className={styles.scheduleItemMeta}>
                      {dl.sourceType} {dl.priority ? `· ${dl.priority} priority` : ''}
                    </div>
                  </div>
                </div>
              ))}

              {todayEvents.map((evt) => (
                <div key={evt.id} className={`${styles.scheduleCardItem} ${styles.scheduleCardEvent}`}>
                  <div className={styles.scheduleItemIconWrap}>
                    <Calendar size={14} style={{ color: '#0ea5e9' }} />
                  </div>
                  <div className={styles.scheduleItemBody}>
                    <div className={styles.scheduleItemTitleRow}>
                      <span className={styles.scheduleItemTitle}>{evt.title}</span>
                      <span className={styles.scheduleTypeBadge} style={{ borderColor: 'rgba(14,165,233,0.3)', color: '#0ea5e9' }}>
                        event
                      </span>
                    </div>
                    <div className={styles.scheduleItemMeta}>
                      {evt.startTime}{evt.endTime ? ` – ${evt.endTime}` : ''}
                      {evt.notes ? ` · ${evt.notes}` : ''}
                    </div>
                  </div>
                </div>
              ))}

              {todayBlocks.map((blk) => (
                <div key={blk.id} className={`${styles.scheduleCardItem} ${styles.scheduleCardBlock}`}>
                  <div className={styles.scheduleItemIconWrap}>
                    <Clock size={14} style={{ color: '#a855f7' }} />
                  </div>
                  <div className={styles.scheduleItemBody}>
                    <div className={styles.scheduleItemTitleRow}>
                      <span className={styles.scheduleItemTitle}>{blk.taskTitle}</span>
                      <span className={styles.scheduleTypeBadge} style={{ borderColor: 'rgba(168,85,247,0.3)', color: '#a855f7' }}>
                        focus
                      </span>
                    </div>
                    <div className={styles.scheduleItemMeta}>
                      {blk.startTime} · {blk.durationMinutes}m
                      {blk.notes ? ` · ${blk.notes}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
            <div className={styles.actionCardTitle}>Brain Dump</div>
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

          <button
            type="button"
            className={styles.actionCard}
            onClick={() => setTimerRunning((r) => !r)}
          >
            <div className={`${styles.actionIconWrap} ${styles.iconWrapTarget}`}>
              {timerRunning ? <Pause size={19} strokeWidth={2.2} /> : <Play size={19} strokeWidth={2.2} />}
            </div>
            <div className={styles.actionCardTitle}>{fmtTimer(timerSecs)}</div>
            <div className={styles.actionCardSub}>{timerRunning ? 'Running…' : 'Pomodoro'}</div>
          </button>
        </div>

        {/* Today's Tasks */}
        <section className={styles.contentSectionCard}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHeaderLeft}>
              <Sun size={17} className={styles.sunHeaderIcon} />
              <h2 className={styles.sectionHeading}>Today</h2>
              {todayHeaderDate && (
                <span className={styles.sectionHeaderDate}>{todayHeaderDate}</span>
              )}
            </div>
            <Link href="/tasks" className={styles.viewAllNotesLink}>All tasks →</Link>
          </div>

          {/* Top 3 Priorities */}
          <div className={styles.subSectionWrap}>
            <h3 className={styles.subSectionTitle}>Top 3 Priorities</h3>
            <div className={styles.prioritiesList}>
              {top3.length === 0 && (
                <div className={styles.emptyState}>
                  No high-priority tasks.{' '}
                  <button type="button" className={styles.emptyStateLink}
                    onClick={() => setAddingTask(true)}>Add one</button>
                </div>
              )}
              {top3.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div
                    className={`${styles.priorityRow} ${idx === 0 ? styles.priorityOneRow : ''} ${item.status === 'done' ? styles.taskDoneRow : ''}`}
                  >
                    <div className={styles.priorityLeft}>
                      <span className={styles.priorityNumBadge}>{idx + 1}</span>
                      <button
                        type="button"
                        className={styles.checkboxBtn}
                        onClick={(e) => handleToggleTask(item.id, e)}
                      >
                        {item.status === 'done' ? (
                          <div className={styles.checkedBox}><Check size={12} strokeWidth={3} /></div>
                        ) : (
                          <div className={styles.emptyBox} />
                        )}
                      </button>
                      <span className={styles.taskTitleText}>{item.title}</span>
                      {idx === 0 && (
                        <span className={styles.priorityOneBadge}>#1 The One Thing</span>
                      )}
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
                    {item.tags && item.tags.length > 0 && (
                      <span className={`${styles.tagBadge} ${getTagStyle(item.tags)}`}>
                        {item.tags[0]}
                      </span>
                    )}
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
              ))}
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
              {otherTasks.map((task) => (
                <div key={task.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div
                    className={`${styles.otherTaskRow} ${task.status === 'done' ? styles.taskDoneRow : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.checkboxBtn}
                      onClick={(e) => handleToggleTask(task.id, e)}
                    >
                      {task.status === 'done' ? (
                        <div className={styles.checkedCircle}><Check size={11} strokeWidth={3} /></div>
                      ) : (
                        <div className={styles.emptyCircle} />
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
              ))}
              {addingTask ? (
                <form onSubmit={handleCreateTask} className={styles.addTaskForm}>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
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
                  <Check size={14} strokeWidth={2.5} />
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

        {/* Habits */}
        <section className={styles.contentSectionCard}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHeaderLeft}>
              <h2 className={styles.sectionHeading}>Habits</h2>
              <span className={styles.sectionHeaderDate}>
                {habitsCompletedToday}/{todayHabits.length} done
              </span>
            </div>
            <Link href="/habits" className={styles.viewAllNotesLink}>All habits →</Link>
          </div>

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
              <h2 className={styles.sectionHeading}>Brain Dump</h2>
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

      {/* Starter Presets Modal */}
      <StarterPresetsModal isOpen={presetsModalOpen} onClose={() => setPresetsModalOpen(false)} />

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
    </div>
  );
}
