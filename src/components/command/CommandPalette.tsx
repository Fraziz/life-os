'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTasks } from '@/context/TaskContext';
import { useKnowledge } from '@/context/KnowledgeContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useFocus } from '@/context/FocusContext';
import { useSettings } from '@/context/SettingsContext';
import styles from './CommandPalette.module.css';

interface CommandItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  keywords?: string[];
  onSelect: () => void;
}

export default function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { tasks } = useTasks();
  const { docs } = useKnowledge();
  const { projects } = useProjects();
  const { goals } = useGoals();
  const { setTimerMode, startTimer } = useFocus();
  const { settings, updateSettings, toggleSimpleMode } = useSettings();

  // Global Keyboard shortcut (Ctrl+K, Cmd+K, /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    const handleCustomOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleCustomOpen);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const closePalette = () => {
    setIsOpen(false);
  };

  // Build command list
  const commands: CommandItem[] = [
    // ── Quick Actions ──
    {
      id: 'act-focus-25',
      category: 'Quick Actions',
      title: 'Start 25m Focus Block',
      subtitle: 'Pomodoro timer in Focus Space',
      keywords: ['timer', 'pomodoro', 'work', 'focus'],
      onSelect: () => {
        setTimerMode('pomodoro', 25);
        startTimer();
        router.push('/focus');
        closePalette();
      },
    },
    {
      id: 'act-brain-dump',
      category: 'Quick Actions',
      title: 'Quick Brain Dump',
      subtitle: 'Capture thought to Inbox',
      keywords: ['inbox', 'capture', 'note', 'idea', 'dump'],
      onSelect: () => {
        router.push('/inbox');
        closePalette();
      },
    },
    {
      id: 'act-wrap-up',
      category: 'Quick Actions',
      title: 'Wrap Up Today',
      subtitle: 'Daily review & evening wrap up',
      keywords: ['evening', 'done', 'accomplishments', 'finish'],
      onSelect: () => {
        router.push('/?wrapup=true');
        closePalette();
      },
    },
    {
      id: 'act-solve-problem',
      category: 'Quick Actions',
      title: 'Problem Breakdown & Analysis',
      subtitle: 'Create structured analysis note',
      keywords: ['problem', 'breakdown', 'solution', 'analyze'],
      onSelect: () => {
        router.push('/knowledge?mode=problem');
        closePalette();
      },
    },
    {
      id: 'act-simple-mode',
      category: 'Quick Actions',
      title: settings.simpleMode ? 'Switch to Full Life OS' : 'Switch to Simple Mode',
      subtitle: settings.simpleMode ? 'Show all sections & advanced tools' : 'Show 4 core daily essentials only',
      keywords: ['mode', 'simple', 'full', 'toggle', 'beginner'],
      onSelect: () => {
        toggleSimpleMode();
        closePalette();
      },
    },
    {
      id: 'act-theme-nature',
      category: 'Quick Actions',
      title: 'Set Theme: Nature Forest',
      subtitle: 'Calm organic translucent aesthetic',
      keywords: ['theme', 'nature', 'green', 'forest'],
      onSelect: () => {
        updateSettings({ theme: 'nature' });
        closePalette();
      },
    },
    {
      id: 'act-theme-dark',
      category: 'Quick Actions',
      title: 'Set Theme: Sleek Charcoal Dark',
      subtitle: 'Modern high-contrast dark mode',
      keywords: ['theme', 'dark', 'black', 'charcoal'],
      onSelect: () => {
        updateSettings({ theme: 'dark' });
        closePalette();
      },
    },
    {
      id: 'act-theme-light',
      category: 'Quick Actions',
      title: 'Set Theme: Clean Luminous Light',
      subtitle: 'Crisp slate and indigo aesthetic',
      keywords: ['theme', 'light', 'white', 'indigo'],
      onSelect: () => {
        updateSettings({ theme: 'light' });
        closePalette();
      },
    },

    // ── Navigation ──
    {
      id: 'nav-today',
      category: 'Navigation',
      title: 'Today Dashboard',
      subtitle: '/',
      keywords: ['home', 'dashboard', 'priorities'],
      onSelect: () => {
        router.push('/');
        closePalette();
      },
    },
    {
      id: 'nav-focus',
      category: 'Navigation',
      title: 'Focus Space',
      subtitle: '/focus',
      keywords: ['timer', 'zen', 'reader', 'sounds'],
      onSelect: () => {
        router.push('/focus');
        closePalette();
      },
    },
    {
      id: 'nav-tasks',
      category: 'Navigation',
      title: 'Tasks Kanban & List',
      subtitle: '/tasks',
      keywords: ['todo', 'doing', 'done', 'backlog'],
      onSelect: () => {
        router.push('/tasks');
        closePalette();
      },
    },
    {
      id: 'nav-calendar',
      category: 'Navigation',
      title: 'Calendar & Schedule',
      subtitle: '/calendar',
      keywords: ['events', 'deadlines', 'day', 'week', 'month'],
      onSelect: () => {
        router.push('/calendar');
        closePalette();
      },
    },
    {
      id: 'nav-inbox',
      category: 'Navigation',
      title: 'Brain Dump / Inbox',
      subtitle: '/inbox',
      keywords: ['capture', 'thoughts', 'someday'],
      onSelect: () => {
        router.push('/inbox');
        closePalette();
      },
    },
    {
      id: 'nav-knowledge',
      category: 'Navigation',
      title: 'Knowledge Base',
      subtitle: '/knowledge',
      keywords: ['notes', 'documents', 'pdf', 'book'],
      onSelect: () => {
        router.push('/knowledge');
        closePalette();
      },
    },
    {
      id: 'nav-workout',
      category: 'Navigation',
      title: 'Workout & Fitness',
      subtitle: '/workout',
      keywords: ['exercise', 'gym', 'weight', '60kg'],
      onSelect: () => {
        router.push('/workout');
        closePalette();
      },
    },
    {
      id: 'nav-habits',
      category: 'Navigation',
      title: 'Habits Tracker',
      subtitle: '/habits',
      keywords: ['streaks', 'routines', 'daily'],
      onSelect: () => {
        router.push('/habits');
        closePalette();
      },
    },
    {
      id: 'nav-projects',
      category: 'Navigation',
      title: 'Projects',
      subtitle: '/projects',
      keywords: ['kanban', 'milestones'],
      onSelect: () => {
        router.push('/projects');
        closePalette();
      },
    },
    {
      id: 'nav-goals',
      category: 'Navigation',
      title: 'Goals',
      subtitle: '/goals',
      keywords: ['targets', 'yearly', '90-day'],
      onSelect: () => {
        router.push('/goals');
        closePalette();
      },
    },
    {
      id: 'nav-milestones',
      category: 'Navigation',
      title: 'Milestones',
      subtitle: '/milestones',
      keywords: ['checkpoints', 'targets'],
      onSelect: () => {
        router.push('/milestones');
        closePalette();
      },
    },
    {
      id: 'nav-roadmap',
      category: 'Navigation',
      title: 'Life Roadmap',
      subtitle: '/roadmap',
      keywords: ['timeline', 'future'],
      onSelect: () => {
        router.push('/roadmap');
        closePalette();
      },
    },
    {
      id: 'nav-review',
      category: 'Navigation',
      title: 'Weekly Review',
      subtitle: '/review',
      keywords: ['reflection', 'progress'],
      onSelect: () => {
        router.push('/review');
        closePalette();
      },
    },
    {
      id: 'nav-settings',
      category: 'Navigation',
      title: 'Settings',
      subtitle: '/settings',
      keywords: ['preferences', 'profile', 'themes'],
      onSelect: () => {
        router.push('/settings');
        closePalette();
      },
    },
  ];

  // Dynamic user items
  const dynamicItems: CommandItem[] = [];

  tasks.slice(0, 8).forEach((task) => {
    dynamicItems.push({
      id: `task-${task.id}`,
      category: 'Your Tasks',
      title: task.title,
      subtitle: `${task.status.toUpperCase()} • Priority: ${task.priority}`,
      keywords: ['task', task.title],
      onSelect: () => {
        router.push(`/tasks?highlight=${task.id}`);
        closePalette();
      },
    });
  });

  docs.slice(0, 6).forEach((doc) => {
    dynamicItems.push({
      id: `doc-${doc.id}`,
      category: 'Knowledge Notes',
      title: doc.title,
      subtitle: doc.tags?.join(', ') || 'Document',
      keywords: ['doc', 'note', doc.title],
      onSelect: () => {
        router.push(`/knowledge?docId=${doc.id}`);
        closePalette();
      },
    });
  });

  projects.slice(0, 4).forEach((p) => {
    dynamicItems.push({
      id: `proj-${p.id}`,
      category: 'Projects',
      title: p.title,
      subtitle: `Progress: ${p.progress}%`,
      keywords: ['project', p.title],
      onSelect: () => {
        router.push(`/projects?highlight=${p.id}`);
        closePalette();
      },
    });
  });

  const allItems = [...commands, ...dynamicItems];

  const filteredItems = query.trim() === ''
    ? allItems.slice(0, 14)
    : allItems.filter((item) => {
        const q = query.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchSub = item.subtitle?.toLowerCase().includes(q);
        const matchKey = item.keywords?.some((k) => k.toLowerCase().includes(q));
        const matchCat = item.category.toLowerCase().includes(q);
        return matchTitle || matchSub || matchKey || matchCat;
      });

  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].onSelect();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={closePalette}>
      <div className={styles.paletteCard} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDownList}>
        <div className={styles.searchHeader}>
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search commands, pages, tasks, or notes..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <span className={styles.escKeyBadge}>ESC</span>
        </div>

        <div className={styles.resultsList}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isActive = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.resultItem} ${isActive ? styles.resultItemActive : ''}`}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className={styles.resultLeft}>
                    <span className={styles.resultTitle}>{item.title}</span>
                    {item.subtitle && <span className={styles.resultSubtitle}>{item.subtitle}</span>}
                  </div>
                  <span className={styles.resultShortcut}>{item.category}</span>
                </button>
              );
            })
          )}
        </div>

        <div className={styles.paletteFooter}>
          <div className={styles.footerTips}>
            <span><span className={styles.footerKey}>↑</span> <span className={styles.footerKey}>↓</span> Navigate</span>
            <span><span className={styles.footerKey}>↵</span> Select</span>
            <span><span className={styles.footerKey}>ESC</span> Close</span>
          </div>
          <span>Sariling Mundo Command Bar</span>
        </div>
      </div>
    </div>
  );
}
