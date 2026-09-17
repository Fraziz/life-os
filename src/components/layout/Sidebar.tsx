'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown,
  Sun,
  LogOut,
  PanelLeftClose,
  Settings,
} from 'lucide-react';

import { NAV_SECTIONS } from '@/config/navigation';
import type { NavItem } from '@/types';
import { useSettings } from '@/context/SettingsContext';
import { useReminders } from '@/context/ReminderContext';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/ui/Logo';
import styles from './Sidebar.module.css';

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
  const { unreadCount } = useReminders();
  const { logout, user } = useAuth();

  const [moreOpen, setMoreOpen] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const displayedSections = settings.simpleMode
    ? NAV_SECTIONS.filter((s) => s.id === 'daily')
    : NAV_SECTIONS;

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
          <Link href="/" className={styles.brand} title="Sariling Mundo">
            <Logo
              iconOnly={collapsed}
              size={22}
              showTagline={!collapsed}
              taglineText="Better habits. A freer you."
            />
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

        {/* Quick Utility Row (Next Action + Alerts) */}
        <div className={styles.topActionsGroup}>
          <div className={styles.quickUtilityRow}>
            <button
              type="button"
              onClick={() => {
                if (onOpenNextAction) onOpenNextAction();
                else window.dispatchEvent(new CustomEvent('open-next-action'));
              }}
              className={styles.utilityPillBtn}
              title="What should I do right now? (Ctrl+J / ⌘J)"
            >
              <span>Next Action</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenReminders) onOpenReminders();
                else window.dispatchEvent(new CustomEvent('open-reminders'));
              }}
              className={styles.utilityPillBtn}
              title="Alerts & Reminders"
            >
              <span>Alerts</span>
              {unreadCount > 0 && (
                <span className={styles.bellCountBadge}>{unreadCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className={styles.nav}>
          {displayedSections.map((section) => {
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
                            <span className={styles.navLabel}>{item.label}</span>
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
                        <span className={styles.navLabel}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Subtle, Formal Inspiration */}
        {!collapsed && (
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