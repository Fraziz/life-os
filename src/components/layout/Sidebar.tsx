'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Headphones,
  Inbox,
  Target,
  Flag,
  FolderKanban,
  CheckSquare,
  GitBranch,
  CloudSun,
  LayoutGrid,
  Calendar,
  TrendingUp,
  RefreshCw,
  RotateCcw,
  Repeat,
  Dumbbell,
  BookOpen,
  Paperclip,
  Settings,
  Search,
  Compass,
  Bell,
  Bot,
  ChevronDown,
  ChevronRight,
  Sun,
  LogOut,
  LucideIcon,
  PanelLeftClose,
} from 'lucide-react';

import { NAV_SECTIONS } from '@/config/navigation';
import type { NavItem } from '@/types';
import { useSettings } from '@/context/SettingsContext';
import { useSearch } from '@/context/SearchContext';
import { useReminders } from '@/context/ReminderContext';
import { useAuth } from '@/context/AuthContext';
import styles from './Sidebar.module.css';

// ── Icon map matching exact names & keys ─────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  today: Sparkles,
  focus: Headphones,
  inbox: Inbox,
  goals: Target,
  milestones: Flag,
  projects: FolderKanban,
  tasks: CheckSquare,
  roadmap: GitBranch,
  dreams: CloudSun,
  areas: LayoutGrid,
  calendar: Calendar,
  progress: TrendingUp,
  review: RefreshCw,
  reset: RotateCcw,
  habits: Repeat,
  workout: Dumbbell,
  knowledge: BookOpen,
  files: Paperclip,
  settings: Settings,
};

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: (v: boolean) => void;
  onMobileClose: () => void;
  onOpenReminders?: () => void;
  onOpenAssistant?: () => void;
  onOpenNextAction?: () => void;
}

export default function Sidebar({
  collapsed,
  mobileOpen,
  onCollapse,
  onMobileClose,
  onOpenReminders,
  onOpenAssistant,
  onOpenNextAction,
}: SidebarProps) {
  const pathname = usePathname();
  const { settings } = useSettings();
  const { openSearch } = useSearch();
  const { unreadCount } = useReminders();
  const { logout, user } = useAuth();

  const [moreOpen, setMoreOpen] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const sidebarClass = [
    styles.sidebar,
    collapsed ? styles.collapsed : '',
    mobileOpen ? styles.mobileOpen : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleNavClick = () => {
    if (mobileOpen) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`${styles.overlay} ${mobileOpen ? styles.visible : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside className={sidebarClass} aria-label="Main navigation">
        {/* Brand Header */}
        <div className={styles.header}>
          <Link href="/" className={styles.brand}>
            <div className={styles.brandTitleRow}>
              <span className={styles.brandName}>Sariling Mundo</span>
              <span className={styles.sparkleIcon}>✦</span>
            </div>
            {!collapsed && (
              <span className={styles.brandTagline}>Better habits. A freer you.</span>
            )}
          </Link>
          <button
            type="button"
            className={styles.hideSidebarBtn}
            onClick={() => onCollapse(true)}
            title="Hide navigation (Ctrl+B)"
            aria-label="Hide navigation"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* Quick Action Top Bar (Search, What to do, Alerts, Assistant) */}
        <div className={styles.topActionsGroup}>
          {/* Search Trigger */}
          <button
            type="button"
            onClick={openSearch}
            className={styles.searchTriggerBtn}
            title="Search everything (Ctrl+K / ⌘K)"
          >
            <span className={styles.navIcon}>
              <Search size={16} strokeWidth={2} />
            </span>
            {!collapsed && <span className={styles.navLabel}>Search</span>}
            {!collapsed && <kbd className={styles.shortcutKbd}>⌘K</kbd>}
          </button>

          {/* What to do? Trigger */}
          <button
            type="button"
            onClick={() => {
              if (onOpenNextAction) onOpenNextAction();
              else window.dispatchEvent(new CustomEvent('open-next-action'));
            }}
            className={styles.whatToDoTriggerBtn}
            title="What should I do right now? (Ctrl+J / ⌘J)"
          >
            <span className={styles.navIcon}>
              <Compass size={16} strokeWidth={2} className={styles.compassIcon} />
            </span>
            {!collapsed && <span className={styles.whatToDoLabel}>What to do?</span>}
            {!collapsed && <kbd className={styles.shortcutKbd}>⌘J</kbd>}
          </button>

          {/* Alerts + Assistant quick row */}
          <div className={styles.quickUtilityRow}>
            <button
              type="button"
              onClick={() => {
                if (onOpenReminders) onOpenReminders();
                else window.dispatchEvent(new CustomEvent('open-reminders'));
              }}
              className={styles.utilityPillBtn}
              title="Alerts & Reminders"
            >
              <div className={styles.bellIconWrap}>
                <Bell size={14} />
                {unreadCount > 0 && (
                  <span className={styles.bellCountBadge}>{unreadCount}</span>
                )}
              </div>
              {!collapsed && <span>Alerts</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenAssistant) onOpenAssistant();
                else window.dispatchEvent(new CustomEvent('open-assistant'));
              }}
              className={styles.utilityPillBtn}
              title="Sariling Mundo Assistant"
            >
              <Bot size={14} />
              {!collapsed && <span>Assistant</span>}
            </button>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className={styles.nav}>
          {NAV_SECTIONS.map((section) => {
            const isMore = section.id === 'more';

            if (isMore) {
              return (
                <div key={section.id} className={styles.sectionGroup}>
                  <button
                    type="button"
                    className={styles.sectionHeaderBtn}
                    onClick={() => setMoreOpen(!moreOpen)}
                    aria-expanded={moreOpen}
                  >
                    {!collapsed && (
                      <span className={styles.sectionTitle}>{section.label}</span>
                    )}
                    <ChevronDown
                      size={14}
                      className={`${styles.moreChevron} ${
                        moreOpen ? styles.moreChevronOpen : ''
                      }`}
                    />
                  </button>

                  {moreOpen && (
                    <div className={styles.sectionItemsList}>
                      {section.items.map((item) => {
                        const IconComp = ICON_MAP[item.icon] || Sparkles;
                        const isActive = pathname === item.href;

                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={handleNavClick}
                            className={`${styles.navItem} ${
                              isActive ? styles.activeItem : ''
                            }`}
                          >
                            <span className={styles.navIcon}>
                              <IconComp
                                size={17}
                                strokeWidth={isActive ? 2.2 : 1.8}
                              />
                            </span>
                            {!collapsed && (
                              <span className={styles.navLabel}>{item.label}</span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={section.id} className={styles.sectionGroup}>
                {!collapsed && (
                  <div className={styles.sectionTitle}>{section.label}</div>
                )}
                <div className={styles.sectionItemsList}>
                  {section.items.map((item) => {
                    const IconComp = ICON_MAP[item.icon] || Sparkles;
                    const isActive =
                      item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={handleNavClick}
                        className={`${styles.navItem} ${
                          isActive ? styles.activeItem : ''
                        }`}
                      >
                        <span className={styles.navIcon}>
                          <IconComp
                            size={17}
                            strokeWidth={isActive ? 2.2 : 1.8}
                          />
                        </span>
                        {!collapsed && (
                          <span className={styles.navLabel}>{item.label}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Handwritten Motivational Sticky Note */}
        {!collapsed && (
          <div className={styles.stickyQuoteWrapper}>
            <div className={styles.stickyQuote}>
              <p className={styles.handwrittenText}>
                Small steps<br />
                every day<br />
                build the life<br />
                you want.
              </p>
              <svg className={styles.handwrittenDoodle} viewBox="0 0 100 20" fill="none">
                <path
                  d="M10 14 Q 30 8, 55 12 T 90 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M18 17 Q 40 12, 65 15 T 85 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.6"
                />
              </svg>
            </div>
          </div>
        )}

        {/* User Profile Footer */}
        <div className={styles.footer}>
          <div
            className={styles.userCard}
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            role="button"
            tabIndex={0}
          >
            <div className={styles.userAvatar}>
              <Sun size={18} className={styles.sunIcon} />
            </div>

            {!collapsed && (
              <div className={styles.userInfo}>
                <span className={styles.userName}>
                  {settings?.profile?.displayName || 'Aaron Paul'}
                </span>
                <span className={styles.userRole}>
                  {settings?.profile?.name || 'BSIT 3E · SSU'}
                </span>
              </div>
            )}

            {!collapsed && (
              <ChevronDown
                size={14}
                className={`${styles.userChevron} ${
                  profileMenuOpen ? styles.userChevronOpen : ''
                }`}
              />
            )}
          </div>

          {profileMenuOpen && (
            <div className={styles.profileDropdown}>
              <Link
                href="/settings"
                className={styles.dropdownItem}
                onClick={() => setProfileMenuOpen(false)}
              >
                <Settings size={14} />
                <span>Settings</span>
              </Link>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setProfileMenuOpen(false);
                  void logout();
                }}
              >
                <LogOut size={14} />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}