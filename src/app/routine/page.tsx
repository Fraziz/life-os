'use client';

import React from 'react';
import DailyRoutineChecklist from '@/components/habits/DailyRoutineChecklist';
import styles from './page.module.css';

export default function RoutinePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Daily Routine</h1>
          <p className={styles.subtitle}>Time-anchored daily checklist synced with Today.</p>
        </div>
      </header>

      <DailyRoutineChecklist />
    </div>
  );
}
