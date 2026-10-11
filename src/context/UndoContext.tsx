'use client';

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode, useCallback } from 'react';
import { Undo2, Redo2, X } from 'lucide-react';
import styles from './UndoToast.module.css';

export interface DeletedItemAction {
  type: string;
  title: string;
  restore: () => void;
  redelete: () => void;
}

interface ToastState {
  id: string;
  action: DeletedItemAction;
  actionType: 'deleted' | 'restored' | 'redeleted';
  type: string;
  title: string;
  durationMs: number;
}

/**
 * Global helper to notify the system that an item (Idea, Task, Goal, Project, Dream, Doc)
 * was deleted so the user can undo it with Ctrl+Z or redo it with Ctrl+Y.
 */
export function notifyItemDeleted(action: DeletedItemAction) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('life_os_item_deleted', { detail: action }));
  }
}

interface UndoContextValue {
  registerDeletedItem: (action: DeletedItemAction) => void;
  undoLastDelete: () => void;
  redoLastDelete: () => void;
}

const UndoContext = createContext<UndoContextValue | undefined>(undefined);

const TOAST_DURATION_MS = 6000;

export function UndoProvider({ children }: { children: ReactNode }) {
  const undoStackRef = useRef<DeletedItemAction[]>([]);
  const redoStackRef = useRef<DeletedItemAction[]>([]);
  const [activeToast, setActiveToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toastStartTimeRef = useRef<number>(0);
  const remainingTimeRef = useRef<number>(TOAST_DURATION_MS);

  const startTimer = useCallback((duration: number) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastStartTimeRef.current = Date.now();
    remainingTimeRef.current = duration;
    toastTimerRef.current = setTimeout(() => {
      setActiveToast(null);
    }, duration);
  }, []);

  const pauseTimer = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
      const elapsed = Date.now() - toastStartTimeRef.current;
      remainingTimeRef.current = Math.max(1000, remainingTimeRef.current - elapsed);
    }
  }, []);

  const resumeTimer = useCallback(() => {
    if (!toastTimerRef.current && activeToast) {
      startTimer(remainingTimeRef.current);
    }
  }, [activeToast, startTimer]);

  const showToast = useCallback((action: DeletedItemAction, actionType: 'deleted' | 'restored' | 'redeleted') => {
    const toastState: ToastState = {
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action,
      actionType,
      type: action.type || 'Item',
      title: action.title || 'Untitled',
      durationMs: TOAST_DURATION_MS,
    };
    setActiveToast(toastState);
    startTimer(TOAST_DURATION_MS);
  }, [startTimer]);

  const registerDeletedItem = useCallback((action: DeletedItemAction) => {
    undoStackRef.current.push(action);
    redoStackRef.current = []; // reset redo stack on new delete
    showToast(action, 'deleted');
  }, [showToast]);

  const undoLastDelete = useCallback(() => {
    const last = undoStackRef.current.pop();
    if (!last) return;

    try {
      last.restore();
      redoStackRef.current.push(last);
      showToast(last, 'restored');
    } catch (err) {
      console.error('Failed to undo delete:', err);
    }
  }, [showToast]);

  const redoLastDelete = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;

    try {
      next.redelete();
      undoStackRef.current.push(next);
      showToast(next, 'redeleted');
    } catch (err) {
      console.error('Failed to redo delete:', err);
    }
  }, [showToast]);

  // Listen for custom events dispatched by notifyItemDeleted
  useEffect(() => {
    const handleItemDeletedEvent = (e: Event) => {
      const customEvent = e as CustomEvent<DeletedItemAction>;
      if (customEvent.detail) {
        registerDeletedItem(customEvent.detail);
      }
    };

    window.addEventListener('life_os_item_deleted', handleItemDeletedEvent);
    return () => window.removeEventListener('life_os_item_deleted', handleItemDeletedEvent);
  }, [registerDeletedItem]);

  // Global keyboard shortcut listener for Ctrl+Z and Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;

      // Do not intercept if user is typing inside an input, textarea, or contentEditable element
      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName.toLowerCase();
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          activeEl.getAttribute('contenteditable') === 'true' ||
          activeEl.closest('[contenteditable="true"]')
        ) {
          return;
        }
      }

      if (key === 'z') {
        if (e.shiftKey) {
          if (redoStackRef.current.length > 0) {
            e.preventDefault();
            redoLastDelete();
          }
        } else {
          if (undoStackRef.current.length > 0) {
            e.preventDefault();
            undoLastDelete();
          }
        }
      } else if (key === 'y') {
        if (redoStackRef.current.length > 0) {
          e.preventDefault();
          redoLastDelete();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoLastDelete, redoLastDelete]);

  return (
    <UndoContext.Provider value={{ registerDeletedItem, undoLastDelete, redoLastDelete }}>
      {children}
      {/* Floating System-Wide Minimalist Undo Toast */}
      {activeToast && (
        <aside
          role="status"
          aria-live="polite"
          className={styles.toastContainer}
        >
          <div
            className={styles.toastCard}
            onMouseEnter={pauseTimer}
            onMouseLeave={resumeTimer}
          >
            <div className={styles.toastContent}>
              <span className={styles.typeBadge}>
                {activeToast.type}
              </span>
              <div className={styles.titleText}>
                <span className={styles.actionPrefix}>
                  {activeToast.actionType === 'restored'
                    ? 'Restored'
                    : activeToast.actionType === 'redeleted'
                    ? 'Re-deleted'
                    : 'Deleted'}
                </span>
                <span>&ldquo;{activeToast.title}&rdquo;</span>
              </div>
            </div>

            <div className={styles.actions}>
              {activeToast.actionType === 'restored' ? (
                <button
                  type="button"
                  onClick={redoLastDelete}
                  className={styles.undoBtn}
                  title="Redo delete (Ctrl+Y)"
                >
                  <Redo2 size={13} />
                  <span>Redo</span>
                  <span className={styles.kbd}>Ctrl+Y</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={undoLastDelete}
                  className={styles.undoBtn}
                  title="Undo delete (Ctrl+Z)"
                >
                  <Undo2 size={13} />
                  <span>Undo</span>
                  <span className={styles.kbd}>Ctrl+Z</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveToast(null)}
                className={styles.closeBtn}
                title="Dismiss"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>

            {/* Subtle animated countdown loading bar */}
            <div className={styles.progressBarTrack} aria-hidden="true">
              <div
                key={activeToast.id}
                className={styles.progressBarFill}
                style={{ animationDuration: `${activeToast.durationMs}ms` }}
              />
            </div>
          </div>
        </aside>
      )}
    </UndoContext.Provider>
  );
}

export function useSystemUndo() {
  const ctx = useContext(UndoContext);
  return ctx;
}
