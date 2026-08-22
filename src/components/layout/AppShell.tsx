'use client';

import { useState, useEffect } from 'react';
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
import { ReminderProvider, useReminders } from '@/context/ReminderContext';
import { SearchProvider, useSearch } from '@/context/SearchContext';
import SearchModal from '@/components/search/SearchModal';
import ReminderDrawer from '@/components/reminders/ReminderDrawer';
import AssistantModal from '@/components/assistant/AssistantModal';
import NextActionModal from '@/components/assistant/NextActionModal';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import KeyboardShortcutsModal from '@/components/ui/KeyboardShortcutsModal';
import { initFirebaseAnalytics } from '@/lib/firebase';
import { AuthProvider } from '@/context/AuthContext';
import AuthGate from '@/components/auth/AuthGate';

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

    window.addEventListener('open-next-action', handleOpenNextAction);
    window.addEventListener('open-assistant', handleOpenAssistant);
    window.addEventListener('open-reminders', handleOpenReminders);

    return () => {
      window.removeEventListener('open-next-action', handleOpenNextAction);
      window.removeEventListener('open-assistant', handleOpenAssistant);
      window.removeEventListener('open-reminders', handleOpenReminders);
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
      // Shift+? or ? (when not typing in an input) → Shortcuts
      if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, openSearch]);

  const mainClass = [
    styles.main,
    collapsed ? styles.sidebarCollapsed : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className={styles.shell}>
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

          <main className={styles.content} id="main-content" tabIndex={-1}>
            {children}
          </main>

          {/* Mobile bottom navigation bar */}
          <MobileBottomNav onOpenNextAction={() => setNextActionOpen(true)} />
        </div>
      </div>

      {/* Global Search Modal */}
      {isOpen && <SearchModal />}

      {/* Reminders Drawer */}
      <ReminderDrawer isOpen={remindersOpen} onClose={() => setRemindersOpen(false)} />

      {/* AI Assistant Modal */}
      <AssistantModal isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} />

      {/* "I Don't Know What To Do" Next Action Modal */}
      <NextActionModal isOpen={nextActionOpen} onClose={() => setNextActionOpen(false)} />

      {/* Keyboard Shortcuts Reference */}
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
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
                  <TodayPlanProvider>
                    <FocusProvider>
                      <InboxProvider>
                        <CalendarProvider>
                          <HabitProvider>
                            <ReviewProvider>
                              <KnowledgeProvider>
                                <ReminderProvider>
                                  <SearchProvider>
                                    <ShellContent>
                                      {content}
                                    </ShellContent>
                                  </SearchProvider>
                                </ReminderProvider>
                              </KnowledgeProvider>
                            </ReviewProvider>
                          </HabitProvider>
                        </CalendarProvider>
                      </InboxProvider>
                    </FocusProvider>
                  </TodayPlanProvider>
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
