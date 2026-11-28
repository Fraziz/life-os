'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown,
  Pin,
  PinOff,
  Home,
  Play,
  Inbox,
  CheckSquare,
  Calendar,
  Target,
  BookOpen,
  Layers,
  Folder,
  RotateCcw,
  Compass,
} from 'lucide-react';

import { NAV_SECTIONS } from '@/config/navigation';
import type { NavItem } from '@/types';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useTour } from '@/context/TourContext';
import { usePwaInstall } from '@/utils/usePwaInstall';
import Logo from '@/components/ui/Logo';
import styles from './Sidebar.module.css';

const SIDEBAR_SECTIONS_STORAGE_KEY = 'life_os_sidebar_sections_v1';

// Mapping of navigation icon identifiers to distinct Lucide icons
const NAV_ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
> = {
  today: Home,
  inbox: Inbox,
  tasks: CheckSquare,
  focus: Play,
  calendar: Calendar,
  projects: Layers,
  goals: Target,
  knowledge: BookOpen,
  files: Folder,
  review: RotateCcw,
  reset: Compass,
};

function matchesNavItem(pathname: string, item: NavItem): boolean {
  if (item.href === '/') {
    return pathname === '/';
  }
  const prefixes =
    item.activePaths && item.activePaths.length > 0 ? item.activePaths : [item.href];
  return prefixes.some(
    (prefix) => prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

function getDefaultSectionState(): Record<string, boolean> {
  const initial: Record<string, boolean> = {};
  for (const section of NAV_SECTIONS) {
    if (section.collapsible) {
      initial[section.id] = section.defaultOpen ?? true;
    }
  }
  return initial;
}

interface SidebarProps {
  collapsed?: boolean;
  pinned?: boolean;
  mobileOpen: boolean;
  onCollapse?: (v: boolean) => void;
  onPinToggle?: (v: boolean) => void;
  onMobileClose: () => void;
  onOpenNextAction?: () => void;
}

export default function Sidebar({
  pinned = false,
  mobileOpen,
  onCollapse,
  onPinToggle,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { settings, toggleSimpleMode } = useSettings();
  const { user, logout } = useAuth();
  const { startTour, isOpen: isTourOpen } = useTour();
  const { canPromptInstall, isStandalone, promptInstall } = usePwaInstall();

  const userDisplayName =
    user?.displayName ||
    settings?.profile?.displayName ||
    (user?.email ? user.email.split('@')[0] : 'User');
  const userSubtitle = user?.email || settings?.profile?.name || 'Personal Space';
  const userInitials = (userDisplayName || 'U').slice(0, 2).toUpperCase();

  // Desktop hover rail state
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);

  const [isPinned, setIsPinned] = useState(pinned);
  useEffect(() => {
    setIsPinned(pinned);
  }, [pinned]);

  // Persistent expanded/collapsed group preferences
  const [sectionOpenMap, setSectionOpenMap] = useState<Record<string, boolean>>(
    getDefaultSectionState
  );
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        setSectionOpenMap((prev) => {
          const merged = { ...prev };
          for (const key of Object.keys(merged)) {
            if (typeof parsed[key] === 'boolean') {
              merged[key] = parsed[key] as boolean;
            }
          }
          return merged;
        });
      }
    } catch {
      // Ignore malformed or unavailable localStorage
    }
  }, []);

  // Close profile menu on outside click or Escape
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [profileMenuOpen]);

  const toggleSection = (sectionId: string) => {
    setSectionOpenMap((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      try {
        localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const displayedSections = useMemo(
    () =>
      settings.simpleMode
        ? NAV_SECTIONS.filter((s) => s.id === 'primary')
        : NAV_SECTIONS,
    [settings.simpleMode]
  );

  // Strictly highlight only a single active navigation item across the entire sidebar
  const activeItemId = useMemo(() => {
    for (const section of displayedSections) {
      for (const item of section.items) {
        if (matchesNavItem(pathname, item)) {
          return item.id;
        }
      }
    }
    return null;
  }, [displayedSections, pathname]);

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
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
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
    } catch {
      // Ignore storage errors
    }
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
          <Link
            href="/"
            className={styles.brand}
            title="Sariling Mundo"
            onClick={handleNavClick}
            data-tour="brand"
          >
            <Logo
              iconOnly={!isExpanded}
              size={28}
              showTagline={isExpanded}
              taglineText="Better habits. A freer you."
            />
          </Link>

          <div className={styles.headerBtnGroup}>
            <button
              type="button"
              className={`${styles.pinSidebarBtn} ${isPinned ? styles.pinActive : ''}`}
              onClick={handlePinClick}
              title={
                isPinned
                  ? 'Unpin sidebar (auto-collapse on mouse leave)'
                  : 'Pin sidebar open (Ctrl+B)'
              }
              aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
              tabIndex={isExpanded ? 0 : -1}
            >
              {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className={styles.nav}>
          {displayedSections.map((section, sIndex) => {
            const isCollapsible = Boolean(section.collapsible);
            const userPrefOpen = isCollapsible ? Boolean(sectionOpenMap[section.id]) : true;
            // Keep Life Management visible while guided tour runs so tour targets resolve cleanly
            const isSectionOpen =
              userPrefOpen || (isTourOpen && section.id === 'life-management');

            // If a collapsible group is closed, keep it quiet — only surface an item if it is currently active
            const visibleItems = isSectionOpen
              ? section.items
              : section.items.filter((item) => item.id === activeItemId);

            const showCollapsedRailDivider = sIndex > 0 && visibleItems.length > 0;

            return (
              <div
                key={section.id}
                className={styles.sectionGroup}
                data-tour={`nav-section-${section.id}`}
              >
                {!section.hideHeader && (
                  <div
                    className={`${styles.sectionHeaderRow} ${
                      !showCollapsedRailDivider ? styles.sectionHeaderRowEmptyRail : ''
                    }`}
                  >
                    {isCollapsible ? (
                      <button
                        type="button"
                        className={styles.sectionHeaderBtn}
                        onClick={() => toggleSection(section.id)}
                        aria-expanded={isSectionOpen}
                        tabIndex={isExpanded ? 0 : -1}
                      >
                        <span className={styles.sectionTitle}>{section.label}</span>
                        <ChevronDown
                          size={13}
                          className={`${styles.moreChevron} ${
                            isSectionOpen ? styles.moreChevronOpen : ''
                          }`}
                        />
                      </button>
                    ) : (
                      <span className={styles.sectionTitle}>{section.label}</span>
                    )}

                    {showCollapsedRailDivider && (
                      <div className={styles.sectionDividerRail} aria-hidden="true" />
                    )}
                  </div>
                )}

                {visibleItems.length > 0 && (
                  <div className={styles.sectionItemsList}>
                    {visibleItems.map((item: NavItem) => {
                      const isActive = item.id === activeItemId;
                      const IconComponent = NAV_ICON_MAP[item.icon] || Layers;

                      return (
                        <div key={item.id} className={styles.navItemWrapper}>
                          <Link
                            href={item.href}
                            prefetch={true}
                            onClick={handleNavClick}
                            data-tour={`nav-${item.id}`}
                            aria-current={isActive ? 'page' : undefined}
                            className={`${styles.navItem} ${
                              isActive ? styles.activeItem : ''
                            }`}
                            title={!isExpanded ? item.label : undefined}
                          >
                            <span className={styles.navIconBox}>
                              <IconComponent
                                size={18}
                                strokeWidth={isActive ? 2.1 : 1.8}
                                className={styles.navIcon}
                              />
                            </span>
                            <span className={styles.navLabel}>{item.label}</span>
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
          })}
        </nav>

        {/* User Profile Footer */}
        <div className={styles.footer} ref={footerRef}>
          <div
            className={styles.userCard}
            onClick={() => {
              if (!isExpanded && onPinToggle) {
                onPinToggle(true);
              }
              setProfileMenuOpen((prev) => !prev);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!isExpanded && onPinToggle) {
                  onPinToggle(true);
                }
                setProfileMenuOpen((prev) => !prev);
              }
            }}
            role="button"
            tabIndex={0}
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            data-tour="user-profile"
            title={!isExpanded ? userDisplayName : undefined}
          >
            <div className={styles.userAvatar}>
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-accent)',
                  }}
                >
                  {userInitials}
                </span>
              )}
            </div>

            <div className={styles.userInfo}>
              <span className={styles.userName}>{userDisplayName}</span>
              <span className={styles.userRole}>{userSubtitle}</span>
            </div>

            <ChevronDown
              size={14}
              className={`${styles.userChevron} ${
                profileMenuOpen ? styles.userChevronOpen : ''
              }`}
            />
          </div>

          {profileMenuOpen && isExpanded && (
            <div className={styles.profileDropdown} role="menu">
              <Link
                href="/settings"
                className={styles.dropdownItem}
                data-tour="nav-settings"
                onClick={() => {
                  setProfileMenuOpen(false);
                  handleNavClick();
                }}
              >
                <span>Settings</span>
              </Link>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setProfileMenuOpen(false);
                  toggleSimpleMode();
                }}
              >
                <span>
                  {settings.simpleMode ? 'Show Full Navigation' : 'Simple Sidebar Mode'}
                </span>
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setProfileMenuOpen(false);
                  handleNavClick();
                  startTour();
                }}
              >
                <span>Interactive Tour</span>
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setProfileMenuOpen(false);
                  handleNavClick();
                  const desktopApi = (
                    window as Window & {
                      sarilingDesktop?: { toggleBubblePopover?: () => Promise<unknown> };
                    }
                  ).sarilingDesktop;
                  if (desktopApi?.toggleBubblePopover) {
                    void desktopApi.toggleBubblePopover();
                  } else {
                    window.dispatchEvent(new CustomEvent('open-ai-chat'));
                  }
                }}
              >
                <span>Floating Bubble</span>
              </button>
              {!isStandalone &&
                (canPromptInstall ? (
                  <button
                    type="button"
                    className={styles.dropdownItem}
                    onClick={() => {
                      setProfileMenuOpen(false);
                      void promptInstall();
                    }}
                  >
                    <span>Install Desktop App</span>
                  </button>
                ) : (
                  <Link
                    href="/settings#desktop-app"
                    className={styles.dropdownItem}
                    onClick={() => {
                      setProfileMenuOpen(false);
                      handleNavClick();
                    }}
                  >
                    <span>Desktop App (Windows)</span>
                  </Link>
                ))}
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setProfileMenuOpen(false);
                  void logout();
                }}
              >
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
