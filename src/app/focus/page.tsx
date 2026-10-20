'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  CheckSquare,
  Square,
  Plus,
  X,
  Volume2,
  VolumeX,
  BookOpen,
  Eraser,
  Check,
  ExternalLink,
  Pin,
  Save,
  Video,
  FileText,
  ChevronDown,
  ChevronUp,
  Bell,
} from 'lucide-react';
import { useFocus } from '@/context/FocusContext';
import { useTasks } from '@/context/TaskContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useInbox } from '@/context/InboxContext';
import { useKnowledge } from '@/context/KnowledgeContext';
import {
  isDocVideoLesson,
  transformVideoLessonsInHtml,
  generateVideoBlockHtml,
  extractVideoLessonData,
  extractVideoLessonNotes,
} from '@/utils/videoLesson';
import AddVideoLessonModal from '@/components/study/AddVideoLessonModal';
import YouTubePlayer from '@/components/study/YouTubePlayer';
import {
  playSubtaskTick,
  playTimerCompleteFanfare,
  triggerDopamineBurst,
  startAmbientSound,
  stopAmbientSound,
  setAmbientVolume,
  type AmbientSoundType,
} from '@/utils/soundAndDopamine';
import type { Task, FocusModeType, KnowledgeDocument } from '@/types';
import ContextualTourBanner from '@/components/tour/ContextualTourBanner';
import styles from './page.module.css';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const HIGHLIGHT_COLORS = [
  { name: 'yellow', label: 'Yellow', bg: 'rgba(251, 191, 36, 0.35)', border: '#f59e0b', text: 'inherit' },
  { name: 'green', label: 'Green', bg: 'rgba(52, 211, 153, 0.35)', border: '#10b981', text: 'inherit' },
  { name: 'blue', label: 'Blue', bg: 'rgba(96, 165, 250, 0.35)', border: '#3b82f6', text: 'inherit' },
  { name: 'pink', label: 'Pink', bg: 'rgba(244, 114, 182, 0.35)', border: '#ec4899', text: 'inherit' },
  { name: 'purple', label: 'Purple', bg: 'rgba(192, 132, 252, 0.35)', border: '#a855f7', text: 'inherit' },
  { name: 'orange', label: 'Orange', bg: 'rgba(251, 146, 60, 0.35)', border: '#f97316', text: 'inherit' },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  yellow: HIGHLIGHT_COLORS[0],
  green: HIGHLIGHT_COLORS[1],
  blue: HIGHLIGHT_COLORS[2],
  pink: HIGHLIGHT_COLORS[3],
  purple: HIGHLIGHT_COLORS[4],
  orange: HIGHLIGHT_COLORS[5],
};

const FONT_COLORS = [
  { name: 'default', label: 'Default', color: 'inherit', border: 'var(--color-border)' },
  { name: 'white', label: 'Pure White', color: '#ffffff', border: '#e2e8f0' },
  { name: 'emerald', label: 'Emerald Green', color: '#10b981', border: '#059669' },
  { name: 'lime', label: 'Lime Green', color: '#84cc16', border: '#65a30d' },
  { name: 'amber', label: 'Amber Gold', color: '#f59e0b', border: '#d97706' },
  { name: 'orange', label: 'Coral Orange', color: '#f97316', border: '#ea580c' },
  { name: 'rose', label: 'Rose Red', color: '#ef4444', border: '#dc2626' },
  { name: 'pink', label: 'Neon Pink', color: '#ec4899', border: '#db2777' },
  { name: 'purple', label: 'Royal Purple', color: '#a855f7', border: '#9333ea' },
  { name: 'cyan', label: 'Vibrant Cyan', color: '#06b6d4', border: '#0891b2' },
  { name: 'blue', label: 'Sky Blue', color: '#3b82f6', border: '#2563eb' },
];

const SOUNDSCAPES: { id: AmbientSoundType; title: string; subtitle: string; icon: string }[] = [
  { id: 'gamma40', title: '40Hz Gamma', subtitle: 'Hyperfocus', icon: '\u{1F9E0}' },
  { id: 'alpha10', title: '10Hz Alpha', subtitle: 'Flow State', icon: '\u{1F9D8}' },
  { id: 'pink',    title: 'Pink Noise', subtitle: 'ADHD Shield', icon: '\u{1F6E1}' },
  { id: 'brown',   title: 'Deep Brown', subtitle: 'Heavy Focus', icon: '\u{1F3A7}' },
  { id: 'white',   title: 'White Noise', subtitle: 'Sound Mask', icon: '\u{1F4FB}' },
  { id: 'rain',    title: 'Gentle Rain', subtitle: 'Calm Rainfall', icon: '\u{1F327}' },
  { id: 'thunder', title: 'Distant Thunder', subtitle: 'Rolling Storm', icon: '\u{26C8}' },
  { id: 'waves',   title: 'Ocean Waves', subtitle: 'Rhythmic Tide', icon: '\u{1F30A}' },
  { id: 'stream',  title: 'River Stream', subtitle: 'Flowing Water', icon: '\u{1F4A7}' },
  { id: 'forest',  title: 'Forest Birds', subtitle: 'Nature Chirp', icon: '\u{1F332}' },
  { id: 'fire',    title: 'Campfire', subtitle: 'Warm Crackle', icon: '\u{1F525}' },
  { id: 'wind',    title: 'Mountain Wind', subtitle: 'Alpine Breeze', icon: '\u{1F4A8}' },
  { id: 'cafe',    title: 'Cozy Cafe', subtitle: 'Quiet Chatter', icon: '\u{2615}' },
  { id: 'drone',   title: 'Space Drone', subtitle: 'Deep Ambience', icon: '\u{1F30C}' },
];

export default function FocusPage() {
  const {
    activeTask,
    activeDoc,
    activeTargetType,
    customTaskTitle,
    mode,
    timerDurationSeconds,
    secondsRemaining,
    secondsElapsed,
    isRunning,
    isZenMode,
    focusHistory,
    startTimer,
    pauseTimer,
    resetTimer,
    finishSession,
    selectFocusTask,
    selectFocusDoc,
    setTimerMode,
    toggleZenMode,
    clearFocusHistory,
    isLoaded,
  } = useFocus();

  const { docs, updateDoc, addDoc, toggleDocReminder } = useKnowledge();
  const { tasks, toggleSubtask } = useTasks();
  const { goals } = useGoals();
  const { projects } = useProjects();
  const { quickDump } = useInbox();

  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [targetTab, setTargetTab] = useState<'tasks' | 'knowledge' | 'videos'>('tasks');
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [targetSearchQuery, setTargetSearchQuery] = useState('');

  const [focusViewMode, setFocusViewMode] = useState<'timer' | 'book'>('book');
  const [customMinInput, setCustomMinInput] = useState('30');
  const [finishNotes, setFinishNotes] = useState('');
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [markDoneOnFinish, setMarkDoneOnFinish] = useState(true);

  // Live Highlighter & Font Color State in Focus Mode
  const [activeHighlightColor, setActiveHighlightColor] = useState('yellow');
  const [annotationMode, setAnnotationMode] = useState<'highlight' | 'fontColor'>('highlight');
  const [activeFontColor, setActiveFontColor] = useState<string>('#ffffff');
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [floatingMenu, setFloatingMenu] = useState<{ x: number; y: number; targetMark?: HTMLElement | null } | null>(null);
  const bookContainerRef = useRef<HTMLDivElement>(null);

  // ADHD Superpowers state
  const [ambientSound, setAmbientSound] = useState<AmbientSoundType>('off');
  const [ambientVol, setAmbientVol] = useState(0.35);
  const [parkingLotInput, setParkingLotInput] = useState('');
  const [parkedNotice, setParkedNotice] = useState(false);
  const [zenParkOpen, setZenParkOpen] = useState(false);
  const [ambientExpanded, setAmbientExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lifeos_ambient_expanded');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const toggleAmbientExpanded = () => {
    setAmbientExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('lifeos_ambient_expanded', String(next));
      }
      return next;
    });
  };

  // Reading scroll progress tracker
  const [readingScrollPercent, setReadingScrollPercent] = useState<number>(0);

  useEffect(() => {
    if (!activeDoc || focusViewMode !== 'book') return;

    const handleScroll = () => {
      const el = bookContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const totalHeight = el.offsetHeight;
      const windowHeight = window.innerHeight;
      const scrolled = Math.max(0, -rect.top + windowHeight * 0.3);
      const denominator = Math.max(1, totalHeight - windowHeight * 0.4);
      const progress = Math.min(100, Math.max(0, Math.round((scrolled / denominator) * 100)));
      setReadingScrollPercent(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeDoc, focusViewMode]);


  // Cleanup ambient sound on unmount
  useEffect(() => {
    return () => {
      stopAmbientSound();
    };
  }, []);

  // Escape key to exit Zen Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZenMode) {
        toggleZenMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode, toggleZenMode]);

  // Sync content into book container ref whenever activeDoc or focusViewMode changes
  const getRichHtml = (content: string) => {
    if (!content) return '';
    let html = content;
    if (!/<[a-z][^>]*>/i.test(content)) {
      html = content
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>');
      html = `<p>${html}</p>`;
    }
    // Clean up any stray video timestamp chip tags or buttons
    html = html
      .replace(/<button[^>]*class=["'][^"']*video-timestamp-chip[^"']*["'][^>]*>[\s\S]*?<\/button>/gi, '')
      .replace(/<span[^>]*class=["'][^"']*video-timestamp-chip[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/\[00:00\]/g, '')
      .replace(/(?:--\s*){3,}/g, '');
    return transformVideoLessonsInHtml(html, false, true, activeDoc?.title);
  };

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Backspace / Delete handling for non-editable widgets, chips, buttons
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);

        if (!range.collapsed) {
          const fragment = range.cloneContents();
          if (fragment.querySelector('.video-timestamp-chip, button, [contenteditable="false"]')) {
            e.preventDefault();
            range.deleteContents();
            handleManualSave();
            return;
          }
        } else {
          const node = sel.anchorNode;
          const offset = sel.anchorOffset;

          if (e.key === 'Backspace') {
            let targetNode: Node | null = null;
            if (node?.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element;
              if (offset > 0) {
                targetNode = el.childNodes[offset - 1] || null;
              }
            } else if (node?.nodeType === Node.TEXT_NODE && offset === 0) {
              targetNode = node.previousSibling;
            }

            if (targetNode instanceof HTMLElement) {
              if (
                targetNode.classList.contains('video-timestamp-chip') ||
                targetNode.tagName === 'BUTTON' ||
                targetNode.getAttribute('contenteditable') === 'false' ||
                targetNode.classList.contains('inline-code')
              ) {
                e.preventDefault();
                targetNode.remove();
                handleManualSave();
                return;
              }
            }
          } else if (e.key === 'Delete') {
            let targetNode: Node | null = null;
            if (node?.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element;
              targetNode = el.childNodes[offset] || null;
            } else if (node?.nodeType === Node.TEXT_NODE) {
              const text = node.textContent || '';
              if (offset >= text.length) {
                targetNode = node.nextSibling;
              }
            }

            if (targetNode instanceof HTMLElement) {
              if (
                targetNode.classList.contains('video-timestamp-chip') ||
                targetNode.tagName === 'BUTTON' ||
                targetNode.getAttribute('contenteditable') === 'false' ||
                targetNode.classList.contains('inline-code')
              ) {
                e.preventDefault();
                targetNode.remove();
                handleManualSave();
                return;
              }
            }
          }
        }
      }
    }
  };

  const handleNotesClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const chip = target.closest('.video-timestamp-chip, [data-timestamp], button') as HTMLElement | null;
    if (chip && bookContainerRef.current?.contains(chip)) {
      e.preventDefault();
      e.stopPropagation();
      chip.remove();
      handleManualSave();
    }
  };

  useEffect(() => {
    if (activeDoc && bookContainerRef.current) {
      if (isDocVideoLesson(activeDoc)) {
        bookContainerRef.current.innerHTML = getRichHtml(extractVideoLessonNotes(activeDoc.content || ''));
      } else {
        bookContainerRef.current.innerHTML = getRichHtml(activeDoc.content || '');
      }
    }
  }, [activeDoc, focusViewMode]);

  // Floating mouse selection toolbar handler
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const container = bookContainerRef.current;
      if (!container) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest(`.${styles.floatingHighlightMenu}`)) {
        return;
      }

      const clickedMark = target?.closest('mark, .font-color-span') as HTMLElement | null;
      const sel = window.getSelection();

      if (
        sel &&
        !sel.isCollapsed &&
        sel.rangeCount > 0 &&
        (container.contains(sel.getRangeAt(0).commonAncestorContainer) ||
          container === sel.getRangeAt(0).commonAncestorContainer)
      ) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setFloatingMenu({
          x: Math.max(10, rect.left + rect.width / 2 - 110),
          y: Math.max(10, rect.top - 48 + window.scrollY),
          targetMark: clickedMark,
        });
      } else if (clickedMark && container.contains(clickedMark)) {
        const rect = clickedMark.getBoundingClientRect();
        setFloatingMenu({
          x: Math.max(10, rect.left + rect.width / 2 - 110),
          y: Math.max(10, rect.top - 48 + window.scrollY),
          targetMark: clickedMark,
        });
      } else {
        setFloatingMenu(null);
      }
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const triggerSaveToast = () => {
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 2000);
  };

  const handleHighlightInFocus = (colorName: string, explicitMark?: HTMLElement | null) => {
    setActiveHighlightColor(colorName);
    const container = bookContainerRef.current;
    if (!container || !activeDoc) return;

    const c = COLOR_MAP[colorName] || HIGHLIGHT_COLORS[0];

    // If explicit mark was passed and clicked (literal highlight, zero spacing change)
    if (explicitMark && container.contains(explicitMark)) {
      explicitMark.style.background = c.bg;
      explicitMark.style.border = 'none';
      explicitMark.style.padding = '0 1px';
      explicitMark.style.margin = '0';
      explicitMark.style.fontWeight = 'inherit';
      if (!explicitMark.style.color) {
        explicitMark.style.color = 'inherit';
      }
      const saved = container.innerHTML;
      updateDoc(activeDoc.id, { content: saved });
      triggerSaveToast();
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer) && container !== range.commonAncestorContainer) return;

    let cur: Node | null = range.commonAncestorContainer;
    while (cur && cur !== container) {
      if (cur.nodeName === 'MARK') {
        const markEl = cur as HTMLElement;
        markEl.style.background = c.bg;
        markEl.style.border = 'none';
        markEl.style.padding = '0';
        markEl.style.margin = '0';
        markEl.style.borderRadius = '0';
        markEl.style.fontWeight = 'inherit';
        if (!markEl.style.color) {
          markEl.style.color = 'inherit';
        }
        const saved = container.innerHTML;
        updateDoc(activeDoc.id, { content: saved });
        triggerSaveToast();
        return;
      }
      cur = cur.parentNode;
    }

    if (sel.isCollapsed) return;

    const mark = document.createElement('mark');
    mark.className = 'highlight-mark';
    mark.style.background = c.bg;
    mark.style.color = 'inherit';
    mark.style.border = 'none';
    mark.style.padding = '0';
    mark.style.margin = '0';
    mark.style.borderRadius = '0';
    mark.style.fontWeight = 'inherit';
    mark.style.boxDecorationBreak = 'clone';
    (mark.style as any).webkitBoxDecorationBreak = 'clone';

    try {
      const frag = range.extractContents();
      const innerMarks = frag.querySelectorAll ? frag.querySelectorAll('mark') : [];
      innerMarks.forEach((m: Element) => {
        const parent = m.parentNode;
        while (m.firstChild) {
          parent?.insertBefore(m.firstChild, m);
        }
        parent?.removeChild(m);
      });
      mark.appendChild(frag);
      range.insertNode(mark);
      sel.removeAllRanges();
    } catch {
      try {
        document.execCommand('hiliteColor', false, c.bg);
      } catch {}
    }

    const saved = container.innerHTML;
    updateDoc(activeDoc.id, { content: saved });
    triggerSaveToast();
  };

  const handleRemoveHighlightInFocus = (explicitMark?: HTMLElement | null) => {
    const container = bookContainerRef.current;
    if (!container || !activeDoc) return;

    let modified = false;

    // 1. Direct explicit mark (from clicking or toolbar)
    if (explicitMark && container.contains(explicitMark)) {
      const parent = explicitMark.parentNode;
      while (explicitMark.firstChild) {
        parent?.insertBefore(explicitMark.firstChild, explicitMark);
      }
      parent?.removeChild(explicitMark);
      modified = true;
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (
        container.contains(range.commonAncestorContainer) ||
        container === range.commonAncestorContainer
      ) {
        // 2. Check if common ancestor or its parents is a MARK
        let cur: Node | null = range.commonAncestorContainer;
        while (cur && cur !== container) {
          if (cur.nodeName === 'MARK') {
            const markEl = cur as HTMLElement;
            const parent = markEl.parentNode;
            while (markEl.firstChild) {
              parent?.insertBefore(markEl.firstChild, markEl);
            }
            parent?.removeChild(markEl);
            modified = true;
            break;
          }
          cur = cur.parentNode;
        }

        // 3. Check all marks in container that intersect or are contained in the selection
        const marks = container.querySelectorAll('mark');
        marks.forEach((m) => {
          try {
            const isContained = sel.containsNode ? sel.containsNode(m, true) : false;
            const isIntersected = range.intersectsNode ? range.intersectsNode(m) : false;
            if (isContained || isIntersected) {
              const parent = m.parentNode;
              while (m.firstChild) {
                parent?.insertBefore(m.firstChild, m);
              }
              parent?.removeChild(m);
              modified = true;
            }
          } catch {
            // fallback
          }
        });
      }
    }

    // 4. Fallback if cursor/anchor is inside a mark
    if (!modified && sel && sel.anchorNode && container.contains(sel.anchorNode)) {
      let cur: Node | null = sel.anchorNode;
      while (cur && cur !== container) {
        if (cur.nodeName === 'MARK') {
          const markEl = cur as HTMLElement;
          const parent = markEl.parentNode;
          while (markEl.firstChild) {
            parent?.insertBefore(markEl.firstChild, markEl);
          }
          parent?.removeChild(markEl);
          modified = true;
          break;
        }
        cur = cur.parentNode;
      }
    }

    if (modified) {
      const saved = container.innerHTML;
      updateDoc(activeDoc.id, { content: saved });
      triggerSaveToast();
      setFloatingMenu(null);
    }
  };

  const handleFontColorInFocus = (colorVal: string, explicitMark?: HTMLElement | null) => {
    setActiveFontColor(colorVal);
    const container = bookContainerRef.current;
    if (!container || !activeDoc) return;

    // 1. Direct explicit target (e.g. clicked highlight mark or span)
    if (explicitMark && container.contains(explicitMark)) {
      if (colorVal === 'inherit') {
        explicitMark.style.color = '';
      } else {
        explicitMark.style.color = colorVal;
      }
      const saved = container.innerHTML;
      updateDoc(activeDoc.id, { content: saved });
      triggerSaveToast();
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer) && container !== range.commonAncestorContainer) return;

    // 2. Check if inside existing mark or font-span
    let cur: Node | null = range.commonAncestorContainer;
    while (cur && cur !== container) {
      if (cur.nodeName === 'MARK' || (cur.nodeName === 'SPAN' && (cur as HTMLElement).style.color)) {
        const el = cur as HTMLElement;
        if (colorVal === 'inherit') {
          el.style.color = '';
        } else {
          el.style.color = colorVal;
        }
        const saved = container.innerHTML;
        updateDoc(activeDoc.id, { content: saved });
        triggerSaveToast();
        return;
      }
      cur = cur.parentNode;
    }

    if (sel.isCollapsed) return;

    // 3. Wrap selection in span
    if (colorVal !== 'inherit') {
      const span = document.createElement('span');
      span.className = 'font-color-span';
      span.style.color = colorVal;
      span.style.fontWeight = 'inherit';
      span.style.padding = '0';
      span.style.margin = '0';
      span.style.border = 'none';
      try {
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
        sel.removeAllRanges();
      } catch {
        try {
          document.execCommand('foreColor', false, colorVal);
        } catch {}
      }
      const saved = container.innerHTML;
      updateDoc(activeDoc.id, { content: saved });
      triggerSaveToast();
    }
  };

  const handleManualSave = () => {
    const container = bookContainerRef.current;
    if (container && activeDoc) {
      if (isDocVideoLesson(activeDoc)) {
        const videoData = extractVideoLessonData(activeDoc.content || '');
        if (videoData) {
          const videoBlockHtml = generateVideoBlockHtml({
            videoId: videoData.videoId,
            url: videoData.url,
            title: activeDoc.title || videoData.title,
            startTime: videoData.startTime,
            isEditMode: false,
          });
          const combined = `${videoBlockHtml}\n\n${container.innerHTML}`;
          updateDoc(activeDoc.id, { content: combined });
        } else {
          updateDoc(activeDoc.id, { content: container.innerHTML });
        }
      } else {
        updateDoc(activeDoc.id, { content: container.innerHTML });
      }
      triggerSaveToast();
    }
  };

  const handleAmbientToggle = (type: AmbientSoundType) => {
    if (ambientSound === type) {
      setAmbientSound('off');
      stopAmbientSound();
    } else {
      setAmbientSound(type);
      startAmbientSound(type, ambientVol);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setAmbientVol(v);
    setAmbientVolume(v);
  };

  // Live active task derived from TaskContext to ensure reactive subtask sync
  const liveActiveTask = activeTask ? tasks.find((t) => t.id === activeTask.id) || activeTask : null;

  const handleSubtaskCheck = (e: React.MouseEvent, subtaskId: string) => {
    e.stopPropagation();
    if (!liveActiveTask) return;
    toggleSubtask(liveActiveTask.id, subtaskId);
    playSubtaskTick();
  };

  const handleParkDistraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parkingLotInput.trim()) return;
    quickDump(parkingLotInput.trim());
    setParkingLotInput('');
    setParkedNotice(true);
    setTimeout(() => setParkedNotice(false), 3000);
  };

  const handleCustomMinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const min = parseInt(customMinInput, 10);
    if (!isNaN(min) && min > 0) {
      setTimerMode('custom', min);
    }
  };

  const handleFinishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    finishSession(finishNotes, markDoneOnFinish);
    if (activeDoc) {
      updateDoc(activeDoc.id, {
        readProgress: readingScrollPercent,
        lastReviewedAt: new Date().toISOString(),
        ...(markDoneOnFinish ? { readStatus: 'completed' as const } : { readStatus: 'reading' as const }),
      });
    }
    playTimerCompleteFanfare();
    triggerDopamineBurst();
    setFinishModalOpen(false);
    setFinishNotes('');
  };

  // Hierarchy Lookup
  const parentProject = liveActiveTask?.projectId
    ? projects.find((p) => p.id === liveActiveTask.projectId)
    : null;
  const parentGoal = parentProject?.goalId
    ? goals.find((g) => g.id === parentProject.goalId)
    : null;

  // Filter tasks & docs for target selector
  const filteredTasks = tasks
    .filter((t) => t.status !== 'done')
    .filter((t) => t.title.toLowerCase().includes(targetSearchQuery.toLowerCase()));

  const filteredDocs = docs
    .filter(
      (d) =>
        d.title.toLowerCase().includes(targetSearchQuery.toLowerCase()) ||
        d.tags.some((tag) => tag.toLowerCase().includes(targetSearchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

  const bookDocs = filteredDocs.filter((d) => !isDocVideoLesson(d));
  const videoDocs = filteredDocs.filter((d) => isDocVideoLesson(d));

  // ── Today's Progress: group sessions by task/book, filtered to today ──
  const todayStr = new Date().toDateString();
  const todaySessions = focusHistory.filter((s) => {
    const d = s.startedAt ? new Date(s.startedAt) : null;
    return d && d.toDateString() === todayStr;
  });

  // Accumulate minutes per target
  const todayProgressMap = new Map<string, { title: string; minutes: number; sessions: number }>();
  for (const s of todaySessions) {
    const key = s.taskId || s.taskTitle || 'Unknown';
    const existing = todayProgressMap.get(key);
    if (existing) {
      existing.minutes += s.durationMinutes;
      existing.sessions += 1;
    } else {
      todayProgressMap.set(key, { title: s.taskTitle || 'Unnamed', minutes: s.durationMinutes, sessions: 1 });
    }
  }
  const todayProgressList = Array.from(todayProgressMap.values()).sort((a, b) => b.minutes - a.minutes);
  const todayTotalMinutes = todayProgressList.reduce((sum, e) => sum + e.minutes, 0);

  function fmtMin(m: number): string {
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  }

  return (
    <div className={`${styles.page} ${isZenMode ? styles.zenMode : ''}`}>
      {/* ── Zen Mode Top Minimalist Floating Bar ── */}
      {isZenMode && (
        <div className={styles.zenTopBar}>
          <div className={styles.zenTopLeft}>
            <button
              type="button"
              className={styles.btnExitZen}
              onClick={toggleZenMode}
              title="Exit Zen Mode (or press Esc)"
            >
              ← Exit <span className={styles.escBadge}>Esc</span>
            </button>

            <div className={styles.zenTargetInfo}>
              <span className={styles.zenTargetLabel}>
                {activeDoc ? (isDocVideoLesson(activeDoc) ? 'VIDEO LESSON' : 'BOOK') : 'TARGET'}
              </span>
              <span
                className={styles.zenTargetTitle}
                title={activeDoc ? activeDoc.title : (liveActiveTask?.title || customTaskTitle || 'Focus Session')}
              >
                {activeDoc ? activeDoc.title : (liveActiveTask?.title || customTaskTitle || 'Focus Session')}
              </span>
            </div>
          </div>

          <div className={styles.zenTopRight}>
            {/* Minimalist Live Timer Capsule */}
            <div className={styles.zenTimerCapsule}>
              <span className={`${styles.zenTimerStatusDot} ${isRunning ? styles.zenTimerActiveDot : ''}`} />
              <span className={styles.zenTimerDigits}>
                {mode === 'flow' ? formatTimer(secondsElapsed) : formatTimer(secondsRemaining)}
              </span>
              {isRunning ? (
                <button
                  type="button"
                  className={styles.zenTimerActionBtn}
                  onClick={pauseTimer}
                  title="Pause Focus Timer"
                >
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.zenTimerActionBtn} ${styles.zenTimerActionStart}`}
                  onClick={startTimer}
                  title="Start Focus Timer"
                >
                  {secondsElapsed > 0 ? 'Resume' : 'Start'}
                </button>
              )}
              <button
                type="button"
                className={styles.zenTimerResetBtn}
                onClick={resetTimer}
                title="Reset timer"
              >
                Reset
              </button>
              <button
                type="button"
                className={styles.zenTimerFinishBtn}
                onClick={() => setFinishModalOpen(true)}
                title="Finish & Log Focus Session"
              >
                Finish
              </button>
            </div>

            {/* Knowledge reading tools when reading a book */}
            {activeDoc && (
              <div className={styles.zenBookTools}>
                {!isDocVideoLesson(activeDoc) && (
                  <>
                    <span className={styles.zenReadingStat} title="Reading progress">
                      {readingScrollPercent}%
                    </span>

                    <button
                      type="button"
                      className={`${styles.zenSaveBtn} ${showSaveToast ? styles.zenSaveBtnSuccess : ''}`}
                      onClick={handleManualSave}
                      title="Save highlights to Study & Books"
                    >
                      {showSaveToast ? 'Saved' : 'Save'}
                    </button>
                  </>
                )}

                {/* Minimal View Toggle in Zen Mode */}
                <div className={styles.zenViewToggle}>
                  <button
                    type="button"
                    className={`${styles.zenViewBtn} ${focusViewMode === 'book' ? styles.zenViewBtnActive : ''}`}
                    onClick={() => setFocusViewMode('book')}
                    title={isDocVideoLesson(activeDoc) ? "Switch to Video Lesson Studio" : "Switch to Book Reader View"}
                  >
                    {isDocVideoLesson(activeDoc) ? 'Video' : 'Book'}
                  </button>
                  <button
                    type="button"
                    className={`${styles.zenViewBtn} ${focusViewMode === 'timer' ? styles.zenViewBtnActive : ''}`}
                    onClick={() => setFocusViewMode('timer')}
                    title="Switch to Timer View"
                  >
                    Timer
                  </button>
                </div>
              </div>
            )}

            {/* Ambient Sound status & quick mute */}
            {ambientSound !== 'off' && (
              <div className={styles.zenAmbientWrap}>
                <span className={styles.zenAmbientLabel}>♫</span>
                <button
                  type="button"
                  className={styles.zenMuteBtn}
                  onClick={() => handleAmbientToggle('off')}
                  title="Mute ambient sound"
                >
                  Mute
                </button>
              </div>
            )}

            {/* ADHD Distraction Thought Quick-Park Trigger */}
            <button
              type="button"
              className={`${styles.zenParkTrigger} ${zenParkOpen ? styles.zenParkTriggerActive : ''}`}
              onClick={() => setZenParkOpen((prev) => !prev)}
              title="Park an ADHD thought without breaking flow"
            >
              {zenParkOpen ? 'Close Park' : 'Park Thought'}
            </button>
          </div>
        </div>
      )}

      {/* Floating Distraction Park Dropdown (Zen Mode) */}
      {isZenMode && zenParkOpen && (
        <div className={styles.zenParkDropdown}>
          <form onSubmit={handleParkDistraction} className={styles.zenParkForm}>
            <input
              type="text"
              value={parkingLotInput}
              onChange={(e) => setParkingLotInput(e.target.value)}
              placeholder="Park a distracting thought without losing focus... ↵"
              className={styles.zenParkInput}
              autoFocus
            />
            <button type="submit" className={styles.zenParkBtn}>
              Park
            </button>
          </form>
          {parkedNotice && (
            <span className={styles.zenParkNotice}>Saved to Brain Dump!</span>
          )}
        </div>
      )}

      {/* Hairline reading progress track across viewport top when in Book Zen Mode */}
      {isZenMode && activeDoc && focusViewMode === 'book' && !isDocVideoLesson(activeDoc) && (
        <div className={styles.zenReadingProgressBarTrack}>
          <div
            className={styles.zenReadingProgressBarFill}
            style={{ width: `${readingScrollPercent}%` }}
          />
        </div>
      )}

      {/* ── Top Header ── */}
      {!isZenMode && (
        <header className={`${styles.header} ${activeDoc && focusViewMode === 'book' ? styles.headerCompact : ''}`}>
          <div className={styles.titleArea}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className={styles.title}>Focus Space</h1>
              {activeDoc && (
                <span className={styles.toastSaved}>
                  {isDocVideoLesson(activeDoc) ? 'Video Lesson Active' : 'Book Reader Active'}
                </span>
              )}
            </div>
            {!(activeDoc && focusViewMode === 'book') && (
              <p className={styles.subtitle}>
                {activeDoc && isDocVideoLesson(activeDoc)
                  ? 'Hyperfocus timer, ADHD distraction parking lot, and video lesson studio.'
                  : 'Hyperfocus timer, ADHD distraction parking lot, and in-session Book Reader with live highlights.'}
              </p>
            )}
          </div>

          <div className={styles.headerActions}>
            {/* View Mode Toggle when reading a Knowledge Book or Video Lesson */}
            {activeDoc && (
              <div className={styles.targetTabGroup} style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`${styles.targetTab} ${focusViewMode === 'book' ? styles.targetTabActive : ''}`}
                  onClick={() => setFocusViewMode('book')}
                >
                  {isDocVideoLesson(activeDoc) ? 'Video View' : 'Book View'}
                </button>
                <button
                  type="button"
                  className={`${styles.targetTab} ${focusViewMode === 'timer' ? styles.targetTabActive : ''}`}
                  onClick={() => setFocusViewMode('timer')}
                >
                  Timer View
                </button>
              </div>
            )}

            <button
              className={styles.btnZen}
              onClick={toggleZenMode}
              title="Toggle Zen Mode (Distraction-Free)"
            >
              <span>Zen Mode</span>
            </button>
          </div>
        </header>
      )}

      {/* Contextual Onboarding Tour Guide */}
      {!isZenMode && <ContextualTourBanner tourId="focus-space" featureName="Focus Space" />}

      {/* Main Focus Container */}
      <div className={activeDoc && focusViewMode === 'book' ? (isDocVideoLesson(activeDoc) ? styles.focusContainerVideo : styles.focusContainerBook) : styles.focusContainer}>
        {/* Left / Main Section */}
        <section className={styles.focusMain} style={{ width: '100%' }}>
          {/* If a Knowledge document is active AND we are in Book View */}
          {activeDoc && focusViewMode === 'book' ? (
            isDocVideoLesson(activeDoc) ? (
              /* ── EXPANSIVE CINEMATIC VIDEO LESSON THEATER ── */
              <div className={styles.focusVideoWrapper}>
                {/* 1. Large 16:9 Video Player Theater Card (Big, Wide & Responsive) */}
                <div className={styles.focusVideoTheaterCard}>
                  <div className={styles.focusVideoHeader}>
                    <div className={styles.focusVideoHeaderLeft}>
                      <span className={styles.focusVideoBadge}>
                        <Video size={12} /> Video Lesson
                      </span>
                      <h2 className={styles.focusVideoTitle}>{activeDoc.title}</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className={`${styles.focusReminderBtn} ${activeDoc.isReminder ? styles.focusReminderBtnActive : ''}`}
                        onClick={() => toggleDocReminder(activeDoc.id)}
                        title={activeDoc.isReminder ? "Remove reminder (clears from Today)" : "Set Reminder (Show on Today)"}
                      >
                        <Bell size={12} style={activeDoc.isReminder ? { color: 'var(--color-warning, #f59e0b)' } : undefined} />
                        <span>Reminder</span>
                      </button>
                      <button
                        type="button"
                        className={styles.focusVideoSwitchBtn}
                        onClick={() => setTaskPickerOpen(true)}
                        title="Switch focus target (Tasks, Books, or Video Lessons)"
                      >
                        <RotateCcw size={12} />
                        <span>Switch Target</span>
                      </button>
                    </div>
                  </div>

                  <div className={styles.focusVideoFrame}>
                    <YouTubePlayer
                      videoId={extractVideoLessonData(activeDoc.content || '')?.videoId || ''}
                      startTime={extractVideoLessonData(activeDoc.content || '')?.startTime || 0}
                      title={activeDoc.title}
                    />
                  </div>
                </div>

                {/* 2. Practice & Study Notes Card with Live Highlighter & Study Notes */}
                <div className={styles.focusVideoNotesCard}>
                  <div className={styles.focusVideoNotesHeader}>
                    <div className={styles.focusVideoNotesTitle}>
                      <FileText size={14} style={{ color: 'var(--color-accent-light)' }} />
                      <span>Lesson Practice &amp; Study Notes</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className={`${styles.bookSaveBtn} ${showSaveToast ? styles.bookSaveBtnSuccess : ''}`}
                        onClick={handleManualSave}
                        title="Save highlights and notes back to document"
                      >
                        <Save size={12} style={{ marginRight: 4 }} />
                        <span>{showSaveToast ? 'Saved' : 'Save Notes'}</span>
                      </button>
                    </div>
                  </div>

                  <div
                    ref={bookContainerRef}
                    contentEditable
                    suppressContentEditableWarning
                    className={styles.focusVideoNotesBody}
                    dangerouslySetInnerHTML={{ __html: getRichHtml(extractVideoLessonNotes(activeDoc.content || '')) }}
                    onKeyDown={handleNotesKeyDown}
                    onClick={handleNotesClick}
                    onBlur={handleManualSave}
                  />

                  <div className={styles.bookFooter} style={{ marginTop: '16px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '10px' }}>
                    <span>Practice &amp; Study Notes · Sariling Mundo</span>
                    <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Standard Book Reading View (A4 Book Paper) */
              <div className={styles.focusBookWrapper}>
                <div className={styles.focusBookPageCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className={styles.bookFocusBadge}>
                        <BookOpen size={12} /> Book
                      </span>
                      <div className={styles.focusBookTitle}>{activeDoc.title}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className={`${styles.focusReminderBtn} ${activeDoc.isReminder ? styles.focusReminderBtnActive : ''}`}
                        onClick={() => toggleDocReminder(activeDoc.id)}
                        title={activeDoc.isReminder ? "Remove reminder (clears from Today)" : "Set Reminder (Show on Today)"}
                      >
                        <Bell size={12} style={activeDoc.isReminder ? { color: 'var(--color-warning, #f59e0b)' } : undefined} />
                        <span>Reminder</span>
                      </button>
                      <button
                        type="button"
                        className={styles.btnSwitchTargetInline}
                        onClick={() => setTaskPickerOpen(true)}
                        title="Switch to another task, book, or video lesson"
                      >
                        <RotateCcw size={12} />
                        <span>Switch Target</span>
                      </button>
                    </div>
                  </div>
                  {activeDoc.tags && activeDoc.tags.filter((t) => t.toLowerCase() !== 'video-lesson').length > 0 && (
                    <div className={styles.bookMeta}>
                      {activeDoc.tags
                        .filter((t) => t.toLowerCase() !== 'video-lesson')
                        .map((t) => (
                          <span key={t} className={styles.bookTag}>#{t}</span>
                        ))}
                    </div>
                  )}
                  <div className={styles.bookDivider} />

                  <div
                    ref={bookContainerRef}
                    contentEditable={false}
                    className={styles.focusBookBody}
                    dangerouslySetInnerHTML={{ __html: getRichHtml(activeDoc.content || '') }}
                  />

                  <div className={styles.bookFooter}>
                    <span>Reading Target in Focus Mode · Sariling Mundo</span>
                    <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
              </div>
            )
          ) : (
            /* Standard Focus Timer Card */
            <div className={styles.focusCard}>
              {/* Mode Switcher Tabs — text only, minimalist */}
              <div className={styles.modeTabs}>
                <button
                  className={`${styles.modeTab} ${mode === 'pomodoro' ? styles.activeMode : ''}`}
                  onClick={() => setTimerMode('pomodoro')}
                >
                  Pomodoro
                </button>
                <button
                  className={`${styles.modeTab} ${mode === 'short_break' ? styles.activeMode : ''}`}
                  onClick={() => setTimerMode('short_break')}
                >
                  Short Break
                </button>
                <button
                  className={`${styles.modeTab} ${mode === 'long_break' ? styles.activeMode : ''}`}
                  onClick={() => setTimerMode('long_break')}
                >
                  Long Break
                </button>
                <button
                  className={`${styles.modeTab} ${mode === 'flow' ? styles.activeMode : ''}`}
                  onClick={() => setTimerMode('flow')}
                >
                  Flow
                </button>
              </div>

              {/* Formal Digital Timer Display Card */}
              <div className={styles.timerDisplayCard} data-tour="focus-timer">
                <div className={styles.timerNumber}>
                  {mode === 'flow'
                    ? formatTimer(secondsElapsed)
                    : formatTimer(secondsRemaining)}
                </div>
                <div className={styles.timerMetaRow}>
                  <span className={styles.timerModeLabel}>
                    {mode === 'flow' ? 'FLOW' : mode.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className={styles.timerStatusDot}>•</span>
                  <span className={styles.timerStatusText}>
                    {isRunning ? 'ACTIVE' : 'READY'}
                  </span>
                </div>
              </div>

              {/* Current Task / Target Details */}
              <div className={styles.currentTaskArea} data-tour="focus-task-select">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className={styles.taskTagPill}>
                    {activeDoc ? (isDocVideoLesson(activeDoc) ? 'VIDEO LESSON TARGET' : 'READING TARGET') : 'CURRENT TARGET'}
                  </span>
                  <button
                    type="button"
                    className={styles.btnSwitchTargetInline}
                    onClick={() => setTaskPickerOpen(true)}
                    title="Switch focus target (Tasks, Books, or Video Lessons)"
                  >
                    <RotateCcw size={11} />
                    <span>Switch Target</span>
                  </button>
                  {parentProject && (
                    <span style={{ fontSize: '11px', color: 'var(--color-accent-light)', background: 'var(--color-surface-2)', padding: '2px 8px', borderRadius: '4px' }}>
                      Project: {parentProject.title}
                    </span>
                  )}
                  {liveActiveTask?.estimatedDuration && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
                      Est: {liveActiveTask.estimatedDuration}m • Act: {Math.round((liveActiveTask.actualDuration || 0) + secondsElapsed / 60)}m
                    </span>
                  )}
                </div>

                <h2 className={styles.taskTitle} id="focus-task-title">
                  {activeDoc ? activeDoc.title : liveActiveTask ? liveActiveTask.title : customTaskTitle || 'Focus Session'}
                </h2>

                {activeDoc && (
                  <div style={{ margin: '8px 0' }}>
                    <button
                      type="button"
                      className={styles.focusBookBtn}
                      onClick={() => setFocusViewMode('book')}
                    >
                      {isDocVideoLesson(activeDoc) ? 'Open Video Lesson Studio' : 'Open Book Reader with Highlighter'}
                    </button>
                  </div>
                )}

                {/* Why It Matters */}
                {parentGoal?.why && (
                  <p className={styles.taskWhy}>
                    &ldquo;{parentGoal.why}&rdquo;
                  </p>
                )}
                {liveActiveTask?.description && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                    {liveActiveTask.description}
                  </p>
                )}
              </div>

              {/* Subtasks checklist (for tasks) */}
              {!activeDoc && (
                <div className={styles.subtasksBox}>
                  <div className={styles.subtasksHeaderRow}>
                    <span className={styles.subtasksLabel}>
                      Steps ({liveActiveTask?.subtasks?.filter((s) => s.completed).length || 0}/{liveActiveTask?.subtasks?.length || 0}):
                    </span>
                  </div>

                  {liveActiveTask?.subtasks && liveActiveTask.subtasks.length > 0 ? (
                    liveActiveTask.subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className={`${styles.subtaskRow} ${sub.completed ? styles.done : ''}`}
                      >
                        <button
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            color: sub.completed ? 'var(--color-success)' : 'var(--color-text-faint)',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                          onClick={(e) => handleSubtaskCheck(e, sub.id)}
                        >
                          {sub.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                        <span style={{ flex: 1, textAlign: 'left' }}>{sub.title}</span>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', margin: 0, padding: '4px 0', textAlign: 'left' }}>
                      No steps yet. Add steps to this task from the Tasks page.
                    </p>
                  )}
                </div>
              )}

              {/* Zen Mode Only Controls */}
              {isZenMode && (
                <div className={styles.controlsRow}>
                  {isRunning ? (
                    <button className={styles.btnPause} onClick={pauseTimer}>
                      Pause
                    </button>
                  ) : (
                    <button className={styles.btnStart} onClick={startTimer}>
                      {secondsElapsed > 0 ? 'Resume' : 'Start Focus'}
                    </button>
                  )}
                  <button className={styles.btnReset} onClick={resetTimer}>
                    Reset
                  </button>
                  <button
                    className={styles.btnFinish}
                    onClick={() => setFinishModalOpen(true)}
                  >
                    Finish
                  </button>
                </div>
              )}

              {/* Zen Mode Inline Distraction Parking Lot */}
              {isZenMode && (
                <div className={styles.zenInlinePark}>
                  <form onSubmit={handleParkDistraction} className={styles.zenInlineParkForm}>
                    <input
                      type="text"
                      value={parkingLotInput}
                      onChange={(e) => setParkingLotInput(e.target.value)}
                      placeholder="Park a distracting thought... ↵"
                      className={styles.zenInlineParkInput}
                    />
                    <button type="submit" className={styles.zenInlineParkBtn}>
                      Park
                    </button>
                  </form>
                  {parkedNotice && (
                    <span className={styles.zenInlineParkNotice}>Saved to Brain Dump!</span>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Sidebar: Sticky Focus Timer, Controls, Parking Lot & Ambient Soundscapes */}
        {!isZenMode && (
          activeDoc && focusViewMode === 'book' ? (
            /* ── Unified Minimalist Focus Companion (Calendar-style Today Box) ── */
            <aside className={styles.bookSidePanel} aria-label="Reading focus companion">
              {/* Header: Title & Status */}
              <div className={styles.bookSideHeader}>
                <div className={styles.bookSideTitleRow}>
                  <span className={styles.bookSideTitle}>Focus Session</span>
                  <span className={isRunning ? styles.bookSideBadgeActive : styles.bookSideBadgeReady}>
                    {isRunning && <span className={styles.bookSideStatusDot} />}
                    {isRunning ? 'Active' : 'Ready'}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.bookSideZenBtn}
                  onClick={toggleZenMode}
                  title="Toggle Zen Mode (Distraction-Free)"
                >
                  Zen
                </button>
              </div>

              {/* Single-row Mode Segmented Control: 4 segments, no wrap */}
              <div className={styles.bookSegmentedTabs}>
                <button
                  type="button"
                  className={`${styles.bookSegmentTab} ${mode === 'pomodoro' ? styles.bookSegmentTabActive : ''}`}
                  onClick={() => setTimerMode('pomodoro')}
                >
                  Pomodoro
                </button>
                <button
                  type="button"
                  className={`${styles.bookSegmentTab} ${mode === 'short_break' ? styles.bookSegmentTabActive : ''}`}
                  onClick={() => setTimerMode('short_break')}
                >
                  Short
                </button>
                <button
                  type="button"
                  className={`${styles.bookSegmentTab} ${mode === 'long_break' ? styles.bookSegmentTabActive : ''}`}
                  onClick={() => setTimerMode('long_break')}
                >
                  Long
                </button>
                <button
                  type="button"
                  className={`${styles.bookSegmentTab} ${mode === 'flow' ? styles.bookSegmentTabActive : ''}`}
                  onClick={() => setTimerMode('flow')}
                >
                  Flow
                </button>
              </div>

              {/* Minimalist Formal Timer Card */}
              <div className={styles.bookTimerCard}>
                <div className={styles.bookTimerDigits}>
                  {mode === 'flow'
                    ? formatTimer(secondsElapsed)
                    : formatTimer(secondsRemaining)}
                </div>
                <div className={styles.bookTimerMetaRow}>
                  <span>{mode === 'flow' ? 'Flow Session' : `${mode === 'pomodoro' ? (isDocVideoLesson(activeDoc) ? '25 Min Lesson' : '25 Min Focus') : 'Break Time'}`}</span>
                  <span>•</span>
                  <span>{formatTimer(secondsElapsed)} spent</span>
                </div>
                <div className={styles.bookTimerProgressTrack}>
                  <div
                    className={styles.bookTimerProgressFill}
                    style={{
                      width: mode === 'flow'
                        ? `${Math.min(100, (secondsElapsed / 1500) * 100)}%`
                        : `${timerDurationSeconds > 0 ? Math.min(100, Math.max(0, ((timerDurationSeconds - secondsRemaining) / timerDurationSeconds) * 100)) : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Session Controls — minimalist, text-only */}
              <div className={styles.bookActionCol}>
                {isRunning ? (
                  <button className={styles.bookBtnPause} onClick={pauseTimer}>
                    Pause
                  </button>
                ) : (
                  <button className={styles.bookBtnStart} onClick={startTimer}>
                    {secondsElapsed > 0 ? 'Resume' : isDocVideoLesson(activeDoc) ? 'Start Lesson' : 'Start Focus'}
                  </button>
                )}

                <div className={styles.bookUtilityRow}>
                  <button
                    type="button"
                    className={styles.bookUtilityBtn}
                    onClick={resetTimer}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className={styles.bookUtilityBtn}
                    onClick={() => setTaskPickerOpen(true)}
                    title="Switch target"
                  >
                    Switch Target
                  </button>
                  <button
                    type="button"
                    className={`${styles.bookUtilityBtn} ${styles.bookUtilityFinish}`}
                    onClick={() => setFinishModalOpen(true)}
                  >
                    Finish
                  </button>
                </div>
              </div>

              {/* When in Video Lesson, keep sidebar ultra-clean showing ONLY the Focus Session timer box */}
              {!isDocVideoLesson(activeDoc) && (
                <>
                  <div className={styles.bookPanelDivider} />

                  {/* ── Reading & Annotation Tools (Knowledge Focus Only) ── */}
                  <div>
                    <div className={styles.bookReadingHeader}>
                      <div className={styles.bookReadingMeta}>
                        <span className={styles.bookReadingPercent}>{readingScrollPercent}% read</span>
                      </div>
                      <div className={styles.bookReadingToolsRight}>
                        <button
                          type="button"
                          className={`${styles.bookSaveBtn} ${showSaveToast ? styles.bookSaveBtnSuccess : ''}`}
                          onClick={handleManualSave}
                          title="Save highlights to Study & Books"
                        >
                          <span>{showSaveToast ? 'Saved' : 'Save'}</span>
                        </button>
                        <Link
                          href="/knowledge"
                          className={styles.bookExtLink}
                          title="Open in Study & Books"
                        >
                          Study &amp; Books
                        </Link>
                      </div>
                    </div>

                    {/* Thin Reading Progress Track */}
                    <div className={styles.bookReadingTrack} title={`Reading progress: ${readingScrollPercent}%`}>
                      <div
                        className={styles.bookReadingFill}
                        style={{ width: `${readingScrollPercent}%` }}
                      />
                    </div>

                    {/* Annotate Mode Switch: Highlight vs Font Color */}
                    <div className={styles.annotateModeSwitch}>
                      <button
                        type="button"
                        className={`${styles.annotateModeBtn} ${annotationMode === 'highlight' ? styles.annotateModeBtnActive : ''}`}
                        onClick={() => setAnnotationMode('highlight')}
                      >
                        Highlight (BG)
                      </button>
                      <button
                        type="button"
                        className={`${styles.annotateModeBtn} ${annotationMode === 'fontColor' ? styles.annotateModeBtnActive : ''}`}
                        onClick={() => setAnnotationMode('fontColor')}
                      >
                        Font Color (Text)
                      </button>
                    </div>

                    {annotationMode === 'highlight' ? (
                      /* Highlighter Color Palette & Quick Eraser */
                      <div className={styles.bookHighlighterRow}>
                        <span className={styles.bookHighlighterLabel}>Highlight</span>
                        <div className={styles.bookSwatchGroup}>
                          {HIGHLIGHT_COLORS.map((c) => (
                            <button
                              key={c.name}
                              type="button"
                              className={`${styles.bookSwatchDot} ${activeHighlightColor === c.name ? styles.bookSwatchDotActive : ''}`}
                              style={{
                                backgroundColor: c.border,
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleHighlightInFocus(c.name)}
                              title={`Select ${c.label} highlighter`}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          className={styles.bookEraserBtn}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleRemoveHighlightInFocus()}
                          title="Clear highlight from selected text"
                        >
                          <Eraser size={12} />
                        </button>
                      </div>
                    ) : (
                      /* Font Color Palette & Reset */
                      <div className={styles.bookHighlighterRow}>
                        <span className={styles.bookHighlighterLabel}>Text Color</span>
                        <div className={styles.bookSwatchGroup}>
                          {FONT_COLORS.map((fc) => (
                            <button
                              key={fc.name}
                              type="button"
                              className={`${styles.bookSwatchDot} ${activeFontColor === fc.color ? styles.bookSwatchDotActive : ''}`}
                              style={{
                                backgroundColor: fc.color === 'inherit' ? 'var(--color-surface-2)' : fc.color,
                                borderColor: fc.border,
                                color: fc.name === 'white' ? '#0f172a' : fc.color === 'inherit' ? 'var(--color-text)' : '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '9px',
                                fontWeight: 700,
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleFontColorInFocus(fc.color)}
                              title={`Font Color: ${fc.label}`}
                            >
                              A
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className={styles.bookEraserBtn}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleFontColorInFocus('inherit')}
                          title="Reset font color to default"
                        >
                          <RotateCcw size={11} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className={styles.bookPanelDivider} />

                  {/* ── Today's Progress ── */}
                  {todayProgressList.length > 0 && (
                    <div>
                      <div className={styles.bookSectionTitle}>
                        Today&rsquo;s Focus
                        <span className={styles.todayTotalBadge}>{fmtMin(todayTotalMinutes)}</span>
                      </div>
                      <div className={styles.todayList}>
                        {todayProgressList.map((entry) => (
                          <div key={entry.title} className={styles.todayEntry}>
                            <span className={styles.todayEntryTitle} title={entry.title}>
                              {entry.title.replace(/^Reading:\s*/i, '')}
                            </span>
                            <span className={styles.todayEntryTime}>{fmtMin(entry.minutes)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={styles.bookPanelDivider} />

                  {/* ADHD Distraction Quick-Park (Inline, minimal) */}
                  <div>
                    <div className={styles.bookSectionTitle}>Distraction Parking</div>
                    <form onSubmit={handleParkDistraction} className={styles.bookInlineParkForm}>
                      <input
                        type="text"
                        value={parkingLotInput}
                        onChange={(e) => setParkingLotInput(e.target.value)}
                        placeholder="Park a quick thought... ↵"
                        className={styles.bookInlineParkInput}
                      />
                      <button type="submit" className={styles.bookInlineParkBtn} title="Save to parking lot">
                        Park
                      </button>
                    </form>
                    {parkedNotice && (
                      <p className={styles.bookParkSuccessText}>
                        Saved to Brain Dump!
                      </p>
                    )}
                  </div>

                  <div className={styles.bookPanelDivider} />

                  {/* Ambient Soundscapes (Compact Selector) */}
                  <div>
                    <div className={styles.bookAmbientHeader}>
                      <span className={styles.bookSectionTitle}>Ambient Sound</span>
                      {ambientSound !== 'off' && (
                        <button
                          type="button"
                          className={styles.bookAmbientMute}
                          onClick={() => handleAmbientToggle('off')}
                          title="Stop soundscape"
                        >
                          <VolumeX size={11} />
                          <span>Mute</span>
                        </button>
                      )}
                    </div>

                    <div className={styles.bookAmbientControlRow}>
                      <select
                        value={ambientSound}
                        onChange={(e) => handleAmbientToggle(e.target.value as any)}
                        className={styles.bookAmbientSelect}
                        aria-label="Ambient sound"
                      >
                        <option value="off">Off (Silent Focus)</option>
                        {SOUNDSCAPES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.icon} {s.title} ({s.subtitle})
                          </option>
                        ))}
                      </select>

                      {ambientSound !== 'off' && (
                        <div className={styles.bookAmbientVolWrap}>
                          <Volume2 size={12} className={styles.bookAmbientVolIcon} />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={ambientVol}
                            onChange={handleVolumeChange}
                            className={styles.bookAmbientSlider}
                            title={`Volume: ${Math.round(ambientVol * 100)}%`}
                          />
                          <span className={styles.bookAmbientVolText}>{Math.round(ambientVol * 100)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </aside>
          ) : (
            /* ── Standard Timer View Right Sidebar ── */
            <aside className={styles.sideSection}>
              <div className={styles.sideCard}>
                <div className={styles.sideCardHeader}>
                  <span className={styles.sideCardTitle}>Session Controls</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {isRunning ? (
                    <button className={styles.sideBtnPause} onClick={pauseTimer}>
                      Pause
                    </button>
                  ) : (
                    <button className={styles.sideBtnStart} onClick={startTimer}>
                      {secondsElapsed > 0 ? 'Resume' : 'Start Focus'}
                    </button>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <button className={styles.sideActionBtn} onClick={resetTimer}>
                      Reset
                    </button>
                    <button
                      className={styles.sideActionBtn}
                      onClick={() => setTaskPickerOpen(true)}
                      title="Switch target"
                    >
                      Switch Target
                    </button>
                  </div>

                  <button
                    className={styles.sideBtnFinish}
                    onClick={() => setFinishModalOpen(true)}
                  >
                    Finish & Log
                  </button>
                </div>
              </div>

              {/* ── Today's Progress ── */}
              {todayProgressList.length > 0 && (
                <div className={styles.sideCard}>
                  <div className={styles.sideCardHeader}>
                    <span className={styles.sideCardTitle}>Today&rsquo;s Focus</span>
                    <span className={styles.todayTotalBadge}>{fmtMin(todayTotalMinutes)}</span>
                  </div>
                  <div className={styles.todayList}>
                    {todayProgressList.map((entry) => (
                      <div key={entry.title} className={styles.todayEntry}>
                        <span className={styles.todayEntryTitle} title={entry.title}>
                          {entry.title.replace(/^Reading:\s*/i, '')}
                        </span>
                        <span className={styles.todayEntryTime}>{fmtMin(entry.minutes)}</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.todayBar}>
                    <div
                      className={styles.todayBarFill}
                      style={{ width: `${Math.min(100, (todayTotalMinutes / 120) * 100)}%` }}
                    />
                  </div>
                  <p className={styles.todayBarLabel}>
                    {fmtMin(todayTotalMinutes)} of 2h goal
                  </p>
                </div>
              )}

              {/* Distraction Parking Lot */}
              <div className={styles.sideCard}>
                <div className={styles.sideCardHeader}>
                  <span className={styles.sideCardTitle}>
                    Distraction Parking Lot
                  </span>
                </div>

                <form onSubmit={handleParkDistraction} className={styles.sideParkingLotForm}>
                  <input
                    type="text"
                    value={parkingLotInput}
                    onChange={(e) => setParkingLotInput(e.target.value)}
                    placeholder="Random thought? Park it here..."
                    className={styles.sideParkingLotInput}
                  />
                  <button type="submit" className={styles.sideBtnParkSubmit}>
                    Park ↵
                  </button>
                </form>

                {parkedNotice && (
                  <p style={{ fontSize: '11px', color: 'var(--color-success)', margin: '6px 0 0 0', fontWeight: 600 }}>
                    Saved to Brain Dump! Back to focusing!
                  </p>
                )}
              </div>

              {/* Ambient Soundscapes */}
              <div className={styles.sideCard} data-tour="focus-audio">
                <div
                  className={`${styles.sideCardHeader} ${styles.collapsibleHeader} ${!ambientExpanded ? styles.sideCardHeaderCollapsed : ''}`}
                  onClick={toggleAmbientExpanded}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleAmbientExpanded();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={ambientExpanded}
                  aria-label="Toggle Ambient Soundscapes"
                >
                  <div className={styles.sideCardTitleGroup}>
                    <span className={styles.sideCardTitle}>
                      Ambient Soundscapes
                    </span>
                    {ambientSound !== 'off' && (
                      <span className={styles.ambientActiveBadge}>
                        <span className={styles.audioWaveDot} />
                        Playing
                      </span>
                    )}
                  </div>
                  <div className={styles.sideCardHeaderActions}>
                    {ambientSound !== 'off' && (
                      <button
                        type="button"
                        className={styles.ambientMuteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAmbientToggle('off');
                        }}
                        title="Stop ambient audio"
                      >
                        <VolumeX size={12} />
                        <span>Stop</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.collapseToggleBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAmbientExpanded();
                      }}
                      aria-label={ambientExpanded ? 'Collapse Ambient Soundscapes' : 'Expand Ambient Soundscapes'}
                      title={ambientExpanded ? 'Collapse' : 'Expand'}
                    >
                      {ambientExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {ambientExpanded && (
                  <>
                    <div className={styles.ambientBtnGrid}>
                      {SOUNDSCAPES.map((s) => {
                        const isActive = ambientSound === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`${styles.ambientPill} ${isActive ? styles.activeAmbient : ''}`}
                            onClick={() => handleAmbientToggle(s.id)}
                            title={`${s.title} (${s.subtitle})`}
                          >
                            <span className={styles.ambientIcon}>{s.icon}</span>
                            <div className={styles.ambientTextCol}>
                              <span className={styles.ambientTitle}>{s.title}</span>
                              <span className={styles.ambientSubtitle}>{s.subtitle}</span>
                            </div>
                            {isActive && (
                              <span className={styles.ambientEqualizer}>
                                <span className={styles.eqBar} style={{ animationDelay: '0ms' }} />
                                <span className={styles.eqBar} style={{ animationDelay: '180ms' }} />
                                <span className={styles.eqBar} style={{ animationDelay: '360ms' }} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {ambientSound !== 'off' && (
                      <div className={styles.ambientVolBar}>
                        <Volume2 size={13} className={styles.ambientVolIcon} />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={ambientVol}
                          onChange={handleVolumeChange}
                          className={styles.ambientSlider}
                          title="Ambient Sound Volume"
                        />
                        <span className={styles.ambientVolLabel}>{Math.round(ambientVol * 100)}%</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </aside>
          )
        )}
      </div>

      {/* ── Modal: Target Picker (Tasks & Knowledge Books) ── */}
      {taskPickerOpen && (
        <div className={styles.modalOverlay} onClick={() => setTaskPickerOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Select Focus Target
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setTaskPickerOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs: Tasks vs Books vs Video Lessons */}
            <div className={styles.targetTabGroup}>
              <button
                type="button"
                className={`${styles.targetTab} ${targetTab === 'tasks' ? styles.targetTabActive : ''}`}
                onClick={() => setTargetTab('tasks')}
              >
                Tasks ({filteredTasks.length})
              </button>
              <button
                type="button"
                className={`${styles.targetTab} ${targetTab === 'knowledge' ? styles.targetTabActive : ''}`}
                onClick={() => setTargetTab('knowledge')}
              >
                <BookOpen size={12} />
                <span>Books ({bookDocs.length})</span>
              </button>
              <button
                type="button"
                className={`${styles.targetTab} ${targetTab === 'videos' ? styles.targetTabActive : ''}`}
                onClick={() => setTargetTab('videos')}
              >
                <Video size={12} />
                <span>Video Lessons ({videoDocs.length})</span>
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder={targetTab === 'tasks' ? 'Search tasks...' : targetTab === 'videos' ? 'Search video lessons...' : 'Search books, notes, documents...'}
                value={targetSearchQuery}
                onChange={(e) => setTargetSearchQuery(e.target.value)}
                className={styles.targetSearchInput}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
              {targetTab === 'videos' ? (
                <>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      marginBottom: '4px',
                      fontSize: '12px',
                      padding: '8px',
                      background: 'rgba(105, 98, 244, 0.1)',
                      border: '1px solid var(--color-accent-light, #6962f4)',
                      color: 'var(--color-text)',
                    }}
                    onClick={() => setVideoModalOpen(true)}
                  >
                    <Video size={14} style={{ color: 'var(--color-accent-light)' }} /> + Add New Video Lesson Target
                  </button>
                  {videoDocs.length > 0 ? (
                    videoDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className={`${styles.knowledgeTargetItem} ${activeDoc?.id === doc.id ? styles.knowledgeTargetActive : ''}`}
                        onClick={() => {
                          selectFocusDoc(doc);
                          setFocusViewMode('book');
                          setTaskPickerOpen(false);
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Video size={14} style={{ color: 'var(--color-accent-light)' }} />
                            {doc.isPinned && <Pin size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />}
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                              {doc.title}
                            </span>
                          </div>
                          {doc.tags && doc.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                              {doc.tags.map((t) => (
                                <span key={t} style={{ fontSize: '10px', color: 'var(--color-text-faint)', background: 'var(--color-surface)', padding: '1px 6px', borderRadius: '4px' }}>
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button className={styles.btnReset} style={{ padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          Select Lesson
                        </button>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', textAlign: 'center', padding: '16px 0' }}>
                      No video lessons found. Click above to add one!
                    </p>
                  )}
                </>
              ) : targetTab === 'tasks' ? (
                filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--color-surface-2)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-lg)',
                        cursor: 'pointer',
                        border: activeTask?.id === task.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                      }}
                      onClick={() => {
                        selectFocusTask(task);
                        setFocusViewMode('timer');
                        setTaskPickerOpen(false);
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
                          {task.title}
                        </span>
                        {task.estimatedDuration && (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginLeft: '6px' }}>
                            • {task.estimatedDuration}m
                          </span>
                        )}
                      </div>
                      <button className={styles.btnReset} style={{ padding: '2px 8px', fontSize: '11px' }}>
                        Select Task
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', textAlign: 'center', padding: '16px 0' }}>
                    No pending tasks found.
                  </p>
                )
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px', fontSize: '12px', padding: '8px', background: 'rgba(124, 106, 255, 0.1)', border: '1px solid var(--color-accent)' }}
                    onClick={() => {
                      const newDoc = addDoc({
                        title: 'Focus Note — ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        content: '# Focus Note\n\nStart typing your focus notes and thoughts here...',
                        status: 'active',
                        category: 'learning',
                        tags: ['focus-note'],
                      });
                      selectFocusDoc(newDoc);
                      setFocusViewMode('book');
                      setTaskPickerOpen(false);
                    }}
                  >
                    <Plus size={14} style={{ color: 'var(--color-accent-light)' }} /> + Create New Note / Book Target
                  </button>
                  {bookDocs.length > 0 ? (
                    bookDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className={`${styles.knowledgeTargetItem} ${activeDoc?.id === doc.id ? styles.knowledgeTargetActive : ''}`}
                        onClick={() => {
                          selectFocusDoc(doc);
                          setFocusViewMode('book');
                          setTaskPickerOpen(false);
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BookOpen size={14} style={{ color: 'var(--color-accent)' }} />
                            {doc.isPinned && <Pin size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />}
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                              {doc.title}
                            </span>
                          </div>
                          {doc.tags && doc.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                              {doc.tags.map((t) => (
                                <span key={t} style={{ fontSize: '10px', color: 'var(--color-text-faint)', background: 'var(--color-surface)', padding: '1px 6px', borderRadius: '4px' }}>
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button className={styles.btnReset} style={{ padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          Select Book Target
                        </button>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', textAlign: 'center', padding: '16px 0' }}>
                      No book documents found.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Finish Session ── */}
      {finishModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setFinishModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Finish Focus Session
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setFinishModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
              Log {Math.max(1, Math.round(secondsElapsed / 60))} minutes of deep focus to {activeDoc ? `Reading: "${activeDoc.title}"` : activeTask ? `"${activeTask.title}"` : customTaskTitle}.
            </p>

            <form onSubmit={handleFinishSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                  Session Notes (Optional)
                </label>
                <textarea
                  value={finishNotes}
                  onChange={(e) => setFinishNotes(e.target.value)}
                  placeholder={activeDoc ? "What key insights or ideas did you highlight?" : "What did you accomplish during this focus block?"}
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3)',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-xs)',
                    minHeight: '80px',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>

              {liveActiveTask && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--color-text)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={markDoneOnFinish}
                    onChange={(e) => setMarkDoneOnFinish(e.target.checked)}
                  />
                  <span>Mark task &ldquo;{liveActiveTask.title}&rdquo; as completed (Done)</span>
                </label>
              )}

              {activeDoc && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--color-text)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={markDoneOnFinish}
                    onChange={(e) => setMarkDoneOnFinish(e.target.checked)}
                  />
                  <span>Mark book &ldquo;{activeDoc.title}&rdquo; as finished (Read)</span>
                </label>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: 'var(--space-2)' }}>
                <button type="button" className={styles.btnReset} onClick={() => setFinishModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnFinish}>
                  Save & Log Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Mouse Selection Toolbar in Focus Book Mode */}
      {floatingMenu && activeDoc && (
        <div
          className={styles.floatingHighlightMenu}
          style={{ left: `${floatingMenu.x}px`, top: `${floatingMenu.y}px` }}
        >
          {/* Highlight BG Swatches */}
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              className={styles.floatingSwatch}
              style={{
                background: c.bg,
                borderColor: c.border,
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                handleHighlightInFocus(c.name, floatingMenu.targetMark);
                setFloatingMenu(null);
              }}
              title={`Highlight in ${c.label}`}
            />
          ))}

          <div className={styles.floatingDivider} />

          {/* Font Color Swatches */}
          {FONT_COLORS.slice(1, 8).map((fc) => (
            <button
              key={fc.name}
              type="button"
              className={styles.floatingFontSwatch}
              style={{
                backgroundColor: fc.color,
                borderColor: fc.border,
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                handleFontColorInFocus(fc.color, floatingMenu.targetMark);
                setFloatingMenu(null);
              }}
              title={`Font Color: ${fc.label}`}
            >
              A
            </button>
          ))}

          <div className={styles.floatingDivider} />

          <button
            type="button"
            className={styles.floatingEraserBtn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              handleRemoveHighlightInFocus(floatingMenu.targetMark);
            }}
            title="Remove Highlight (Clear)"
          >
            <Eraser size={12} />
          </button>
        </div>
      )}

      {/* Modal: Add New Video Lesson Target directly in Focus Space */}
      <AddVideoLessonModal
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        mode="create"
        onInsert={({ videoId, url, title, startTime }) => {
          const lessonTitle = title.trim() || 'Video Lesson';
          const blockHtml = generateVideoBlockHtml({
            videoId,
            url,
            title: lessonTitle,
            startTime,
            isEditMode: false,
          });
          const newDoc = addDoc({
            title: lessonTitle,
            content: `${blockHtml}\n\n## Practice & Study Notes\n- Key chords, tabs, and insights...\n`,
            status: 'active',
            category: 'learning',
            tags: ['video-lesson'],
            docType: 'video-lesson',
            isPinned: false,
            readStatus: 'reading',
            readProgress: 0,
          });
          selectFocusDoc(newDoc);
          setFocusViewMode('book');
          setTaskPickerOpen(false);
          setVideoModalOpen(false);
        }}
      />
    </div>
  );
}
