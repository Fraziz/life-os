'use client';

import React from 'react';
import DailyRoutineChecklist from '@/components/habits/DailyRoutineChecklist';
import styles from './page.module.css';

export default function RoutinePage() {
  return (
    <div className={styles.page}>
      <DailyRoutineChecklist />
    </div>
  );
}
