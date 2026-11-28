'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './PairedPageSwitcher.module.css';

export interface PairedTabOption {
  label: string;
  href: string;
}

interface PairedPageSwitcherProps {
  ariaLabel: string;
  tabs: PairedTabOption[];
}

export default function PairedPageSwitcher({ ariaLabel, tabs }: PairedPageSwitcherProps) {
  const pathname = usePathname();

  return (
    <nav className={styles.switcherWrap} aria-label={ariaLabel}>
      <div className={styles.switcherTrack}>
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={true}
              aria-current={isActive ? 'page' : undefined}
              className={`${styles.switcherTab} ${
                isActive ? styles.switcherTabActive : ''
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
