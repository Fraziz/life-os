'use client';

import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import styles from './SelectCheckbox.module.css';

export interface SelectCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  ariaLabel?: string;
  className?: string;
  selectionMode?: boolean;
}

export default function SelectCheckbox({
  checked,
  onToggle,
  ariaLabel = 'Select item',
  className = '',
  selectionMode = false,
}: SelectCheckboxProps) {
  const isVisible = checked || selectionMode;
  if (!isVisible) return null;

  return (
    <button
      type="button"
      className={`${styles.selectBtn} ${checked ? styles.checked : ''} ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={checked ? 'Deselect' : 'Select'}
      aria-label={ariaLabel}
      aria-checked={checked}
      role="checkbox"
    >
      {checked ? (
        <CheckSquare size={16} className={styles.iconChecked} />
      ) : (
        <Square size={16} className={styles.iconUnchecked} />
      )}
    </button>
  );
}

