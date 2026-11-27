'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  hideCancel?: boolean;
  inputPlaceholder?: string;
  defaultValue?: string;
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  hideCancel = false,
  inputPlaceholder,
  defaultValue = '',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const hasInput = inputPlaceholder !== undefined;

  return (
    <div
      className={styles.overlay}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitleWrap}>
            {isDestructive && (
              <div className={styles.warningIconWrap}>
                <AlertTriangle size={18} />
              </div>
            )}
            <h3 id="confirm-dialog-title" className={styles.title}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(hasInput ? inputValue : undefined);
          }}
        >
          <div className={styles.body}>
            <p className={styles.message}>{message}</p>
            {hasInput && (
              <input
                type="text"
                className={styles.input}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                autoFocus
              />
            )}
          </div>

          <div className={styles.actions}>
            {!hideCancel && (
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onCancel}
              >
                {cancelLabel}
              </button>
            )}
            <button
              type="submit"
              className={isDestructive ? styles.destructiveBtn : styles.confirmBtn}
              autoFocus={!hasInput}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
