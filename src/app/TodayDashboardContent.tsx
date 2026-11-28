'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  X,
  Play,
  Moon,
  Battery,
  BatteryMedium,
  BatteryCharging,
  Clock,
  CheckSquare,
  Square,
  BookOpen,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RotateCcw,
  Plus,
} from 'lucide-react';

import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useInbox } from '@/context/InboxContext';
import { useKnowledge } from '@/context/KnowledgeContext';
import { useLifeAreas } from '@/context/LifeAreaContext';
import { useFocus } from '@/context/FocusContext';
import {
  playSuccessChime,
  playSubtaskTick,
  triggerDopamineBurst,
} from '@/utils/soundAndDopamine';
import { useDailyRoutineReminder } from '@/utils/dailyRoutineReminder';
import { formatTagLabel } from '@/utils/tagUtils';
import RightSidebar from '@/components/layout/RightSidebar';
import LifeDomainPill from '@/components/layout/LifeDomainPill';

import DailyBriefingModal from '@/components/assistant/DailyBriefingModal';
import OptimizeDayModal from '@/components/assistant/OptimizeDayModal';
import { resolveTaskHierarchy } from '@/utils/hierarchyResolver';
import styles from './page.module.css';

export default function TodayDashboardContent() {
  const router = useRouter();
  const { settings } = useSettings();
  const { tasks, toggleTaskDone, toggleTaskReminder, quickAddTask, toggleSubtask } = useTasks();
  const { activeProjects, projects, toggleProjectReminder } = useProjects();
  const { goals } = useGoals();
  const { focusedAreaId, areas } = useLifeAreas();
  const {
    quickDump,
    activeReminders,
    toggleItemApplied,
    toggleItemReminder,
  } = useInbox();
  const { selectFocusTask, startTimer } = useFocus();
  const dailyRoutine = useDailyRoutineReminder();
  const { docs, addDoc } = useKnowledge();

  // ── Featured Book Picker State ────────────────────────────────
  const [featuredBookId, setFeaturedBookId] = useState<string | null>(null);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [newBookTitleInput, setNewBookTitleInput] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('life_os_featured_book_id');
      if (saved) setFeaturedBookId(saved);
    } catch {}

    const onBookChanged = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) setFeaturedBookId(custom.detail);
    };
    window.addEventListener('life_os_featured_book_changed', onBookChanged);
    return () => window.removeEventListener('life_os_featured_book_changed', onBookChanged);
  }, []);

  const currentReadingDoc =
    (featuredBookId ? docs.find((d) => d.id === featuredBookId) : null) ||
    docs.find((d) => d.readStatus === 'reading') ||
    docs.find((d) => (d.readProgress || 0) > 0 && (d.readProgress || 0) < 100) ||
    docs.find((d) => d.isPinned) ||
    docs.find((d) => !d.id.startsWith('doc-sariling-mundo') && !d.id.startsWith('doc-life-os')) ||
    docs[0];

  const handleSelectFeaturedBook = (id: string) => {
    setFeaturedBookId(id);
    try {
      localStorage.setItem('life_os_featured_book_id', id);
    } catch {}
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

  const filteredPickerDocs = [...docs]
    .filter(
      (d) =>
        !bookSearchQuery.trim() ||
        d.title.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
        (Array.isArray(d.tags) &&
          d.tags.some((t) => t.toLowerCase().includes(bookSearchQuery.toLowerCase())))
    )
    .sort((a, b) => {
      if (a.id === featuredBookId) return -1;
      if (b.id === featuredBookId) return 1;
      const aReading = a.readStatus === 'reading' || (a.readProgress || 0) > 0;
      const bReading = b.readStatus === 'reading' || (b.readProgress || 0) > 0;
      if (aReading && !bReading) return -1;
      if (!aReading && bReading) return 1;
      const aIsCustom = !a.id.startsWith('doc-sariling-mundo') && !a.id.startsWith('doc-life-os');
      const bIsCustom = !b.id.startsWith('doc-sariling-mundo') && !b.id.startsWith('doc-life-os');
      if (aIsCustom && !bIsCustom) return -1;
      if (!aIsCustom && bIsCustom) return 1;
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

  // ── Modals & Progressive Disclosure State ─────────────────────
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [optimizeModalOpen, setOptimizeModalOpen] = useState(false);
  const [briefingInitialMode, setBriefingInitialMode] = useState<'morning' | 'evening'>('morning');
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [assistMenuOpen, setAssistMenuOpen] = useState(false);
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
  const assistMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!assistMenuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (assistMenuRef.current && !assistMenuRef.current.contains(e.target as Node)) {
        setAssistMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAssistMenuOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEsc);
    };
  }, [assistMenuOpen]);

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

  // ── Greeting & Date ───────────────────────────────────────────
  const [greeting, setGreeting] = useState('Good morning');
  const [todayHeaderDate, setTodayHeaderDate] = useState('');

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
    setTodayHeaderDate(
      now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    );
  }, []);

  const userName = settings?.profile?.displayName || 'there';
  const todayStr = new Date().toISOString().split('T')[0];

  // ── Functional ADHD Energy Regulator ──────────────────────────
  const [energyLevel, setEnergyLevel] = useState<'low' | 'normal' | 'high'>('normal');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('life_os_energy_level');
      if (saved === 'low' || saved === 'normal' || saved === 'high') {
        setEnergyLevel(saved);
      }
    } catch {}

    const onEnergyChange = (e: Event) => {
      const custom = e as CustomEvent<'low' | 'normal' | 'high'>;
      if (custom.detail) setEnergyLevel(custom.detail);
    };
    window.addEventListener('life_os_energy_changed', onEnergyChange);
    return () => window.removeEventListener('life_os_energy_changed', onEnergyChange);
  }, []);

  const selectEnergy = (lvl: 'low' | 'normal' | 'high') => {
    setEnergyLevel(lvl);
    if (lvl === 'low') {
      setQueueExpanded(false);
    }
    try {
      localStorage.setItem('life_os_energy_level', lvl);
      window.dispatchEvent(new CustomEvent('life_os_energy_changed', { detail: lvl }));
    } catch {}
  };

  // ── Domain-Scoped Tasks & Energy-Aware Ordering ───────────────
  const domainTasks = useMemo(() => {
    if (!focusedAreaId) return tasks;
    const activeArea = areas.find((a) => a.id === focusedAreaId);
    const areaNameLower = activeArea ? activeArea.name.toLowerCase() : '';
    return tasks.filter((t) => {
      const { parentProject, parentGoal } = resolveTaskHierarchy(t, projects, goals);
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
  }, [tasks, focusedAreaId, areas, projects, goals]);

  const activeDomainTasks = useMemo(() => {
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const pending = domainTasks.filter((item) => {
      if (item.status === 'done') return false;
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      const norm = item.title.trim().toLowerCase();
      if (norm && seenTitles.has(norm)) return false;
      if (norm) seenTitles.add(norm);
      return true;
    });

    const priorityRank: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

    return [...pending].sort((a, b) => {
      const aDoNow = a.tags?.includes('do-it-now') ? 1 : 0;
      const bDoNow = b.tags?.includes('do-it-now') ? 1 : 0;
      if (aDoNow !== bDoNow) return bDoNow - aDoNow;

      if (energyLevel === 'low') {
        // Low energy: surface shorter / lower-friction wins first so initiation feels effortless
        const aDur = a.estimatedDuration || 25;
        const bDur = b.estimatedDuration || 25;
        if (aDur !== bDur) return aDur - bDur;
      }

      const aDoing = a.status === 'doing' ? 1 : 0;
      const bDoing = b.status === 'doing' ? 1 : 0;
      if (aDoing !== bDoing) return bDoing - aDoing;

      const aPrio = priorityRank[a.priority || 'medium'] || 2;
      const bPrio = priorityRank[b.priority || 'medium'] || 2;
      if (aPrio !== bPrio) return bPrio - aPrio;

      return 0;
    });
  }, [domainTasks, energyLevel]);

  const primaryTask = activeDomainTasks[0] || null;
  const nextUpTasks = energyLevel === 'low' ? [] : activeDomainTasks.slice(1, 3);
  const remainingTasks =
    energyLevel === 'low' ? activeDomainTasks.slice(1) : activeDomainTasks.slice(3);

  const overdueCount = useMemo(
    () => tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr).length,
    [tasks, todayStr]
  );

  const completedTodayTasks = useMemo(
    () =>
      domainTasks
        .filter((t) => {
          if (t.status !== 'done') return false;
          if (t.completedAt) return t.completedAt.split('T')[0] === todayStr;
          if (t.updatedAt) return t.updatedAt.split('T')[0] === todayStr;
          return true;
        })
        .slice(0, 10),
    [domainTasks, todayStr]
  );

  // ── Pinned Reminders Strip ────────────────────────────────────
  const todayReminders = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'routine' | 'task' | 'idea' | 'project';
      typeLabel: string;
      title: string;
      subtitle?: string;
      href: string;
      onFinish?: () => void;
      onClearReminder: () => void;
    }> = [];

    tasks
      .filter((t) => t.isReminder && t.status !== 'done')
      .forEach((t) => {
        list.push({
          id: t.id,
          type: 'task',
          typeLabel: 'Task',
          title: t.title,
          subtitle: t.dueDate ? `Due ${t.dueDate}` : undefined,
          href: '/tasks',
          onFinish: () => toggleTaskDone(t.id),
          onClearReminder: () => toggleTaskReminder(t.id),
        });
      });

    (activeReminders || [])
      .filter((r) => !r.isApplied && r.status === 'inbox')
      .forEach((r) => {
        list.push({
          id: r.id,
          type: 'idea',
          typeLabel: 'Idea',
          title: r.content,
          subtitle: r.reminderTime ? `${r.reminderTime}` : undefined,
          href: '/inbox',
          onFinish: () => toggleItemApplied(r.id),
          onClearReminder: () => toggleItemReminder(r.id),
        });
      });

    (activeProjects || [])
      .filter((p) => p.isReminder && p.status !== 'completed')
      .forEach((p) => {
        list.push({
          id: p.id,
          type: 'project',
          typeLabel: 'Project',
          title: p.title,
          subtitle: `${p.progress}%`,
          href: '/projects',
          onClearReminder: () => toggleProjectReminder(p.id),
        });
      });

    return list;
  }, [
    tasks,
    activeReminders,
    activeProjects,
    toggleTaskDone,
    toggleTaskReminder,
    toggleItemApplied,
    toggleItemReminder,
    toggleProjectReminder,
  ]);

  // ── Unified Calm Capture (1 Input instead of 5) ───────────────
  const [captureMode, setCaptureMode] = useState<'task' | 'idea'>('task');
  const [captureText, setCaptureText] = useState('');
  const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);
  const [emptyFocusInput, setEmptyFocusInput] = useState('');

  const showQuickFeedback = (msg: string) => {
    setCaptureFeedback(msg);
    setTimeout(() => setCaptureFeedback(null), 2600);
  };

  const handleUnifiedCapture = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = captureText.trim();
    if (!clean) return;

    if (captureMode === 'task') {
      quickAddTask(clean, {
        priority: 'high',
        dueDate: todayStr,
        lifeAreaId: focusedAreaId || undefined,
      });
      showQuickFeedback('Added to Today');
    } else {
      quickDump(clean, { isReminder: false });
      showQuickFeedback('Safely parked in Idea Parking — stay on your focus');
    }

    setCaptureText('');
    playSuccessChime();
  };

  const handleSetMainWin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = emptyFocusInput.trim();
    if (!clean) return;
    quickAddTask(clean, {
      priority: 'high',
      dueDate: todayStr,
      lifeAreaId: focusedAreaId || undefined,
      tags: ['do-it-now'],
    });
    setEmptyFocusInput('');
    playSuccessChime();
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

  const handleStartFocusOnTask = (task: (typeof tasks)[number]) => {
    selectFocusTask(task);
    startTimer();
    router.push('/focus');
  };

  const getTaskRowContext = (task: (typeof tasks)[number]) => {
    const hier = resolveTaskHierarchy(task, projects, goals);
    const shortContext =
      hier.parentProject?.title ||
      hier.parentGoal?.title ||
      (task.tags && task.tags.length > 0 && task.tags[0] !== 'do-it-now'
        ? formatTagLabel(task.tags[0])
        : '');
    return { shortContext };
  };

  const tasksDoneTotal = tasks.filter((t) => t.status === 'done').length;
  const readingTitle = currentReadingDoc?.title || 'Books & Notes';
  const nextMicroStep = primaryTask?.subtasks?.find((s) => !s.completed) || null;

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.mainColumn}>
        {/* ── 1. Calm Executive Top Header ── */}
        <header className={styles.cockpitHeader}>
          <div className={styles.cockpitTitleBlock}>
            <h1 className={styles.cockpitGreeting}>
              {greeting}, {userName}
            </h1>
            {todayHeaderDate && <p className={styles.cockpitDateSub}>{todayHeaderDate}</p>}
          </div>

          <div className={styles.cockpitControlsRow}>
            {/* Functional Energy Regulator */}
            <div className={styles.headerEnergyPills} role="group" aria-label="Energy level">
              <button
                type="button"
                className={`${styles.headerEnergyBtn} ${
                  energyLevel === 'low' ? styles.headerEnergyBtnActive : ''
                }`}
                onClick={() => selectEnergy('low')}
                title="Low Energy: Hides extra lists and shows only 1 manageable step"
              >
                <Battery size={13} />
                <span>Low</span>
              </button>
              <button
                type="button"
                className={`${styles.headerEnergyBtn} ${
                  energyLevel === 'normal' ? styles.headerEnergyBtnActive : ''
                }`}
                onClick={() => selectEnergy('normal')}
                title="Steady Focus: Shows #1 focus + up to 2 next priorities"
              >
                <BatteryMedium size={13} />
                <span>Steady</span>
              </button>
              <button
                type="button"
                className={`${styles.headerEnergyBtn} ${
                  energyLevel === 'high' ? styles.headerEnergyBtnActive : ''
                }`}
                onClick={() => selectEnergy('high')}
                title="High Energy: Tackle your hardest priority first"
              >
                <BatteryCharging size={13} />
                <span>High</span>
              </button>
            </div>

            <LifeDomainPill />

            {/* Progressive Disclosure Assist Menu (replaces 6 scattered top buttons) */}
            <div className={styles.assistMenuWrap} ref={assistMenuRef}>
              <button
                type="button"
                className={styles.assistMenuBtn}
                onClick={() => setAssistMenuOpen((v) => !v)}
                aria-expanded={assistMenuOpen}
                aria-haspopup="menu"
              >
                <SlidersHorizontal size={14} />
                <span>Tools</span>
                {overdueCount > 0 && <span className={styles.assistDot} />}
              </button>

              {assistMenuOpen && (
                <div className={styles.assistDropdown} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.assistDropdownItem}
                    onClick={() => {
                      setAssistMenuOpen(false);
                      window.dispatchEvent(new CustomEvent('open-next-action'));
                    }}
                  >
                    <span>Pick Next Action For Me</span>
                    <span className={styles.assistHint}>Ctrl+J</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.assistDropdownItem}
                    onClick={() => {
                      setAssistMenuOpen(false);
                      setOptimizeModalOpen(true);
                    }}
                  >
                    <span>Auto-Optimize Schedule</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.assistDropdownItem}
                    onClick={() => {
                      setAssistMenuOpen(false);
                      handleOpenBriefing();
                    }}
                  >
                    <span>AI Daily Briefing</span>
                  </button>
                  <Link
                    href="/reset"
                    role="menuitem"
                    className={styles.assistDropdownItem}
                    onClick={() => setAssistMenuOpen(false)}
                  >
                    <span>Compassion Reset (Overdue)</span>
                    {overdueCount > 0 && (
                      <span className={styles.assistCountPill}>{overdueCount}</span>
                    )}
                  </Link>
                  <div className={styles.assistDivider} />
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.assistDropdownItem}
                    onClick={(e) => {
                      setAssistMenuOpen(false);
                      setWrapUpOpen(true);
                      playSuccessChime();
                      triggerDopamineBurst(e.clientX, e.clientY);
                    }}
                  >
                    <span>Wrap Up Day</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Gentle Low-Energy Reassurance Banner */}
        {energyLevel === 'low' && (
          <div className={styles.gentleModeBanner} role="status">
            <span>
              <strong>Gentle Mode active:</strong> Extra lists are hidden so your mind can rest. Just
              focus on one small step below—momentum beats perfection.
            </span>
          </div>
        )}

        {/* ── 2. Single Focal Anchor: RIGHT NOW Spotlight Card ── */}
        <section className={styles.focusSpotlightCard} aria-label="Primary Focus">
          {primaryTask ? (
            <>
              <div className={styles.spotlightTopBar}>
                <div className={styles.spotlightEyebrow}>
                  <span className={styles.spotlightPulseDot} />
                  <span>
                    {energyLevel === 'low' ? 'ONE GENTLE STEP' : 'FOCUS RIGHT NOW'}
                  </span>
                  {getTaskRowContext(primaryTask).shortContext && (
                    <span className={styles.spotlightContextPill}>
                      {getTaskRowContext(primaryTask).shortContext}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className={styles.stuckSwitchBtn}
                  onClick={() => window.dispatchEvent(new CustomEvent('open-next-action'))}
                  title="Feeling resistance? Let AI suggest an easier starting point"
                >
                  <Sparkles size={12} />
                  <span>Stuck? Pick for me</span>
                </button>
              </div>

              <h2 className={styles.spotlightTitle}>{primaryTask.title}</h2>

              {/* First uncompleted subtask surfaced immediately to lower initiation friction */}
              {nextMicroStep && (
                <div className={styles.spotlightSubtaskRow}>
                  <button
                    type="button"
                    className={styles.spotlightSubtaskCheck}
                    onClick={(e) => handleToggleSubtask(primaryTask.id, nextMicroStep.id, e)}
                    title="Complete this micro-step"
                  >
                    <Square size={14} />
                    <span>First step: {nextMicroStep.title}</span>
                  </button>
                  {primaryTask.subtasks && primaryTask.subtasks.length > 1 && (
                    <button
                      type="button"
                      className={styles.subtaskBadgeBtn}
                      onClick={(e) => toggleSubtasks(primaryTask.id, e)}
                    >
                      {primaryTask.subtasks.filter((s) => s.completed).length}/
                      {primaryTask.subtasks.length} steps{' '}
                      {expandedSubtasks[primaryTask.id] ? '▲' : '▼'}
                    </button>
                  )}
                </div>
              )}

              {primaryTask.subtasks &&
                primaryTask.subtasks.length > 1 &&
                expandedSubtasks[primaryTask.id] && (
                  <div className={styles.spotlightSubtasksExpanded}>
                    {primaryTask.subtasks.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={(e) => handleToggleSubtask(primaryTask.id, sub.id, e)}
                        className={styles.spotlightSubtaskItem}
                      >
                        {sub.completed ? <CheckSquare size={13} /> : <Square size={13} />}
                        <span
                          style={{
                            textDecoration: sub.completed ? 'line-through' : 'none',
                            opacity: sub.completed ? 0.6 : 1,
                          }}
                        >
                          {sub.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

              <div className={styles.spotlightActionsRow}>
                <button
                  type="button"
                  className={styles.startFocusCta}
                  onClick={() => handleStartFocusOnTask(primaryTask)}
                >
                  <Play size={15} fill="currentColor" />
                  <span>Start Focus Session</span>
                </button>

                <button
                  type="button"
                  className={styles.completeFocusBtn}
                  onClick={(e) => handleToggleTask(primaryTask.id, e)}
                >
                  <Check size={15} strokeWidth={2.4} />
                  <span>Mark Complete</span>
                </button>
              </div>
            </>
          ) : (
            <div className={styles.emptySpotlightWrap}>
              <div className={styles.spotlightEyebrow}>
                <span className={styles.spotlightPulseDot} />
                <span>CLEAR SLATE</span>
              </div>
              <h2 className={styles.spotlightTitle}>
                What is the one thing that would make today feel like a win?
              </h2>
              <form onSubmit={handleSetMainWin} className={styles.emptySpotlightForm}>
                <input
                  type="text"
                  value={emptyFocusInput}
                  onChange={(e) => setEmptyFocusInput(e.target.value)}
                  placeholder="Write one clear, doable action..."
                  className={styles.captureTextInput}
                />
                <button
                  type="submit"
                  className={styles.startFocusCta}
                  disabled={!emptyFocusInput.trim()}
                >
                  <Plus size={15} />
                  <span>Set Focus</span>
                </button>
              </form>
            </div>
          )}
        </section>

        {/* ── 3. Unified Quick Capture (Replaces 5 duplicate inputs) ── */}
        <form onSubmit={handleUnifiedCapture} className={styles.unifiedCaptureCard}>
          <div className={styles.captureModePills} role="tablist" aria-label="Capture destination">
            <button
              type="button"
              role="tab"
              aria-selected={captureMode === 'task'}
              className={`${styles.captureModeBtn} ${
                captureMode === 'task' ? styles.captureModeBtnActive : ''
              }`}
              onClick={() => setCaptureMode('task')}
            >
              Today Task
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={captureMode === 'idea'}
              className={`${styles.captureModeBtn} ${
                captureMode === 'idea' ? styles.captureModeBtnActive : ''
              }`}
              onClick={() => setCaptureMode('idea')}
              title="Offload distracting mid-work thoughts into Idea Parking without cluttering Today"
            >
              Park Thought
            </button>
          </div>

          <input
            type="text"
            value={captureText}
            onChange={(e) => setCaptureText(e.target.value)}
            placeholder={
              captureMode === 'task'
                ? 'Add a task for today and press Enter...'
                : 'Offload a random thought or worry into Idea Parking...'
            }
            className={styles.unifiedCaptureInput}
          />

          <button
            type="submit"
            className={styles.unifiedCaptureSubmit}
            disabled={!captureText.trim()}
          >
            {captureMode === 'task' ? 'Add' : 'Park'}
          </button>

          {captureFeedback && (
            <span className={styles.captureFeedbackPill} role="status">
              {captureFeedback}
            </span>
          )}
        </form>

        {/* ── 4. Pinned Reminders (Only when active) ── */}
        {todayReminders.length > 0 && (
          <div className={styles.todayRemindersCard}>
            <div className={styles.todayRemindersHeader}>
              <div className={styles.todayRemindersHeaderLeft}>
                <h3 className={styles.todayRemindersTitle}>Pinned Reminders</h3>
                <span className={styles.todayRemindersCountBadge}>{todayReminders.length}</span>
              </div>
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
                      title="Mark done"
                      aria-label="Complete reminder"
                    >
                      <Check size={12} />
                    </button>
                  ) : (
                    <span className={styles.reminderDotMarker} />
                  )}

                  <span className={styles.reminderTypeBadge}>{rem.typeLabel}</span>

                  <Link href={rem.href} className={styles.reminderItemLink}>
                    <span className={styles.reminderItemTitle}>{rem.title}</span>
                    {rem.subtitle && (
                      <span className={styles.reminderItemSub}>{rem.subtitle}</span>
                    )}
                  </Link>

                  <button
                    type="button"
                    className={styles.reminderDismissBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      rem.onClearReminder();
                    }}
                    title="Unpin from Today"
                    aria-label="Remove reminder"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 5. Next Up Queue (Rule of 3 + Progressive Disclosure) ── */}
        {(nextUpTasks.length > 0 || remainingTasks.length > 0 || completedTodayTasks.length > 0) && (
          <section className={styles.contentSectionCard} aria-label="Up Next Queue">
            <div className={styles.sectionHeaderRow} style={{ marginBottom: nextUpTasks.length > 0 ? 12 : 6 }}>
              <div className={styles.sectionHeaderLeft}>
                <h2 className={styles.sectionHeading}>
                  {energyLevel === 'low' ? 'Parked For Later' : 'Up Next'}
                </h2>
                <span className={styles.sectionHeaderDate}>
                  {activeDomainTasks.length > 1 ? `${activeDomainTasks.length - 1} queued` : 'Clear'}
                </span>
              </div>
              <Link href="/tasks" className={styles.viewAllNotesLink}>
                Task board →
              </Link>
            </div>

            {nextUpTasks.length > 0 && (
              <div className={styles.prioritiesList}>
                {nextUpTasks.map((item, idx) => {
                  const { shortContext } = getTaskRowContext(item);
                  return (
                    <div key={item.id} className={styles.cleanQueueRow}>
                      <div className={styles.priorityLeft}>
                        <span className={styles.priorityNumBadge}>{idx + 2}</span>
                        <button
                          type="button"
                          className={styles.checkboxBtn}
                          onClick={(e) => handleToggleTask(item.id, e)}
                          aria-label={`Complete ${item.title}`}
                        >
                          <div className={styles.emptyBox} />
                        </button>
                        <span className={styles.taskTitleText}>{item.title}</span>
                        {item.subtasks && item.subtasks.length > 0 && (
                          <span className={styles.quietMetaChip}>
                            {item.subtasks.filter((s) => s.completed).length}/{item.subtasks.length}
                          </span>
                        )}
                      </div>

                      <div className={styles.rowRightActions}>
                        {shortContext && (
                          <span className={styles.taskContextText}>{shortContext}</span>
                        )}
                        <button
                          type="button"
                          className={styles.rowFocusMiniBtn}
                          onClick={() => handleStartFocusOnTask(item)}
                          title="Start focus timer on this task"
                          aria-label={`Focus on ${item.title}`}
                        >
                          <Play size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Progressive disclosure for remaining tasks so users never face a wall of 10+ items */}
            {remainingTasks.length > 0 && (
              <div className={styles.disclosureQueueWrap}>
                <button
                  type="button"
                  className={styles.queueDisclosureBtn}
                  onClick={() => setQueueExpanded((v) => !v)}
                  aria-expanded={queueExpanded}
                >
                  <span>
                    {queueExpanded
                      ? 'Hide extra tasks'
                      : `Show ${remainingTasks.length} more parked task${
                          remainingTasks.length === 1 ? '' : 's'
                        }`}
                  </span>
                  {queueExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {queueExpanded && (
                  <div className={styles.otherTasksList} style={{ marginTop: 8 }}>
                    {remainingTasks.slice(0, 10).map((task) => {
                      const { shortContext } = getTaskRowContext(task);
                      return (
                        <div key={task.id} className={styles.otherTaskRow}>
                          <button
                            type="button"
                            className={styles.checkboxBtn}
                            onClick={(e) => handleToggleTask(task.id, e)}
                            aria-label={`Complete ${task.title}`}
                          >
                            <div className={styles.emptyCircle} />
                          </button>
                          <span className={styles.otherTaskTitle}>{task.title}</span>
                          {shortContext && (
                            <span
                              className={styles.taskContextText}
                              style={{ marginLeft: 'auto' }}
                            >
                              {shortContext}
                            </span>
                          )}
                          <button
                            type="button"
                            className={styles.rowFocusMiniBtn}
                            onClick={() => handleStartFocusOnTask(task)}
                            title="Start focus timer"
                            aria-label={`Focus on ${task.title}`}
                          >
                            <Play size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Completed Today Dopamine Wins */}
            {completedTodayTasks.length > 0 && (
              <div className={styles.completedTasksWrap}>
                <button
                  type="button"
                  className={styles.queueDisclosureBtn}
                  onClick={() => setShowCompleted((v) => !v)}
                  aria-expanded={showCompleted}
                >
                  <span>
                    Completed today ({completedTodayTasks.length} win
                    {completedTodayTasks.length === 1 ? '' : 's'})
                  </span>
                  {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showCompleted && (
                  <div className={styles.completedTasksList}>
                    {completedTodayTasks.map((t) => (
                      <div key={t.id} className={styles.completedTaskRow}>
                        <button
                          type="button"
                          className={styles.checkboxBtn}
                          onClick={(e) => handleToggleTask(t.id, e)}
                          title="Undo completion"
                        >
                          <div className={styles.checkedCircle}>
                            <Check size={11} strokeWidth={3} />
                          </div>
                        </button>
                        <span className={styles.completedTaskTitle}>{t.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── 6. Calm Daily Anchors (Routine + Current Book) ── */}
        {energyLevel !== 'low' && (
          <div className={styles.calmContextGrid}>
            <Link href="/routine" className={styles.calmContextCard}>
              <div className={styles.calmCardTop}>
                <span className={styles.calmCardLabel}>
                  <Clock size={14} />
                  <span>Daily Routine</span>
                </span>
                <span className={styles.calmCardBadge}>
                  {dailyRoutine.completedCount}/{dailyRoutine.totalCount}
                </span>
              </div>
              <div className={styles.calmCardTitle}>
                {dailyRoutine.subtitle || 'Follow your structured time blocks'}
              </div>
            </Link>

            <div className={styles.calmContextCard}>
              <div className={styles.calmCardTop}>
                <span className={styles.calmCardLabel}>
                  <BookOpen size={14} />
                  <span>Active Reading</span>
                </span>
                <button
                  type="button"
                  className={styles.changeBookBtn}
                  onClick={() => setBookPickerOpen(true)}
                >
                  Switch
                </button>
              </div>
              <Link
                href={
                  currentReadingDoc ? `/knowledge?docId=${currentReadingDoc.id}` : '/knowledge'
                }
                className={styles.calmCardLinkBody}
              >
                <span className={styles.calmCardTitle}>{readingTitle}</span>
                {currentReadingDoc?.readProgress != null && currentReadingDoc.readProgress > 0 && (
                  <span className={styles.calmCardSub}>
                    {currentReadingDoc.readProgress}% completed
                  </span>
                )}
              </Link>
            </div>
          </div>
        )}
      </div>

      <RightSidebar
        onOpenWrapUp={(e) => {
          setWrapUpOpen(true);
          playSuccessChime();
          triggerDopamineBurst(e.clientX, e.clientY);
        }}
        overdueCount={overdueCount}
      />

      {/* Evening Shutdown & Wrap Up Day Modal */}
      {wrapUpOpen && (
        <div className={styles.modalBackdrop} onClick={() => setWrapUpOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Moon size={18} />
              <h2 className={styles.modalTitle} style={{ margin: 0 }}>
                Great Job Today, {userName}
              </h2>
            </div>
            <p className={styles.modalSubtitle}>
              You showed up and took action today. Take a deep breath and acknowledge your wins.
            </p>

            <div className={styles.modalStatsGrid}>
              <div className={styles.modalStatCard}>
                <span className={styles.modalStatNumber}>{completedTodayTasks.length || tasksDoneTotal}</span>
                <span className={styles.modalStatLabel}>Tasks Completed</span>
              </div>
              <div className={styles.modalStatCard}>
                <span className={styles.modalStatNumber}>{dailyRoutine.completedCount}</span>
                <span className={styles.modalStatLabel}>Routine Blocks</span>
              </div>
            </div>

            <div className={styles.modalReflection}>
              <strong>Evening Anchor:</strong> You don&apos;t have to finish everything to deserve
              rest. Give your brain full permission to recharge tonight.
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', width: '100%' }}>
              <button
                type="button"
                className={styles.modalPrimaryBtn}
                style={{
                  flex: 1,
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
                onClick={() => {
                  setWrapUpOpen(false);
                  handleOpenBriefing('evening');
                }}
              >
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
                <h3 className={styles.bookPickerTitle}>Choose Active Reading Book</h3>
                <p className={styles.bookPickerDesc}>
                  Select which book or study note stays pinned on Today.
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
                      className={`${styles.bookListItem} ${
                        isSelected ? styles.bookListItemActive : ''
                      }`}
                      onClick={() => handleSelectFeaturedBook(doc.id)}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          minWidth: 0,
                          textAlign: 'left',
                        }}
                      >
                        <BookOpen
                          size={16}
                          style={{
                            color: isSelected ? 'var(--color-accent)' : 'var(--color-text-muted)',
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div className={styles.bookItemTitle}>{doc.title}</div>
                          <div className={styles.bookItemMeta}>
                            {doc.readProgress != null && doc.readProgress > 0
                              ? `${doc.readProgress}% read · `
                              : ''}
                            {doc.category || 'document'}
                          </div>
                        </div>
                      </div>
                      <span className={styles.bookSelectBadge}>
                        {isSelected ? 'Active' : 'Select'}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div
                  style={{
                    padding: '20px 0',
                    textAlign: 'center',
                    fontSize: '0.82rem',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  No matching books found.
                </div>
              )}
            </div>

            <div className={styles.bookCreateDivider}>
              <span>Or add a new book</span>
            </div>

            <form onSubmit={handleCreateAndSelectBook} className={styles.bookCreateForm}>
              <input
                type="text"
                placeholder="Enter new book title..."
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
