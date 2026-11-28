'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import styles from './AppShell.module.css';
import { NAV_SECTIONS } from '@/config/navigation';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
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
import { StudySessionProvider } from '@/context/StudySessionContext';
import { QuickNotesProvider } from '@/context/QuickNotesContext';
import { ReminderProvider, useReminders } from '@/context/ReminderContext';
import { SearchProvider, useSearch } from '@/context/SearchContext';
import { UndoProvider } from '@/context/UndoContext';
import { TourProvider } from '@/context/TourContext';
import { ConfirmProvider } from '@/context/ConfirmContext';
const TourOverlay = dynamic(() => import('@/components/tour/TourOverlay'), { ssr: false });
const TourWelcomeModal = dynamic(() => import('@/components/tour/TourWelcomeModal'), { ssr: false });
const TourCompletionModal = dynamic(() => import('@/components/tour/TourCompletionModal'), { ssr: false });
const SearchModal = dynamic(() => import('@/components/search/SearchModal'), { ssr: false });
const ReminderDrawer = dynamic(() => import('@/components/reminders/ReminderDrawer'), { ssr: false });
const NextActionModal = dynamic(() => import('@/components/assistant/NextActionModal'), { ssr: false });
const AIAssistantPanel = dynamic(() => import('@/components/assistant/AIAssistantPanel'), { ssr: false });
const MobileBottomNav = dynamic(() => import('@/components/layout/MobileBottomNav'), { ssr: false });
const KeyboardShortcutsModal = dynamic(() => import('@/components/ui/KeyboardShortcutsModal'), { ssr: false });
const CommandPalette = dynamic(() => import('@/components/command/CommandPalette'), { ssr: false });
const GrammarAssist = dynamic(() => import('@/components/ui/GrammarAssist'), { ssr: false });
const GlobalLinkPreview = dynamic(() => import('@/components/ui/GlobalLinkPreview'), { ssr: false });
import HierarchyProgressSync from './HierarchyProgressSync';
import { initFirebaseAnalytics } from '@/lib/firebase';
import { DEFAULT_SYSTEM_CONFIG, subscribeSystemConfig, type SystemConfig } from '@/lib/systemConfig';
import { AuthProvider } from '@/context/AuthContext';
import AuthGate from '@/components/auth/AuthGate';
import { PanelLeft, Bot } from 'lucide-react';
import { useArrowKeyScroll } from '@/utils/useArrowKeyScroll';
import { useGlobalLinkDetector } from '@/utils/useGlobalLinkDetector';

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
  return match?.label ?? 'Sariling Mundo';
}

/** Wraps shell content to access Search and Reminders Context */
function ShellContent({ children }: { children: React.ReactNode }) {
  // Support natural arrow key scrolling across any scrollable container in the app
  useArrowKeyScroll();

  // Support auto-clickable links everywhere across the entire system
  useGlobalLinkDetector();

  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, openSearch } = useSearch();
  const { unreadCount } = useReminders();
  const { settings } = useSettings();

  // Desktop: pinned state — when true, sidebar is locked open at 248px.
  // When false (default), sidebar is in Instagram PC hover rail mode (72px).
  const [isPinned, setIsPinned] = useState(false);

  // Mobile: drawer open state — reset on navigation
  const [mobileOpen, setMobileOpen] = useState(false);

  // Modal dialog states
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [nextActionOpen, setNextActionOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    return subscribeSystemConfig((cfg) => {
      setSystemConfig(cfg);
      setBannerDismissed(false);
    });
  }, []);

  // Restore persisted sidebar preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('life_os_sidebar_pinned');
      if (saved !== null) {
        setIsPinned(saved === 'true');
      }
    } catch {
      // localStorage unavailable (SSR/private mode)
    }
  }, []);

  // Expand sidebar during tour if targeting sidebar items on desktop
  useEffect(() => {
    const handleTourSidebar = (e: Event) => {
      const customEvent = e as CustomEvent<{ expand: boolean }>;
      if (window.innerWidth >= 1024 && customEvent.detail?.expand) {
        setIsPinned(true);
      }
    };
    window.addEventListener('tour-expand-sidebar', handleTourSidebar);
    return () => {
      window.removeEventListener('tour-expand-sidebar', handleTourSidebar);
    };
  }, []);

  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);

  // Safe window.confirm guard against aggressive browser locker extensions (e.g. Breaking Browser Locker Behavior)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalConfirm = window.confirm;
    window.confirm = function (message?: string) {
      try {
        return originalConfirm.call(window, message);
      } catch (err: unknown) {
        console.warn('Browser extension prevented native confirm(); safely proceeding.', err);
        return true;
      }
    };
    return () => {
      window.confirm = originalConfirm;
    };
  }, []);

  // Listen for custom trigger events from anywhere in the app
  useEffect(() => {
    const handleOpenNextAction = () => setNextActionOpen(true);
    const handleOpenAiChat = () => setAiChatOpen(true);
    const handleOpenReminders = () => setRemindersOpen(true);
    const handleToggleSidebar = () => {
      setIsPinned(prev => {
        const next = !prev;
        try { localStorage.setItem('life_os_sidebar_pinned', String(next)); } catch {}
        return next;
      });
    };

    window.addEventListener('open-next-action', handleOpenNextAction);
    window.addEventListener('open-ai-chat', handleOpenAiChat);
    window.addEventListener('open-reminders', handleOpenReminders);
    window.addEventListener('toggle-sidebar', handleToggleSidebar);

    return () => {
      window.removeEventListener('open-next-action', handleOpenNextAction);
      window.removeEventListener('open-ai-chat', handleOpenAiChat);
      window.removeEventListener('open-reminders', handleOpenReminders);
      window.removeEventListener('toggle-sidebar', handleToggleSidebar);
    };
  }, []);

  // Persist when changed
  const handlePinToggle = (value: boolean) => {
    setIsPinned(value);
    try {
      localStorage.setItem('life_os_sidebar_pinned', String(value));
    } catch {
      // ignore
    }
  };

  // Close mobile drawer and maintain browser tab title on route change
  useEffect(() => {
    setMobileOpen(false);
    if (typeof document !== 'undefined') {
      document.title = 'Sariling Mundo';
    }
  }, [pathname]);

  // Global keybindings
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isInput =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) ||
        (e.target as HTMLElement)?.isContentEditable;

      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
      // Ctrl+B or Cmd+B → Toggle Sidebar Pinning
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsPinned(prev => {
          const next = !prev;
          try { localStorage.setItem('life_os_sidebar_pinned', String(next)); } catch {}
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
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShortcutsOpen(true);
      }

      // Alt+key quick navigation across website modules (when not typing)
      if (e.altKey && !e.ctrlKey && !e.metaKey && !isInput) {
        const k = e.key.toLowerCase();
        if (k === 'i') {
          e.preventDefault();
          router.push('/inbox'); // Idea Parking
        } else if (k === 'g') {
          e.preventDefault();
          router.push('/goals'); // Goals
        } else if (k === 'p') {
          e.preventDefault();
          router.push('/projects'); // Projects
        } else if (k === 't') {
          e.preventDefault();
          router.push('/tasks'); // Tasks
        } else if (k === 'f') {
          e.preventDefault();
          router.push('/focus'); // Focus Space
        } else if (k === 'r') {
          e.preventDefault();
          router.push('/review'); // Weekly Review
        } else if (k === 'y') {
          e.preventDefault();
          router.push('/'); // Today Dashboard
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, openSearch, router]);

  // Synchronize browser tab logo (favicon) with active brand/workspace logo in real time
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const faviconHref = settings?.customLogoUrl || '/logo.png?v=3';
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconHref;
    if (faviconHref.includes('.svg')) {
      link.type = 'image/svg+xml';
    } else if (faviconHref.startsWith('data:image/png') || faviconHref.includes('.png')) {
      link.type = 'image/png';
    } else if (faviconHref.startsWith('data:image/jpeg') || faviconHref.includes('.jpg')) {
      link.type = 'image/jpeg';
    }
  }, [settings?.customLogoUrl]);

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
          // If previous position was stuck in the middle of reading text, reset to safe edge
          const isMiddleOfScreen = parsed.x > 80 && parsed.x < (window.innerWidth - 80);
          if (isMiddleOfScreen) {
            setBubblePos(null);
            localStorage.removeItem('life_os_ai_bubble_pos');
          } else {
            const maxX = Math.max(10, window.innerWidth - 60);
            const maxY = Math.max(10, window.innerHeight - 60);
            setBubblePos({
              x: Math.min(Math.max(10, parsed.x), maxX),
              y: Math.min(Math.max(10, parsed.y), maxY),
            });
          }
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
    if (Math.hypot(dx, dy) > 8) {
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
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const initX = dragRef.current.initX;
    const initY = dragRef.current.initY;
    dragRef.current = null;
    setIsDraggingBubble(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (!wasMoved) {
      setAiChatOpen(prev => !prev);
    } else {
      // Snap automatically to the nearest screen edge so it never hovers over reading content
      const currentX = initX + dx;
      const snapX = currentX > window.innerWidth / 2 ? window.innerWidth - 64 : 16;
      const snapY = Math.min(Math.max(16, initY + dy), window.innerHeight - 74);
      const snapped = { x: snapX, y: snapY };
      setBubblePos(snapped);
      try {
        localStorage.setItem('life_os_ai_bubble_pos', JSON.stringify(snapped));
      } catch {}
    }
  };

  const mainClass = [
    styles.main,
    isPinned ? styles.sidebarPinned : '',
    pathname === '/knowledge' ? styles.knowledgeMain : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className={styles.shell}>
        <Sidebar
          pinned={isPinned}
          mobileOpen={mobileOpen}
          onPinToggle={handlePinToggle}
          onMobileClose={() => setMobileOpen(false)}
          onOpenNextAction={() => setNextActionOpen(true)}
        />

        <div className={mainClass}>
          {/* Mobile-only top bar */}
          <TopBar
            pageTitle={getPageTitle(pathname)}
            onMenuToggle={() => setMobileOpen(true)}
            onOpenNextAction={() => setNextActionOpen(true)}
            onOpenSearch={openSearch}
            onOpenReminders={() => setRemindersOpen(true)}
            unreadCount={unreadCount}
          />

          {/* Automatic Tasks -> Projects -> Goals -> Dreams Progress Cascade */}
          <HierarchyProgressSync />

          {systemConfig.bannerEnabled && systemConfig.bannerMessage && !bannerDismissed && (
            <div
              className={`${styles.systemBanner} ${
                systemConfig.bannerTone === 'warning'
                  ? styles.systemBannerWarning
                  : systemConfig.bannerTone === 'critical'
                  ? styles.systemBannerCritical
                  : ''
              }`}
              role="status"
            >
              <div className={styles.systemBannerText}>
                {systemConfig.bannerTitle && <strong>{systemConfig.bannerTitle}: </strong>}
                <span>{systemConfig.bannerMessage}</span>
              </div>
              <div className={styles.systemBannerActions}>
                {systemConfig.bannerActionLabel && systemConfig.bannerActionHref && (
                  systemConfig.bannerActionHref.startsWith('/') ? (
                    <Link href={systemConfig.bannerActionHref} className={styles.systemBannerClose}>
                      {systemConfig.bannerActionLabel}
                    </Link>
                  ) : (
                    <a
                      href={systemConfig.bannerActionHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.systemBannerClose}
                    >
                      {systemConfig.bannerActionLabel}
                    </a>
                  )
                )}
                <button
                  type="button"
                  className={styles.systemBannerClose}
                  onClick={() => setBannerDismissed(true)}
                  aria-label="Dismiss announcement"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <main
            className={`${styles.content} ${pathname === '/knowledge' ? styles.knowledgeContent : ''}`}
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
        data-tour="ai-assistant-btn"
        onPointerDown={handleBubblePointerDown}
        onPointerMove={handleBubblePointerMove}
        onPointerUp={handleBubblePointerUp}
        onPointerCancel={handleBubblePointerUp}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setBubblePos(null);
          try { localStorage.removeItem('life_os_ai_bubble_pos'); } catch {}
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setBubblePos(null);
          try { localStorage.removeItem('life_os_ai_bubble_pos'); } catch {}
        }}
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
        title="AI Assistant (Click to open, Drag to dock, Double-click to reset)"
        id="ai-chat-float-btn"
      >
        <Bot size={20} strokeWidth={2} />
      </button>

      <GrammarAssist />
      <GlobalLinkPreview />

      {/* Interactive Guided Tour Overlays and Dialogs */}
      <TourOverlay />
      <TourWelcomeModal />
      <TourCompletionModal />
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
                    <StudySessionProvider>
                      <TodayPlanProvider>
                        <FocusProvider>
                          <InboxProvider>
                            <CalendarProvider>
                              <HabitProvider>
                                <ReviewProvider>
                                  <QuickNotesProvider>
                                    <ReminderProvider>
                                      <SearchProvider>
                                        <UndoProvider>
                                          <ConfirmProvider>
                                            <TourProvider>
                                              <ShellContent>
                                                {content}
                                              </ShellContent>
                                            </TourProvider>
                                          </ConfirmProvider>
                                        </UndoProvider>
                                      </SearchProvider>
                                    </ReminderProvider>
                                  </QuickNotesProvider>
                                </ReviewProvider>
                              </HabitProvider>
                            </CalendarProvider>
                          </InboxProvider>
                        </FocusProvider>
                      </TodayPlanProvider>
                    </StudySessionProvider>
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
