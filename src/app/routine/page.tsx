'use client';

import React from 'react';
import DailyRoutineChecklist from '@/components/habits/DailyRoutineChecklist';
import PairedPageSwitcher from '@/components/layout/PairedPageSwitcher';
import styles from './page.module.css';

const CALENDAR_ROUTINE_TABS = [
  { label: 'Calendar', href: '/calendar' },
  { label: 'Daily Routine', href: '/routine' },
];

export default function RoutinePage() {
  return (
    <div className={styles.page}>
      <PairedPageSwitcher
        ariaLabel="Calendar and Routines views"
        tabs={CALENDAR_ROUTINE_TABS}
      />
      <DailyRoutineChecklist />
    </div>
  );
}
