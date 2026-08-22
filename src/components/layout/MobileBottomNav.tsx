'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Inbox, Headphones, CheckSquare, Compass } from 'lucide-react';
import styles from './MobileBottomNav.module.css';

interface MobileBottomNavProps {
  onOpenNextAction: () => void;
}

export default function MobileBottomNav({ onOpenNextAction }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Today', href: '/', icon: Sparkles },
    { label: 'Inbox', href: '/inbox', icon: Inbox },
    { label: 'Action', isCenterAction: true, icon: Compass },
    { label: 'Focus', href: '/focus', icon: Headphones },
    { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  ];

  return (
    <nav className={styles.bottomNav} aria-label="Mobile Bottom Navigation">
      {navItems.map((item) => {
        if (item.isCenterAction) {
          return (
            <button
              key="action"
              onClick={onOpenNextAction}
              className={styles.centerActionBtn}
              title="What should I do right now?"
              aria-label="What to do now"
            >
              <Compass size={22} />
            </button>
          );
        }

        const Icon = item.icon;
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href || '');

        return (
          <Link
            key={item.label}
            href={item.href || '/'}
            className={`${styles.navLink} ${isActive ? styles.active : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
            <span className={styles.navText}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
