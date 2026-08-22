'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import { NAV_SECTIONS } from '@/config/navigation';
import type { NavItem } from '@/types';

import {
  Sparkles,
  LayoutGrid,
  CloudSun,
  Target,
  Flag,
  FolderKanban,
  CheckSquare,
  Calendar,
  RefreshCw,
  Repeat,
  Headphones,
  Settings,
  Inbox,
  RotateCcw,
  TrendingUp,
  Search,
  BookOpen,
  GitBranch,
  LucideIcon,
  Bell,
  Compass,
  Bot,
  ChevronDown,
  MoreHorizontal,
  LogOut,
  Paperclip,
} from 'lucide-react';

import { useSettings } from '@/context/SettingsContext';
import { useSearch } from '@/context/SearchContext';
import { useReminders } from '@/context/ReminderContext';
import { useAuth } from '@/context/AuthContext';

import styles from './Sidebar.module.css';

// ── Icon map ───────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  today: Sparkles,
  inbox: Inbox,
  areas: LayoutGrid,
  dreams: CloudSun,
  goals: Target,
  milestones: Flag,
  projects: FolderKanban,
  tasks: CheckSquare,
  reset: RotateCcw,
  calendar: Calendar,
  progress: TrendingUp,
  review: RefreshCw,
  habits: Repeat,
  focus: Headphones,
  settings: Settings,
  search: Search,
  knowledge: BookOpen,
  roadmap: GitBranch,
  files: Paperclip,
};

// ── Collapse icon ──────────────────────────────────────────

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      {collapsed ? (
        <path d="M6 3l5 5-5 5V3z" />
      ) : (
        <path d="M10 3L5 8l5 5V3z" />
      )}
    </svg>
  );
}

// ── Nav item ────────────────────────────────────────────────

interface NavItemProps {
  item: NavItem;
  isActive: boolean;
  sidebarCollapsed: boolean;
  onClick?: () => void;
}

function NavItemRow({
  item,
  isActive,
  sidebarCollapsed,
  onClick,
}: NavItemProps) {
  const IconComponent = ICON_MAP[item.icon];

  const classNames = [
    styles.navItem,
    isActive ? styles.active : '',
    !item.isAvailable ? styles.unavailable : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className={styles.navItemIcon} aria-hidden="true">
        {IconComponent && (
          <IconComponent size={18} strokeWidth={1.8} />
        )}
      </span>

      <span className={styles.navItemLabel}>
        {item.label}
      </span>

      {item.badge !== undefined && (
        <span className={styles.navItemBadge}>
          {item.badge}
        </span>
      )}

      {sidebarCollapsed && (
        <span className={styles.tooltip}>
          {item.label}
          {!item.isAvailable && ` · Phase ${item.phase}`}
        </span>
      )}
    </>
  );

  if (!item.isAvailable) {
    return (
      <div
        className={classNames}
        role="menuitem"
        aria-disabled="true"
        aria-label={`${item.label} — available in Phase ${item.phase}`}
        title={`Coming in Phase ${item.phase}`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={classNames}
      role="menuitem"
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
    >
      {content}
    </Link>
  );
}

// ── Sidebar component ──────────────────────────────────────

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

  // ── More section state ───────────────────────────────────

  const moreSection = NAV_SECTIONS.find(
    (section) => section.id === 'more'
  );

  const isMorePage = Boolean(
    moreSection?.items.some((item) =>
      item.href === '/'
        ? pathname === '/'
        : pathname.startsWith(item.href)
    )
  );

  const [moreOpen, setMoreOpen] = useState(isMorePage);

  // Automatically open More when navigating to a secondary page.
  useEffect(() => {
    if (isMorePage) {
      setMoreOpen(true);
    }
  }, [isMorePage]);

  const sidebarClass = [
    styles.sidebar,
    collapsed ? styles.collapsed : '',
    mobileOpen ? styles.mobileOpen : '',
  ]
    .filter(Boolean)
    .join(' ');

  // ── Render normal navigation section ──────────────────────

  const renderSection = (section: (typeof NAV_SECTIONS)[number]) => {
    const isMore = section.id === 'more';

    // MORE gets special collapsible behavior.
    if (isMore) {
      return (
        <div key={section.id} className={styles.section}>
          <button
            type="button"
            className={styles.moreToggle}
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-controls="life-os-more-navigation"
            title={moreOpen ? 'Hide more options' : 'Show more options'}
          >
            <span className={styles.sectionLabel}>
              {section.label}
            </span>

            {!collapsed && (
              <ChevronDown
                size={15}
                strokeWidth={1.8}
                className={`${styles.moreChevron} ${moreOpen ? styles.moreChevronOpen : ''
                  }`}
              />
            )}

            {collapsed && (
              <span className={styles.moreCollapsedIcon}>
                <MoreHorizontal
                  size={18}
                  strokeWidth={1.8}
                />
              </span>
            )}
          </button>

          {moreOpen && (
            <div
              id="life-os-more-navigation"
              className={styles.moreItems}
            >
              {section.items.map((item) => (
                <NavItemRow
                  key={item.id}
                  item={item}
                  isActive={
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href)
                  }
                  sidebarCollapsed={collapsed}
                  onClick={
                    mobileOpen
                      ? onMobileClose
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={section.id} className={styles.section}>
        <span
          className={styles.sectionLabel}
          aria-hidden={collapsed}
        >
          {section.label}
        </span>

        {section.items.map((item) => (
          <NavItemRow
            key={item.id}
            item={item}
            isActive={
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
            }
            sidebarCollapsed={collapsed}
            onClick={
              mobileOpen
                ? onMobileClose
                : undefined
            }
          />
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`${styles.overlay} ${mobileOpen ? styles.visible : ''
          }`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={sidebarClass}
        aria-label="Main navigation"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logoArea}>
            <Logo
              iconOnly={collapsed}
              size={28}
            />
          </div>

          <button
            className={styles.collapseButton}
            onClick={() => onCollapse(!collapsed)}
            aria-label={
              collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
            title={
              collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>

        {/* Navigation */}
        <nav
          className={styles.nav}
          role="menu"
          aria-label="Site navigation"
        >
          {/* Search */}
          <button
            onClick={openSearch}
            className={styles.searchTrigger}
            title="Search everything (Ctrl+K)"
          >
            <span
              className={styles.navItemIcon}
              aria-hidden="true"
            >
              <Search
                size={18}
                strokeWidth={1.8}
              />
            </span>

            <span className={styles.navItemLabel}>
              Search
            </span>

            {!collapsed && (
              <kbd className={styles.searchKbd}>
                ⌘K
              </kbd>
            )}

            {collapsed && (
              <span className={styles.tooltip}>
                Search (⌘K)
              </span>
            )}
          </button>

          {/* What To Do */}
          {onOpenNextAction && (
            <button
              onClick={onOpenNextAction}
              className={styles.nextActionTrigger}
              title="What should I do right now? (Ctrl+J)"
            >
              <span
                className={styles.navItemIcon}
                aria-hidden="true"
              >
                <Compass
                  size={18}
                  strokeWidth={1.8}
                  style={{
                    color: 'var(--color-accent)',
                  }}
                />
              </span>

              <span className={styles.navItemLabel}>
                What to do?
              </span>

              {!collapsed && (
                <kbd className={styles.searchKbd}>
                  ⌘J
                </kbd>
              )}

              {collapsed && (
                <span className={styles.tooltip}>
                  What to do? (⌘J)
                </span>
              )}
            </button>
          )}

          {/* Alerts + Assistant */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              marginBottom: '8px',
            }}
          >
            {onOpenReminders && (
              <button
                onClick={onOpenReminders}
                className={styles.quickActionBtn}
                title="Reminders & Alerts"
              >
                <span
                  className={styles.navItemIcon}
                  style={{
                    position: 'relative',
                  }}
                >
                  <Bell size={16} />

                  {unreadCount > 0 && (
                    <span className={styles.bellBadge}>
                      {unreadCount}
                    </span>
                  )}
                </span>

                {!collapsed && (
                  <span className={styles.navItemLabel}>
                    Alerts
                  </span>
                )}

                {collapsed && (
                  <span className={styles.tooltip}>
                    Reminders ({unreadCount})
                  </span>
                )}
              </button>
            )}

            {onOpenAssistant && (
              <button
                onClick={onOpenAssistant}
                className={styles.quickActionBtn}
                title="Life OS Assistant"
              >
                <span
                  className={styles.navItemIcon}
                  aria-hidden="true"
                >
                  <Bot size={16} />
                </span>

                {!collapsed && (
                  <span className={styles.navItemLabel}>
                    Assistant
                  </span>
                )}

                {collapsed && (
                  <span className={styles.tooltip}>
                    Assistant
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Main navigation */}
          {NAV_SECTIONS.map(renderSection)}
        </nav>

        {/* User footer */}
        <footer className={styles.footer}>
          <Link
            href="/settings"
            className={styles.userCard}
            aria-label="Personal settings"
            title="Personal settings & profile"
          >
            <div
              className={styles.userAvatar}
              aria-hidden="true"
            >
              {settings?.profile?.avatarInitials || 'A'}
            </div>

            <div className={styles.userInfo}>
              <div className={styles.userName}>
                {settings?.profile?.displayName ||
                  settings?.profile?.name ||
                  'Personal User'}
              </div>

              <div className={styles.userStatus}>
                {user?.email || 'Private account'}
              </div>
            </div>
          </Link>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={() => void logout()}
            title="Log out"
          >
            <LogOut size={16} />
            {!collapsed && <span>Log out</span>}
          </button>
        </footer>
      </aside>
    </>
  );
}