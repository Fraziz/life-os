'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import styles from './AppShell.module.css';
import { NAV_SECTIONS } from '@/config/navigation';
import { SettingsProvider } from '@/context/SettingsContext';
import { LifeAreaProvider } from '@/context/LifeAreaContext';
import { DreamProvider } from '@/context/DreamContext';
import { GoalProvider } from '@/context/GoalContext';
import { MilestoneProvider } from '@/context/MilestoneContext';
import { ProjectProvider } from '@/context/ProjectContext';
import { TaskProvider } from '@/context/TaskContext';
import { TodayPlanProvider } from '@/context/TodayPlanContext';
import { FocusProvider } from '@/context/FocusContext';
import { InboxProvider } from '@/context/InboxContext';
import { CalendarProvider } from '@/context/CalendarContext';
import { HabitProvider } from '@/context/HabitContext';
import { ReviewProvider } from '@/context/ReviewContext';
import { KnowledgeProvider } from '@/context/KnowledgeContext';
import { QuickNotesProvider } from '@/context/QuickNotesContext';
import { ReminderProvider, useReminders } from '@/context/ReminderContext';
import { SearchProvider, useSearch } from '@/context/SearchContext';
import SearchModal from '@/components/search/SearchModal';
import ReminderDrawer from '@/components/reminders/ReminderDrawer';
import AssistantModal from '@/components/assistant/AssistantModal';
import NextActionModal from '@/components/assistant/NextActionModal';
import AIAssistantPanel from '@/components/assistant/AIAssistantPanel';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import KeyboardShortcutsModal from '@/components/ui/KeyboardShortcutsModal';
import CommandPalette from '@/components/command/CommandPalette';
import { initFirebaseAnalytics } from '@/lib/firebase';
import { AuthProvider } from '@/context/AuthContext';
import AuthGate from '@/components/auth/AuthGate';
import { PanelLeft, Bot } from 'lucide-react';

/**
 * Derives a human-readable page title from the current pathname.
 * Used by the mobile TopBar.
 */
function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Today';
  const allItems = NAV_SECTIONS.flatMap((s) => s.items);
  const match = allItems.find((item) =>
    item.href !== '/' && pathname.startsWith(item.href)
  );
  return match?.label ?? 'Life OS';
}

/** Wraps shell content to access Search and Reminders Context */
function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isOpen, openSearch } = useSearch();

  // Desktop: collapsed state — persisted across sessions
  const [collapsed, setCollapsed] = useState(false);

  // Mobile: drawer open state — reset on navigation
  const [mobileOpen, setMobileOpen] = useState(false);

  // Modal dialog states
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [nextActionOpen, setNextActionOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Restore persisted sidebar preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('life_os_sidebar_collapsed');
      if (saved !== null) {
        setCollapsed(saved === 'true');
      }
    } catch {
      // localStorage unavailable (SSR/private mode)
    }
  }, []);

  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);

  // Listen for custom trigger events from anywhere in the app
  useEffect(() => {
    const handleOpenNextAction = () => setNextActionOpen(true);
    const handleOpenAssistant = () => setAssistantOpen(true);
    const handleOpenReminders = () => setRemindersOpen(true);
    const handleToggleSidebar = () => {
      setCollapsed(prev => {
        const next = !prev;
        try { localStorage.setItem('life_os_sidebar_collapsed', String(next)); } catch {}
        return next;
      });
    };

    window.addEventListener('open-next-action', handleOpenNextAction);
    window.addEventListener('open-assistant', handleOpenAssistant);
    window.addEventListener('open-reminders', handleOpenReminders);
    window.addEventListener('toggle-sidebar', handleToggleSidebar);

    return () => {
      window.removeEventListener('open-next-action', handleOpenNextAction);
      window.removeEventListener('open-assistant', handleOpenAssistant);
      window.removeEventListener('open-reminders', handleOpenReminders);
      window.removeEventListener('toggle-sidebar', handleToggleSidebar);
    };
  }, []);

  // Persist when changed
  const handleCollapse = (value: boolean) => {
    setCollapsed(value);
    try {
      localStorage.setItem('life_os_sidebar_collapsed', String(value));
    } catch {
      // ignore
    }
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Global keybindings
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
      // Ctrl+B or Cmd+B → Toggle Sidebar / Hide Navigation
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsed(prev => {
          const next = !prev;
          try { localStorage.setItem('life_os_sidebar_collapsed', String(next)); } catch {}
          return next;
        });
      }
      // Ctrl+K or Cmd+K → open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
      // Ctrl+J or Cmd+J → What Should I Do Right Now?
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        setNextActionOpen(true);
      }
      // Ctrl+L → Open AI Chat Assistant
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        setAiChatOpen(prev => !prev);
      }
      // Shift+? or ? (when not typing in an input) → Shortcuts
      if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, openSearch]);

  // Draggable floating AI bubble state
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number; moved: boolean } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('life_os_ai_bubble_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const maxX = Math.max(10, window.innerWidth - 60);
          const maxY = Math.max(10, window.innerHeight - 60);
          setBubblePos({
            x: Math.min(Math.max(10, parsed.x), maxX),
            y: Math.min(Math.max(10, parsed.y), maxY),
          });
        }
      }
    } catch {}
  }, []);

  const handleBubblePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: rect.left,
      initY: rect.top,
      moved: false,
    };
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleBubblePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > 3) {
      dragRef.current.moved = true;
      setIsDraggingBubble(true);
      const newX = Math.min(Math.max(10, dragRef.current.initX + dx), window.innerWidth - 54);
      const newY = Math.min(Math.max(10, dragRef.current.initY + dy), window.innerHeight - 54);
      setBubblePos({ x: newX, y: newY });
    }
  };

  const handleBubblePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const wasMoved = dragRef.current.moved;
    dragRef.current = null;
    setIsDraggingBubble(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (!wasMoved) {
      setAiChatOpen(prev => !prev);
    } else if (bubblePos) {
      try {
        localStorage.setItem('life_os_ai_bubble_pos', JSON.stringify(bubblePos));
      } catch {}
    }
  };

  const mainClass = [
    styles.main,
    collapsed ? styles.sidebarCollapsed : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className={styles.shell}>
        {collapsed && (
          <button
            type="button"
            onClick={() => handleCollapse(false)}
            className={styles.expandSidebarBtn}
            title="Show navigation (Ctrl+B)"
            aria-label="Show navigation"
          >
            <PanelLeft size={16} />
          </button>
        )}
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCollapse={handleCollapse}
          onMobileClose={() => setMobileOpen(false)}
          onOpenReminders={() => setRemindersOpen(true)}
          onOpenAssistant={() => setAssistantOpen(true)}
          onOpenNextAction={() => setNextActionOpen(true)}
        />

        <div className={mainClass}>
          {/* Mobile-only top bar */}
          <TopBar
            pageTitle={getPageTitle(pathname)}
            onMenuToggle={() => setMobileOpen(true)}
            onOpenReminders={() => setRemindersOpen(true)}
            onOpenNextAction={() => setNextActionOpen(true)}
          />

          <main
            className={`${styles.content} ${pathname === '/roadmap' ? styles.noPadding : ''}`}
            id="main-content"
            tabIndex={-1}
          >
            {children}
          </main>

          {/* Mobile bottom navigation bar */}
          <MobileBottomNav onOpenNextAction={() => setNextActionOpen(true)} />
        </div>
      </div>

      {/* Global Search Modal */}
      {isOpen && <SearchModal />}

      {/* Global Command Palette (Ctrl+K / ⌘K) */}
      <CommandPalette />

      {/* Reminders Drawer */}
      <ReminderDrawer isOpen={remindersOpen} onClose={() => setRemindersOpen(false)} />

      {/* AI Assistant Modal */}
      <AssistantModal isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} />

      {/* "I Don't Know What To Do" Next Action Modal */}
      <NextActionModal isOpen={nextActionOpen} onClose={() => setNextActionOpen(false)} />

      {/* Keyboard Shortcuts Reference */}
      {shortcutsOpen && (
        <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      )}

      {/* AI Chat Assistant Panel */}
      <AIAssistantPanel isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} />

      {/* Movable Minimalist Floating AI Chat Button */}
      <button
        type="button"
        onPointerDown={handleBubblePointerDown}
        onPointerMove={handleBubblePointerMove}
        onPointerUp={handleBubblePointerUp}
        onPointerCancel={handleBubblePointerUp}
        className={`${styles.aiChatBtn} ${isDraggingBubble ? styles.aiChatBtnDragging : ''}`}
        style={
          bubblePos
            ? {
                left: `${bubblePos.x}px`,
                top: `${bubblePos.y}px`,
                right: 'auto',
                bottom: 'auto',
              }
            : undefined
        }
        aria-label="Open AI assistant (Ctrl+L)"
        title="AI Assistant (Click to open, Drag to move)"
        id="ai-chat-float-btn"
      >
        <Bot size={20} strokeWidth={2} />
      </button>
    </>
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * AppShell manages the overall layout state.
 * Provider order matters — all data providers wrap Reminder, Search, and Shell.
 */
function withAppProviders(content: React.ReactNode) {
  return (
    <SettingsProvider>
      <LifeAreaProvider>
        <DreamProvider>
          <GoalProvider>
            <MilestoneProvider>
              <ProjectProvider>
                <TaskProvider>
                  <KnowledgeProvider>
                    <TodayPlanProvider>
                      <FocusProvider>
                        <InboxProvider>
                          <CalendarProvider>
                            <HabitProvider>
                              <ReviewProvider>
                                <QuickNotesProvider>
                                  <ReminderProvider>
                                    <SearchProvider>
                                      <ShellContent>
                                        {content}
                                      </ShellContent>
                                    </SearchProvider>
                                  </ReminderProvider>
                                </QuickNotesProvider>
                              </ReviewProvider>
                            </HabitProvider>
                          </CalendarProvider>
                        </InboxProvider>
                      </FocusProvider>
                    </TodayPlanProvider>
                  </KnowledgeProvider>
                </TaskProvider>
              </ProjectProvider>
            </MilestoneProvider>
          </GoalProvider>
        </DreamProvider>
      </LifeAreaProvider>
    </SettingsProvider>
  );
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <AuthProvider>
      <AuthGate shell={withAppProviders}>{children}</AuthGate>
    </AuthProvider>
  );
}
