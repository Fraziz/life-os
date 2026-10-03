'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown,
  Sun,
  LogOut,
  Settings,
  ShieldAlert,
  Compass,
  Pin,
  PinOff,
  Home,
  Play,
  Send,
  CheckSquare,
  Calendar,
  Cloud,
  Target,
  FolderKanban,
  BookOpen,
  Repeat,
  Dumbbell,
  Layers,
  Folder,
  RotateCcw,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { NAV_SECTIONS } from '@/config/navigation';
import type { NavItem } from '@/types';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/ui/Logo';
import styles from './Sidebar.module.css';

// Mapping of navigation icon identifiers to Lucide icons
const NAV_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  today: Home,
  focus: Play,
  inbox: Send,
  tasks: CheckSquare,
  calendar: Calendar,
  roadmap: Compass,
  dreams: Cloud,
  goals: Target,
  projects: FolderKanban,
  knowledge: BookOpen,
  habits: Repeat,
  workout: Dumbbell,
  areas: Layers,
  files: Folder,
  review: RotateCcw,
  progress: TrendingUp,
  reset: Zap,
};

interface SidebarProps {
  collapsed?: boolean;
  pinned?: boolean;
  mobileOpen: boolean;
  onCollapse?: (v: boolean) => void;
  onPinToggle?: (v: boolean) => void;
  onMobileClose: () => void;
  onOpenReminders?: () => void;
  onOpenAssistant?: () => void;
  onOpenNextAction?: () => void;
}

export default function Sidebar({
  collapsed,
  pinned = false,
  mobileOpen,
  onCollapse,
  onPinToggle,
  onMobileClose,
  onOpenNextAction,
}: SidebarProps) {
  const pathname = usePathname();
  const { settings } = useSettings();
  const { user, logout, logoutAllDevices } = useAuth();
  const userDisplayName = user?.displayName || settings?.profile?.displayName || (user?.email ? user.email.split('@')[0] : 'User');
  const userSubtitle = user?.email || settings?.profile?.name || 'Personal Space';
  const userInitials = (userDisplayName || 'U').slice(0, 2).toUpperCase();

  // Hover auto-open / auto-close state (Instagram PC style)
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local pinned fallback if not passed from parent
  const [isPinned, setIsPinned] = useState(pinned);

  useEffect(() => {
    setIsPinned(pinned);
  }, [pinned]);

  const [moreOpen, setMoreOpen] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const displayedSections = settings.simpleMode
    ? NAV_SECTIONS.filter((s) => s.id === 'daily')
    : NAV_SECTIONS;

  // An expanded sidebar is active when either mobile drawer is open, pinned open, or hovered
  const isExpanded = mobileOpen || isPinned || isHovered;

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    // Smooth 220ms debounce so rapid mouse movements and edge crossings don't flicker or shake
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 220);
  };

  const handlePinClick = () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    if (onPinToggle) {
      onPinToggle(nextPinned);
    } else if (onCollapse) {
      onCollapse(!nextPinned);
    }
    try {
      localStorage.setItem('life_os_sidebar_pinned', String(nextPinned));
    } catch {}
  };

  const handleNavClick = () => {
    if (mobileOpen) {
      onMobileClose();
    }
  };

  const sidebarClass = [
    styles.sidebar,
    isExpanded ? styles.isExpanded : '',
    isPinned ? styles.isPinned : '',
    isHovered ? styles.isHovered : '',
    collapsed && !isHovered ? styles.collapsed : '',
    mobileOpen ? styles.mobileOpen : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`${styles.overlay} ${mobileOpen ? styles.visible : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={sidebarClass}
        aria-label="Main navigation"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Brand Header */}
        <div className={styles.header}>
          <Link href="/" className={styles.brand} title="Sariling Mundo" onClick={handleNavClick}>
            <Logo
              iconOnly={!isExpanded}
              size={22}
              showTagline={isExpanded}
              taglineText="Better habits. A freer you."
            />
          </Link>

          {isExpanded && (
            <button
              type="button"
              className={`${styles.pinSidebarBtn} ${isPinned ? styles.pinActive : ''}`}
              onClick={handlePinClick}
              title={
                isPinned
                  ? 'Unpin sidebar (Auto-collapse on mouse leave)'
                  : 'Pin sidebar open (Ctrl+B)'
              }
              aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            >
              {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
          )}
        </div>

        {/* Next Action Quick Launcher (Notification button removed as requested) */}
        <div className={styles.nextActionWrap}>
          {isExpanded ? (
            <button
              type="button"
              onClick={() => {
                if (onOpenNextAction) onOpenNextAction();
                else window.dispatchEvent(new CustomEvent('open-next-action'));
              }}
              className={styles.nextActionBtn}
              title="What should I do right now? (Ctrl+J / ⌘J)"
            >
              <div className={styles.nextActionLeft}>
                <Compass size={16} className={styles.nextActionIcon} />
                <span className={styles.nextActionLabel}>Next Action</span>
              </div>
              <kbd className={styles.nextActionKbd}>Ctrl+J</kbd>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (onOpenNextAction) onOpenNextAction();
                else window.dispatchEvent(new CustomEvent('open-next-action'));
              }}
              className={styles.railActionBtn}
              title="What should I do right now? (Ctrl+J / ⌘J)"
              aria-label="What should I do right now? (Ctrl+J)"
            >
              <Compass size={18} className={styles.nextActionIcon} />
              <span className={styles.navTooltip}>Next Action (Ctrl+J)</span>
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className={styles.nav}>
          {displayedSections.map((section) => {
            const isMore = section.id === 'more';

            if (isMore) {
              return (
                <div key={section.id} className={styles.sectionGroup}>
                  {isExpanded ? (
                    <button
                      type="button"
                      className={styles.sectionHeaderBtn}
                      onClick={() => setMoreOpen(!moreOpen)}
                      aria-expanded={moreOpen}
                    >
                      <span className={styles.sectionTitle}>{section.label}</span>
                      <ChevronDown
                        size={14}
                        className={`${styles.moreChevron} ${
                          moreOpen ? styles.moreChevronOpen : ''
                        }`}
                      />
                    </button>
                  ) : null}

                  {(!isExpanded || moreOpen) && (
                    <div className={styles.sectionItemsList}>
                      {section.items.map((item: NavItem) => {
                        const isActive = pathname === item.href;
                        const IconComponent = NAV_ICON_MAP[item.icon] || Layers;

                        return (
                          <div key={item.id} className={styles.navItemWrapper}>
                            <Link
                              href={item.href}
                              prefetch={true}
                              onClick={handleNavClick}
                              className={`${styles.navItem} ${
                                isActive ? styles.activeItem : ''
                              }`}
                              title={!isExpanded ? item.label : undefined}
                            >
                              <IconComponent
                                size={isExpanded ? 18 : 20}
                                strokeWidth={isActive ? 2.2 : 1.8}
                                className={styles.navIcon}
                              />
                              {isExpanded && (
                                <span className={styles.navLabel}>{item.label}</span>
                              )}
                              {!isExpanded && (
                                <span className={styles.navTooltip}>{item.label}</span>
                              )}
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={section.id} className={styles.sectionGroup}>
                {isExpanded && (
                  <div className={styles.sectionTitle}>{section.label}</div>
                )}
                <div className={styles.sectionItemsList}>
                  {section.items.map((item: NavItem) => {
                    const isActive =
                      item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href);
                    const IconComponent = NAV_ICON_MAP[item.icon] || Layers;

                    return (
                      <div key={item.id} className={styles.navItemWrapper}>
                        <Link
                          key={item.id}
                          href={item.href}
                          prefetch={true}
                          onClick={handleNavClick}
                          className={`${styles.navItem} ${
                            isActive ? styles.activeItem : ''
                          }`}
                          title={!isExpanded ? item.label : undefined}
                        >
                          <IconComponent
                            size={isExpanded ? 18 : 20}
                            strokeWidth={isActive ? 2.2 : 1.8}
                            className={styles.navIcon}
                          />
                          {isExpanded && (
                            <span className={styles.navLabel}>{item.label}</span>
                          )}
                          {!isExpanded && (
                            <span className={styles.navTooltip}>{item.label}</span>
                          )}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Subtle, Formal Inspiration */}
        {isExpanded && (
          <div className={styles.sidebarQuote}>
            <p className={styles.quoteText}>
              &ldquo;Small steps every day build the life you want.&rdquo;
            </p>
          </div>
        )}

        {/* User Profile Footer */}
        <div className={styles.footer}>
          <div
            className={styles.userCard}
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            role="button"
            tabIndex={0}
            title={!isExpanded ? userDisplayName : undefined}
          >
            <div className={styles.userAvatar}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-accent)' }}>{userInitials}</span>
              )}
            </div>

            {isExpanded && (
              <div className={styles.userInfo}>
                <span className={styles.userName}>
                  {userDisplayName}
                </span>
                <span className={styles.userRole}>
                  {userSubtitle}
                </span>
              </div>
            )}

            {isExpanded && (
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
                <span>Sign Out</span>
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                style={{ color: 'var(--color-danger, #ef4444)' }}
                onClick={() => {
                  setProfileMenuOpen(false);
                  if (window.confirm('Log out of all devices? This will invalidate all your sessions across all phones and computers.')) {
                    void logoutAllDevices();
                  }
                }}
              >
                <ShieldAlert size={14} />
                <span>Log out all devices</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}