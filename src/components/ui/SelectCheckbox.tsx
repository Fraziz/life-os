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

/**
 * Returns true when clicking anywhere on a selectable card/row should toggle its selection:
 * active only during selection mode, ignoring interactive controls and dragged text selections.
 */
export function shouldToggleSelectionOnCardClick(
  e: React.MouseEvent<HTMLElement>,
  isSelectionActive: boolean
): boolean {
  if (!isSelectionActive) return false;
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  if (
    target.closest(
      'a, button, input, textarea, select, option, label, [role="button"], [role="checkbox"], [contenteditable="true"], [data-no-select-toggle="true"]'
    )
  ) {
    return false;
  }
  const winSel = typeof window !== 'undefined' ? window.getSelection()?.toString() : '';
  if (winSel && winSel.length > 0) return false;
  return true;
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
        <CheckSquare size={17} className={styles.iconChecked} />
      ) : (
        <Square size={17} className={styles.iconUnchecked} />
      )}
    </button>
  );
}

